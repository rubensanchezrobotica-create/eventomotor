import "server-only";
import { EDITORIAL_STORY_COLLECTIONS } from "./story-types";

import { createSupabaseServerClient } from "@/lib/supabase";
import { buildCanonicalStoryMediaPublicUrl } from "./story-media.server";
import { assertStoryMediaObjectPath, isStoryMediaMimeType, STORY_MEDIA_PUBLIC_MAX_LONG_EDGE } from "./story-media-validation";
import { resolveStoryPublicImage } from "./story-responsive-images.server";
import type { StoryPublicImage } from "./story-responsive-images";

export type HomeStory = {
  slug: string;
  title: string;
  summary: string;
  hero: { src: string; alt: string; width: number; height: number; publicImage?: StoryPublicImage };
};

const STORY_SELECT = "id,slug,status,collection,title,dek,hero_media_id,published_at,updated_at";
const HERO_SELECT = "id,story_id,bucket_id,object_path,mime_type,width,height,alt_text,byte_size";

/** Optional Home enrichment: bounded, PUBLISHED-only and no body/admin DTO. */
export async function listHomeStories(): Promise<HomeStory[]> {
  const client = createSupabaseServerClient();
  if (!client) return [];
  try {
    const result = await client.from("stories").select(STORY_SELECT).eq("status", "PUBLISHED")
      .in("collection", [...EDITORIAL_STORY_COLLECTIONS])
      .order("published_at", { ascending: false }).order("id").limit(3);
    if (result.error || !result.data?.length) return [];
    const rows = result.data;
    const images = await client.from("story_media").select(HERO_SELECT).eq("bucket_id", "story-media")
      .in("id", rows.map((row) => row.hero_media_id).filter((id): id is string => Boolean(id)));
    if (images.error) return [];
    // A concurrent archival/edit must not escape via a previously read header.
    const latest = await client.from("stories").select("id,status,updated_at").eq("status", "PUBLISHED")
      .in("id", rows.map((row) => row.id));
    if (latest.error) return [];
    const output: HomeStory[] = [];
    const slugs = new Set<string>();
    for (const row of rows) {
      if (!EDITORIAL_STORY_COLLECTIONS.some((c) => c === row.collection)) continue;
      const hero = images.data?.find((image) => image.id === row.hero_media_id && image.story_id === row.id);
      if (row.status !== "PUBLISHED" || !row.published_at || !Number.isFinite(Date.parse(row.published_at))
        || !latest.data?.some((current) => current.id === row.id && current.status === "PUBLISHED" && current.updated_at === row.updated_at)
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || row.slug.length > 180 || slugs.has(row.slug)
        || !row.title.trim() || !row.dek.trim() || !hero || hero.bucket_id !== "story-media"
        || !hero.alt_text.trim() || !isStoryMediaMimeType(hero.mime_type)
        || !Number.isSafeInteger(hero.width) || !Number.isSafeInteger(hero.height)
        || Math.min(hero.width, hero.height) <= 0 || Math.max(hero.width, hero.height) > STORY_MEDIA_PUBLIC_MAX_LONG_EDGE) continue;
      try {
        assertStoryMediaObjectPath(hero.object_path, { storyId: row.id, mediaId: hero.id, mimeType: hero.mime_type });
        const summary = row.dek.trim().replace(/\s+/g, " ");
        const src = buildCanonicalStoryMediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", hero.object_path);
        const excerpt = summary.slice(0, 237);
        const sentenceEnd = Math.max(excerpt.lastIndexOf(". "), excerpt.lastIndexOf("! "), excerpt.lastIndexOf("? "));
        const item: HomeStory = { slug: row.slug, title: row.title.trim(),
          summary: summary.length <= 240 ? summary : sentenceEnd >= 80 ? excerpt.slice(0, sentenceEnd + 1) : `${excerpt.replace(/\s+\S*$/, "")}…`,
          hero: { src, alt: hero.alt_text, width: hero.width, height: hero.height,
            publicImage: resolveStoryPublicImage({ src, width: hero.width, height: hero.height, bytes: hero.byte_size }) } };
        if (/story-media-drafts|\/object\/sign\/|[?&](?:token|signature)=/i.test(JSON.stringify(item))) continue;
        output.push(item); slugs.add(row.slug);
      } catch { /* Invalid public locator fails closed for this item. */ }
    }
    return output;
  } catch { return []; } // An optional editorial outage never takes down the agenda.
}
