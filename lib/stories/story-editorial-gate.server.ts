import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EditorialPersonRow, StoryCreditRow, StoryEventRow, StoryMediaRow, StoryRow } from "@/lib/supabase";
import { storyCommercialGate } from "./story-commercial.server";
import { validateStoryCredits, validateStoryEventRelations, validateStoryPublication } from "./story-validation";

export type StoryAttribution = {
  credits: StoryCreditRow[];
  relations: StoryEventRow[];
  people: Pick<EditorialPersonRow, "id" | "display_name" | "active">[];
};

/** One editorial policy for preparation, READY saves and final publication.
 * Technical Storage delivery is a separate gate. A16D fences this read using
 * expectedUpdatedAt and rechecks attribution under the parent lock in SQL.
 */
export function storyEditorialGate(story: StoryRow, media: StoryMediaRow[], attribution: StoryAttribution) {
  const gate = validateStoryPublication({ id: story.id, slug: story.slug, status: "READY", type: story.type,
    collection: story.collection, title: story.title, dek: story.dek, contextLocation: story.context_location,
    heroMediaId: story.hero_media_id ?? "", schemaVersion: story.schema_version, contentBlocks: story.content_blocks,
    seoTitle: story.seo_title, seoDescription: story.seo_description, disciplineSlugs: story.discipline_slugs,
    territoryIds: story.territory_ids, publishedAt: story.published_at, updatedAt: story.updated_at, homeRank: story.home_rank,
  }, { media: media.map((item) => ({ id: item.id, altText: item.alt_text, rightsType: item.rights_type })) });
  const issues = [...gate.errors, ...storyCommercialGate(story).map((issue) => ({ code: "REQUIRED_VALUE" as const, ...issue }))];
  const credits = attribution.credits.map((c) => ({ personId: c.person_id, role: c.role, sortOrder: c.sort_order }));
  const relations = attribution.relations.map((r) => ({ eventId: r.event_id, relationType: r.relation_type, sortOrder: r.sort_order }));
  issues.push(...validateStoryCredits(credits).errors, ...validateStoryEventRelations(relations).errors);
  if (!credits.some((credit) => credit.role === "TEXT") || attribution.credits.some((credit) => credit.story_id !== story.id
    || !attribution.people.some((person) => person.id === credit.person_id && person.active && person.display_name.trim()))) {
    issues.push({ code: "REQUIRED_VALUE", field: "credits", message: "Se requiere un crédito TEXT y personas editoriales válidas." });
  }
  if (media.some((item) => item.story_id !== story.id) || attribution.relations.some((r) => r.story_id !== story.id)
    || story.content_blocks.some((block) => block.type === "EVENT_REFERENCE" && !relations.some((r) => r.eventId === block.eventId))) {
    issues.push({ code: "REQUIRED_VALUE", field: "relations", message: "Las referencias editoriales deben pertenecer a esta publicación." });
  }
  return issues;
}

export async function readStoryAttribution(client: SupabaseClient<Database>, storyId: string): Promise<StoryAttribution> {
  const [c, r] = await Promise.all([
    client.from("story_credits").select("story_id,person_id,role,sort_order").eq("story_id", storyId),
    client.from("story_events").select("story_id,event_id,relation_type,sort_order").eq("story_id", storyId),
  ]);
  if (c.error || r.error) throw new Error("Editorial attribution unavailable.");
  const ids = [...new Set((c.data ?? []).map((credit) => credit.person_id))];
  const p = ids.length ? await client.from("editorial_people").select("id,display_name,active").in("id", ids) : { data: [], error: null };
  if (p.error) throw new Error("Editorial people unavailable.");
  return { credits: c.data ?? [], relations: r.data ?? [], people: p.data ?? [] };
}
