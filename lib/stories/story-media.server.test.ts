import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import type { StoryMediaInsert, StoryMediaRow, StoryRow } from "@/lib/supabase";
import {
  StoryMediaServiceError,
  buildCanonicalStoryMediaPublicUrl,
  createStoryMediaService,
  inspectStoryMediaImage,
  sanitizeStoryMediaImage,
  type StoryMediaRepository,
  type StoryMediaStorage,
} from "./story-media.server";
import {
  STORY_MEDIA_DRAFT_BUCKET,
  STORY_MEDIA_MAX_UPLOAD_BYTES,
  STORY_MEDIA_PREVIEW_TTL_SECONDS,
  STORY_MEDIA_PUBLIC_BUCKET,
  STORY_MEDIA_PUBLIC_MAX_LONG_EDGE,
  StoryMediaValidationError,
  buildStoryMediaObjectPath,
} from "./story-media-validation";

const STORY_ID = "11111111-1111-4111-8111-111111111111";
const MEDIA_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-09-30T10:00:00.000Z";

function story(status: StoryRow["status"] = "DRAFT"): StoryRow {
  return {
    id: STORY_ID,
    slug: "historia-de-prueba",
    status,
    type: "CRONICA",
    collection: "DESDE_DENTRO",
    title: "Historia de prueba",
    dek: "Una entradilla válida para la historia.",
    context_location: null,
    content_blocks: [
      {
        id: "paragraph-1",
        type: "PARAGRAPH",
        content: [{ type: "TEXT", text: "Contenido editorial." }],
      },
    ],
    schema_version: 1,
    hero_media_id: MEDIA_ID,
    seo_title: "Historia de prueba",
    seo_description: "Descripción SEO de la historia de prueba.",
    discipline_slugs: [],
    territory_ids: [],
    published_at: null,
    home_rank: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function toRow(insert: StoryMediaInsert): StoryMediaRow {
  return {
    id: insert.id,
    story_id: insert.story_id,
    bucket_id: insert.bucket_id,
    object_path: insert.object_path,
    width: insert.width,
    height: insert.height,
    mime_type: insert.mime_type,
    byte_size: insert.byte_size,
    alt_text: insert.alt_text ?? "",
    caption: insert.caption ?? null,
    credit: insert.credit ?? null,
    rights_type: insert.rights_type ?? "UNKNOWN",
    rights_notes: insert.rights_notes ?? null,
    created_at: insert.created_at ?? NOW,
    updated_at: insert.updated_at ?? NOW,
  };
}

function setup(initialStory = story()) {
  const stories = new Map([[STORY_ID, initialStory]]);
  const media = new Map<string, StoryMediaRow>();
  const objects = new Map<string, Uint8Array>();
  let insertCount = 0;
  let uploadCount = 0;
  let removeCount = 0;
  let publicDeliveryCheckCount = 0;

  const repository: StoryMediaRepository = {
    async getStory(storyId) {
      return stories.get(storyId) ?? null;
    },
    async getMedia(mediaId) {
      return media.get(mediaId) ?? null;
    },
    async listStoryMedia(storyId) {
      return [...media.values()].filter((item) => item.story_id === storyId);
    },
    async insertMedia(insert) {
      insertCount += 1;
      if (media.has(insert.id)) throw new Error("duplicate");
      const row = toRow(insert);
      media.set(row.id, row);
      return row;
    },
    async updateMediaForPromotion(input) {
      const current = media.get(input.mediaId);
      if (
        !current ||
        current.story_id !== input.storyId ||
        current.bucket_id !== input.expectedBucketId ||
        current.object_path !== input.expectedObjectPath ||
        (input.expectedUpdatedAt !== undefined && current.updated_at !== input.expectedUpdatedAt)
      ) {
        return null;
      }
      const updated = { ...current, ...input.update } as StoryMediaRow;
      media.set(updated.id, updated);
      return updated;
    },
  };

  const storage: StoryMediaStorage = {
    async getBucket(bucketId) {
      if (bucketId === STORY_MEDIA_DRAFT_BUCKET) {
        return {
          id: bucketId,
          public: false,
          fileSizeLimit: STORY_MEDIA_MAX_UPLOAD_BYTES,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        };
      }
      if (bucketId === STORY_MEDIA_PUBLIC_BUCKET) {
        return {
          id: bucketId,
          public: true,
          fileSizeLimit: STORY_MEDIA_MAX_UPLOAD_BYTES,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        };
      }
      return null;
    },
    async createSignedUploadUrl(_bucketId, objectPath) {
      return { token: `upload:${objectPath}` };
    },
    async createSignedUrl(_bucketId, objectPath, expiresIn) {
      return { signedUrl: `https://signed.test/${objectPath}?expires=${expiresIn}` };
    },
    async download(bucketId, objectPath) {
      const value = objects.get(`${bucketId}:${objectPath}`);
      if (!value) throw new Error("not found");
      return new Uint8Array(value);
    },
    async upload(bucketId, objectPath, bytes, options) {
      assert.equal(options.upsert, false);
      uploadCount += 1;
      const key = `${bucketId}:${objectPath}`;
      if (objects.has(key)) throw new Error("already exists");
      objects.set(key, new Uint8Array(bytes));
      return { path: objectPath };
    },
    async remove(bucketId, objectPath) {
      removeCount += 1;
      if (!objects.delete(`${bucketId}:${objectPath}`)) throw new Error("not found");
    },
    getPublicUrl(bucketId, objectPath) {
      return `https://supabase.test/storage/v1/object/public/${bucketId}/${objectPath}`;
    },
    async verifyPublicDelivery(bucketId, objectPath, expectedMimeType) {
      publicDeliveryCheckCount += 1;
      if (!objects.has(`${bucketId}:${objectPath}`)) throw new Error("not found");
      return {
        publicUrl: `https://supabase.test/storage/v1/object/public/${bucketId}/${objectPath}`,
        contentType: expectedMimeType,
      };
    },
  };

  return {
    service: createStoryMediaService({ repository, storage, createId: () => MEDIA_ID }),
    repository,
    storage,
    stories,
    media,
    objects,
    counts: {
      get inserts() {
        return insertCount;
      },
      get uploads() {
        return uploadCount;
      },
      get removes() {
        return removeCount;
      },
      get publicDeliveryChecks() {
        return publicDeliveryCheckCount;
      },
    },
  };
}

async function jpeg(width = 16, height = 9) {
  return new Uint8Array(
    await sharp({
      create: { width, height, channels: 3, background: { r: 210, g: 60, b: 20 } },
    })
      .jpeg({ progressive: false })
      .toBuffer(),
  );
}

function draftPath() {
  return buildStoryMediaObjectPath({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
  });
}

test("signed upload intent is deterministic and creates no media row", async () => {
  const fixture = setup();
  const result = await fixture.service.createUploadIntent({
    storyId: STORY_ID,
    mimeType: "image/jpeg",
    byteSize: 123,
  });
  assert.equal(result.mediaId, MEDIA_ID);
  assert.equal(result.bucketId, STORY_MEDIA_DRAFT_BUCKET);
  assert.equal(result.objectPath, draftPath());
  assert.ok(result.signedToken);
  assert.match(result.signedToken, /^upload:/);
  assert.equal(fixture.media.size, 0);
});

test("client operation UUID is the deterministic media identity across retries", async () => {
  const fixture = setup();
  const input = {
    storyId: STORY_ID,
    operationId: MEDIA_ID,
    mimeType: "image/jpeg" as const,
    byteSize: 123,
  };
  assert.equal((await fixture.service.createUploadIntent(input)).mediaId, MEDIA_ID);
  assert.equal((await fixture.service.createUploadIntent(input)).mediaId, MEDIA_ID);
  assert.equal(fixture.media.size, 0);
});

test("upload intent fails closed when the private bucket contract drifts", async () => {
  const fixture = setup();
  const service = createStoryMediaService({
    repository: fixture.repository,
    storage: {
      ...fixture.storage,
      async getBucket(bucketId) {
        const bucket = await fixture.storage.getBucket(bucketId);
        return bucket ? { ...bucket, public: true } : null;
      },
    },
    createId: () => MEDIA_ID,
  });
  await assert.rejects(
    service.createUploadIntent({ storyId: STORY_ID, mimeType: "image/jpeg", byteSize: 123 }),
    (error) => error instanceof StoryMediaServiceError && error.code === "BUCKET_MISCONFIGURED",
  );
});

test("upload intent permits READY and rejects PUBLISHED or ARCHIVED stories", async () => {
  await assert.doesNotReject(setup(story("READY")).service.createUploadIntent({
    storyId: STORY_ID,
    operationId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: 123,
  }));
  for (const status of ["PUBLISHED", "ARCHIVED"] as const) {
    await assert.rejects(
      setup(story(status)).service.createUploadIntent({
        storyId: STORY_ID,
        operationId: MEDIA_ID,
        mimeType: "image/jpeg",
        byteSize: 123,
      }),
      (error) => error instanceof StoryMediaServiceError && error.code === "STORY_NOT_EDITABLE",
    );
  }
});

test("finalize decodes the private image and creates the approved row", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  const result = await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  assert.equal(result.created, true);
  assert.equal(result.media.bucket_id, STORY_MEDIA_DRAFT_BUCKET);
  assert.equal(result.media.width, 16);
  assert.equal(result.media.height, 9);
  assert.equal(result.media.alt_text, "");
  assert.equal(result.media.rights_type, "UNKNOWN");
});

test("an exact finalize retry is idempotent", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  const input = {
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg" as const,
    byteSize: bytes.byteLength,
  };
  assert.equal((await fixture.service.finalizeUpload(input)).created, true);
  assert.equal((await fixture.service.finalizeUpload(input)).created, false);
  assert.equal(fixture.counts.inserts, 1);
  assert.equal(fixture.media.size, 1);
});

