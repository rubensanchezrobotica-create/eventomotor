import assert from "node:assert/strict";
import test from "node:test";
import {
  STORY_MEDIA_MAX_HEIGHT,
  STORY_MEDIA_MAX_PIXEL_COUNT,
  STORY_MEDIA_MAX_UPLOAD_BYTES,
  STORY_MEDIA_MAX_WIDTH,
  STORY_MEDIA_PREVIEW_TTL_SECONDS,
  StoryMediaValidationError,
  assertStoryMediaByteSize,
  assertStoryMediaDimensions,
  assertStoryMediaFilename,
  assertStoryMediaMimeType,
  assertStoryMediaObjectPath,
  assertStoryMediaSignature,
  assertStoryMediaUuid,
  buildStoryMediaObjectPath,
  canonicalExtensionForStoryMedia,
  detectStoryMediaMimeType,
} from "./story-media-validation";

const STORY_ID = "11111111-1111-4111-8111-111111111111";
const MEDIA_ID = "22222222-2222-4222-8222-222222222222";

function expectCode(code: StoryMediaValidationError["code"], action: () => unknown) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof StoryMediaValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("accepts canonical UUIDs and rejects path-like identifiers", () => {
  assert.doesNotThrow(() => assertStoryMediaUuid(STORY_ID, "storyId"));
  expectCode("INVALID_UUID", () => assertStoryMediaUuid("../story", "storyId"));
});

test("builds a deterministic ownership path without client filenames", () => {
  assert.equal(
    buildStoryMediaObjectPath({ storyId: STORY_ID, mediaId: MEDIA_ID, mimeType: "image/jpeg" }),
    `${STORY_ID}/${MEDIA_ID}/asset.jpg`,
  );
});

test("uses one canonical extension per allowed MIME type", () => {
  assert.equal(canonicalExtensionForStoryMedia("image/jpeg"), "jpg");
  assert.equal(canonicalExtensionForStoryMedia("image/png"), "png");
  assert.equal(canonicalExtensionForStoryMedia("image/webp"), "webp");
});

test("rejects an object path that does not exactly match story/media ownership", () => {
  expectCode("INVALID_OBJECT_PATH", () =>
    assertStoryMediaObjectPath(`${STORY_ID}/${MEDIA_ID}/original.jpg`, {
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      mimeType: "image/jpeg",
    }),
  );
});

test("accepts exactly the three approved MIME types", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.doesNotThrow(() => assertStoryMediaMimeType(mimeType));
  }
  expectCode("UNSUPPORTED_MIME_TYPE", () => assertStoryMediaMimeType("image/gif"));
  expectCode("UNSUPPORTED_MIME_TYPE", () => assertStoryMediaMimeType("image/svg+xml"));
});

test("validates client filenames without using them in object paths", () => {
  assert.doesNotThrow(() => assertStoryMediaFilename("foto.JPEG", "image/jpeg"));
  assert.doesNotThrow(() => assertStoryMediaFilename("foto.png", "image/png"));
  assert.doesNotThrow(() => assertStoryMediaFilename("foto.webp", "image/webp"));
  expectCode("INVALID_FILENAME", () => assertStoryMediaFilename("../foto.jpg", "image/jpeg"));
  expectCode("INVALID_FILENAME", () => assertStoryMediaFilename("foto\n.jpg", "image/jpeg"));
  expectCode("INVALID_EXTENSION", () => assertStoryMediaFilename("foto.png", "image/jpeg"));
  expectCode("INVALID_EXTENSION", () => assertStoryMediaFilename("foto.svg", "image/png"));
});

test("enforces a positive byte size capped at 25 MiB", () => {
  assert.doesNotThrow(() => assertStoryMediaByteSize(STORY_MEDIA_MAX_UPLOAD_BYTES));
  expectCode("INVALID_BYTE_SIZE", () => assertStoryMediaByteSize(0));
  expectCode("INVALID_BYTE_SIZE", () => assertStoryMediaByteSize(1.5));
  expectCode("FILE_TOO_LARGE", () => assertStoryMediaByteSize(STORY_MEDIA_MAX_UPLOAD_BYTES + 1));
});

test("detects JPEG magic bytes", () => {
  assert.equal(detectStoryMediaMimeType(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
});

test("detects PNG magic bytes", () => {
  assert.equal(
    detectStoryMediaMimeType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    "image/png",
  );
});

test("detects WebP magic bytes", () => {
  assert.equal(
    detectStoryMediaMimeType(
      Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
    ),
    "image/webp",
  );
});

test("rejects unknown and mismatched magic bytes", () => {
  expectCode("SIGNATURE_MISMATCH", () => detectStoryMediaMimeType(Uint8Array.of(1, 2, 3, 4)));
  expectCode("SIGNATURE_MISMATCH", () =>
    assertStoryMediaSignature(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0), "image/png"),
  );
  expectCode("SIGNATURE_MISMATCH", () =>
    assertStoryMediaSignature(Uint8Array.of(0x4d, 0x5a, 0x90, 0x00), "image/jpeg"),
  );
});

test("accepts approved dimensions at their independent limits", () => {
  assert.doesNotThrow(() => assertStoryMediaDimensions(STORY_MEDIA_MAX_WIDTH, 1));
  assert.doesNotThrow(() => assertStoryMediaDimensions(1, STORY_MEDIA_MAX_HEIGHT));
});

test("rejects invalid and oversized dimensions", () => {
  expectCode("INVALID_DIMENSIONS", () => assertStoryMediaDimensions(0, 100));
  expectCode("DIMENSIONS_TOO_LARGE", () => assertStoryMediaDimensions(STORY_MEDIA_MAX_WIDTH + 1, 1));
  expectCode("DIMENSIONS_TOO_LARGE", () => assertStoryMediaDimensions(1, STORY_MEDIA_MAX_HEIGHT + 1));
});

test("enforces the independent decoded-pixel cap", () => {
  const edge = Math.floor(Math.sqrt(STORY_MEDIA_MAX_PIXEL_COUNT));
  assert.doesNotThrow(() => assertStoryMediaDimensions(edge, edge));
  expectCode("PIXEL_COUNT_TOO_LARGE", () => assertStoryMediaDimensions(10_000, 10_000));
});

test("fixes signed preview lifetime at exactly five minutes", () => {
  assert.equal(STORY_MEDIA_PREVIEW_TTL_SECONDS, 300);
});
