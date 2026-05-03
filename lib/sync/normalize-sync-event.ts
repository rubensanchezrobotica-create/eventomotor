import type { RawEvent } from "@/lib/scrapers/types";
import { createEventSlug } from "@/lib/slug";
import type { EventUpsert } from "@/lib/supabase";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildEventId(event: RawEvent) {
  if (event.id) {
    return event.id;
  }

  const source = slugify(event.source || "external");
  const title = slugify(event.title);
  const start = slugify(event.start);
  const venue = slugify(event.venue || "venue-pending");

  return [source, title, start, venue].filter(Boolean).join("-");
}

export function normalizeSyncEvent(event: RawEvent): EventUpsert {
  const title = normalizeText(event.title);
  const discipline = event.discipline?.trim() || "Motociclismo";
  const venue = event.venue?.trim() || "Por confirmar";
  const tags = event.tags?.map((tag) => tag.trim()).filter(Boolean);

  return {
    id: buildEventId({ ...event, title, discipline, venue }),
    slug: createEventSlug(title, event.start),
    title,
    championship: event.championship?.trim() || discipline,
    discipline,
    start_date: event.start,
    end_date: event.end || event.start,
    venue,
    city: event.city?.trim() || null,
    province: event.province?.trim() || null,
    region: event.region?.trim() || event.province?.trim() || null,
    level: event.level?.trim() || "Publicado",
    source: event.source.trim(),
    source_id: event.sourceId?.trim() || null,
    source_url: event.sourceUrl?.trim() || "",
    ticket_url: event.ticketUrl?.trim() || "",
    tags: tags?.length ? tags : [discipline],
    featured: Boolean(event.featured),
    visible: true,
    import_method: "scraper-rfme",
    data_quality: "draft",
    notes: null,
    updated_at: new Date().toISOString(),
  };
}
