import {
  isRegionalRegionId,
  matchesRegionalCommunity,
  REGIONAL_CONFIGS,
  type RegionalFinderMode,
  type RegionalLandingConfig,
  type RegionalRegionId,
} from "@/lib/regions/regional-config";
import type { EventItem } from "@/types/event";

export {
  isRegionalRegionId,
  type RegionalFinderMode,
  type RegionalLandingConfig,
  type RegionalRegionId,
};

export type RegionalCount = {
  count: number;
  key: string;
  label: string;
};

export type RegionalLandingModel = {
  config: RegionalLandingConfig;
  disciplineCounts: RegionalCount[];
  finderMode: RegionalFinderMode;
  nextThirtyDaysEvents: EventItem[];
  pastEvents: EventItem[];
  provinceCounts: RegionalCount[];
  territorialTotal: number;
  upcomingEvents: EventItem[];
  upcomingTotal: number;
  vehicleCounts: RegionalCount[];
  weekendEvents: EventItem[];
};

export type RegionalLandingQuery = {
  discipline: string;
  province: string;
  query: string;
  showAll: boolean;
  vehicle: string;
  when: "upcoming" | "weekend" | "next30";
};

export const REGIONAL_DESKTOP_LIMIT = 8;
export const REGIONAL_MOBILE_LIMIT = 6;
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "cancelado", "cancelada"]);
const UNRELIABLE_DATE_QUALITIES = new Set(["pending_date"]);
const SPANISH_MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
] as const;

function cleanText(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeRegionalText(value: string | null | undefined) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const REGIONAL_PROVINCE_LABELS: Record<string, string> = {
  lerida: "Lleida",
  lleida: "Lleida",
};

const REGIONAL_DISCIPLINE_LABELS: Record<string, string> = {
  clasicos: "Clásicos",
  concentracion: "Concentración",
  concentraciones: "Concentraciones",
  minivelocidad: "MiniVelocidad",
  montana: "Montaña",
};

function normalizeRegionalProvince(value: string | null | undefined) {
  const raw = cleanText(value);
  return REGIONAL_PROVINCE_LABELS[normalizeRegionalText(raw)] || raw;
}

function normalizeRegionalDiscipline(value: string | null | undefined) {
  const raw = cleanText(value);
  return REGIONAL_DISCIPLINE_LABELS[normalizeRegionalText(raw)] || raw;
}

export function regionalFilterKey(value: string | null | undefined) {
  return normalizeRegionalText(value).replace(/\s+/g, "-");
}

function toDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function today(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekendRange(now: Date) {
  const currentDay = today(now);
  const day = currentDay.getDay();
  const daysUntilSaturday = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const saturday = new Date(currentDay);
  saturday.setDate(currentDay.getDate() + daysUntilSaturday);
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() - 1);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return {
    friday: toIsoDate(friday),
    sunday: toIsoDate(sunday),
  };
}

function isEventInWeekendRange(
  event: EventItem,
  range: ReturnType<typeof getWeekendRange>,
) {
  return toDate(event.start).getTime() <= toDate(range.sunday).getTime()
    && eventEnd(event).getTime() >= toDate(range.friday).getTime();
}

function isValidIsoDate(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime()));
}

function eventEnd(event: EventItem) {
  return toDate(event.end || event.start);
}

function isCancelled(event: EventItem) {
  return CANCELLED_STATUSES.has(normalizeRegionalText(event.eventStatus))
    || event.dataQuality === "cancelled";
}

function hasReliableDate(event: EventItem) {
  return isValidIsoDate(event.start)
    && isValidIsoDate(event.end || event.start)
    && !UNRELIABLE_DATE_QUALITIES.has(event.dataQuality || "");
}

function isUpcoming(event: EventItem, now: Date) {
  return hasReliableDate(event) && eventEnd(event).getTime() >= today(now).getTime();
}

function isPast(event: EventItem, now: Date) {
  return hasReliableDate(event) && eventEnd(event).getTime() < today(now).getTime();
}

function isInProgress(event: EventItem, now: Date) {
  const current = today(now).getTime();
  return toDate(event.start).getTime() <= current && eventEnd(event).getTime() >= current;
}

