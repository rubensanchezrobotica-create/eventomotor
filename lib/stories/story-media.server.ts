import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  createSupabaseServerClient,
  type Database,
  type StoryMediaInsert,
  type StoryMediaRow,
  type StoryMediaUpdate,
  type StoryRow,
} from "@/lib/supabase";
import { collectStoryMediaIds, validateStoryPublication } from "./story-validation";
import {
  STORY_MEDIA_ALLOWED_MIME_TYPES,
  STORY_MEDIA_DRAFT_BUCKET,
  STORY_MEDIA_MAX_PIXEL_COUNT,
  STORY_MEDIA_MAX_UPLOAD_BYTES,
  STORY_MEDIA_PREVIEW_TTL_SECONDS,
  STORY_MEDIA_PUBLIC_BUCKET,
  STORY_MEDIA_PUBLIC_MAX_LONG_EDGE,
  StoryMediaValidationError,
  assertStoryMediaByteSize,
  assertStoryMediaDimensions,
  assertStoryMediaMimeType,
  assertStoryMediaObjectPath,
  assertStoryMediaSignature,
  assertStoryMediaUuid,
  buildStoryMediaObjectPath,
  isStoryMediaMimeType,
  storyMediaMimeTypeForExtension,
  type StoryMediaMimeType,
} from "./story-media-validation";

export type StoryMediaServiceErrorCode =
  | "SUPABASE_NOT_CONFIGURED"
  | "STORY_NOT_FOUND"
  | "STORY_NOT_EDITABLE"
  | "MEDIA_NOT_FOUND"
  | "MEDIA_OWNERSHIP_MISMATCH"
  | "MEDIA_STATE_CONFLICT"
  | "BUCKET_MISCONFIGURED"
  | "STORAGE_OPERATION_FAILED"
  | "DATABASE_OPERATION_FAILED"
  | "PUBLIC_ASSET_CONFLICT"
  | "PUBLIC_DELIVERY_FAILED"
  | "PROMOTION_UPDATE_FAILED";

export type StoryMediaCleanupStatus = "COMPLETED" | "PENDING" | "NOT_REQUIRED";

export class StoryMediaServiceError extends Error {
  readonly code: StoryMediaServiceErrorCode;
  readonly cleanupStatus?: StoryMediaCleanupStatus;

  constructor(
    code: StoryMediaServiceErrorCode,
    message: string,
    cleanupStatus?: StoryMediaCleanupStatus,
  ) {
    super(message);
    this.name = "StoryMediaServiceError";
    this.code = code;
    this.cleanupStatus = cleanupStatus;
  }
}

type StorageBucketConfig = {
  id: string;
  public: boolean;
  fileSizeLimit: number | null;
  allowedMimeTypes: readonly string[] | null;
};

type StorageUploadResult = { path: string };

export type StoryMediaRepository = {
  getStory(storyId: string): Promise<StoryRow | null>;
  getMedia(mediaId: string): Promise<StoryMediaRow | null>;
  listStoryMedia(storyId: string): Promise<StoryMediaRow[]>;
  insertMedia(row: StoryMediaInsert): Promise<StoryMediaRow>;
  updateMediaForPromotion(input: {
    mediaId: string;
    storyId: string;
    expectedBucketId: string;
    expectedObjectPath: string;
    update: StoryMediaUpdate;
  }): Promise<StoryMediaRow | null>;
};

export type StoryMediaStorage = {
  getBucket(bucketId: string): Promise<StorageBucketConfig | null>;
  createSignedUploadUrl(bucketId: string, objectPath: string): Promise<{ token: string }>;
  createSignedUrl(bucketId: string, objectPath: string, expiresIn: number): Promise<{ signedUrl: string }>;
  download(bucketId: string, objectPath: string): Promise<Uint8Array>;
  upload(
    bucketId: string,
    objectPath: string,
    bytes: Uint8Array,
    options: { contentType: StoryMediaMimeType; upsert: false },
  ): Promise<StorageUploadResult>;
  remove(bucketId: string, objectPath: string): Promise<void>;
  getPublicUrl(bucketId: string, objectPath: string): string;
  verifyPublicDelivery(
    bucketId: string,
    objectPath: string,
    expectedMimeType: StoryMediaMimeType,
  ): Promise<{ publicUrl: string; contentType: string }>;
};

export type StoryMediaServiceDependencies = {
  repository: StoryMediaRepository;
  storage: StoryMediaStorage;
  createId?: () => string;
};

