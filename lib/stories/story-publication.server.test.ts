import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database, StoryRow } from "@/lib/supabase";
import { createSupabaseRelationRepository, classifyStoryAdminDatabaseError } from "./story-admin.server";
import { createPublicationFetch, createStoryPublicationService, StoryPublicationError } from "./story-publication.server";

const storyId = "e1000000-0000-4000-8000-000000000001";
const requestId = "e2000000-0000-4000-8000-000000000001";
const version = "2030-01-01T00:00:00Z";
const input = { storyId, requestId, expectedUpdatedAt: version };
const ready = { id: storyId, status: "READY", updated_at: version } as StoryRow;

test("publication transport aborts a stalled request before the function deadline", async () => {
  const stalledFetch: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  });
  const startedAt = Date.now();
  await assert.rejects(createPublicationFetch(stalledFetch, 25)("https://example.test/rest/v1/stories"),
    (error: unknown) => error instanceof Error && error.name === "TimeoutError");
  assert.ok(Date.now() - startedAt < 1_000);
});

test("publication transport honors the earlier overall deadline", async () => {
  const stalledFetch: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  });
  await assert.rejects(createPublicationFetch(stalledFetch, 1_000, AbortSignal.timeout(25))("https://example.test/rest/v1/stories"),
    (error: unknown) => error instanceof Error && error.name === "TimeoutError");
});

function harness(story: StoryRow | null = ready) {
  const calls: string[] = [];
  const service = createStoryPublicationService({
    async getStory() { calls.push("read"); return story; },
    async readiness() { calls.push("readiness"); return { ready: true }; },
    async commit(request) { calls.push("commit"); assert.deepEqual(request, input); return { ...ready, status: "PUBLISHED" }; },
  });
  return { service, calls };
}

test("publication reads and gates before one versioned atomic commit", async () => {
  const h = harness();
  assert.equal((await h.service.publish(input)).status, "PUBLISHED");
  assert.deepEqual(h.calls, ["read", "readiness", "commit"]);
});

test("DRAFT, ARCHIVED and missing Story never reach commit", async () => {
  for (const story of [null, { ...ready, status: "DRAFT" }, { ...ready, status: "ARCHIVED" }] as Array<StoryRow | null>) {
    const h = harness(story);
    await assert.rejects(h.service.publish(input), StoryPublicationError);
    assert.deepEqual(h.calls, ["read"]);
  }
});

test("stale reviewed version never reaches readiness or commit", async () => {
  const h = harness({ ...ready, updated_at: "2030-01-02T00:00:00Z" });
  await assert.rejects(h.service.publish(input), (e: unknown) => e instanceof StoryPublicationError && e.code === "VERSION_CONFLICT");
  assert.deepEqual(h.calls, ["read"]);
});

test("editorial or storage gate fails closed without publication", async () => {
  let writes = 0;
  const service = createStoryPublicationService({
    async getStory() { return ready; },
    async readiness() { return { ready: false }; },
    async commit() { writes++; return ready; },
  });
  await assert.rejects(service.publish(input), (e: unknown) => e instanceof StoryPublicationError && e.code === "GATE_FAILED");
  assert.equal(writes, 0);
});

test("gate I/O error cannot fall through to SQL", async () => {
  let writes = 0;
  const service = createStoryPublicationService({
    async getStory() { return ready; },
    async readiness() { throw new Error("unavailable"); },
    async commit() { writes++; return ready; },
  });
  await assert.rejects(service.publish(input), /unavailable/);
  assert.equal(writes, 0);
});

test("a stalled readiness transport aborts without invoking the publication RPC", async () => {
  let commits = 0;
  const stalledFetch: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  });
  const service = createStoryPublicationService({
    async getStory() { return ready; },
    async readiness() {
      await createPublicationFetch(stalledFetch, 25)("https://example.test/storage/v1/object/public/synthetic");
      return { ready: true };
    },
    async commit() { commits++; return ready; },
  });
  await assert.rejects(service.publish(input), (error: unknown) => error instanceof Error && error.name === "TimeoutError");
  assert.equal(commits, 0);
});

test("concurrent change detected by RPC is not reported as success", async () => {
  const service = createStoryPublicationService({
    async getStory() { return ready; },
    async readiness() { return { ready: true }; },
    async commit() { throw new StoryPublicationError("VERSION_CONFLICT", "stale"); },
  });
  await assert.rejects(service.publish(input), (e: unknown) => e instanceof StoryPublicationError && e.code === "VERSION_CONFLICT");
});

test("already published retry delegates identity/version verification to receipt RPC", async () => {
  const h = harness({ ...ready, status: "PUBLISHED" });
  await h.service.publish(input);
  assert.deepEqual(h.calls, ["read", "commit"]);
});

test("an incorrect retry is never converted into success", async () => {
  const service = createStoryPublicationService({
    async getStory() { return { ...ready, status: "PUBLISHED" }; },
    async readiness() { assert.fail("not a READY gate"); },
    async commit() { throw new StoryPublicationError("VERSION_CONFLICT", "different receipt"); },
  });
  await assert.rejects(service.publish(input), /different receipt/);
});

test("real relation repository sends exactly one RPC per replacement, never DELETE/INSERT", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const client = createClient<Database>("http://localhost:54321", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      async fetch(url, init) {
        const path = new URL(String(url)).pathname;
        calls.push({ path, body: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify(ready), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  });
  const repo = createSupabaseRelationRepository(client);
  await repo.replaceCreditsExpected({
    storyId, expectedUpdatedAt: version,
    credits: [{ story_id: storyId, person_id: requestId, role: "TEXT", sort_order: 0 }, { story_id: storyId, person_id: requestId, role: "PHOTO", sort_order: 1 }],
  });
  await repo.replaceEventsExpected({
    storyId, expectedUpdatedAt: version,
    relations: [{ story_id: storyId, event_id: "synthetic-event", relation_type: "PRIMARY", sort_order: 0 }],
  });
  assert.deepEqual(calls.map(({ path }) => path), ["/rest/v1/rpc/replace_story_credits", "/rest/v1/rpc/replace_story_events"]);
  assert.deepEqual(calls[0].body, {
    p_story_id: storyId, p_expected_updated_at: version,
    p_credits: [{ person_id: requestId, role: "TEXT", sort_order: 0 }, { person_id: requestId, role: "PHOTO", sort_order: 1 }],
  });
  assert.deepEqual(calls[1].body, {
    p_story_id: storyId, p_expected_updated_at: version,
    p_relations: [{ event_id: "synthetic-event", relation_type: "PRIMARY", sort_order: 0 }],
  });
});

test("SQL concurrency outcomes stay conflicts, not silent success", () => {
  assert.equal(classifyStoryAdminDatabaseError({ code: "40001" }), "STORY_VERSION_CONFLICT");
  assert.equal(classifyStoryAdminDatabaseError({ code: "55P03" }), "STORY_VERSION_CONFLICT");
  assert.equal(classifyStoryAdminDatabaseError({ code: "55000" }), "STORY_NOT_EDITABLE");
});
