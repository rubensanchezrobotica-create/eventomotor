import assert from "node:assert/strict";
import test from "node:test";
import { listHomeStories } from "./story-home.server";

const storyId = "a1000000-0000-4000-8000-000000000001";
const mediaId = "a2000000-0000-4000-8000-000000000001";
function fixture() {
  return {
    story: { id: storyId, slug: "synthetic-home-story", status: "PUBLISHED", title: "Synthetic Home story",
      dek: "An approved short synthetic summary.", hero_media_id: mediaId, published_at: "2030-01-02T12:00:00Z",
      updated_at: "2030-01-02T12:00:00Z", content_blocks: "PRIVATE_BODY_SENTINEL", rights_notes: "PRIVATE_NOTES_SENTINEL" },
    hero: { id: mediaId, story_id: storyId, bucket_id: "story-media", object_path: `${storyId}/${mediaId}/asset.webp`,
      width: 1600, height: 1000, mime_type: "image/webp", alt_text: "Approved synthetic hero", rights_notes: "PRIVATE_NOTES_SENTINEL" },
    archivedDuringRead: false, editedDuringRead: false, unavailable: false,
  };
}

async function withFixture(run: (input: ReturnType<typeof fixture>, calls: URL[]) => Promise<void>) {
  const input = fixture(), calls: URL[] = [], originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-only";
  globalThis.fetch = async (request, options) => {
    const url = new URL(request instanceof Request ? request.url : String(request)); calls.push(url);
    assert.equal(url.hostname, "127.0.0.1"); assert.equal(options?.method ?? "GET", "GET");
    const select = url.searchParams.get("select") ?? "";
    assert.ok(!/\*|content_blocks|rights_notes|seo_|person_id/.test(select), "Home never reads the full article, notes or credits");
    if (input.unavailable) return new Response("{}", { status: 503 });
    let rows: unknown[] = [];
    if (url.pathname.endsWith("/stories")) {
      assert.equal(url.searchParams.get("status"), "eq.PUBLISHED");
      if (select === "id,status,updated_at") {
        rows = input.archivedDuringRead ? [] : [{ ...input.story, updated_at: input.editedDuringRead ? "2030-01-03T12:00:00Z" : input.story.updated_at }];
      } else {
        assert.equal(url.searchParams.get("limit"), "3");
        assert.equal(url.searchParams.get("order"), "published_at.desc,id.asc");
        rows = input.story.status === "PUBLISHED" ? [input.story] : [];
      }
    } else {
      assert.ok(url.pathname.endsWith("/story_media"), "no other table is needed");
      assert.equal(url.searchParams.get("bucket_id"), "eq.story-media");
      assert.ok(url.searchParams.get("id")?.includes(mediaId));
      rows = [input.hero];
    }
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
  };
  try { await run(input, calls); }
  finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}

test("real Home loader reads a bounded PUBLISHED header and hero, returns only the minimal public projection", async () => {
  await withFixture(async (_input, calls) => {
    const result = await listHomeStories();
    assert.equal(result.length, 1);
    assert.deepEqual(Object.keys(result[0]).sort(), ["hero", "slug", "summary", "title"]);
    assert.deepEqual(Object.keys(result[0].hero).sort(), ["alt", "height", "src", "width"]);
    assert.match(result[0].hero.src, /\/object\/public\/story-media\//);
    assert.ok(!/PRIVATE_|story-media-drafts|rights_notes|content_blocks|object_path|published_at/.test(JSON.stringify(result)));
    assert.equal(calls.length, 3);
  });
});

for (const state of ["DRAFT", "READY", "ARCHIVED"]) test(`${state} contributes no Home content or media reads`, async () => {
  await withFixture(async (input, calls) => { input.story.status = state; assert.deepEqual(await listHomeStories(), []); assert.equal(calls.length, 1); });
});

test("concurrent archival or header edit fails closed after media lookup", async () => {
  await withFixture(async (input) => {
    input.archivedDuringRead = true; assert.deepEqual(await listHomeStories(), []);
    input.archivedDuringRead = false; input.editedDuringRead = true; assert.deepEqual(await listHomeStories(), []);
  });
});

test("private, misowned, noncanonical or invalid hero cannot appear on Home", async () => {
  const changes = [
    (s: ReturnType<typeof fixture>) => { s.hero.bucket_id = "story-media-drafts"; },
    (s: ReturnType<typeof fixture>) => { s.hero.story_id = "another-story"; },
    (s: ReturnType<typeof fixture>) => { s.hero.object_path = "../private.png"; },
    (s: ReturnType<typeof fixture>) => { s.hero.width = 3201; },
    (s: ReturnType<typeof fixture>) => { s.hero.alt_text = ""; },
    (s: ReturnType<typeof fixture>) => { s.story.dek = "https://example.test/object/sign/private?token=secret"; },
  ];
  for (const change of changes) await withFixture(async (input) => { change(input); assert.deepEqual(await listHomeStories(), []); });
});

test("summary stays bounded without changing CMS content; optional outages preserve the Home agenda", async () => {
  await withFixture(async (input) => {
    input.story.dek = "Approved synthetic summary. ".repeat(20);
    const before = input.story.dek, result = await listHomeStories();
    assert.ok(result[0].summary.length <= 240); assert.ok(result[0].summary.endsWith("summary.")); assert.equal(input.story.dek, before);
    input.unavailable = true; assert.deepEqual(await listHomeStories(), []);
  });
});
