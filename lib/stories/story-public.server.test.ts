import assert from "node:assert/strict";
import test from "node:test";
import { toPublicStory, getPublicStory, listPublicStories, getPublicStoriesForEvent, type PublicStorySource } from "./story-public.server";
import { buildStoryMetadata, buildStoryJsonLd, buildStoriesSitemap, serializeStoryJsonLd } from "./story-public-seo";

const storyId = "a1000000-0000-4000-8000-000000000001";
const mediaId = "a2000000-0000-4000-8000-000000000001";
const personId = "a3000000-0000-4000-8000-000000000001";
function fixture(): PublicStorySource {
  return {
    story: { id: storyId, slug: "synthetic-chronicle", status: "PUBLISHED", type: "CRONICA", collection: "DESDE_DENTRO",
      title: "Synthetic chronicle", dek: "Synthetic dek", context_location: "Circuit",
      content_blocks: [{ id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Synthetic text" }] },
        { id: "i", type: "IMAGE", mediaId }, { id: "e", type: "EVENT_REFERENCE", eventId: "event-1" }],
      schema_version: 1, hero_media_id: mediaId, seo_title: "CMS SEO title", seo_description: "CMS description",
      discipline_slugs: ["circuito"], territory_ids: ["cataluna"], published_at: "2030-01-02T12:00:00Z",
      updated_at: "2030-01-02T12:00:00Z", created_at: "2030-01-01T12:00:00Z", home_rank: null },
    media: [{ id: mediaId, story_id: storyId, bucket_id: "story-media", object_path: `${storyId}/${mediaId}/asset.webp`,
      width: 1600, height: 1000, mime_type: "image/webp", byte_size: 200, alt_text: "Synthetic image", caption: "Approved caption",
      credit: "Synthetic person", rights_type: "OWN", rights_notes: "PRIVATE_RIGHTS_SENTINEL", created_at: "2030-01-01T12:00:00Z", updated_at: "2030-01-01T12:00:00Z" }],
    credits: ["TEXT", "PHOTO"].map((role, index) => ({ story_id: storyId, person_id: personId, role: role as "TEXT" | "PHOTO", sort_order: index })),
    relations: [{ story_id: storyId, event_id: "event-1", relation_type: "PRIMARY", sort_order: 0 }],
    people: [{ id: personId, display_name: "Synthetic person" }],
    events: [{ id: "event-1", slug: "synthetic-event", title: "Synthetic event", start_date: "2030-01-01", venue: "Circuit", city: "City", province: "Province", visible: true }],
  };
}
const origin = "https://example.supabase.co";

test("public projection preserves approved article and multi-role byline without internal fields", () => {
  const input = fixture();
  const story = toPublicStory(input, origin)!;
  assert.ok(story);
  assert.deepEqual(story.blocks, input.story.content_blocks);
  assert.equal(story.media[mediaId].caption, "Approved caption");
  assert.equal(story.credits.length, 2);
  assert.equal(story.events["event-1"].href, "/evento/synthetic-event");
  const serialized = JSON.stringify(story);
  for (const sentinel of ["PRIVATE_RIGHTS_SENTINEL", "rights_notes", "object_path", "bucket_id", "created_at", "home_rank", "story-media-drafts", "/object/sign/"]) assert.ok(!serialized.includes(sentinel));
  assert.match(story.media[mediaId].resolvedUrl, /\/object\/public\/story-media\//);
});

for (const state of ["DRAFT", "READY", "ARCHIVED"] as const) test(`${state} never crosses public boundary`, () => {
  const input = fixture(); input.story.status = state;
  assert.equal(toPublicStory(input, origin), null);
});

test("missing date, invalid editorial content, private/misowned/noncanonical media fail closed", () => {
  const mutations: Array<(s: PublicStorySource) => void> = [
    (s) => { s.story.published_at = null; },
    (s) => { s.story.content_blocks.push(s.story.content_blocks[0]); },
    (s) => { s.media[0].bucket_id = "story-media-drafts"; },
    (s) => { s.media[0].story_id = "another-story"; },
    (s) => { s.media[0].object_path = "../secret.png"; },
    (s) => { s.media[0].width = 3201; },
    (s) => { s.media[0].rights_type = "UNKNOWN"; },
    (s) => { s.media[0].alt_text = ""; },
    (s) => { s.people = []; },
    (s) => { s.story.content_blocks[0] = { id: "private-link", type: "PARAGRAPH", content: [{ type: "LINK", href: "https://example.test/storage/v1/object/sign/story-media-drafts/a?token=secret", children: [{ type: "TEXT", text: "private" }] }] }; },
  ];
  for (const change of mutations) { const s = fixture(); change(s); assert.equal(toPublicStory(s, origin), null); }
});

test("unrelated and invisible events do not leak into public event references", () => {
  const s = fixture(); s.events[0].visible = false;
  s.events.push({ ...s.events[0], id: "not-related", visible: true });
  assert.deepEqual(toPublicStory(s, origin)!.events, {});
});

test("CMS SEO, stable image, author, publisher and real publication instant are retained", () => {
  const story = toPublicStory(fixture(), origin)!;
  const meta = buildStoryMetadata(story), ld = buildStoryJsonLd(story);
  assert.deepEqual(meta.title, { absolute: "CMS SEO title" });
  assert.equal(meta.description, "CMS description");
  assert.equal(meta.alternates?.canonical, "https://www.eventomotor.com/historias/synthetic-chronicle");
  assert.deepEqual(meta.robots, { index: true, follow: true });
  assert.ok(meta.openGraph && "type" in meta.openGraph);
  assert.equal(meta.openGraph.type, "article");
  assert.ok(meta.twitter && "card" in meta.twitter);
  assert.equal(meta.twitter.card, "summary_large_image");
  assert.equal(ld.datePublished, story.publishedAt);
  assert.deepEqual(ld.author, [{ "@type": "Person", name: "Synthetic person" }]);
  assert.equal(ld.publisher.name, "EventoMotor");
  assert.equal(ld.image[0], story.media[mediaId].resolvedUrl);
  const sitemap = buildStoriesSitemap([story]);
  assert.equal(sitemap.length, 1); assert.equal(sitemap[0].url, meta.alternates?.canonical);
  assert.deepEqual(buildStoriesSitemap([]), []);
  assert.ok(!serializeStoryJsonLd({ ...ld, headline: "</script><script>bad</script>" }).includes("<"));
});

test("real public loaders issue PUBLISHED-only queries, narrow selects and recheck state", async () => {
  const input = fixture(), calls: URL[] = [], previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-local-test-only";
  let currentState = "PUBLISHED";
  globalThis.fetch = async (request) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    assert.equal(url.hostname, "127.0.0.1"); calls.push(url);
    const table = url.pathname.split("/").at(-1), select = url.searchParams.get("select") ?? "";
    assert.notEqual(select, "*"); assert.ok(!select.includes("rights_notes"));
    let rows: unknown[] = [];
    if (table === "stories") {
      assert.equal(url.searchParams.get("status"), "eq.PUBLISHED");
      rows = currentState === "PUBLISHED" ? [{ ...input.story, status: currentState }] : [];
    } else if (table === "story_media") {
      assert.equal(url.searchParams.get("bucket_id"), "eq.story-media"); rows = input.media;
    } else if (table === "story_credits") rows = input.credits;
    else if (table === "story_events") rows = input.relations;
    else if (table === "editorial_people") rows = input.people;
    else if (table === "events") { assert.equal(url.searchParams.get("visible"), "eq.true"); rows = input.events; }
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.ok(await getPublicStory(input.story.slug));
    assert.equal((await listPublicStories()).length, 1);
    assert.equal((await getPublicStoriesForEvent("event-1")).length, 1);
    for (const status of ["DRAFT", "READY", "ARCHIVED"]) {
      currentState = status;
      assert.equal(await getPublicStory(input.story.slug), null);
      assert.deepEqual(await listPublicStories(), []);
      assert.deepEqual(await getPublicStoriesForEvent("event-1"), []);
    }
    assert.equal(await getPublicStory("../private"), null);
    assert.ok(calls.some((url) => url.searchParams.get("select") === "status,updated_at"));
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "synthetic unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
    assert.deepEqual(await getPublicStoriesForEvent("event-1"), [], "optional Story outage never breaks the event page or leaks data");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