test("upload intent retry after finalize reuses exact state and rejects a changed contract", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const exact = await fixture.service.createUploadIntent({
    storyId: STORY_ID,
    operationId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  assert.equal(exact.alreadyFinalized, true);
  assert.equal(exact.signedToken, null);
  await assert.rejects(
    fixture.service.createUploadIntent({
      storyId: STORY_ID,
      operationId: MEDIA_ID,
      mimeType: "image/jpeg",
      byteSize: bytes.byteLength + 1,
    }),
    (error) => error instanceof StoryMediaServiceError && error.code === "MEDIA_STATE_CONFLICT",
  );
});

test("two competing finalizes converge on one exact media row", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  let initialReads = 0;
  let releaseInitialReads!: () => void;
  const initialReadBarrier = new Promise<void>((resolve) => {
    releaseInitialReads = resolve;
  });
  const repository: StoryMediaRepository = {
    ...fixture.repository,
    async getMedia(mediaId) {
      if (initialReads < 2) {
        initialReads += 1;
        if (initialReads === 2) releaseInitialReads();
        await initialReadBarrier;
        return null;
      }
      return fixture.repository.getMedia(mediaId);
    },
  };
  const service = createStoryMediaService({
    repository,
    storage: fixture.storage,
    createId: () => MEDIA_ID,
  });
  const input = {
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg" as const,
    byteSize: bytes.byteLength,
  };

  const results = await Promise.all([service.finalizeUpload(input), service.finalizeUpload(input)]);
  assert.deepEqual(
    results.map((result) => result.created).sort(),
    [false, true],
  );
  assert.equal(fixture.counts.inserts, 2);
  assert.equal(fixture.media.size, 1);
  assert.ok(fixture.objects.has(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`));
});

test("an inconsistent finalize retry fails closed", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const current = fixture.media.get(MEDIA_ID)!;
  fixture.media.set(MEDIA_ID, { ...current, width: current.width + 1 });
  await assert.rejects(
    fixture.service.finalizeUpload({
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      mimeType: "image/jpeg",
      byteSize: bytes.byteLength,
    }),
    (error) => error instanceof StoryMediaServiceError && error.code === "MEDIA_STATE_CONFLICT",
  );
});

test("finalize rejects corrupt content even when JPEG magic bytes are present", async () => {
  const fixture = setup();
  const bytes = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4);
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await assert.rejects(
    fixture.service.finalizeUpload({
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      mimeType: "image/jpeg",
      byteSize: bytes.byteLength,
    }),
    (error) => error instanceof StoryMediaValidationError && error.code === "INVALID_IMAGE_BYTES",
  );
});

test("finalize is unavailable after publication", async () => {
  const fixture = setup(story("PUBLISHED"));
  await assert.rejects(
    fixture.service.finalizeUpload({
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      mimeType: "image/jpeg",
      byteSize: 100,
    }),
    (error) => error instanceof StoryMediaServiceError && error.code === "STORY_NOT_EDITABLE",
  );
});

test("private preview always uses the fixed 300-second signed URL", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const preview = await fixture.service.createPreviewUrl({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
  });
  assert.equal(STORY_MEDIA_PREVIEW_TTL_SECONDS, 300);
  assert.match(preview.signedUrl, /expires=300$/);
});

test("public URL construction pins the trusted origin, bucket and canonical path", () => {
  assert.equal(
    buildCanonicalStoryMediaPublicUrl("https://project.supabase.co", draftPath()),
    `https://project.supabase.co/storage/v1/object/public/${STORY_MEDIA_PUBLIC_BUCKET}/${draftPath()}`,
  );
  assert.equal(
    buildCanonicalStoryMediaPublicUrl("http://127.0.0.1:54321", draftPath()),
    `http://127.0.0.1:54321/storage/v1/object/public/${STORY_MEDIA_PUBLIC_BUCKET}/${draftPath()}`,
  );
  assert.throws(
    () => buildCanonicalStoryMediaPublicUrl("http://project.supabase.co", draftPath()),
    (error) => error instanceof StoryMediaServiceError && error.code === "PUBLIC_DELIVERY_FAILED",
  );
  assert.throws(
    () => buildCanonicalStoryMediaPublicUrl("https://project.supabase.co/tenant", draftPath()),
    (error) => error instanceof StoryMediaServiceError && error.code === "PUBLIC_DELIVERY_FAILED",
  );
  assert.throws(() =>
    buildCanonicalStoryMediaPublicUrl(
      "https://project.supabase.co",
      `${STORY_ID}/${MEDIA_ID}/../asset.jpg`,
    ),
  );
});

test("Sharp inspection rejects a declared MIME mismatch", async () => {
  const bytes = await jpeg();
  await assert.rejects(
    inspectStoryMediaImage(bytes, "image/png"),
    (error) => error instanceof StoryMediaValidationError && error.code === "SIGNATURE_MISMATCH",
  );
});

test("Sharp inspection decodes the approved PNG and WebP formats", async () => {
  const source = sharp({
    create: { width: 12, height: 8, channels: 3, background: { r: 20, g: 30, b: 40 } },
  });
  const png = new Uint8Array(await source.clone().png().toBuffer());
  const webp = new Uint8Array(await source.clone().webp().toBuffer());
  assert.deepEqual(await inspectStoryMediaImage(png, "image/png"), {
    mimeType: "image/png",
    width: 12,
    height: 8,
    byteSize: png.byteLength,
  });
  assert.deepEqual(await inspectStoryMediaImage(webp, "image/webp"), {
    mimeType: "image/webp",
    width: 12,
    height: 8,
    byteSize: webp.byteLength,
  });
});

test("full decode rejects a truncated JPEG with parseable magic and metadata", async () => {
  const complete = await jpeg(64, 32);
  const truncated = complete.subarray(0, complete.byteLength - 1);
  assert.equal((await sharp(truncated).metadata()).format, "jpeg");
  await assert.rejects(
    inspectStoryMediaImage(truncated, "image/jpeg"),
    (error) => error instanceof StoryMediaValidationError && error.code === "INVALID_IMAGE_BYTES",
  );
});

test("full decode rejects a truncated PNG with a valid signature", async () => {
  const complete = new Uint8Array(
    await sharp({
      create: { width: 64, height: 32, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } },
    })
      .png()
      .toBuffer(),
  );
  const truncated = complete.subarray(0, complete.byteLength - 17);
  assert.equal((await sharp(truncated).metadata()).format, "png");
  await assert.rejects(
    inspectStoryMediaImage(truncated, "image/png"),
    (error) => error instanceof StoryMediaValidationError && error.code === "INVALID_IMAGE_BYTES",
  );
});

