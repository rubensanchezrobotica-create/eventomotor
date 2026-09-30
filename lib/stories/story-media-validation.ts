export const STORY_MEDIA_DRAFT_BUCKET = "story-media-drafts" as const;
export const STORY_MEDIA_PUBLIC_BUCKET = "story-media" as const;

export const STORY_MEDIA_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type StoryMediaMimeType = (typeof STORY_MEDIA_ALLOWED_MIME_TYPES)[number];

export const STORY_MEDIA_MAX_UPLOAD_BYTES = 26_214_400;
export const STORY_MEDIA_MAX_WIDTH = 15_000;
export const STORY_MEDIA_MAX_HEIGHT = 15_000;
export const STORY_MEDIA_MAX_PIXEL_COUNT = 80_000_000;
export const STORY_MEDIA_PUBLIC_MAX_LONG_EDGE = 3_200;
export const STORY_MEDIA_PREVIEW_TTL_SECONDS = 300;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CANONICAL_EXTENSIONS: Record<StoryMediaMimeType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type StoryMediaValidationErrorCode =
  | "INVALID_UUID"
  | "UNSUPPORTED_MIME_TYPE"
  | "INVALID_BYTE_SIZE"
  | "FILE_TOO_LARGE"
  | "SIGNATURE_MISMATCH"
  | "INVALID_IMAGE_BYTES"
  | "INVALID_DIMENSIONS"
  | "DIMENSIONS_TOO_LARGE"
  | "PIXEL_COUNT_TOO_LARGE"
  | "INVALID_OBJECT_PATH";

export class StoryMediaValidationError extends Error {
  readonly code: StoryMediaValidationErrorCode;

  constructor(code: StoryMediaValidationErrorCode, message: string) {
    super(message);
    this.name = "StoryMediaValidationError";
    this.code = code;
  }
}

export function assertStoryMediaUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new StoryMediaValidationError("INVALID_UUID", `${field} must be a canonical UUID.`);
  }
}

export function isStoryMediaMimeType(value: unknown): value is StoryMediaMimeType {
  return STORY_MEDIA_ALLOWED_MIME_TYPES.includes(value as StoryMediaMimeType);
}

export function assertStoryMediaMimeType(value: unknown): asserts value is StoryMediaMimeType {
  if (!isStoryMediaMimeType(value)) {
    throw new StoryMediaValidationError(
      "UNSUPPORTED_MIME_TYPE",
      "Story media must be JPEG, PNG, or WebP.",
    );
  }
}

export function canonicalExtensionForStoryMedia(mimeType: StoryMediaMimeType) {
  return CANONICAL_EXTENSIONS[mimeType];
}

export function storyMediaMimeTypeForExtension(extension: string): StoryMediaMimeType | null {
  if (extension === "jpg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

export function buildStoryMediaObjectPath(input: {
  storyId: string;
  mediaId: string;
  mimeType: StoryMediaMimeType;
}) {
  assertStoryMediaUuid(input.storyId, "storyId");
  assertStoryMediaUuid(input.mediaId, "mediaId");
  assertStoryMediaMimeType(input.mimeType);
  return `${input.storyId}/${input.mediaId}/asset.${canonicalExtensionForStoryMedia(input.mimeType)}`;
}

export function assertStoryMediaObjectPath(
  value: unknown,
  expected: { storyId: string; mediaId: string; mimeType: StoryMediaMimeType },
): asserts value is string {
  const expectedPath = buildStoryMediaObjectPath(expected);
  if (value !== expectedPath) {
    throw new StoryMediaValidationError(
      "INVALID_OBJECT_PATH",
      "Story media path does not match its immutable story/media ownership.",
    );
  }
}

export function assertStoryMediaByteSize(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new StoryMediaValidationError("INVALID_BYTE_SIZE", "Story media size must be positive.");
  }
  if (Number(value) > STORY_MEDIA_MAX_UPLOAD_BYTES) {
    throw new StoryMediaValidationError("FILE_TOO_LARGE", "Story media exceeds 25 MiB.");
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectStoryMediaMimeType(bytes: Uint8Array): StoryMediaMimeType {
  if (bytes.byteLength >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    bytes.byteLength >= 8 &&
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  if (
    bytes.byteLength >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  throw new StoryMediaValidationError(
    "SIGNATURE_MISMATCH",
    "Story media does not have an allowed image signature.",
  );
}

export function assertStoryMediaSignature(
  bytes: Uint8Array,
  expectedMimeType: StoryMediaMimeType,
) {
  const detected = detectStoryMediaMimeType(bytes);
  if (detected !== expectedMimeType) {
    throw new StoryMediaValidationError(
      "SIGNATURE_MISMATCH",
      "Story media signature does not match the declared MIME type.",
    );
  }
  return detected;
}

export function assertStoryMediaDimensions(width: unknown, height: unknown) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || Number(width) <= 0 || Number(height) <= 0) {
    throw new StoryMediaValidationError(
      "INVALID_DIMENSIONS",
      "Story media must expose positive integer dimensions.",
    );
  }
  if (Number(width) > STORY_MEDIA_MAX_WIDTH || Number(height) > STORY_MEDIA_MAX_HEIGHT) {
    throw new StoryMediaValidationError(
      "DIMENSIONS_TOO_LARGE",
      "Story media dimensions exceed the approved limit.",
    );
  }
  if (Number(width) * Number(height) > STORY_MEDIA_MAX_PIXEL_COUNT) {
    throw new StoryMediaValidationError(
      "PIXEL_COUNT_TOO_LARGE",
      "Story media pixel count exceeds the approved limit.",
    );
  }
}
