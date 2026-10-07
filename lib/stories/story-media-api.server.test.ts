import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminSessionToken,
} from "@/lib/admin-session";
import {
  verifyAdminMediaSession,
  type AdminSessionRuntime,
} from "@/lib/admin-session.server";
import {
  StoryMediaServiceError,
  createSupabaseStoryMediaService,
} from "./story-media.server";
import {
  createPreviewUrlHandler,
  createPromoteHandler,
  createUploadFinalizeHandler,
  createUploadIntentHandler,
  type StoryMediaApiDependencies,
} from "./story-media-api.server";

const STORY_ID = "11111111-1111-4111-8111-111111111111";
const MEDIA_ID = "22222222-2222-4222-8222-222222222222";
const UPDATED_AT = "2026-10-06T10:00:00.000Z";

function postBody(overrides: Record<string, unknown> = {}) {
  return new Request("https://eventomotor.test/api/admin/stories/media/upload-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storyId: STORY_ID,
      operationId: MEDIA_ID,
      filename: "foto.jpg",
      declaredMime: "image/jpeg",
      byteSize: 123,
      ...overrides,
    }),
  });
}

function dependencies(service: Record<string, unknown>, authorization: "AUTHORIZED" | "UNAUTHENTICATED" | "UNTRUSTED_ORIGIN" = "AUTHORIZED") {
  let serviceReads = 0;
  const result: StoryMediaApiDependencies = {
    async authorizeMutation() { return authorization; },
    async authenticateRead() { return authorization === "AUTHORIZED"; },
    service() {
      serviceReads += 1;
      return service as unknown as ReturnType<typeof createSupabaseStoryMediaService>;
    },
  };
  return { result, serviceReads: () => serviceReads };
}