export type StoryMediaInspection = {
  mimeType: StoryMediaMimeType;
  width: number;
  height: number;
  byteSize: number;
};

export type StoryMediaReadinessIssue = {
  code:
    | "MEDIA_NOT_PUBLIC"
    | "PUBLIC_BUCKET_MISCONFIGURED"
    | "PUBLIC_OBJECT_UNAVAILABLE"
    | "PUBLIC_MEDIA_STATE_INVALID"
    | "PUBLIC_DELIVERY_UNAVAILABLE";
  mediaId: string;
};

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isEditableStory(story: StoryRow) {
  return story.status === "DRAFT" || story.status === "READY";
}

function assertEditableStory(story: StoryRow | null) {
  if (!story) {
    throw new StoryMediaServiceError("STORY_NOT_FOUND", "Story does not exist.");
  }
  if (!isEditableStory(story)) {
    throw new StoryMediaServiceError(
      "STORY_NOT_EDITABLE",
      "Story media can only change while the story is DRAFT or READY.",
    );
  }
  return story;
}

function sorted(values: readonly string[]) {
  return [...values].sort();
}

function assertBucketConfig(bucket: StorageBucketConfig | null, expectedPublic: boolean) {
  if (
    !bucket ||
    bucket.public !== expectedPublic ||
    bucket.fileSizeLimit !== STORY_MEDIA_MAX_UPLOAD_BYTES ||
    JSON.stringify(sorted(bucket.allowedMimeTypes ?? [])) !==
      JSON.stringify(sorted(STORY_MEDIA_ALLOWED_MIME_TYPES))
  ) {
    throw new StoryMediaServiceError(
      "BUCKET_MISCONFIGURED",
      "Story media Storage bucket does not match the approved contract.",
    );
  }
}

function assertCanonicalPublicObjectPath(objectPath: string) {
  const parts = objectPath.split("/");
  const match = parts[2]?.match(/^asset\.(jpg|png|webp)$/);
  const mimeType = match ? storyMediaMimeTypeForExtension(match[1]) : null;
  if (parts.length !== 3 || !mimeType) {
    throw new StoryMediaValidationError(
      "INVALID_OBJECT_PATH",
      "Story media public path is not canonical.",
    );
  }
  assertStoryMediaObjectPath(objectPath, {
    storyId: parts[0],
    mediaId: parts[1],
    mimeType,
  });
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function buildCanonicalStoryMediaPublicUrl(
  supabaseUrl: string,
  objectPath: string,
) {
  assertCanonicalPublicObjectPath(objectPath);
  let origin: URL;
  try {
    origin = new URL(supabaseUrl);
  } catch {
    throw new StoryMediaServiceError(
      "PUBLIC_DELIVERY_FAILED",
      "Supabase public origin is invalid.",
    );
  }
  const secureScheme = origin.protocol === "https:";
  const localDevelopmentScheme = origin.protocol === "http:" && isLoopbackHostname(origin.hostname);
  if (
    (!secureScheme && !localDevelopmentScheme) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new StoryMediaServiceError(
      "PUBLIC_DELIVERY_FAILED",
      "Supabase public origin does not match the approved URL contract.",
    );
  }
  const encodedObjectPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const expectedPath = `/storage/v1/object/public/${STORY_MEDIA_PUBLIC_BUCKET}/${encodedObjectPath}`;
  const publicUrl = new URL(expectedPath, `${origin.origin}/`);
  if (
    publicUrl.origin !== origin.origin ||
    publicUrl.pathname !== expectedPath ||
    publicUrl.search ||
    publicUrl.hash
  ) {
    throw new StoryMediaServiceError(
      "PUBLIC_DELIVERY_FAILED",
      "Story media public URL failed canonical validation.",
    );
  }
  return publicUrl.href;
}

export async function inspectStoryMediaImage(
  bytes: Uint8Array,
  expectedMimeType: StoryMediaMimeType,
): Promise<StoryMediaInspection> {
  assertStoryMediaByteSize(bytes.byteLength);
  assertStoryMediaSignature(bytes, expectedMimeType);

  try {
    if (expectedMimeType === "image/webp") {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const declaredLength = view.getUint32(4, true) + 8;
      if (declaredLength !== bytes.byteLength) {
        throw new StoryMediaValidationError(
          "INVALID_IMAGE_BYTES",
          "WebP container length does not match its bytes.",
        );
      }
    }
    const metadata = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: STORY_MEDIA_MAX_PIXEL_COUNT,
    }).metadata();
    if (!metadata.width || !metadata.height) {
      throw new StoryMediaValidationError(
        "INVALID_DIMENSIONS",
        "Decoded image did not expose dimensions.",
      );
    }
    assertStoryMediaDimensions(metadata.width, metadata.height);
    const decodedMimeType =
      metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "png"
          ? "image/png"
          : metadata.format === "webp"
            ? "image/webp"
            : null;
    if (decodedMimeType !== expectedMimeType) {
      throw new StoryMediaValidationError(
        "SIGNATURE_MISMATCH",
        "Decoded format does not match the declared MIME type.",
      );
    }
    // stats() drives libvips through the complete pixel stream without
    // materializing an uncompressed bitmap in JavaScript memory.
    await sharp(bytes, {
      failOn: "error",
      limitInputPixels: STORY_MEDIA_MAX_PIXEL_COUNT,
    }).stats();
    return {
      mimeType: expectedMimeType,
      width: metadata.width,
      height: metadata.height,
      byteSize: bytes.byteLength,
    };
  } catch (error) {
    if (error instanceof StoryMediaValidationError) throw error;
    throw new StoryMediaValidationError(
      "INVALID_IMAGE_BYTES",
      "Story media cannot be fully decoded safely.",
    );
  }
}