test("full decode rejects a truncated WebP with a valid RIFF/WEBP header", async () => {
  const complete = new Uint8Array(
    await sharp({
      create: { width: 64, height: 32, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .webp()
      .toBuffer(),
  );
  const truncated = complete.subarray(0, complete.byteLength - 1);
  assert.equal(String.fromCharCode(...truncated.subarray(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...truncated.subarray(8, 12)), "WEBP");
  await assert.rejects(
    inspectStoryMediaImage(truncated, "image/webp"),
    (error) => error instanceof StoryMediaValidationError && error.code === "INVALID_IMAGE_BYTES",
  );
});

test("sanitization never upscales a small image", async () => {
  const original = await jpeg(16, 9);
  const result = await sanitizeStoryMediaImage(original, "image/jpeg");
  assert.equal(result.inspection.width, 16);
  assert.equal(result.inspection.height, 9);
});

test("sanitization auto-orients, caps the long edge, and strips metadata", async () => {
  const original = new Uint8Array(
    await sharp({
      create: {
        width: 4_000,
        height: 2_000,
        channels: 3,
        background: { r: 20, g: 90, b: 180 },
      },
    })
      .jpeg()
      .withMetadata({
        orientation: 6,
        exif: { IFD0: { Artist: "Private photographer" } },
      })
      .withXmp("<x:xmpmeta><GPSLatitude>40.0</GPSLatitude></x:xmpmeta>")
      .toBuffer(),
  );
  const result = await sanitizeStoryMediaImage(original, "image/jpeg");
  assert.equal(Math.max(result.inspection.width, result.inspection.height), 3_200);
  assert.equal(result.inspection.width, 1_600);
  assert.equal(result.inspection.height, 3_200);
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
});

test("PNG sanitization preserves an alpha channel", async () => {
  const original = new Uint8Array(
    await sharp({
      create: { width: 8, height: 6, channels: 4, background: { r: 20, g: 90, b: 180, alpha: 0.5 } },
    })
      .png()
      .toBuffer(),
  );
  const result = await sanitizeStoryMediaImage(original, "image/png");
  const decoded = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.channels, 4);
  assert.equal(decoded.data[3], 128);
});

test("promotion preserves the private original and creates one sanitized public asset", async () => {
  const fixture = setup();
  const bytes = await jpeg(4_000, 2_000);
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const result = await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  assert.equal(result.promoted, true);
  assert.equal(result.media.bucket_id, STORY_MEDIA_PUBLIC_BUCKET);
  assert.equal(Math.max(result.media.width, result.media.height), 3_200);
  assert.ok(fixture.objects.has(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`));
  assert.ok(fixture.objects.has(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`));
  assert.equal(fixture.counts.uploads, 1);
});

test("admin media URL is signed while private and canonical after promotion", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const privateResult = await fixture.service.createAdminMediaUrl({ storyId: STORY_ID, mediaId: MEDIA_ID });
  assert.equal(privateResult.private, true);
  assert.match(privateResult.url, /expires=300/);
  await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  const publicResult = await fixture.service.createAdminMediaUrl({ storyId: STORY_ID, mediaId: MEDIA_ID });
  assert.equal(publicResult.private, false);
  assert.match(publicResult.url, /\/storage\/v1\/object\/public\/story-media\//);
});

test("preview and promotion reject cross-story media ownership", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const otherStoryId = "99999999-9999-4999-8999-999999999999";
  fixture.stories.set(otherStoryId, { ...story(), id: otherStoryId });
  for (const action of [
    () => fixture.service.createAdminMediaUrl({ storyId: otherStoryId, mediaId: MEDIA_ID }),
    () => fixture.service.promote({ storyId: otherStoryId, mediaId: MEDIA_ID }),
  ]) {
    await assert.rejects(
      action(),
      (error) => error instanceof StoryMediaServiceError && error.code === "MEDIA_OWNERSHIP_MISMATCH",
    );
  }
  assert.equal(fixture.counts.uploads, 0);
});

test("editor promotion gate requires metadata and rejects a stale media version", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  await assert.rejects(
    fixture.service.promote({
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      expectedUpdatedAt: NOW,
      requirePublicationMetadata: true,
    }),
    (error) => error instanceof StoryMediaServiceError && error.code === "MEDIA_STATE_CONFLICT",
  );
  const current = fixture.media.get(MEDIA_ID)!;
  fixture.media.set(MEDIA_ID, { ...current, alt_text: "Vehículo en pista" });
  await assert.rejects(
    fixture.service.promote({
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      expectedUpdatedAt: NOW,
      requirePublicationMetadata: true,
    }),
    (error) => error instanceof StoryMediaServiceError && error.code === "MEDIA_STATE_CONFLICT",
  );
  fixture.media.set(MEDIA_ID, { ...current, rights_type: "OWN" });
  await assert.rejects(
    fixture.service.promote({
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      expectedUpdatedAt: NOW,
      requirePublicationMetadata: true,
    }),
    (error) => error instanceof StoryMediaServiceError && error.code === "MEDIA_STATE_CONFLICT",
  );
  fixture.media.set(MEDIA_ID, { ...current, alt_text: "Vehículo en pista", rights_type: "OWN" });
  await assert.rejects(
    fixture.service.promote({
      storyId: STORY_ID,
      mediaId: MEDIA_ID,
      expectedUpdatedAt: "2026-09-30T09:00:00.000Z",
      requirePublicationMetadata: true,
    }),
    (error) => error instanceof StoryMediaServiceError && error.code === "MEDIA_STATE_CONFLICT",
  );
  assert.equal(fixture.counts.uploads, 0);
});

test("promotion retry is idempotent and does not upload another asset", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  assert.equal((await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID })).promoted, true);
  assert.equal((await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID })).promoted, false);
  assert.equal(fixture.counts.uploads, 1);
});

