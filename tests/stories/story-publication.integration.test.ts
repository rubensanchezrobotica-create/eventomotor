import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database, StoryRow } from "@/lib/supabase";
import { createSupabaseStoryMediaService } from "@/lib/stories/story-media.server";
import { publishStory, StoryPublicationError } from "@/lib/stories/story-publication.server";
import { STORY_MEDIA_PUBLIC_MAX_LONG_EDGE } from "@/lib/stories/story-media-validation";
import { STORY_LIMITS, type StoryContentBlock } from "@/lib/stories/story-types";

const enabled = process.env.STORIES_PUBLICATION_INTEGRATION === "1";

test("real publication path composes editorial, byte/delivery and atomic SQL gates", { skip: !enabled }, async (t) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(url && key, "isolated integration configuration is required");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname), "integration refuses non-loopback Supabase");
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const catalogClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const mediaService = createSupabaseStoryMediaService(client);
  const originalFetch = globalThis.fetch;
  const trace: Array<{ method: string; path: string }> = [];
  // Instrumentation only: all requests reach real local Supabase. No response,
  // readiness, validator, repository or RPC is mocked.
  globalThis.fetch = (request, options) => {
    const target = new URL(request instanceof Request ? request.url : String(request));
    assert.ok(["127.0.0.1", "localhost"].includes(target.hostname), "test transport refuses external endpoints");
    trace.push({ method: options?.method ?? (request instanceof Request ? request.method : "GET"), path: target.pathname });
    return originalFetch(request, options);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  // Published synthetic fixtures are discarded by CI stop --no-backup.
  // No privileged delete/unfreeze path is introduced for cleanup.
  const image = await sharp({ create: {
    width: STORY_MEDIA_PUBLIC_MAX_LONG_EDGE, height: 1600, channels: 3,
    background: { r: 20, g: 60, b: 90 },
  } }).webp().toBuffer();

  const paragraph = (id: string, text = "Synthetic editorial body.") => ({
    id, type: "PARAGRAPH", content: [{ type: "TEXT", text }],
  });
  async function fixture(body: unknown[], options: { missingObject?: boolean; wrongDimensions?: boolean } = {}) {
    const storyId = randomUUID(), mediaId = randomUUID();
    const path = storyId + "/" + mediaId + "/asset.webp";
    const draft = await client.from("stories").insert({ id: storyId, type: "REPORTAJE", collection: "DESDE_DENTRO" });
    assert.equal(draft.error, null);
    if (!options.missingObject) {
      const upload = await client.storage.from("story-media").upload(path, image, { contentType: "image/webp", upsert: false });
      assert.equal(upload.error, null);
    }
    const media = await client.from("story_media").insert({
      id: mediaId, story_id: storyId, bucket_id: "story-media", object_path: path,
      width: options.wrongDimensions ? STORY_MEDIA_PUBLIC_MAX_LONG_EDGE - 1 : STORY_MEDIA_PUBLIC_MAX_LONG_EDGE,
      height: 1600, mime_type: "image/webp", byte_size: image.length,
      alt_text: "Synthetic test image", rights_type: "OWN",
    });
    assert.equal(media.error, null);
    const ready = await client.from("stories").update({
      status: "READY", title: "Synthetic reviewed editorial", slug: "synthetic-gate-" + storyId,
      dek: "Synthetic dek", hero_media_id: mediaId,
      seo_title: "Synthetic SEO", seo_description: "Synthetic SEO description.",
      discipline_slugs: ["circuito"], territory_ids: ["madrid"],
      // Deliberate raw DB setup bypasses editor validation for negative tests;
      // the operation under test is REAL publishStory, not raw SQL.
      content_blocks: body as StoryContentBlock[],
    }).eq("id", storyId).select("*").single();
    assert.equal(ready.error, null);
    assert.ok(ready.data);
    return { story: ready.data, mediaId };
  }
  function publicationCalls() {
    return trace.filter(({ method, path }) => method === "POST" && path === "/rest/v1/rpc/publish_story").length;
  }
  async function assertUnchanged(story: StoryRow) {
    const after = await client.from("stories").select("*").eq("id", story.id).single();
    assert.equal(after.error, null);
    assert.deepEqual(after.data, story, "rejection preserves complete READY row and version");
    const receipt = await catalogClient.from("story_publication_receipts").select("story_id").eq("story_id", story.id);
    assert.equal(receipt.error, null);
    assert.deepEqual(receipt.data, [], "rejected gate records no receipt");
  }
  const invalidEditorialCases = [
    { name: "unsafe LINK", code: "UNSAFE_LINK", body: [{
      id: "unsafe-1", type: "PARAGRAPH", content: [{ type: "LINK", href: "javascript:alert(1)", children: [{ type: "TEXT", text: "Unsafe" }] }],
    }] },
    { name: "arbitrary HTML field", code: "UNKNOWN_FIELD", body: [{ ...paragraph("html-1"), html: "<script>invalid</script>" }] },
    { name: "duplicate block identifiers", code: "DUPLICATE_BLOCK_ID", body: [paragraph("same-id"), paragraph("same-id")] },
    { name: "paragraph text aggregate limit", code: "LIMIT_EXCEEDED", body: [{
      id: "paragraph-limit", type: "PARAGRAPH", content: [
        { type: "TEXT", text: "x".repeat(STORY_LIMITS.paragraphText) }, { type: "TEXT", text: "x" },
      ],
    }] },
    { name: "whole-body text aggregate limit", code: "LIMIT_EXCEEDED", body:
      Array.from({ length: 13 }, (_, index) => paragraph("body-" + index, "x".repeat(STORY_LIMITS.paragraphText))) },
    { name: "total structural inline node limit", code: "LIMIT_EXCEEDED", body:
      Array.from({ length: 21 }, (_, index) => ({
        id: "inline-" + index, type: "PARAGRAPH",
        content: Array.from({ length: STORY_LIMITS.inlineNodes }, () => ({ type: "TEXT", text: "x" })),
      })) },
  ];
  for (const scenario of invalidEditorialCases) {
    await t.test("READY + valid real media rejects " + scenario.name, async () => {
      const { story } = await fixture(scenario.body);
      const readiness = await mediaService.publicationReadiness(story.id);
      assert.equal(readiness.ready, false);
      assert.deepEqual(readiness.storageIssues, [], "real image, byte decode and public delivery are valid");
      assert.ok(readiness.publicationErrors.some(({ code }) => code === scenario.code));
      const rpcBefore = publicationCalls(), transportBefore = trace.length;
      await assert.rejects(publishStory({
        storyId: story.id, expectedUpdatedAt: story.updated_at, requestId: randomUUID(),
      }), (error: unknown) => error instanceof StoryPublicationError && error.code === "GATE_FAILED");
      assert.equal(publicationCalls(), rpcBefore, "invalid editorial never reaches publish_story RPC");
      assert.ok(trace.slice(transportBefore).some(({ path }) => path.startsWith("/storage/v1/object/")),
        "actual publishStory exercised real Storage, not a ready:true mock");
      await assertUnchanged(story);
    });
  }
  for (const scenario of [
    { name: "wrong image metadata", options: { wrongDimensions: true }, issue: "PUBLIC_MEDIA_STATE_INVALID" },
    { name: "missing actual object", options: { missingObject: true }, issue: "PUBLIC_OBJECT_UNAVAILABLE" },
  ]) {
    await t.test("READY + valid editorial rejects " + scenario.name, async () => {
      const { story } = await fixture([paragraph("valid-body")], scenario.options);
      const readiness = await mediaService.publicationReadiness(story.id);
      assert.deepEqual(readiness.publicationErrors, []);
      assert.ok(readiness.storageIssues.some(({ code }) => code === scenario.issue));
      const rpcBefore = publicationCalls();
      await assert.rejects(publishStory({
        storyId: story.id, expectedUpdatedAt: story.updated_at, requestId: randomUUID(),
      }), (error: unknown) => error instanceof StoryPublicationError && error.code === "GATE_FAILED");
      assert.equal(publicationCalls(), rpcBefore);
      await assertUnchanged(story);
    });
  }
  await t.test("valid editorial + approved 3200px real media publishes atomically with idempotent retry", async () => {
    const { story } = await fixture([paragraph("valid-body")]);
    const readiness = await mediaService.publicationReadiness(story.id);
    assert.deepEqual(readiness, { ready: true, publicationErrors: [], storageIssues: [] });
    const request = { storyId: story.id, expectedUpdatedAt: story.updated_at, requestId: randomUUID() };
    const rpcBefore = publicationCalls();
    const published = await publishStory(request);
    assert.equal(published.status, "PUBLISHED");
    assert.ok(published.published_at);
    assert.equal(publicationCalls(), rpcBefore + 1);
    const retry = await publishStory(request);
    assert.deepEqual(retry, published, "retry preserves every published field and timestamp");
    const receipt = await catalogClient.from("story_publication_receipts").select("story_id,request_id").eq("story_id", story.id);
    assert.equal(receipt.error, null);
    assert.deepEqual(receipt.data, [{ story_id: story.id, request_id: request.requestId }]);
  });
  t.diagnostic("REAL_EDITORIAL_PUBLICATION_GATE_NEGATIVES=6/6");
  t.diagnostic("REAL_MEDIA_PUBLICATION_GATE_NEGATIVES=2/2");
  t.diagnostic("REAL_PUBLISH_STORY_3200PX_AND_IDEMPOTENCY=PASS");
});
