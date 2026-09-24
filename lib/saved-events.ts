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
export const VALL_SANT_PERE_SAVED_ALIAS = "rally-vall-sant-pere-2026-09-25";
export const VALL_SANT_PERE_SAVED_CANONICAL = "rally-vall-sant-pere-esporles-2026-09-25";

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

export function canonicalSavedEventSlug(slug: string) {
  return slug === VALL_SANT_PERE_SAVED_ALIAS
    ? VALL_SANT_PERE_SAVED_CANONICAL
    : slug;
}

function normalizeSavedEvents(events: unknown[]) {
  const normalizedEvents: SavedEvent[] = [];
  let vallEventIndex: number | null = null;
  let changed = false;

  for (const value of events) {
    const event = value as Partial<SavedEvent>;
    if (!event?.slug || !event.title || !event.start) continue;

    const isVallEvent = event.slug === VALL_SANT_PERE_SAVED_ALIAS
      || event.slug === VALL_SANT_PERE_SAVED_CANONICAL;

    if (!isVallEvent) {
      normalizedEvents.push(event as SavedEvent);
      continue;
    }

    const canonicalSlug = canonicalSavedEventSlug(event.slug);
    const isCanonicalRecord = canonicalSlug === event.slug;
    const normalized = { ...event, slug: canonicalSlug } as SavedEvent;

    if (canonicalSlug !== event.slug) changed = true;
    if (vallEventIndex === null) {
      vallEventIndex = normalizedEvents.length;
      normalizedEvents.push(normalized);
      continue;
    }

    changed = true;
    if (isCanonicalRecord) normalizedEvents[vallEventIndex] = normalized;
  }

  return {
    changed,
    events: normalizedEvents.sort((left, right) => left.start.localeCompare(right.start)),
  };
}

export function getSavedEvents() {
  const normalized = normalizeSavedEvents(readRawSavedEvents());
  if (normalized.changed) {
    try {
      writeSavedEvents(normalized.events);
    } catch {
      // The in-memory compatibility view remains usable even when the browser
      // refuses the opportunistic migration. Explicit writes still throw.
    }
  }
  return normalized.events;
}

export function isEventSaved(slug: string) {
  const canonicalSlug = canonicalSavedEventSlug(slug);
  return getSavedEvents().some((event) => event.slug === canonicalSlug);
}

export function saveEvent(event: SavedEvent) {
  const current = getSavedEvents();
  const canonicalSlug = canonicalSavedEventSlug(event.slug);
  const existingCanonical = current.find((item) => item.slug === canonicalSlug);

  if (event.slug === VALL_SANT_PERE_SAVED_ALIAS && existingCanonical) {
    writeSavedEvents(current);
    return current;
  }

  const canonicalEvent = { ...event, slug: canonicalSlug };
  const next = [canonicalEvent, ...current.filter((item) => item.slug !== canonicalEvent.slug)].sort((a, b) => a.start.localeCompare(b.start));
  writeSavedEvents(next);
  return next;
}

export function removeSavedEvent(slug: string) {
  const canonicalSlug = canonicalSavedEventSlug(slug);
  const next = getSavedEvents().filter((event) => event.slug !== canonicalSlug);
  writeSavedEvents(next);
  return next;
}
