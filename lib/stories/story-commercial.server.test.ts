import assert from "node:assert/strict";
import test from "node:test";
import { commercialFixture } from "@/tests/stories/commercial-fixture";
import { commercialContentHash, storyCommercialGate } from "./story-commercial.server";
import { toPublicStory, getPublicStory, getPublicCollaboration, listPublicStories, listPublicCollaborations, getPublicStoriesForEvent } from "./story-public.server";
import { listHomeStories } from "./story-home.server";
import { buildStoryMetadata, buildStoryJsonLd, buildStoriesSitemap } from "./story-public-seo";
import { createStoryAdminMutationService, type StoryAdminMutationRepository } from "./story-admin.server";
import { createStoryPublicationService } from "./story-publication.server";
import { createStoryLaunchService } from "./story-launch.server";
import { validateStoryDocument } from "./story-validation";
import type { StoryAdminInput } from "./story-admin";

function approved() {
  const f = commercialFixture(), s = f.story;
  s.commercial_metadata = { ...s.commercial_metadata!, advertiserName: "Synthetic advertiser", advertiserConfirmed: true,
    factsVerified: true, editorialApprovalRef: "PRIVATE_APPROVAL_REF", imageAuthorizationRef: "PRIVATE_IMAGE_REF", commercialLinksChecked: true };
  s.commercial_metadata.approvedContentHash = commercialContentHash(s);
  return f;
}

test("incomplete metadata gives exact blockers without guessing advertiser or author", () => {
  const f = commercialFixture();
  assert.deepEqual(storyCommercialGate(f.story).map((i) => i.field), ["advertiserName", "factsVerified", "editorialApprovalRef", "imageAuthorizationRef", "commercialLinksChecked", "approvedContentHash"]);
  assert.equal(f.story.commercial_metadata!.advertiserName, "");
  assert.equal(f.people[0].display_name, "Synthetic agency author");
});

test("approval binds current text, links, taxonomy, hero and commercial evidence", () => {
  const f = approved();
  assert.deepEqual(storyCommercialGate(f.story), []);
  for (const mutate of [
    (s: typeof f.story) => { s.title += " changed"; },
    (s: typeof f.story) => { s.dek += " changed"; },
    (s: typeof f.story) => { s.hero_media_id = "c2000000-0000-4000-8000-000000000002"; },
    (s: typeof f.story) => { const p = s.content_blocks[0]; if (p.type === "PARAGRAPH") p.content = p.content.map((n, i) => i === 1 && n.type === "LINK" ? { ...n, href: "https://example.test/changed" } : n); },
    (s: typeof f.story) => { const p = s.content_blocks[0]; if (p.type === "PARAGRAPH") p.content = p.content.map((n, i) => i === 1 && n.type === "LINK" ? { ...n, children: [{ type: "TEXT", text: "Changed anchor" }] } : n); },
    (s: typeof f.story) => { const p = s.content_blocks[0]; if (p.type === "PARAGRAPH") p.content = p.content.map((n, i) => i === 1 && n.type === "LINK" ? { ...n, sponsored: false } : n); },
    (s: typeof f.story) => { s.content_blocks = [{ id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "changed" }] }]; },
    (s: typeof f.story) => { s.commercial_metadata!.advertiserName = "Another advertiser"; },
    (s: typeof f.story) => { s.commercial_metadata!.imageAuthorizationRef = "other"; },
  ]) {
    const changed = structuredClone(f.story); mutate(changed);
    assert.ok(storyCommercialGate(changed).some((i) => i.field === "approvedContentHash"));
  }
});

test("sponsored accepts only boolean, safe URLs and no arbitrary rel or HTML", () => {
  const f = approved(); assert.equal(validateStoryDocument({ schemaVersion: 1, contentBlocks: f.story.content_blocks }).ok, true);
  for (const override of [{ sponsored: "yes" }, { rel: "sponsored" }, { href: "javascript:alert(1)" }]) {
    const b = structuredClone(f.story.content_blocks[0]); assert.equal(b.type, "PARAGRAPH");
    const content = b.content.map((node, index) => index === 1 ? { ...node, ...override } : node);
    assert.equal(validateStoryDocument({ schemaVersion: 1, contentBlocks: [{ ...b, content }] }).ok, false);
  }
});

test("non-PUBLISHED commercial states stay private; published commercial has one Historias canonical", () => {
  const f = approved(), origin = "https://example.supabase.co";
  for (const status of ["DRAFT", "READY", "ARCHIVED"] as const) { f.story.status = status; assert.equal(toPublicStory(f, origin, true), null); }
  f.story.status = "PUBLISHED"; f.story.published_at = "2030-01-02T12:00:00Z";
  assert.equal(toPublicStory(f, origin), null);
  const p = toPublicStory(f, origin, true)!; assert.ok(p);
  assert.deepEqual(p.sponsor, { name: "Synthetic advertiser", label: "Contenido patrocinado" });
  assert.ok(!/PRIVATE_|commercial_metadata|approvedContentHash|rights_notes/.test(JSON.stringify(p)));
  const metadata = buildStoryMetadata(p), ld = buildStoryJsonLd(p);
  assert.equal(metadata.alternates?.canonical, "https://www.eventomotor.com/historias/synthetic-sponsored-article");
  assert.deepEqual(ld.author, [{ "@type": "Person", name: "Synthetic agency author" }]);
  assert.equal(ld.sponsor?.name, "Synthetic advertiser"); assert.equal(ld.publisher.name, "EventoMotor");
  assert.equal(buildStoriesSitemap([p])[0].url, metadata.alternates?.canonical);
});