test("every mutation rejects missing/tampered session and cross-origin before service access", async () => {
  for (const [authorization, status] of [["UNAUTHENTICATED", 401], ["UNTRUSTED_ORIGIN", 403]] as const) {
    for (const invoke of [
      (fixture: ReturnType<typeof dependencies>) => createUploadIntentHandler(fixture.result)(postBody()),
      (fixture: ReturnType<typeof dependencies>) => createUploadFinalizeHandler(fixture.result)(postBody()),
      (fixture: ReturnType<typeof dependencies>) => createPromoteHandler(fixture.result)(new Request(
        `https://eventomotor.test/api/admin/stories/media/${MEDIA_ID}/promote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId: STORY_ID, expectedUpdatedAt: UPDATED_AT }),
        },
      ), { params: Promise.resolve({ mediaId: MEDIA_ID }) }),
    ]) {
      const fixture = dependencies({}, authorization);
      const response = await invoke(fixture);
      assert.equal(response.status, status);
      assert.equal(fixture.serviceReads(), 0);
    }
  }
});

test("a tampered media cookie is rejected by a route before service construction", async () => {
  const previousSecret = process.env.ADMIN_SECRET;
  const secret = "synthetic-media-route-secret";
  process.env.ADMIN_SECRET = secret;
  try {
    const valid = createAdminSessionToken(secret, Date.now(), "abcdefghijklmnop");
    const runtime: AdminSessionRuntime = {
      async readSessionToken() { return `${valid}tampered`; },
      async redirectToLogin(): Promise<never> { throw new Error("unexpected redirect"); },
    };
    const fixture = dependencies({});
    fixture.result.authorizeMutation = async () => (
      await verifyAdminMediaSession(runtime) ? "AUTHORIZED" : "UNAUTHENTICATED"
    );

    const response = await createUploadIntentHandler(fixture.result)(postBody());
    assert.equal(response.status, 401);
    assert.equal(fixture.serviceReads(), 0);
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousSecret;
  }
});

test("upload intent validates filename, MIME and deterministic operation identity", async () => {
  let observed: unknown;
  const fixture = dependencies({
    async createUploadIntent(input: unknown) {
      observed = input;
      return { mediaId: MEDIA_ID, signedToken: "synthetic", alreadyFinalized: false };
    },
  });
  const response = await createUploadIntentHandler(fixture.result)(postBody());
  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    storyId: STORY_ID,
    operationId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: 123,
  });
  assert.equal((await createUploadIntentHandler(fixture.result)(postBody({ filename: "foto.svg" }))).status, 400);
  assert.equal((await createUploadIntentHandler(fixture.result)(postBody({ operationId: "not-a-uuid" }))).status, 400);
});

test("finalize maps operationId to mediaId without accepting a client object path", async () => {
  let observed: unknown;
  const fixture = dependencies({
    async finalizeUpload(input: unknown) { observed = input; return { created: true }; },
  });
  const response = await createUploadFinalizeHandler(fixture.result)(postBody({ objectPath: "ignored" }));
  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    mimeType: "image/jpeg",
    byteSize: 123,
  });
});

test("two exact finalize route calls compose to one durable media row", async () => {
  const durable = new Set<string>();
  let insertCount = 0;
  const fixture = dependencies({
    async finalizeUpload(input: { mediaId: string }) {
      const created = !durable.has(input.mediaId);
      if (created) {
        durable.add(input.mediaId);
        insertCount += 1;
      }
      return { created, mediaId: input.mediaId };
    },
  });
  const handler = createUploadFinalizeHandler(fixture.result);
  const first = await handler(postBody());
  const second = await handler(postBody());
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).finalized.created, true);
  assert.equal((await second.json()).finalized.created, false);
  assert.equal(insertCount, 1);
  assert.equal(durable.size, 1);
});

test("preview is session-protected and resolves only server-owned media identity", async () => {
  const denied = dependencies({}, "UNAUTHENTICATED");
  const request = new Request(`https://eventomotor.test/api/admin/stories/media/${MEDIA_ID}/preview-url?storyId=${STORY_ID}`);
  const context = { params: Promise.resolve({ mediaId: MEDIA_ID }) };
  assert.equal((await createPreviewUrlHandler(denied.result)(request, context)).status, 401);
  const allowed = dependencies({
    async createAdminMediaUrl(input: unknown) { return { input, url: "https://signed.test", private: true }; },
  });
  assert.equal((await createPreviewUrlHandler(allowed.result)(request, context)).status, 200);
});

test("preview and promotion reject cross-story media adoption", async () => {
  const foreignStoryId = "44444444-4444-4444-8444-444444444444";
  const preview = dependencies({
    async createAdminMediaUrl() {
      throw new StoryMediaServiceError(
        "MEDIA_OWNERSHIP_MISMATCH",
        "Synthetic cross-story preview rejection.",
      );
    },
  });
  const previewResponse = await createPreviewUrlHandler(preview.result)(
    new Request(
      `https://eventomotor.test/api/admin/stories/media/${MEDIA_ID}/preview-url?storyId=${foreignStoryId}`,
    ),
    { params: Promise.resolve({ mediaId: MEDIA_ID }) },
  );
  assert.equal(previewResponse.status, 400);
  assert.equal((await previewResponse.json()).error, "MEDIA_OWNERSHIP_MISMATCH");

  const promotion = dependencies({
    async promote() {
      throw new StoryMediaServiceError(
        "MEDIA_OWNERSHIP_MISMATCH",
        "Synthetic cross-story promotion rejection.",
      );
    },
  });
  const promoteResponse = await createPromoteHandler(promotion.result)(
    new Request(`https://eventomotor.test/api/admin/stories/media/${MEDIA_ID}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: foreignStoryId, expectedUpdatedAt: UPDATED_AT }),
    }),
    { params: Promise.resolve({ mediaId: MEDIA_ID }) },
  );
  assert.equal(promoteResponse.status, 400);
  assert.equal((await promoteResponse.json()).error, "MEDIA_OWNERSHIP_MISMATCH");
});

test("promotion always enables metadata gate and optimistic version", async () => {
  let observed: unknown;
  const fixture = dependencies({
    async promote(input: unknown) { observed = input; return { promoted: true }; },
    async publicationReadiness() { return { ready: true, publicationErrors: [], storageIssues: [] }; },
  });
  const response = await createPromoteHandler(fixture.result)(new Request(
    "https://eventomotor.test/api/admin/stories/media/promote",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: STORY_ID, expectedUpdatedAt: UPDATED_AT }),
    },
  ), { params: Promise.resolve({ mediaId: MEDIA_ID }) });
  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    storyId: STORY_ID,
    mediaId: MEDIA_ID,
    expectedUpdatedAt: UPDATED_AT,
    requirePublicationMetadata: true,
  });
});
