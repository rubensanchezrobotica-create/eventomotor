import "server-only";

import { getVehicleType } from "@/lib/event-classification";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import { FALLBACK_EVENTS } from "@/lib/fallback-events";
import { createEventSlug } from "@/lib/slug";
import { resolveFeaturedStatus } from "@/lib/temporary-featured-events";
import type { EventItem } from "@/types/event";

const HOME_EVENT_SELECT = [
  "id",
  "slug",
  "title",
  "championship",
  "discipline",
  "start_date",
  "end_date",
  "venue",
  "city",
  "province",
  "region",
  "source",
  "source_url",
  "ticket_url",
  "tags",
  "vehicle_type",
  "featured",
  "latitude",
  "longitude",
].join(",");

type HomeEventRow = Pick<
  EventRow,
  | "id"
  | "slug"
  | "title"
  | "championship"
  | "discipline"
  | "start_date"
  | "end_date"
  | "venue"
  | "city"
  | "province"
  | "region"
  | "source"
  | "source_url"
  | "ticket_url"
  | "tags"
  | "vehicle_type"
  | "featured"
  | "latitude"
  | "longitude"
>;

function projectHomeEvent(event: EventItem): EventItem {
  const vehicleType = getVehicleType(event);

  return {
    id: event.id,
    slug: event.slug || createEventSlug(event.title, event.start),
    title: event.title,
    championship: event.championship,
    discipline: event.discipline,
    start: event.start,
    end: event.end,
    venue: event.venue,
    city: event.city,
    province: event.province,
    region: event.region,
    level: event.level,
    source: event.source,
    sourceUrl: event.sourceUrl,
    ticketUrl: event.ticketUrl,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    tags: event.tags,
    vehicleType,
    vehicle_type: vehicleType,
    featured: event.featured,
  };
}

function mapHomeEventRow(row: HomeEventRow): EventItem {
  const vehicleType = getVehicleType({
    title: row.title,
    championship: row.championship,
    discipline: row.discipline,
    source: row.source,
    tags: row.tags,
    vehicle_type: row.vehicle_type,
  });

  return {
    id: row.id,
    slug: row.slug || createEventSlug(row.title, row.start_date),
    title: row.title,
    championship: row.championship || row.discipline || "Motociclismo",
    discipline: row.discipline || "Motociclismo",
    start: row.start_date,
    end: row.end_date || row.start_date,
    venue: row.venue || "Por confirmar",
    city: row.city || "Por confirmar",
    province: row.province || "Por confirmar",
    region: row.region || row.province || "Por confirmar",
    level: "Publicado",
    source: row.source || "Supabase",
    sourceUrl: row.source_url || "",
    ticketUrl: row.ticket_url || "",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    tags: row.tags?.length ? row.tags : [row.discipline || "Motociclismo"],
    vehicleType,
    vehicle_type: vehicleType,
    featured: resolveFeaturedStatus(row.slug, row.featured),
  };
}

function fallbackVisibleEvents(): EventItem[] {
  return FALLBACK_EVENTS.filter((event) => event.visible !== false).map((event) => ({
    ...event,
    slug: event.slug || createEventSlug(event.title, event.start),
  }));
}

export async function getVisibleEvents() {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return fallbackVisibleEvents();
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("visible", true)
    .order("start_date", { ascending: true });

  if (error || !data) {
    return fallbackVisibleEvents();
  }

  const events = (data as EventRow[]).map(mapEventRowToEventItem);

  return events.length ? events : fallbackVisibleEvents();
}

export async function getHomeVisibleEvents() {
  const fallbackEvents = fallbackVisibleEvents().map(projectHomeEvent);
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return fallbackEvents;
  }

  const { data, error } = await supabase
    .from("events")
    .select(HOME_EVENT_SELECT)
    .eq("visible", true)
    .order("start_date", { ascending: true });

  if (error || !data) {
    return fallbackEvents;
  }

  const events = (data as unknown as HomeEventRow[]).map(mapHomeEventRow);
  return events.length ? events : fallbackEvents;
}
