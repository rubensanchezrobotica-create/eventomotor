import "server-only";
import { storyEditorialGate } from "./story-editorial-gate.server";

import { createHash } from "node:crypto";
import { getStoryForAdmin, updateStoryDraft, StoryAdminError, type StoryAdminBundle } from "./story-admin.server";
import { createSupabaseStoryMediaService } from "./story-media.server";
import { assertStoryMediaUuid } from "./story-media-validation";
import { collectStoryMediaIds } from "./story-validation";
import type { StoryRow } from "@/lib/supabase";

export function storyEditorialFingerprint(bundle: StoryAdminBundle) {
  const { updated_at: _version, status: _status, published_at: _published, ...story } = bundle.story;
  void _version; void _status; void _published;
  return createHash("sha256").update(JSON.stringify({ story, credits: bundle.credits, relations: bundle.eventRelations,
    media: bundle.media.map((item) => ({ id: item.id, story_id: item.story_id, alt_text: item.alt_text,
      caption: item.caption, credit: item.credit, rights_type: item.rights_type, rights_notes: item.rights_notes })) })).digest("hex");
}

function assertEditorialGate(bundle: StoryAdminBundle) {
  const issues = storyEditorialGate(bundle.story, bundle.media, { credits: bundle.credits, relations: bundle.eventRelations, people: bundle.people });
  if (issues.length) throw new StoryAdminError("STORY_INPUT_INVALID", "El gate comercial/editorial completo no permite preparar esta publicación.", issues);
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
        commercialMetadata: s.commercial_metadata ?? null,
        status: "READY", type: s.type, collection: s.collection, title: s.title, dek: s.dek,
        contextLocation: s.context_location ?? "", slug: s.slug, disciplineSlugs: s.discipline_slugs,
        territoryIds: s.territory_ids, contentBlocks: s.content_blocks, heroMediaId: s.hero_media_id ?? "",
        seoTitle: s.seo_title, seoDescription: s.seo_description,
      } });
    },
  }).prepare(input);
}
