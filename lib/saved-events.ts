export type SavedEvent = {
  slug: string;
  title: string;
  start: string;
  end: string;
  city: string;
  province: string;
  venue: string;
  discipline: string;
  category?: string;
  vehicle_type?: string;
  source_url?: string;
  ticket_url?: string;
};

export const SAVED_EVENTS_STORAGE_KEY = "eventomotor:saved-events";

function readRawSavedEvents() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedEvents(events: SavedEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify(events));
}

export function getSavedEvents() {
  return readRawSavedEvents()
    .filter((event): event is SavedEvent => Boolean(event?.slug && event?.title && event?.start))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function isEventSaved(slug: string) {
  return getSavedEvents().some((event) => event.slug === slug);
}

export function saveEvent(event: SavedEvent) {
  const current = getSavedEvents();
  const next = [event, ...current.filter((item) => item.slug !== event.slug)].sort((a, b) => a.start.localeCompare(b.start));
  writeSavedEvents(next);
  return next;
}

export function removeSavedEvent(slug: string) {
  const next = getSavedEvents().filter((event) => event.slug !== slug);
  writeSavedEvents(next);
  return next;
}
