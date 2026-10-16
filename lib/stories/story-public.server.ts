import "server-only";

import { cache } from "react";
import { createSupabaseServerClient, type StoryRow, type StoryMediaRow, type StoryCreditRow, type StoryEventRow } from "@/lib/supabase";
import { buildCanonicalStoryMediaPublicUrl } from "./story-media.server";
import { assertStoryMediaObjectPath, isStoryMediaMimeType, STORY_MEDIA_PUBLIC_BUCKET, STORY_MEDIA_PUBLIC_MAX_LONG_EDGE } from "./story-media-validation";
import { collectStoryMediaIds, validateStoryPublication } from "./story-validation";
import type { StoryCredit } from "./story-types";
import { resolveStoryPublicImage } from "./story-responsive-images.server";
import type { StoryRendererMedia, StoryRendererEvent } from "@/components/redesign-v2/stories/StoryRenderer";

// No admin bundle, rights notes, signed URL, object locator or raw row is returned.
export type PublicStory = {
  slug: string; title: string; dek: string; type: StoryRow["type"]; collection: StoryRow["collection"];
  contextLocation: string | null; heroMediaId: string; blocks: StoryRow["content_blocks"];
  media: Record<string, StoryRendererMedia>; events: Record<string, StoryRendererEvent>;
  credits: StoryCredit[]; people: Record<string, string>;
  seoTitle: string; seoDescription: string; publishedAt: string; updatedAt: string;
};
export type PublicStorySource = {
  story: StoryRow; media: StoryMediaRow[]; credits: StoryCreditRow[]; relations: StoryEventRow[];
  people: Array<{ id: string; display_name: string }>;
  events: Array<{ id: string; slug: string | null; title: string; start_date: string; venue: string | null; city: string | null; province: string | null; visible: boolean | null }>;
};

export function toPublicStory(source: PublicStorySource, supabaseUrl: string): PublicStory | null {
  const { story } = source;
  if (story.status !== "PUBLISHED" || !story.published_at || Number.isNaN(Date.parse(story.published_at))) return null;
  const gate = validateStoryPublication({
    id: story.id, slug: story.slug, status: "READY", type: story.type, collection: story.collection,
    title: story.title, dek: story.dek, contextLocation: story.context_location,
    schemaVersion: story.schema_version, contentBlocks: story.content_blocks, heroMediaId: story.hero_media_id ?? "",
    seoTitle: story.seo_title, seoDescription: story.seo_description,
    disciplineSlugs: story.discipline_slugs, territoryIds: story.territory_ids,
    publishedAt: story.published_at, updatedAt: story.updated_at,
  }, { media: source.media.map((item) => ({ id: item.id, altText: item.alt_text, rightsType: item.rights_type })) });
  if (!gate.ok) return null;
  const required = new Set([story.hero_media_id!, ...collectStoryMediaIds(story.content_blocks)]);
  const media: PublicStory["media"] = {};
  try {
    for (const id of required) {
      const item = source.media.find((candidate) => candidate.id === id);
      if (!item || item.story_id !== story.id || item.bucket_id !== STORY_MEDIA_PUBLIC_BUCKET || !isStoryMediaMimeType(item.mime_type)
        || !Number.isSafeInteger(item.width) || !Number.isSafeInteger(item.height) || Math.min(item.width, item.height) <= 0
        || Math.max(item.width, item.height) > STORY_MEDIA_PUBLIC_MAX_LONG_EDGE) return null;
      assertStoryMediaObjectPath(item.object_path, { storyId: story.id, mediaId: id, mimeType: item.mime_type });
      const resolvedUrl = buildCanonicalStoryMediaPublicUrl(supabaseUrl, item.object_path);
      media[id] = { id, resolvedUrl, width: item.width,
        height: item.height, altText: item.alt_text, caption: item.caption, credit: item.credit,
        publicImage: resolveStoryPublicImage({ src: resolvedUrl, width: item.width, height: item.height, bytes: item.byte_size }) };
    }
  } catch { return null; }
  // Defend the public boundary even if a privileged legacy writer saved a private link.
  if (/story-media-drafts|\/object\/sign\/|[?&](?:token|signature)=/i.test(JSON.stringify(story.content_blocks))) return null;
  const people = Object.fromEntries(source.people.map((person) => [person.id, person.display_name]));
  const credits = source.credits.filter((credit) => credit.story_id === story.id)
    .map((credit) => ({ personId: credit.person_id, role: credit.role, sortOrder: credit.sort_order }));
  if (!credits.length || credits.some((credit) => !people[credit.personId])) return null;
  const relatedIds = new Set(source.relations.filter((relation) => relation.story_id === story.id).map((relation) => relation.event_id));
  const events = Object.fromEntries(source.events.filter((event) => event.visible === true && relatedIds.has(event.id)
    && event.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug)).map((event) => [event.id, {
      id: event.id, title: event.title, href: `/evento/${event.slug}`, date: event.start_date,
      location: [event.venue, event.city, event.province].filter(Boolean).join(", "),
    }]));
  const projected = { slug: story.slug, title: story.title, dek: story.dek, type: story.type, collection: story.collection,
    contextLocation: story.context_location, heroMediaId: story.hero_media_id!, blocks: story.content_blocks,
    media, events, credits, people, seoTitle: story.seo_title, seoDescription: story.seo_description,
    publishedAt: story.published_at, updatedAt: story.updated_at };
  if (/story-media-drafts|\/object\/sign\/|[?&](?:token|signature)=/i.test(JSON.stringify(projected))) return null;
  return projected;
}