test("an ambiguous promotion retry adopts exact PUBLIC state despite a stale draft version", async () => {
  const fixture = setup();
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  const finalized = await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  fixture.media.set(MEDIA_ID, {
    ...finalized.media,
    alt_text: "Vehículo en pista",
    rights_type: "OWN",
  });
  const input = {
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    expectedUpdatedAt: finalized.media.updated_at,
    requirePublicationMetadata: true,
  };
  assert.equal((await fixture.service.promote(input)).promoted, true);
  fixture.media.set(MEDIA_ID, {
    ...fixture.media.get(MEDIA_ID)!,
    updated_at: "2026-09-30T10:01:00.000Z",
  });
  assert.equal((await fixture.service.promote(input)).promoted, false);
  assert.equal(fixture.counts.uploads, 1);
});

test("promotion fails closed without overwriting a conflicting public asset", async () => {
  const fixture = setup();
  const original = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, original);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: original.byteLength,
  });
  const conflicting = await jpeg(8, 8);
  fixture.objects.set(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`, conflicting);

  await assert.rejects(
    fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID }),
    (error) => error instanceof StoryMediaServiceError && error.code === "PUBLIC_ASSET_CONFLICT",
  );
  assert.deepEqual(
    fixture.objects.get(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`),
    conflicting,
  );
  assert.equal(fixture.media.get(MEDIA_ID)?.bucket_id, STORY_MEDIA_DRAFT_BUCKET);
});

