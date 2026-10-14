import "server-only";

import { createHash } from "node:crypto";
import { getStoryForAdmin, updateStoryDraft, StoryAdminError, type StoryAdminBundle } from "./story-admin.server";
import { createSupabaseStoryMediaService } from "./story-media.server";
import { assertStoryMediaUuid } from "./story-media-validation";
import { collectStoryMediaIds, validateStoryPublication, validateStoryCredits, validateStoryEventRelations } from "./story-validation";
import type { StoryRow } from "@/lib/supabase";

export function storyEditorialFingerprint(bundle: StoryAdminBundle) {
  const { updated_at: _version, status: _status, published_at: _published, ...story } = bundle.story;
  void _version; void _status; void _published;
  return createHash("sha256").update(JSON.stringify({ story, credits: bundle.credits, relations: bundle.eventRelations,
    media: bundle.media.map((item) => ({ id: item.id, story_id: item.story_id, alt_text: item.alt_text,
      caption: item.caption, credit: item.credit, rights_type: item.rights_type, rights_notes: item.rights_notes })) })).digest("hex");
}

function assertEditorialGate(bundle: StoryAdminBundle) {
  const s = bundle.story;
  const gate = validateStoryPublication({ id: s.id, slug: s.slug, status: "READY", type: s.type, collection: s.collection,
    title: s.title, dek: s.dek, contextLocation: s.context_location, heroMediaId: s.hero_media_id ?? "",
    schemaVersion: s.schema_version, contentBlocks: s.content_blocks, seoTitle: s.seo_title, seoDescription: s.seo_description,
    disciplineSlugs: s.discipline_slugs, territoryIds: s.territory_ids, publishedAt: s.published_at, updatedAt: s.updated_at,
    homeRank: s.home_rank }, { media: bundle.media.map((item) => ({ id: item.id, altText: item.alt_text, rightsType: item.rights_type })) });
  const credits = bundle.credits.map((c) => ({ personId: c.person_id, role: c.role, sortOrder: c.sort_order }));
  const events = bundle.eventRelations.map((e) => ({ eventId: e.event_id, relationType: e.relation_type, sortOrder: e.sort_order }));
  if (!gate.ok || !validateStoryCredits(credits).ok || !validateStoryEventRelations(events).ok
    || !credits.some((c) => c.role === "TEXT") || credits.some((c) => !bundle.people.some((p) => p.id === c.personId))
    || bundle.media.some((m) => m.story_id !== s.id)) {
    throw new StoryAdminError("STORY_INPUT_INVALID", "El gate editorial completo no permite preparar esta Historia.");
  }
}

export function createStoryLaunchService(deps: {
  getBundle(id: string): Promise<StoryAdminBundle | null>;
  promote(input: { storyId: string; mediaId: string; expectedUpdatedAt: string; requirePublicationMetadata: boolean }): Promise<unknown>;
  markReady(bundle: StoryAdminBundle): Promise<StoryRow>;
  readiness(id: string): Promise<{ ready: boolean }>;
}) {
  return {
    async prepare(input: { storyId: string; expectedUpdatedAt: string }) {
      assertStoryMediaUuid(input.storyId, "storyId");
      let bundle = await deps.getBundle(input.storyId);
      if (!bundle) throw new StoryAdminError("STORY_NOT_FOUND", "La Historia no existe.");
      if (!["DRAFT", "READY"].includes(bundle.story.status)) throw new StoryAdminError("STORY_NOT_EDITABLE", "La Historia no es editable.");
      if (bundle.story.updated_at !== input.expectedUpdatedAt) throw new StoryAdminError("STORY_VERSION_CONFLICT", "La versión revisada ha cambiado.");
      assertEditorialGate(bundle);
      const fingerprint = storyEditorialFingerprint(bundle);
      const requiredIds = new Set([bundle.story.hero_media_id!, ...collectStoryMediaIds(bundle.story.content_blocks)]);
      for (const mediaId of requiredIds) {
        const item = bundle.media.find((m) => m.id === mediaId)!;
        // Existing service verifies original bytes, sanitizes without crop, uses
        // immutable paths/upsert:false and verifies an existing derivative on retry.
        await deps.promote({ storyId: input.storyId, mediaId, expectedUpdatedAt: item.updated_at, requirePublicationMetadata: true });
        const current = await deps.getBundle(input.storyId);
        if (!current || !["DRAFT", "READY"].includes(current.story.status) || storyEditorialFingerprint(current) !== fingerprint) {
          throw new StoryAdminError("STORY_VERSION_CONFLICT", "El contenido editorial ha cambiado durante la preparación. Se conserva el progreso.");
        }
        bundle = current;
      }
      assertEditorialGate(bundle);
      const ready = bundle.story.status === "READY" ? bundle.story : await deps.markReady(bundle);
      // Real byte decode, catalog ownership and anonymous public delivery, not a mock gate.
      if (!(await deps.readiness(input.storyId)).ready) throw new StoryAdminError("STORY_INPUT_INVALID", "Los medios o el contenido no superan el gate técnico.");
      return ready;
    },
  };
}

export async function prepareStoryForPublication(input: { storyId: string; expectedUpdatedAt: string }) {
  const media = createSupabaseStoryMediaService();
  return createStoryLaunchService({
    getBundle: getStoryForAdmin, promote: (request) => media.promote(request), readiness: (id) => media.publicationReadiness(id),
    markReady: (bundle) => {
      const s = bundle.story;
      return updateStoryDraft({ id: s.id, expectedUpdatedAt: s.updated_at, values: {
        status: "READY", type: s.type, collection: s.collection, title: s.title, dek: s.dek,
        contextLocation: s.context_location ?? "", slug: s.slug, disciplineSlugs: s.discipline_slugs,
        territoryIds: s.territory_ids, contentBlocks: s.content_blocks, heroMediaId: s.hero_media_id ?? "",
        seoTitle: s.seo_title, seoDescription: s.seo_description,
      } });
    },
  }).prepare(input);
}