const STORY_SELECT = "id,slug,status,type,collection,title,dek,context_location,content_blocks,schema_version,hero_media_id,seo_title,seo_description,discipline_slugs,territory_ids,published_at,updated_at";
const MEDIA_SELECT = "id,story_id,bucket_id,object_path,width,height,mime_type,byte_size,alt_text,caption,credit,rights_type";

async function loadPublicStory(slug: string): Promise<PublicStory | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) return null;
  const client = createSupabaseServerClient();
  if (!client) return null;
  const storyResult = await client.from("stories").select(STORY_SELECT).eq("slug", slug).eq("status", "PUBLISHED").maybeSingle();
  if (storyResult.error) throw new Error("Public Story lookup unavailable.");
  if (!storyResult.data) return null;
  const story = storyResult.data as StoryRow;
  const [m, c, r] = await Promise.all([
    client.from("story_media").select(MEDIA_SELECT).eq("story_id", story.id).eq("bucket_id", STORY_MEDIA_PUBLIC_BUCKET),
    client.from("story_credits").select("story_id,person_id,role,sort_order").eq("story_id", story.id).order("sort_order"),
    client.from("story_events").select("story_id,event_id,relation_type,sort_order").eq("story_id", story.id).order("sort_order"),
  ]);
  if (m.error || c.error || r.error) throw new Error("Public Story dependencies unavailable.");
  const credits = c.data ?? [], relations = r.data ?? [];
  const [p, e] = await Promise.all([
    credits.length ? client.from("editorial_people").select("id,display_name").in("id", credits.map((credit) => credit.person_id)) : { data: [], error: null },
    relations.length ? client.from("events").select("id,slug,title,start_date,venue,city,province,visible")
      .in("id", relations.map((relation) => relation.event_id)).eq("visible", true) : { data: [], error: null },
  ]);
  if (p.error || e.error) throw new Error("Public Story attribution unavailable.");
  // Recheck after dependent reads: ARCHIVED cannot leak through a stale first read.
  const latest = await client.from("stories").select("status,updated_at").eq("id", story.id).eq("status", "PUBLISHED").maybeSingle();
  if (latest.error) throw new Error("Public Story state unavailable.");
  if (!latest.data || latest.data.updated_at !== story.updated_at) return null;
  return toPublicStory({ story, media: (m.data ?? []) as StoryMediaRow[], credits, relations, people: p.data ?? [], events: e.data ?? [] }, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
}

// Request memoization only; no cross-request cache of editorial rows.
export const getPublicStory = cache(loadPublicStory);

export async function listPublicStories(): Promise<PublicStory[]> {
  const client = createSupabaseServerClient();
  if (!client) return [];
  const { data, error } = await client.from("stories").select("slug").eq("status", "PUBLISHED").order("published_at", { ascending: false });
  if (error) throw new Error("Published Stories list unavailable.");
  const stories = await Promise.all((data ?? []).map((row) => getPublicStory(row.slug)));
  return stories.filter((story): story is PublicStory => story !== null);
}

async function loadPublicStoriesForEvent(eventId: string) {
  const client = createSupabaseServerClient();
  if (!client) return [];
  const { data, error } = await client.from("story_events").select("story_id").eq("event_id", eventId);
  if (error) throw new Error("Related published Stories unavailable.");
  if (!data?.length) return [];
  const s = await client.from("stories").select("slug").in("id", data.map((row) => row.story_id)).eq("status", "PUBLISHED").order("published_at", { ascending: false });
  if (s.error) throw new Error("Related published Stories unavailable.");
  const stories = await Promise.all((s.data ?? []).map((row) => getPublicStory(row.slug)));
  return stories.filter((story): story is PublicStory => story !== null)
    .map((story) => ({ slug: story.slug, title: story.title, collection: story.collection }));
}

export async function getPublicStoriesForEvent(eventId: string) {
  // Optional editorial enrichment must not break the established event agenda.
  // Unavailable or non-public dependencies render no module, never private data.
  try { return await loadPublicStoriesForEvent(eventId); }
  catch { return []; }
}
