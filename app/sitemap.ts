import type { MetadataRoute } from "next";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";
import { OPPORTUNITY_PAGES } from "@/lib/opportunity-pages";
import { SEO_DISCIPLINES, SEO_ZONES } from "@/lib/seo-taxonomy";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];
type SitemapEvent = Pick<EventRow, "slug" | "start_date" | "created_at" | "updated_at" | "visible" | "event_status">;

const EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const revalidate = 3600;

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

function validDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function todayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isFutureEvent(event: SitemapEvent) {
  const start = validDate(event.start_date);
  return Boolean(start && start.getTime() >= todayAtMidnight().getTime());
}

function eventLastModified(event: SitemapEvent) {
  return validDate(event.updated_at) || validDate(event.created_at) || validDate(event.start_date) || new Date();
}

function isIndexableFutureEvent(event: SitemapEvent) {
  const slug = event.slug?.trim() || "";
  const status = event.event_status?.trim() || "confirmed";

  return event.visible !== false && EVENT_SLUG_PATTERN.test(slug) && status !== "cancelled" && isFutureEvent(event);
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
  const now = new Date();
  const staticEntries = [
    sitemapEntry("/", now, "daily", 1),
    sitemapEntry("/contacto", now, "monthly", 0.6),
    sitemapEntry("/publicar-evento", now, "weekly", 0.6),
    sitemapEntry("/aviso-legal", now, "yearly", 0.3),
    sitemapEntry("/privacidad", now, "yearly", 0.3),
    sitemapEntry("/cookies", now, "yearly", 0.3),
    sitemapEntry("/disciplinas", now, "weekly", 0.8),
    sitemapEntry("/zonas", now, "weekly", 0.8),
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
    .filter(isIndexableFutureEvent)
    .map((event) =>
      sitemapEntry(`/evento/${event.slug}`, eventLastModified(event), "weekly", 0.7),
    );

  return [...staticEntries, ...taxonomyEntries, ...opportunityEntries, ...eventEntries];
}
