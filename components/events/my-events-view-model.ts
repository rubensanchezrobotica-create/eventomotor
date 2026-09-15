import {
  assignV2HomeEventImages,
  type V2AssignedEventImage,
} from "@/components/redesign-v2/discipline-fallback-resolver";
import { SAVED_EVENTS_STORAGE_KEY, type SavedEvent } from "@/lib/saved-events";

export type SavedEventDisplayItem = {
  effectiveDate: string | null;
  event: SavedEvent;
  image: V2AssignedEventImage;
};

export type SavedEventsViewModel = {
  past: SavedEventDisplayItem[];
  undated: SavedEventDisplayItem[];
  upcoming: SavedEventDisplayItem[];
};

type SavedEventsStorage = Pick<Storage, "getItem" | "setItem">;

const civilDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCivilDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = civilDatePattern.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}

export function localCivilDateKey(now = new Date()): string {
  return [
    String(now.getFullYear()).padStart(4, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function effectiveSavedEventDate(event: SavedEvent): string | null {
  if (isCivilDateKey(event.end)) return event.end;
  return isCivilDateKey(event.start) ? event.start : null;
}

export function hasValidSavedEventStart(event: SavedEvent): boolean {
  return isCivilDateKey(event.start);
}

function isSavedEventSnapshot(value: unknown): value is SavedEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedEvent>;
  return typeof candidate.slug === "string"
    && candidate.slug.trim().length > 0
    && typeof candidate.title === "string"
    && candidate.title.trim().length > 0;
}

export function readSavedEventsSnapshot(storage: Pick<SavedEventsStorage, "getItem">): SavedEvent[] {
  try {
    const raw = storage.getItem(SAVED_EVENTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSavedEventSnapshot) : [];
  } catch {
    return [];
  }
}

export function removeSavedEventFromSnapshot(
  storage: SavedEventsStorage,
  slug: string,
): SavedEvent[] {
  const next = readSavedEventsSnapshot(storage).filter((event) => event.slug !== slug);
  storage.setItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function buildSavedEventsViewModel(
  events: readonly SavedEvent[],
  today: string,
): SavedEventsViewModel {
  if (!isCivilDateKey(today)) throw new Error("Today must be a valid civil date key");

  const images = assignV2HomeEventImages(events.map((event) => ({
    slug: event.slug,
    title: event.title,
    discipline: event.discipline,
    start: event.start,
    venue: event.venue,
    city: event.city,
    province: event.province,
    vehicleType: event.vehicle_type,
  })));

  const indexed = events.map((event, index) => ({
    effectiveDate: effectiveSavedEventDate(event),
    event,
    image: images[index],
    storageIndex: index,
  }));

  const upcoming = indexed
    .filter((item) => item.effectiveDate !== null && item.effectiveDate >= today)
    .sort((a, b) => a.effectiveDate!.localeCompare(b.effectiveDate!) || a.storageIndex - b.storageIndex);
  const past = indexed
    .filter((item) => item.effectiveDate !== null && item.effectiveDate < today)
    .sort((a, b) => b.effectiveDate!.localeCompare(a.effectiveDate!) || a.storageIndex - b.storageIndex);
  const undated = indexed.filter((item) => item.effectiveDate === null);

  const project = ({ effectiveDate, event, image }: typeof indexed[number]): SavedEventDisplayItem => ({
    effectiveDate,
    event,
    image,
  });

  return {
    upcoming: upcoming.map(project),
    undated: undated.map(project),
    past: past.map(project),
  };
}

export function savedEventsDisplayOrder(events: readonly SavedEvent[], today: string): string[] {
  const model = buildSavedEventsViewModel(events, today);
  return [...model.upcoming, ...model.undated, ...model.past].map(({ event }) => event.slug);
}

export function nextSavedEventFocusSlug(
  events: readonly SavedEvent[],
  removedSlug: string,
  today: string,
): string | null {
  const order = savedEventsDisplayOrder(events, today);
  const removedIndex = order.indexOf(removedSlug);
  if (removedIndex < 0) return order[0] ?? null;
  return order[removedIndex + 1] ?? order[removedIndex - 1] ?? null;
}

export function formatSavedEventDate(event: SavedEvent): string {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = isCivilDateKey(event.start) ? event.start : null;
  const end = isCivilDateKey(event.end) ? event.end : null;

  if (!start && !end) return "Fecha por confirmar";
  if (!start) return formatter.format(new Date(`${end}T12:00:00Z`));
  const formattedStart = formatter.format(new Date(`${start}T12:00:00Z`));
  if (!end || end === start) return formattedStart;
  return `${formattedStart} – ${formatter.format(new Date(`${end}T12:00:00Z`))}`;
}

export function savedEventsCountLabel(count: number): string {
  return count === 1 ? "1 evento guardado" : `${count} eventos guardados`;
}
