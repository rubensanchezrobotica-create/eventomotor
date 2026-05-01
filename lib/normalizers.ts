import type { EventItem } from "@/types/event";
import { isDateText, parseDate } from "@/lib/date-utils";

function slugify(text: string) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeRemoteEvent(raw: unknown, index: number): EventItem | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;

  const title = String(record.title || record.name || "").trim();
  const start = String(record.start || record.startDate || record.date || "").slice(0, 10);
  const endCandidate = String(record.end || record.endDate || record.finishDate || start).slice(0, 10);

  if (!title || !isDateText(start)) return null;

  const discipline = String(record.discipline || record.category || "Motociclismo").trim();
  const venue = String(record.venue || record.location || "Por confirmar").trim();
  const city = String(record.city || record.locality || "Por confirmar").trim();
  const province = String(record.province || record.state || "Por confirmar").trim();

  return {
    id: String(record.id || `${slugify(title)}-${start}-${index}`),
    title,
    championship: String(record.championship || record.series || discipline),
    discipline,
    start,
    end: isDateText(endCandidate) ? endCandidate : start,
    venue,
    city,
    province,
    region: String(record.region || record.community || province),
    level: String(record.level || "Publicado"),
    source: String(record.source || record.feedName || "Fuente externa"),
    sourceUrl: String(record.sourceUrl || record.url || ""),
    ticketUrl: String(record.ticketUrl || record.ticketsUrl || ""),
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [discipline],
    featured: Boolean(record.featured),
  };
}

export function normalizeRemoteEvents(payload: unknown): EventItem[] {
  const list = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as { events?: unknown }).events)
      ? (payload as { events: unknown[] }).events
      : [];

  const seen = new Set();

  return list
    .map((item, index) => normalizeRemoteEvent(item, index))
    .filter((event): event is EventItem => Boolean(event))
    .filter((event) => {
      const key = `${event.title}-${event.start}-${event.venue}`.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
}