test("real loaders include published commercial in Historias but exclude it from Home/events", async () => {
  const f = approved(); f.story.status = "PUBLISHED"; f.story.published_at = "2030-01-02T12:00:00Z";
  const oldFetch = globalThis.fetch, oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"; process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-only";
  const calls: URL[] = [];
  globalThis.fetch = async (input) => {
    const u = new URL(input instanceof Request ? input.url : String(input)); assert.equal(u.hostname, "127.0.0.1"); calls.push(u);
    const table = u.pathname.split("/").at(-1);
    const rows = table === "stories" ? [f.story] : table === "story_media" ? f.media : table === "story_credits" ? f.credits
      : table === "editorial_people" ? f.people : table === "story_events" ? [{ story_id: f.story.id }] : [];
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.equal((await getPublicStory(f.story.slug))?.collection, "COLABORACIONES");
    assert.equal((await listPublicStories()).filter((story) => story.slug === f.story.slug).length, 1);
    assert.deepEqual(await listHomeStories(), []);
    assert.deepEqual(await getPublicStoriesForEvent("synthetic-event"), []);
    assert.ok(await getPublicCollaboration(f.story.slug)); assert.equal((await listPublicCollaborations()).length, 1);
    const selects = calls.filter((u) => u.pathname.endsWith("/stories") && !u.searchParams.get("select")?.includes("status,updated_at"));
    assert.ok(selects.every((u) => u.searchParams.get("status") === "eq.PUBLISHED"));
    assert.ok(selects.every((u) => u.searchParams.has("collection")));
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("real admin service rejects READY without approval, ignores forged hashes, persists exact LINKs and rejects stale edits", async () => {
  let f = approved(); const version = f.story.updated_at; let writes = 0;
  const repository: StoryAdminMutationRepository = {
    async getAttribution() { return { credits: f.credits, people: f.people.map((p) => ({ ...p, active: true })), relations: f.relations }; },
    async createDraft() { throw new Error("not used"); }, async getStory() { return f.story; }, async findSlugOwner() { return null; },
    async getMediaByIds() { return f.media; }, async getRelatedEventIds() { return []; },
    async updateExpected(input) { writes++; f.story = { ...f.story, ...input.update, updated_at: "2030-01-01T00:00:01Z" }; return f.story; },
  };
  const s = f.story;
  const values: StoryAdminInput = { status: "READY", type: "ARTICULO", collection: "COLABORACIONES", title: s.title, dek: s.dek,
    slug: s.slug, contextLocation: "", contentBlocks: s.content_blocks, heroMediaId: s.hero_media_id!, seoTitle: s.seo_title,
    seoDescription: s.seo_description, disciplineSlugs: s.discipline_slugs, territoryIds: s.territory_ids, commercialMetadata: s.commercial_metadata };
  const service = createStoryAdminMutationService(repository);
  f = commercialFixture();
  await assert.rejects(service.updateDraft({ id: s.id, expectedUpdatedAt: version, values }), /gate comercial/); assert.equal(writes, 0);
  const saved = await service.updateDraft({ id: s.id, expectedUpdatedAt: version, values: { ...values, approveCommercialVersion: true } });
  assert.equal(saved.status, "READY"); assert.deepEqual(saved.content_blocks, s.content_blocks); assert.deepEqual(storyCommercialGate(saved), []);
  await assert.rejects(service.updateDraft({ id: s.id, expectedUpdatedAt: version, values }), /ha cambiado/); assert.equal(writes, 1);
});

test("publication service never commits a READY article whose commercial gate fails", async () => {
  const f = commercialFixture(); f.story.status = "READY"; let commits = 0;
  const service = createStoryPublicationService({ async getStory() { return f.story; }, async readiness() { return { ready: storyCommercialGate(f.story).length === 0 }; },
    async commit() { commits++; return f.story; } });
  await assert.rejects(service.publish({ storyId: f.story.id, expectedUpdatedAt: f.story.updated_at, requestId: "c4000000-0000-4000-8000-000000000001" }), /readiness/);
  assert.equal(commits, 0);
});

test("real preparation gate blocks commercial drafts before promotion despite a ready technical mock", async () => {
  const f = commercialFixture(); let promotions = 0, writes = 0;
  const service = createStoryLaunchService({
    async getBundle() { return { story: f.story, media: f.media, credits: f.credits, eventRelations: [], relatedEvents: [],
      people: f.people.map((p) => ({ ...p, active: true, created_at: f.story.created_at, updated_at: f.story.updated_at })) }; },
    async promote() { promotions++; }, async markReady() { writes++; return f.story; }, async readiness() { return { ready: true }; },
  });
  await assert.rejects(service.prepare({ storyId: f.story.id, expectedUpdatedAt: f.story.updated_at }), /gate comercial/);
  assert.equal(promotions, 0); assert.equal(writes, 0);
});