export async function sanitizeStoryMediaImage(
  bytes: Uint8Array,
  mimeType: StoryMediaMimeType,
) {
  await inspectStoryMediaImage(bytes, mimeType);

  let pipeline = sharp(bytes, {
    failOn: "error",
    limitInputPixels: STORY_MEDIA_MAX_PIXEL_COUNT,
  })
    .rotate()
    .resize({
      width: STORY_MEDIA_PUBLIC_MAX_LONG_EDGE,
      height: STORY_MEDIA_PUBLIC_MAX_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toColourspace("srgb");

  if (mimeType === "image/jpeg") {
    pipeline = pipeline.jpeg({ quality: 90, progressive: false });
  } else if (mimeType === "image/png") {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.webp({ quality: 90 });
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const sanitized = new Uint8Array(data);
  assertStoryMediaSignature(sanitized, mimeType);
  assertStoryMediaByteSize(sanitized.byteLength);
  assertStoryMediaDimensions(info.width, info.height);
  if (Math.max(info.width, info.height) > STORY_MEDIA_PUBLIC_MAX_LONG_EDGE) {
    throw new StoryMediaValidationError(
      "DIMENSIONS_TOO_LARGE",
      "Sanitized story media exceeds the public long-edge limit.",
    );
  }
  return {
    bytes: sanitized,
    inspection: {
      mimeType,
      width: info.width,
      height: info.height,
      byteSize: sanitized.byteLength,
    } satisfies StoryMediaInspection,
  };
}

function assertMediaOwnership(media: StoryMediaRow | null, storyId: string, mediaId: string) {
  if (!media) {
    throw new StoryMediaServiceError("MEDIA_NOT_FOUND", "Story media does not exist.");
  }
  if (media.id !== mediaId || media.story_id !== storyId) {
    throw new StoryMediaServiceError(
      "MEDIA_OWNERSHIP_MISMATCH",
      "Story media does not belong to the requested story.",
    );
  }
  return media;
}

function mediaMatchesInspection(
  media: StoryMediaRow,
  input: {
    storyId: string;
    mediaId: string;
    bucketId: string;
    objectPath: string;
    inspection: StoryMediaInspection;
  },
) {
  return (
    media.id === input.mediaId &&
    media.story_id === input.storyId &&
    media.bucket_id === input.bucketId &&
    media.object_path === input.objectPath &&
    media.mime_type === input.inspection.mimeType &&
    media.width === input.inspection.width &&
    media.height === input.inspection.height &&
    media.byte_size === input.inspection.byteSize
  );
}

function mapStoryForPublication(story: StoryRow) {
  return {
    id: story.id,
    slug: story.slug,
    status: story.status,
    type: story.type,
    collection: story.collection,
    title: story.title,
    dek: story.dek,
    contextLocation: story.context_location,
    contentBlocks: story.content_blocks,
    schemaVersion: story.schema_version,
    heroMediaId: story.hero_media_id ?? "",
    seoTitle: story.seo_title,
    seoDescription: story.seo_description,
    disciplineSlugs: story.discipline_slugs,
    territoryIds: story.territory_ids,
    publishedAt: story.published_at,
    updatedAt: story.updated_at,
    homeRank: story.home_rank,
  };
}

export function createStoryMediaService(dependencies: StoryMediaServiceDependencies) {
  const createId = dependencies.createId ?? randomUUID;

  return {
    async createUploadIntent(input: {
      storyId: string;
      mimeType: StoryMediaMimeType;
      byteSize: number;
    }) {
      assertStoryMediaUuid(input.storyId, "storyId");
      assertStoryMediaMimeType(input.mimeType);
      assertStoryMediaByteSize(input.byteSize);
      assertEditableStory(await dependencies.repository.getStory(input.storyId));
      assertBucketConfig(
        await dependencies.storage.getBucket(STORY_MEDIA_DRAFT_BUCKET),
        false,
      );

      const mediaId = createId();
      assertStoryMediaUuid(mediaId, "mediaId");
      const objectPath = buildStoryMediaObjectPath({
        storyId: input.storyId,
        mediaId,
        mimeType: input.mimeType,
      });
      const signed = await dependencies.storage.createSignedUploadUrl(
        STORY_MEDIA_DRAFT_BUCKET,
        objectPath,
      );
      return {
        mediaId,
        bucketId: STORY_MEDIA_DRAFT_BUCKET,
        objectPath,
        signedToken: signed.token,
        expectedMimeType: input.mimeType,
        maxUploadBytes: STORY_MEDIA_MAX_UPLOAD_BYTES,
      };
    },

    async finalizeUpload(input: {
      storyId: string;
      mediaId: string;
      mimeType: StoryMediaMimeType;
      byteSize: number;
    }) {
      assertStoryMediaUuid(input.storyId, "storyId");
      assertStoryMediaUuid(input.mediaId, "mediaId");
      assertStoryMediaMimeType(input.mimeType);
      assertStoryMediaByteSize(input.byteSize);
      assertEditableStory(await dependencies.repository.getStory(input.storyId));
      assertBucketConfig(
        await dependencies.storage.getBucket(STORY_MEDIA_DRAFT_BUCKET),
        false,
      );

      const objectPath = buildStoryMediaObjectPath(input);
      const bytes = await dependencies.storage.download(STORY_MEDIA_DRAFT_BUCKET, objectPath);
      if (bytes.byteLength !== input.byteSize) {
        throw new StoryMediaValidationError(
          "INVALID_BYTE_SIZE",
          "Downloaded story media size does not match the finalized size.",
        );
      }
      const inspection = await inspectStoryMediaImage(bytes, input.mimeType);
      const exactState = {
        storyId: input.storyId,
        mediaId: input.mediaId,
        bucketId: STORY_MEDIA_DRAFT_BUCKET,
        objectPath,
        inspection,
      };
      const existing = await dependencies.repository.getMedia(input.mediaId);
      if (existing) {
        if (!mediaMatchesInspection(existing, exactState)) {
          throw new StoryMediaServiceError(
            "MEDIA_STATE_CONFLICT",
            "Finalize retry conflicts with the existing media row.",
          );
        }
        return { media: existing, created: false };
      }

      const insert: StoryMediaInsert = {
        id: input.mediaId,
        story_id: input.storyId,
        bucket_id: STORY_MEDIA_DRAFT_BUCKET,
        object_path: objectPath,
        width: inspection.width,
        height: inspection.height,
        mime_type: inspection.mimeType,
        byte_size: inspection.byteSize,
        alt_text: "",
        rights_type: "UNKNOWN",
      };

      try {
        const media = await dependencies.repository.insertMedia(insert);
        return { media, created: true };
      } catch (error) {
        const raced = await dependencies.repository.getMedia(input.mediaId);
        if (raced && mediaMatchesInspection(raced, exactState)) {
          return { media: raced, created: false };
        }
        if (error instanceof StoryMediaServiceError) throw error;
        throw new StoryMediaServiceError(
          "DATABASE_OPERATION_FAILED",
          "Story media finalize failed closed.",
        );
      }
    },

    async createPreviewUrl(input: {
      storyId: string;
      mediaId: string;
    }) {
      assertStoryMediaUuid(input.storyId, "storyId");
      assertStoryMediaUuid(input.mediaId, "mediaId");
      const media = assertMediaOwnership(
        await dependencies.repository.getMedia(input.mediaId),
        input.storyId,
        input.mediaId,
      );
      if (!isStoryMediaMimeType(media.mime_type) || media.bucket_id !== STORY_MEDIA_DRAFT_BUCKET) {
        throw new StoryMediaServiceError(
          "MEDIA_STATE_CONFLICT",
          "Only private draft media receives signed preview URLs.",
        );
      }
      assertStoryMediaObjectPath(media.object_path, {
        storyId: input.storyId,
        mediaId: input.mediaId,
        mimeType: media.mime_type,
      });
      assertBucketConfig(
        await dependencies.storage.getBucket(STORY_MEDIA_DRAFT_BUCKET),
        false,
      );
      return dependencies.storage.createSignedUrl(
        STORY_MEDIA_DRAFT_BUCKET,
        media.object_path,
        STORY_MEDIA_PREVIEW_TTL_SECONDS,
      );
    },

    async promote(input: { storyId: string; mediaId: string }) {
      assertStoryMediaUuid(input.storyId, "storyId");
      assertStoryMediaUuid(input.mediaId, "mediaId");
      assertEditableStory(await dependencies.repository.getStory(input.storyId));
      const media = assertMediaOwnership(
        await dependencies.repository.getMedia(input.mediaId),
        input.storyId,
        input.mediaId,
      );
      if (!isStoryMediaMimeType(media.mime_type)) {
        throw new StoryMediaServiceError("MEDIA_STATE_CONFLICT", "Media MIME type is not promotable.");
      }

      const expectedPath = buildStoryMediaObjectPath({
        storyId: input.storyId,
        mediaId: input.mediaId,
        mimeType: media.mime_type,
      });
      assertStoryMediaObjectPath(media.object_path, {
        storyId: input.storyId,
        mediaId: input.mediaId,
        mimeType: media.mime_type,
      });
      assertBucketConfig(
        await dependencies.storage.getBucket(STORY_MEDIA_PUBLIC_BUCKET),
        true,
      );

      if (media.bucket_id === STORY_MEDIA_PUBLIC_BUCKET) {
        const publicBytes = await dependencies.storage.download(
          STORY_MEDIA_PUBLIC_BUCKET,
          expectedPath,
        );
        const inspection = await inspectStoryMediaImage(publicBytes, media.mime_type);
        if (
          !mediaMatchesInspection(media, {
            storyId: input.storyId,
            mediaId: input.mediaId,
            bucketId: STORY_MEDIA_PUBLIC_BUCKET,
            objectPath: expectedPath,
            inspection,
          })
        ) {
          throw new StoryMediaServiceError(
            "MEDIA_STATE_CONFLICT",
            "Public media row does not match its stored asset.",
          );
        }
        return {
          media,
          promoted: false,
          publicUrl: dependencies.storage.getPublicUrl(STORY_MEDIA_PUBLIC_BUCKET, expectedPath),
        };
      }
      if (media.bucket_id !== STORY_MEDIA_DRAFT_BUCKET) {
        throw new StoryMediaServiceError("MEDIA_STATE_CONFLICT", "Media is in an unknown bucket.");
      }

      assertBucketConfig(
        await dependencies.storage.getBucket(STORY_MEDIA_DRAFT_BUCKET),
        false,
      );
      const original = await dependencies.storage.download(
        STORY_MEDIA_DRAFT_BUCKET,
        media.object_path,
      );
      const originalInspection = await inspectStoryMediaImage(original, media.mime_type);
      if (
        originalInspection.byteSize !== media.byte_size ||
        originalInspection.width !== media.width ||
        originalInspection.height !== media.height
      ) {
        throw new StoryMediaServiceError(
          "MEDIA_STATE_CONFLICT",
          "Private original no longer matches its finalized row.",
        );
      }
      const sanitized = await sanitizeStoryMediaImage(original, media.mime_type);
      let uploadedByThisAttempt = false;

      try {
        await dependencies.storage.upload(
          STORY_MEDIA_PUBLIC_BUCKET,
          expectedPath,
          sanitized.bytes,
          { contentType: media.mime_type, upsert: false },
        );
        uploadedByThisAttempt = true;
      } catch {
        let existingPublic: Uint8Array;
        try {
          existingPublic = await dependencies.storage.download(
            STORY_MEDIA_PUBLIC_BUCKET,
            expectedPath,
          );
        } catch {
          throw new StoryMediaServiceError(
            "STORAGE_OPERATION_FAILED",
            "Public story media upload failed.",
          );
        }
        if (sha256(existingPublic) !== sha256(sanitized.bytes)) {
          throw new StoryMediaServiceError(
            "PUBLIC_ASSET_CONFLICT",
            "Existing public asset differs from the sanitized derivative.",
          );
        }
      }

      const verified = await dependencies.storage.download(
        STORY_MEDIA_PUBLIC_BUCKET,
        expectedPath,
      );
      if (sha256(verified) !== sha256(sanitized.bytes)) {
        throw new StoryMediaServiceError(
          "PUBLIC_ASSET_CONFLICT",
          "Uploaded public asset failed byte verification.",
        );
      }
      await inspectStoryMediaImage(verified, media.mime_type);

      const exactPublicState = {
        storyId: input.storyId,
        mediaId: input.mediaId,
        bucketId: STORY_MEDIA_PUBLIC_BUCKET,
        objectPath: expectedPath,
        inspection: sanitized.inspection,
      };

      const resolvePromotionUpdateFailure = async (message: string) => {
        let raced: StoryMediaRow | null = null;
        try {
          raced = await dependencies.repository.getMedia(input.mediaId);
        } catch {
          // An uncertain database outcome must never delete an object that a
          // concurrent successful transaction may already have adopted.
          throw new StoryMediaServiceError(
            "PROMOTION_UPDATE_FAILED",
            message,
            uploadedByThisAttempt ? "PENDING" : "NOT_REQUIRED",
          );
        }
        if (raced && mediaMatchesInspection(raced, exactPublicState)) {
          return {
            media: raced,
            promoted: false,
            publicUrl: dependencies.storage.getPublicUrl(
              STORY_MEDIA_PUBLIC_BUCKET,
              expectedPath,
            ),
          };
        }

        let cleanupStatus: StoryMediaCleanupStatus = "NOT_REQUIRED";
        if (uploadedByThisAttempt) {
          try {
            await dependencies.storage.remove(STORY_MEDIA_PUBLIC_BUCKET, expectedPath);
            cleanupStatus = "COMPLETED";
          } catch {
            cleanupStatus = "PENDING";
          }
        }
        throw new StoryMediaServiceError(
          "PROMOTION_UPDATE_FAILED",
          message,
          cleanupStatus,
        );
      };

      let updated: StoryMediaRow | null;
      try {
        updated = await dependencies.repository.updateMediaForPromotion({
          mediaId: input.mediaId,
          storyId: input.storyId,
          expectedBucketId: STORY_MEDIA_DRAFT_BUCKET,
          expectedObjectPath: media.object_path,
          update: {
            bucket_id: STORY_MEDIA_PUBLIC_BUCKET,
            object_path: expectedPath,
            width: sanitized.inspection.width,
            height: sanitized.inspection.height,
            mime_type: sanitized.inspection.mimeType,
            byte_size: sanitized.inspection.byteSize,
          },
        });
      } catch {
        return resolvePromotionUpdateFailure(
          "Promotion database update failed after the public upload.",
        );
      }
      if (!updated) {
        return resolvePromotionUpdateFailure("Promotion lost optimistic revalidation.");
      }

      return {
        media: updated,
        promoted: true,
        publicUrl: dependencies.storage.getPublicUrl(STORY_MEDIA_PUBLIC_BUCKET, expectedPath),
      };
    },

    async publicationReadiness(storyId: string) {
      assertStoryMediaUuid(storyId, "storyId");
      const story = await dependencies.repository.getStory(storyId);
      if (!story) {
        throw new StoryMediaServiceError("STORY_NOT_FOUND", "Story does not exist.");
      }
      const media = await dependencies.repository.listStoryMedia(storyId);
      const publication = validateStoryPublication(mapStoryForPublication(story), {
        media: media.map((item) => ({
          id: item.id,
          altText: item.alt_text,
          rightsType: item.rights_type,
        })),
      });
      const requiredMediaIds = new Set([
        ...(story.hero_media_id ? [story.hero_media_id] : []),
        ...collectStoryMediaIds(story.content_blocks),
      ]);
      const mediaById = new Map(media.map((item) => [item.id, item]));
      const storageIssues: StoryMediaReadinessIssue[] = [];
      let publicBucketReady = true;
      try {
        assertBucketConfig(
          await dependencies.storage.getBucket(STORY_MEDIA_PUBLIC_BUCKET),
          true,
        );
      } catch {
        publicBucketReady = false;
      }

      for (const mediaId of requiredMediaIds) {
        const item = mediaById.get(mediaId);
        if (!item || item.bucket_id !== STORY_MEDIA_PUBLIC_BUCKET) {
          storageIssues.push({ code: "MEDIA_NOT_PUBLIC", mediaId });
          continue;
        }
        if (!isStoryMediaMimeType(item.mime_type)) {
          storageIssues.push({ code: "PUBLIC_MEDIA_STATE_INVALID", mediaId });
          continue;
        }
        if (!publicBucketReady) {
          storageIssues.push({ code: "PUBLIC_BUCKET_MISCONFIGURED", mediaId });
          continue;
        }
        try {
          assertStoryMediaObjectPath(item.object_path, {
            storyId,
            mediaId,
            mimeType: item.mime_type,
          });
          const bytes = await dependencies.storage.download(
            STORY_MEDIA_PUBLIC_BUCKET,
            item.object_path,
          );
          const inspection = await inspectStoryMediaImage(bytes, item.mime_type);
          if (
            inspection.width !== item.width ||
            inspection.height !== item.height ||
            inspection.byteSize !== item.byte_size ||
            Math.max(inspection.width, inspection.height) > STORY_MEDIA_PUBLIC_MAX_LONG_EDGE
          ) {
            storageIssues.push({ code: "PUBLIC_MEDIA_STATE_INVALID", mediaId });
            continue;
          }
        } catch {
          storageIssues.push({ code: "PUBLIC_OBJECT_UNAVAILABLE", mediaId });
          continue;
        }
        try {
          const delivery = await dependencies.storage.verifyPublicDelivery(
            STORY_MEDIA_PUBLIC_BUCKET,
            item.object_path,
            item.mime_type,
          );
          if (delivery.contentType !== item.mime_type) {
            storageIssues.push({ code: "PUBLIC_DELIVERY_UNAVAILABLE", mediaId });
          }
        } catch {
          storageIssues.push({ code: "PUBLIC_DELIVERY_UNAVAILABLE", mediaId });
        }
      }

      return {
        ready: publication.ok && storageIssues.length === 0,
        publicationErrors: publication.errors,
        storageIssues,
      };
    },
  };
}

function createSupabaseDependencies(
  client: SupabaseClient<Database>,
  supabaseUrl: string,
): StoryMediaServiceDependencies {
  const repository: StoryMediaRepository = {
    async getStory(storyId) {
      const { data, error } = await client
        .from("stories")
        .select("*")
        .eq("id", storyId)
        .maybeSingle();
      if (error) {
        throw new StoryMediaServiceError(
          "DATABASE_OPERATION_FAILED",
          "Could not read story state.",
        );
      }
      return data;
    },
    async getMedia(mediaId) {
      const { data, error } = await client
        .from("story_media")
        .select("*")
        .eq("id", mediaId)
        .maybeSingle();
      if (error) {
        throw new StoryMediaServiceError(
          "DATABASE_OPERATION_FAILED",
          "Could not read story media state.",
        );
      }
      return data;
    },
    async listStoryMedia(storyId) {
      const { data, error } = await client
        .from("story_media")
        .select("*")
        .eq("story_id", storyId);
      if (error) {
        throw new StoryMediaServiceError(
          "DATABASE_OPERATION_FAILED",
          "Could not list story media.",
        );
      }
      return data ?? [];
    },
    async insertMedia(row) {
      const { data, error } = await client.from("story_media").insert(row).select("*").single();
      if (error || !data) {
        throw new StoryMediaServiceError(
          "DATABASE_OPERATION_FAILED",
          "Could not insert story media.",
        );
      }
      return data;
    },
    async updateMediaForPromotion(input) {
      const { data, error } = await client
        .from("story_media")
        .update(input.update)
        .eq("id", input.mediaId)
        .eq("story_id", input.storyId)
        .eq("bucket_id", input.expectedBucketId)
        .eq("object_path", input.expectedObjectPath)
        .select("*")
        .maybeSingle();
      if (error) {
        throw new StoryMediaServiceError(
          "DATABASE_OPERATION_FAILED",
          "Could not promote story media row.",
        );
      }
      return data;
    },
  };

  const getCanonicalPublicUrl = (bucketId: string, objectPath: string) => {
    if (bucketId !== STORY_MEDIA_PUBLIC_BUCKET) {
      throw new StoryMediaServiceError(
        "PUBLIC_DELIVERY_FAILED",
        "Only the fixed public story media bucket may expose a public URL.",
      );
    }
    const canonical = buildCanonicalStoryMediaPublicUrl(supabaseUrl, objectPath);
    const generated = client.storage.from(bucketId).getPublicUrl(objectPath).data.publicUrl;
    let generatedUrl: URL;
    try {
      generatedUrl = new URL(generated);
    } catch {
      throw new StoryMediaServiceError(
        "PUBLIC_DELIVERY_FAILED",
        "Supabase generated an invalid public story media URL.",
      );
    }
    if (generatedUrl.href !== canonical) {
      throw new StoryMediaServiceError(
        "PUBLIC_DELIVERY_FAILED",
        "Supabase public story media URL differs from the canonical origin and path.",
      );
    }
    return canonical;
  };

  const storage: StoryMediaStorage = {
    async getBucket(bucketId) {
      const { data, error } = await client.storage.getBucket(bucketId);
      if (error || !data) return null;
      return {
        id: data.id,
        public: data.public,
        fileSizeLimit: data.file_size_limit ?? null,
        allowedMimeTypes: data.allowed_mime_types ?? null,
      };
    },
    async createSignedUploadUrl(bucketId, objectPath) {
      const { data, error } = await client.storage
        .from(bucketId)
        .createSignedUploadUrl(objectPath, { upsert: false });
      if (error || !data?.token) {
        throw new StoryMediaServiceError(
          "STORAGE_OPERATION_FAILED",
          "Could not create signed story media upload.",
        );
      }
      return { token: data.token };
    },
    async createSignedUrl(bucketId, objectPath, expiresIn) {
      const { data, error } = await client.storage
        .from(bucketId)
        .createSignedUrl(objectPath, expiresIn);
      if (error || !data?.signedUrl) {
        throw new StoryMediaServiceError(
          "STORAGE_OPERATION_FAILED",
          "Could not create signed story media preview.",
        );
      }
      return { signedUrl: data.signedUrl };
    },
    async download(bucketId, objectPath) {
      const { data, error } = await client.storage.from(bucketId).download(objectPath);
      if (error || !data) {
        throw new StoryMediaServiceError(
          "STORAGE_OPERATION_FAILED",
          "Could not download story media.",
        );
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    async upload(bucketId, objectPath, bytes, options) {
      const { data, error } = await client.storage
        .from(bucketId)
        .upload(objectPath, bytes, options);
      if (error || !data) {
        throw new StoryMediaServiceError(
          "STORAGE_OPERATION_FAILED",
          "Could not upload sanitized story media.",
        );
      }
      return { path: data.path };
    },
    async remove(bucketId, objectPath) {
      const { error } = await client.storage.from(bucketId).remove([objectPath]);
      if (error) {
        throw new StoryMediaServiceError(
          "STORAGE_OPERATION_FAILED",
          "Could not remove orphaned public story media.",
        );
      }
    },
    getPublicUrl(bucketId, objectPath) {
      return getCanonicalPublicUrl(bucketId, objectPath);
    },
    async verifyPublicDelivery(bucketId, objectPath, expectedMimeType) {
      const publicUrl = getCanonicalPublicUrl(bucketId, objectPath);
      let response: Response;
      try {
        response = await fetch(publicUrl, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          redirect: "error",
          cache: "no-store",
        });
      } catch {
        throw new StoryMediaServiceError(
          "PUBLIC_DELIVERY_FAILED",
          "Public story media endpoint could not be reached safely.",
        );
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
      try {
        await response.body?.cancel();
      } catch {
        // Response cancellation is best-effort after the headers are verified.
      }
      if (!response.ok || contentType !== expectedMimeType) {
        throw new StoryMediaServiceError(
          "PUBLIC_DELIVERY_FAILED",
          "Public story media response failed status or Content-Type validation.",
        );
      }
      return { publicUrl, contentType };
    },
  };

  return { repository, storage };
}

export function createSupabaseStoryMediaService(
  client: SupabaseClient<Database> | null = createSupabaseServerClient(),
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!client || !supabaseUrl) {
    throw new StoryMediaServiceError(
      "SUPABASE_NOT_CONFIGURED",
      "Supabase server credentials are not configured.",
    );
  }
  return createStoryMediaService(createSupabaseDependencies(client, supabaseUrl));
}