test("promotion adopts an existing byte-identical public asset without overwrite", async () => {
  const fixture = setup();
  const original = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, original);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: original.byteLength,
  });
  const sanitized = await sanitizeStoryMediaImage(original, "image/jpeg");
  const existing = new Uint8Array(sanitized.bytes);
  fixture.objects.set(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`, existing);

  const result = await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  assert.equal(result.promoted, true);
  assert.equal(result.media.bucket_id, STORY_MEDIA_PUBLIC_BUCKET);
  assert.deepEqual(
    fixture.objects.get(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`),
    existing,
  );
});

test("promotion removes its new public object when the conditional database update fails", async () => {
  const fixture = setup();
  const original = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, original);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: original.byteLength,
  });
  const service = createStoryMediaService({
    repository: {
      ...fixture.repository,
      async updateMediaForPromotion() {
        return null;
      },
    },
    storage: fixture.storage,
  });

  await assert.rejects(
    service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID }),
    (error) =>
      error instanceof StoryMediaServiceError &&
      error.code === "PROMOTION_UPDATE_FAILED" &&
      error.cleanupStatus === "COMPLETED",
  );
  assert.equal(fixture.counts.removes, 1);
  assert.equal(fixture.media.get(MEDIA_ID)?.bucket_id, STORY_MEDIA_DRAFT_BUCKET);
  assert.equal(fixture.objects.has(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`), false);
  assert.ok(fixture.objects.has(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`));
});