export function sortRegionalUpcomingEvents(events: EventItem[], now: Date) {
  return [...events].sort((left, right) => (
    Number(isInProgress(right, now)) - Number(isInProgress(left, now))
    || left.start.localeCompare(right.start)
    || (left.end || left.start).localeCompare(right.end || right.start)
    || normalizeRegionalText(left.title).localeCompare(normalizeRegionalText(right.title), "es")
  ));
}

function sortPastEvents(events: EventItem[]) {
  return [...events].sort((left, right) => (
    (right.end || right.start).localeCompare(left.end || left.start)
    || right.start.localeCompare(left.start)
    || left.title.localeCompare(right.title, "es")
  ));
}

function deduplicateEvents(events: EventItem[]) {
  const unique = new Map<string, EventItem>();
  for (const event of events) {
    const key = event.slug || event.id;
    if (!unique.has(key)) unique.set(key, event);
  }
  return [...unique.values()];
}

function buildCounts(events: EventItem[], readLabel: (event: EventItem) => string) {
  const counts = new Map<string, RegionalCount>();

  for (const event of events) {
    const label = cleanText(readLabel(event));
    const key = regionalFilterKey(label);
    if (!key || normalizeRegionalText(label) === "por confirmar") continue;
    const current = counts.get(key);
    counts.set(key, {
      count: (current?.count || 0) + 1,
      key,
      label: current?.label || label,
    });
  }

  return [...counts.values()]
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"));
}

export function eventBelongsToRegionalLanding(
  event: EventItem,
  id: RegionalRegionId,
) {
  return matchesRegionalCommunity(event, id);
}

export function regionalFinderMode(upcomingTotal: number): RegionalFinderMode {
  if (upcomingTotal >= 10) return "full";
  if (upcomingTotal >= 3) return "compact";
  if (upcomingTotal >= 1) return "hidden";
  return "empty";
}

export function buildRegionalLandingModel(
  events: EventItem[],
  id: RegionalRegionId,
  now: Date,
): RegionalLandingModel {
  const eligibleEvents = deduplicateEvents(events.filter((event) => event.visible === true && !isCancelled(event)));
  const territorialEvents = eligibleEvents.filter((event) => eventBelongsToRegionalLanding(event, id));
  const upcomingEvents = sortRegionalUpcomingEvents(
    territorialEvents.filter((event) => isUpcoming(event, now)),
    now,
  );
  const pastEvents = sortPastEvents(territorialEvents.filter((event) => isPast(event, now)));
  const range = getWeekendRange(now);
  const weekendEvents = upcomingEvents.filter((event) => (
    hasReliableDate(event) && isEventInWeekendRange(event, range)
  ));
  const thirtyDayLimit = today(now);
  thirtyDayLimit.setDate(thirtyDayLimit.getDate() + 30);
  const nextThirtyDaysEvents = upcomingEvents.filter((event) => (
    toDate(event.start).getTime() <= thirtyDayLimit.getTime()
  ));

  return {
    config: REGIONAL_CONFIGS[id],
    disciplineCounts: buildCounts(upcomingEvents, (event) => normalizeRegionalDiscipline(event.discipline)),
    finderMode: regionalFinderMode(upcomingEvents.length),
    nextThirtyDaysEvents,
    pastEvents,
    provinceCounts: buildCounts(upcomingEvents, (event) => normalizeRegionalProvince(event.province)),
    territorialTotal: upcomingEvents.length + pastEvents.length,
    upcomingEvents,
    upcomingTotal: upcomingEvents.length,
    vehicleCounts: buildCounts(upcomingEvents, canonicalVehicleLabel),
    weekendEvents,
  };
}

