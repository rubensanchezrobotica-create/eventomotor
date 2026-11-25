import type { MetadataRoute } from "next";
import { isIndexableFutureEvent, todayAtMidnight, validDate } from "@/lib/event-sitemap-eligibility";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";
import { OPPORTUNITY_PAGES } from "@/lib/opportunity-pages";
import { SEO_DISCIPLINES, SEO_ZONES } from "@/lib/seo-taxonomy";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  currentNewsletterProductionCanaryEnvironment,
  currentNewsletterPublicLaunchEnvironment,
  evaluateNewsletterProductionCanaryResendConfiguration,
  evaluateNewsletterPublicLaunchResendConfiguration,
} from "@/lib/newsletter/resend-config.server";
import type { EventRow } from "@/lib/supabase";
import { listPublicStories } from "@/lib/stories/story-public.server";
import { buildStoriesSitemap } from "@/lib/stories/story-public-seo";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];
type SitemapEvent = Pick<EventRow, "slug" | "start_date" | "created_at" | "updated_at" | "visible" | "event_status">;

// Metadata routes are cached by default. Publication/archival must be visible on
// the next canonical request, independently of deployment or action invalidation.
// This opt-out is scoped to /sitemap.xml, not the rest of the site.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sitemapEntry(
  path: string,
  lastModified: Date,
  changeFrequency: ChangeFrequency,
  priority: number,
) {
  return {
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}

function eventLastModified(event: SitemapEvent) {
  return validDate(event.updated_at) || validDate(event.created_at) || validDate(event.start_date) || new Date();
}

async function fallbackSitemapEvents(): Promise<SitemapEvent[]> {
  const fallbackEvents = await getVisibleEvents();

  return fallbackEvents.map((event) => ({
    slug: event.slug || null,
    start_date: event.start,
    created_at: event.start,
    updated_at: event.start,
    visible: event.visible !== false,
    event_status: event.eventStatus || "confirmed",
  }));
}

async function getSitemapEvents(): Promise<SitemapEvent[]> {
  const supabase = createSupabaseServerClient();

  if (!supabase) return fallbackSitemapEvents();

  const { data, error } = await supabase
    .from("events")
    .select("slug,start_date,created_at,updated_at,visible,event_status")
    .eq("visible", true)
    .gte("start_date", todayAtMidnight().toISOString().slice(0, 10))
    .order("start_date", { ascending: true });

  if (error || !data) return fallbackSitemapEvents();

  return data as SitemapEvent[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getSitemapEvents();
  const stories = await listPublicStories();
  const now = new Date();
  const publicNewsletter = evaluateNewsletterPublicLaunchResendConfiguration(
    currentNewsletterPublicLaunchEnvironment(),
  );
  const canaryNewsletter = evaluateNewsletterProductionCanaryResendConfiguration(
    currentNewsletterProductionCanaryEnvironment(),
  );
  const staticEntries = [
    sitemapEntry("/", now, "daily", 1),
    sitemapEntry("/contacto", now, "monthly", 0.6),
    sitemapEntry("/publicar-evento", now, "weekly", 0.6),
    sitemapEntry("/aviso-legal", now, "yearly", 0.3),
    sitemapEntry("/privacidad", now, "yearly", 0.3),
    sitemapEntry("/cookies", now, "yearly", 0.3),
    sitemapEntry("/calendario", now, "daily", 0.9),
    sitemapEntry("/disciplinas", now, "weekly", 0.8),
    sitemapEntry("/zonas", now, "weekly", 0.8),
    sitemapEntry("/historias", now, "weekly", 0.6),
    ...(publicNewsletter.enabled && !canaryNewsletter.enabled
      ? [sitemapEntry("/newsletter", now, "weekly", 0.6)]
      : []),
  ];
  const taxonomyEntries = [
    ...SEO_DISCIPLINES.map((discipline) =>
      sitemapEntry(`/disciplinas/${discipline.slug}`, now, "weekly", 0.75),
    ),
    ...SEO_ZONES.map((zone) =>
      sitemapEntry(`/zonas/${zone.slug}`, now, "weekly", 0.75),
    ),
  ];
  const opportunityEntries = OPPORTUNITY_PAGES.map((page) =>
    sitemapEntry(`/${page.slug}`, now, "daily", 0.85),
  );
  const eventEntries = events
    .filter((event) => isIndexableFutureEvent(event))
    .map((event) =>
      sitemapEntry(`/evento/${event.slug}`, eventLastModified(event), "weekly", 0.7),
    );

  return [...staticEntries, ...taxonomyEntries, ...opportunityEntries, ...eventEntries, ...buildStoriesSitemap(stories)];
}
