import assert from "node:assert/strict";
import test from "node:test";
import { commercialFixture } from "@/tests/stories/commercial-fixture";
import { commercialContentHash } from "./story-commercial.server";
import { storyEditorialGate, type StoryAttribution } from "./story-editorial-gate.server";
import { createStoryAdminMutationService, type StoryAdminMutationRepository } from "./story-admin.server";

function fixture() {
  const f = commercialFixture();
  Object.assign(f.story.commercial_metadata!, { advertiserName: "Synthetic advertiser", advertiserConfirmed: true,
    factsVerified: true, editorialApprovalRef: "SYNTHETIC", imageAuthorizationRef: "SYNTHETIC", commercialLinksChecked: true });
  f.story.commercial_metadata!.approvedContentHash = commercialContentHash(f.story);
  const attribution: StoryAttribution = { credits: f.credits, relations: f.relations, people: f.people.map((p) => ({ ...p, active: true })) };
  return { ...f, attribution };
}

test("shared real gate accepts complete editorial/commercial candidates and rejects missing authors/people", () => {
  for (const commercial of [false, true]) {
    const f = fixture();
    if (!commercial) { f.story.collection = "DESDE_DENTRO"; f.story.type = "REPORTAJE"; f.story.commercial_metadata = null; }
    assert.deepEqual(storyEditorialGate(f.story, f.media, f.attribution), []);
    assert.ok(storyEditorialGate({ ...f.story, hero_media_id: null }, f.media, f.attribution).some((issue) => issue.code === "HERO_REQUIRED"));
    for (const change of [
      (a: StoryAttribution) => { a.credits = []; },
      (a: StoryAttribution) => { a.credits[0].role = "PHOTO"; },
      (a: StoryAttribution) => { a.people = []; },
      (a: StoryAttribution) => { a.people[0].active = false; },
      (a: StoryAttribution) => { a.credits[0].person_id = "missing-person"; },
    ]) {
      const a = structuredClone(f.attribution); change(a);
      assert.ok(storyEditorialGate(f.story, f.media, a).some((issue) => issue.field === "credits"));
    }
  }
});

test("READY uses the same gate and refuses missing attribution before any update", async () => {
  const f = fixture(); let writes = 0;
  const repository: StoryAdminMutationRepository = {
    async createDraft() { throw Error("unused"); }, async getStory() { return f.story; }, async findSlugOwner() { return null; },
    async getMediaByIds() { return f.media; }, async getRelatedEventIds() { return []; },
    async getAttribution() { return { ...f.attribution, credits: [] }; },
    async updateExpected() { writes++; return f.story; },
  };
  const s = f.story;
  await assert.rejects(createStoryAdminMutationService(repository).updateDraft({ id: s.id, expectedUpdatedAt: s.updated_at, values: {
    status: "READY", type: s.type, collection: s.collection, title: s.title, dek: s.dek, slug: s.slug, contextLocation: "",
    contentBlocks: s.content_blocks, heroMediaId: s.hero_media_id!, seoTitle: s.seo_title, seoDescription: s.seo_description,
    disciplineSlugs: s.discipline_slugs, territoryIds: s.territory_ids, commercialMetadata: s.commercial_metadata,
  } }), /gate editorial/);
  assert.equal(writes, 0);
});