test("promotion reports cleanup pending when compensating public deletion fails", async () => {
  const fixture = setup();
  const original = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, original);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: original.byteLength,
  });
  const service = createStoryMediaService({
    repository: {
      ...fixture.repository,
      async updateMediaForPromotion() {
        return null;
      },
    },
    storage: {
      ...fixture.storage,
      async remove() {
        throw new Error("cleanup unavailable");
      },
    },
  });

  await assert.rejects(
    service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID }),
    (error) =>
      error instanceof StoryMediaServiceError &&
      error.code === "PROMOTION_UPDATE_FAILED" &&
      error.cleanupStatus === "PENDING",
  );
  assert.equal(fixture.media.get(MEDIA_ID)?.bucket_id, STORY_MEDIA_DRAFT_BUCKET);
  assert.equal(fixture.objects.has(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`), true);
});

test("promotion adopts a concurrent exact database update without deleting public media", async () => {
  const fixture = setup();
  const original = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, original);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: original.byteLength,
  });
  const service = createStoryMediaService({
    repository: {
      ...fixture.repository,
      async updateMediaForPromotion(input) {
        const current = fixture.media.get(input.mediaId)!;
        fixture.media.set(input.mediaId, { ...current, ...input.update });
        return null;
      },
    },
    storage: fixture.storage,
  });

  const result = await service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  assert.equal(result.promoted, false);
  assert.equal(result.media.bucket_id, STORY_MEDIA_PUBLIC_BUCKET);
  assert.equal(fixture.counts.removes, 0);
  assert.ok(fixture.objects.has(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`));
  assert.ok(fixture.objects.has(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`));
});

test("publication readiness requires promotion plus editorial alt and rights", async () => {
  const fixture = setup(story("READY"));
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const before = await fixture.service.publicationReadiness(STORY_ID);
  assert.equal(before.ready, false);
  assert.deepEqual(before.storageIssues, [{ code: "MEDIA_NOT_PUBLIC", mediaId: MEDIA_ID }]);

  const current = fixture.media.get(MEDIA_ID)!;
  fixture.media.set(MEDIA_ID, {
    ...current,
    alt_text: "Coche de competición en pista",
    rights_type: "OWN",
  });
  await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  const after = await fixture.service.publicationReadiness(STORY_ID);
  assert.equal(after.ready, true);
  assert.deepEqual(after.publicationErrors, []);
  assert.deepEqual(after.storageIssues, []);
  assert.equal(fixture.counts.publicDeliveryChecks, 1);
});

test("publication readiness tracks server metadata changes after promotion", async () => {
  const fixture = setup(story("READY"));
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  fixture.media.set(MEDIA_ID, {
    ...fixture.media.get(MEDIA_ID)!,
    alt_text: "Coche de competición en pista",
    rights_type: "OWN",
  });
  await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  assert.equal((await fixture.service.publicationReadiness(STORY_ID)).ready, true);

  fixture.media.set(MEDIA_ID, { ...fixture.media.get(MEDIA_ID)!, alt_text: "" });
  assert.equal((await fixture.service.publicationReadiness(STORY_ID)).ready, false);

  fixture.media.set(MEDIA_ID, {
    ...fixture.media.get(MEDIA_ID)!,
    alt_text: "Coche de competición en pista",
  });
  assert.equal((await fixture.service.publicationReadiness(STORY_ID)).ready, true);

  fixture.media.set(MEDIA_ID, {
    ...fixture.media.get(MEDIA_ID)!,
    rights_type: "UNKNOWN",
  });
  assert.equal((await fixture.service.publicationReadiness(STORY_ID)).ready, false);
});

test("a draft asset with complete metadata is never publication ready", async () => {
  const fixture = setup(story("READY"));
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  fixture.media.set(MEDIA_ID, {
    ...fixture.media.get(MEDIA_ID)!,
    alt_text: "Coche de competición en pista",
    rights_type: "OWN",
  });

  const result = await fixture.service.publicationReadiness(STORY_ID);
  assert.equal(result.ready, false);
  assert.deepEqual(result.storageIssues, [{ code: "MEDIA_NOT_PUBLIC", mediaId: MEDIA_ID }]);
});

test("readiness fails closed if the public bucket becomes private", async () => {
  const fixture = setup(story("READY"));
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const current = fixture.media.get(MEDIA_ID)!;
  fixture.media.set(MEDIA_ID, {
    ...current,
    alt_text: "Coche de competición en pista",
    rights_type: "OWN",
  });
  await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  const service = createStoryMediaService({
    repository: fixture.repository,
    storage: {
      ...fixture.storage,
      async getBucket(bucketId) {
        const bucket = await fixture.storage.getBucket(bucketId);
        return bucketId === STORY_MEDIA_PUBLIC_BUCKET && bucket
          ? { ...bucket, public: false }
          : bucket;
      },
    },
  });

  const result = await service.publicationReadiness(STORY_ID);
  assert.equal(result.ready, false);
  assert.deepEqual(result.storageIssues, [
    { code: "PUBLIC_BUCKET_MISCONFIGURED", mediaId: MEDIA_ID },
  ]);
});

test("readiness fails closed when public delivery Content-Type is wrong", async () => {
  const fixture = setup(story("READY"));
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const current = fixture.media.get(MEDIA_ID)!;
  fixture.media.set(MEDIA_ID, {
    ...current,
    alt_text: "Coche de competición en pista",
    rights_type: "OWN",
  });
  await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  const service = createStoryMediaService({
    repository: fixture.repository,
    storage: {
      ...fixture.storage,
      async verifyPublicDelivery(bucketId, objectPath) {
        return {
          publicUrl: `https://supabase.test/storage/v1/object/public/${bucketId}/${objectPath}`,
          contentType: "image/png",
        };
      },
    },
  });

  const result = await service.publicationReadiness(STORY_ID);
  assert.equal(result.ready, false);
  assert.deepEqual(result.storageIssues, [
    { code: "PUBLIC_DELIVERY_UNAVAILABLE", mediaId: MEDIA_ID },
  ]);
});