export function assertRegionalLandingModelTerritorial(
  model: RegionalLandingModel,
) {
  const collections = [
    model.upcomingEvents,
    model.pastEvents,
    model.weekendEvents,
    model.nextThirtyDaysEvents,
  ];
  const externalEvent = collections
    .flat()
    .find((event) => !eventBelongsToRegionalLanding(event, model.config.id));

  if (externalEvent) {
    throw new Error(
      `El evento "${externalEvent.slug || externalEvent.id}" no pertenece a ${model.config.name}.`,
    );
  }

  return model;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function parseRegionalLandingQuery(
  searchParams: Record<string, string | string[] | undefined>,
): RegionalLandingQuery {
  const when = firstParam(searchParams.when);
  return {
    discipline: regionalFilterKey(firstParam(searchParams.discipline)),
    province: regionalFilterKey(firstParam(searchParams.province)),
    query: cleanText(firstParam(searchParams.q)),
    showAll: firstParam(searchParams.show) === "all",
    vehicle: regionalFilterKey(firstParam(searchParams.vehicle)),
    when: when === "weekend" || when === "next30" ? when : "upcoming",
  };
}

export function filterRegionalLandingEvents(
  model: RegionalLandingModel,
  query: RegionalLandingQuery,
) {
  const events = query.when === "weekend"
    ? model.weekendEvents
    : query.when === "next30"
      ? model.nextThirtyDaysEvents
      : model.upcomingEvents;
  const normalizedQuery = normalizeRegionalText(query.query);
  return events.filter((event) => {
    if (!eventBelongsToRegionalLanding(event, model.config.id)) return false;
    if (query.province && regionalFilterKey(normalizeRegionalProvince(event.province)) !== query.province) return false;
    if (query.discipline && regionalFilterKey(normalizeRegionalDiscipline(event.discipline)) !== query.discipline) return false;
    if (query.vehicle && regionalFilterKey(canonicalVehicleLabel(event)) !== query.vehicle) return false;
    if (normalizedQuery) {
      const searchable = normalizeRegionalText([
        event.title,
        event.venue,
        event.city,
        event.province,
      ].filter(Boolean).join(" "));
      if (!searchable.includes(normalizedQuery)) return false;
    }
    return true;
  });
}

export function regionalEventStatusLabel(event: EventItem) {
  if (normalizeRegionalText(event.eventStatus) === "postponed") return "Aplazado";
  if (normalizeRegionalText(event.eventStatus) === "tentative") return "Fecha provisional";
  return "";
}

function canonicalVehicleLabel(event: EventItem) {
  const labels: Record<string, string> = {
    coche: "Coche",
    karting: "Karting",
    mixto: "Mixto",
    moto: "Moto",
    otros: "Otros",
  };
  const value = cleanText(event.vehicleType || event.vehicle_type);
  return labels[normalizeRegionalText(value)] || value;
}

const BADGE_ALIASES: Record<string, string> = {
  automovilismo: "coche",
  coches: "coche",
  kart: "karting",
  karts: "karting",
  motocicleta: "moto",
  motocicletas: "moto",
  motociclismo: "moto",
  motos: "moto",
};

function badgeKey(value: string) {
  const normalized = normalizeRegionalText(value);
  return BADGE_ALIASES[normalized] || normalized;
}

export function regionalEventBadges(event: EventItem) {
  const status = regionalEventStatusLabel(event);
  const discipline = cleanText(event.discipline);
  const vehicle = canonicalVehicleLabel(event);
  const informational: string[] = [];
  const seen = new Set<string>();

  for (const label of [discipline, vehicle]) {
    const key = badgeKey(label);
    if (!label || !key || key === "otros" || seen.has(key)) continue;
    seen.add(key);
    informational.push(label);
  }

  return {
    informational: informational.slice(0, 2),
    status,
  };
}

export function regionalEventDateLabel(event: EventItem) {
  const start = toDate(event.start);
  const end = eventEnd(event);
  const sameDay = start.getTime() === end.getTime();
  const sameMonth = start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth();

  if (sameDay) {
    return {
      lines: [{ day: String(start.getDate()), month: SPANISH_MONTHS[start.getMonth()] }],
      splitRange: false,
    };
  }

  if (sameMonth) {
    return {
      lines: [{
        day: `${start.getDate()}–${end.getDate()}`,
        month: SPANISH_MONTHS[start.getMonth()],
      }],
      splitRange: false,
    };
  }

  return {
    lines: [
      { day: String(start.getDate()), month: SPANISH_MONTHS[start.getMonth()] },
      { day: String(end.getDate()), month: SPANISH_MONTHS[end.getMonth()] },
    ],
    splitRange: true,
  };
}

export function regionalEventDateAriaLabel(event: EventItem) {
  const start = toDate(event.start);
  const end = eventEnd(event);
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return start.getTime() === end.getTime()
    ? formatter.format(start)
    : `Del ${formatter.format(start)} al ${formatter.format(end)}`;
}
