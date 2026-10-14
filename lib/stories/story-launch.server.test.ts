import assert from "node:assert/strict";
import test from "node:test";
import { createStoryLaunchService } from "./story-launch.server";
import type { StoryAdminBundle } from "./story-admin.server";

const id = "b1000000-0000-4000-8000-000000000001", mediaId = "b2000000-0000-4000-8000-000000000001", personId = "b3000000-0000-4000-8000-000000000001";
function fixture(): StoryAdminBundle {
  return { story: { id, slug: "synthetic-launch", status: "DRAFT", type: "CRONICA", collection: "DESDE_DENTRO", title: "Synthetic", dek: "Synthetic dek",
    context_location: null, content_blocks: [{ id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Synthetic body" }] }],
    schema_version: 1, hero_media_id: mediaId, seo_title: "Synthetic SEO", seo_description: "Synthetic description",
    discipline_slugs: ["circuito"], territory_ids: ["cataluna"], published_at: null, home_rank: null, created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" },
    media: [{ id: mediaId, story_id: id, bucket_id: "story-media-drafts", object_path: `${id}/${mediaId}/asset.png`, width: 1200, height: 800,
      mime_type: "image/png", byte_size: 200, alt_text: "Synthetic", caption: "Synthetic caption", credit: "Synthetic person", rights_type: "OWN", rights_notes: "Private notes", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" }],
    people: [{ id: personId, display_name: "Synthetic person", active: true, created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" }],
    credits: [{ story_id: id, person_id: personId, role: "TEXT", sort_order: 0 }], eventRelations: [], relatedEvents: [] };
}

function harness(bundle = fixture(), readiness = true, concurrent = false) {
  const calls: string[] = [];
  const service = createStoryLaunchService({
    async getBundle() { return structuredClone(bundle); },
    async promote(input) {
      calls.push("promote"); assert.equal(input.requirePublicationMetadata, true);
      assert.equal(input.mediaId, mediaId);
      bundle.media[0].bucket_id = "story-media"; bundle.story.updated_at = "2030-01-01T00:00:01Z";
      if (concurrent) bundle.story.dek = "Concurrent change";
    },
    async markReady(current) { calls.push("ready"); assert.equal(current.story.updated_at, bundle.story.updated_at); bundle.story.status = "READY"; return bundle.story; },
    async readiness() { calls.push("readiness"); return { ready: readiness }; },
  });
  return { service, calls, bundle };
}

test("valid preparation preserves body and metadata and never calls publication itself", async () => {
  const h = harness(), before = structuredClone(h.bundle);
  const result = await h.service.prepare({ storyId: id, expectedUpdatedAt: before.story.updated_at });
  assert.equal(result.status, "READY"); assert.deepEqual(h.calls, ["promote", "ready", "readiness"]);
  assert.deepEqual(h.bundle.story.content_blocks, before.story.content_blocks);
  assert.equal(h.bundle.media[0].rights_notes, before.media[0].rights_notes);
  assert.deepEqual(h.bundle.credits, before.credits);
  assert.equal(h.bundle.story.published_at, null);
});

test("invalid editorial READY candidate is rejected BEFORE any promotion or mutation", async () => {
  const mutations: Array<(b: StoryAdminBundle) => void> = [
    (b) => { b.story.dek = ""; }, (b) => { b.story.content_blocks.push(b.story.content_blocks[0]); },
    (b) => { b.media[0].rights_type = "UNKNOWN"; }, (b) => { b.media[0].alt_text = ""; },
    (b) => { b.credits.push(b.credits[0]); }, (b) => { b.people = []; },
  ];
  for (const mutation of mutations) {
    const b = fixture(); mutation(b); const h = harness(b), before = structuredClone(b);
    await assert.rejects(h.service.prepare({ storyId: id, expectedUpdatedAt: b.story.updated_at }));
    assert.deepEqual(h.calls, []); assert.deepEqual(b, before);
  }
});

test("stale version and noneditable Story cause zero promotion", async () => {
  const h = harness(); await assert.rejects(h.service.prepare({ storyId: id, expectedUpdatedAt: "old" })); assert.deepEqual(h.calls, []);
  for (const status of ["PUBLISHED", "ARCHIVED"] as const) {
    const b = fixture(); b.story.status = status; const x = harness(b);
    await assert.rejects(x.service.prepare({ storyId: id, expectedUpdatedAt: b.story.updated_at })); assert.deepEqual(x.calls, []);
  }
});

test("concurrent editorial change stops preparation, preserves progress and never overwrites it", async () => {
  const h = harness(fixture(), true, true);
  await assert.rejects(h.service.prepare({ storyId: id, expectedUpdatedAt: h.bundle.story.updated_at }));
  assert.deepEqual(h.calls, ["promote"]); assert.equal(h.bundle.story.dek, "Concurrent change");
  assert.equal(h.bundle.story.status, "DRAFT");
});

test("technical readiness failure cannot report preparation success", async () => {
  const h = harness(fixture(), false);
  await assert.rejects(h.service.prepare({ storyId: id, expectedUpdatedAt: h.bundle.story.updated_at }));
  assert.deepEqual(h.calls, ["promote", "ready", "readiness"]); assert.equal(h.bundle.story.published_at, null);
});