test("readiness fails closed when the public object disappears", async () => {
  const fixture = setup(story("READY"));
  const bytes = await jpeg();
  fixture.objects.set(`${STORY_MEDIA_DRAFT_BUCKET}:${draftPath()}`, bytes);
  await fixture.service.finalizeUpload({
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
  });
  const current = fixture.media.get(MEDIA_ID)!;
  fixture.media.set(MEDIA_ID, {
    ...current,
    alt_text: "Coche de competición en pista",
    rights_type: "OWN",
  });
  await fixture.service.promote({ storyId: STORY_ID, mediaId: MEDIA_ID });
  fixture.objects.delete(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`);
  const result = await fixture.service.publicationReadiness(STORY_ID);
  assert.equal(result.ready, false);
  assert.deepEqual(result.storageIssues, [
    { code: "PUBLIC_OBJECT_UNAVAILABLE", mediaId: MEDIA_ID },
  ]);
});

test("readiness rejects a public derivative above the approved long edge", async () => {
  const fixture = setup(story("READY"));
  const bytes = await jpeg(STORY_MEDIA_PUBLIC_MAX_LONG_EDGE + 1, 1);
  fixture.objects.set(`${STORY_MEDIA_PUBLIC_BUCKET}:${draftPath()}`, bytes);
  fixture.media.set(
    MEDIA_ID,
    toRow({
      id: MEDIA_ID,
      story_id: STORY_ID,
      bucket_id: STORY_MEDIA_PUBLIC_BUCKET,
      object_path: draftPath(),
      width: STORY_MEDIA_PUBLIC_MAX_LONG_EDGE + 1,
      height: 1,
      mime_type: "image/jpeg",
      byte_size: bytes.byteLength,
      alt_text: "Coche de competición en pista",
      rights_type: "OWN",
    }),
  );

  const result = await fixture.service.publicationReadiness(STORY_ID);
  assert.equal(result.ready, false);
  assert.deepEqual(result.storageIssues, [
    { code: "PUBLIC_MEDIA_STATE_INVALID", mediaId: MEDIA_ID },
  ]);
});
