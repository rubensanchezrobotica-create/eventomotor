import {
  matchesRegionalCommunity,
  REGIONAL_CONFIGS,
  REGIONAL_REGION_IDS,
} from "@/lib/regions/regional-config";
import {
  normalizeRegionalText,
  regionalFilterKey,
  type RegionalCount,
  type RegionalRegionId,
} from "@/lib/regions/regional-landing-model";
import type { EventItem } from "@/types/event";
import {
  effectiveMotorcycleEventEnd,
  isMotorcycleEvent,
  isMotorcycleGatheringEvent,
  isValidIsoDate,
  madridIsoDate,
  motorcycleWeekendRange,
  MOTORCYCLE_TIME_ZONE,
} from "@/lib/concentrations/motorcycle-event-core";

export {
  effectiveMotorcycleEventEnd,
  isMotorcycleEvent,
  isMotorcycleGatheringEvent,
  isValidIsoDate,
  madridIsoDate,
  motorcycleWeekendRange,
  MOTORCYCLE_TIME_ZONE,
} from "@/lib/concentrations/motorcycle-event-core";

export const MOTORCYCLE_DESKTOP_LIMIT = 8;
export const MOTORCYCLE_MOBILE_LIMIT = 6;

function addIsoDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export type MotorcycleTemporalStatus = "ongoing" | "future" | "past" | "invalid";

export type MotorcycleLandingQuery = {
  archiveAll: boolean;
  month: string;
  province: string;
  query: string;
  showAll: boolean;
  when: "upcoming" | "weekend" | "next30";
};

export type MotorcycleMonthCount = RegionalCount & {
  month: string;
};

export type MotorcycleTerritory = {
  count: number;
  href: string;
  id: RegionalRegionId;
  label: string;
};

export type MotorcycleConcentrationsModel = {
  allEvents: EventItem[];
  monthCounts: MotorcycleMonthCount[];
  nextThirtyDaysEvents: EventItem[];
  pastEvents: EventItem[];
  provinceCounts: RegionalCount[];
  territories: MotorcycleTerritory[];
  today: string;
  upcomingEvents: EventItem[];
  upcomingTotal: number;
  weekendEvents: EventItem[];
  weekendRange: { friday: string; sunday: string };
};

function cleanText(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function motorcycleTemporalStatus(
  event: EventItem,
  today: string,
): MotorcycleTemporalStatus {
  if (!isValidIsoDate(event.start)) return "invalid";
  if (isValidIsoDate(event.end) && event.end < event.start) return "invalid";
  const end = effectiveMotorcycleEventEnd(event);
  if (event.start <= today && end >= today) return "ongoing";
  if (event.start > today) return "future";
  return end < today ? "past" : "invalid";
}

function eventKey(event: EventItem) {
  return event.slug || event.id;
}

function deduplicateEvents(events: EventItem[]) {
  const unique = new Map<string, EventItem>();
  for (const event of events) {
    const key = eventKey(event);
    if (!unique.has(key)) unique.set(key, event);
  }
  return [...unique.values()];
}

function sortUpcoming(events: EventItem[], today: string) {
  return [...events].sort((left, right) => (
    Number(motorcycleTemporalStatus(right, today) === "ongoing")
    - Number(motorcycleTemporalStatus(left, today) === "ongoing")
    || left.start.localeCompare(right.start)
    || effectiveMotorcycleEventEnd(left).localeCompare(effectiveMotorcycleEventEnd(right))
    || normalizeRegionalText(left.title).localeCompare(normalizeRegionalText(right.title), "es")
  ));
}

function sortPast(events: EventItem[]) {
  return [...events].sort((left, right) => (
    effectiveMotorcycleEventEnd(right).localeCompare(effectiveMotorcycleEventEnd(left))
    || right.start.localeCompare(left.start)
    || left.title.localeCompare(right.title, "es")
  ));
}

const CANONICAL_PROVINCES = new Map<string, string>();
for (const config of Object.values(REGIONAL_CONFIGS)) {
  for (const province of config.provinces) {
    CANONICAL_PROVINCES.set(regionalFilterKey(province), province);
  }
}
CANONICAL_PROVINCES.set("lerida", "Lleida");

function provinceIdentity(value: string | null | undefined) {
  const label = cleanText(value);
  const sourceKey = regionalFilterKey(label);
  const key = sourceKey === "lerida" ? "lleida" : sourceKey;
  return {
    key,
    label: CANONICAL_PROVINCES.get(key) || CANONICAL_PROVINCES.get(sourceKey) || label,
  };
}

function buildProvinceCounts(events: EventItem[]) {
  const counts = new Map<string, RegionalCount>();
  for (const event of events) {
    const province = provinceIdentity(event.province);
    if (!province.key || province.key === "por-confirmar") continue;
    const current = counts.get(province.key);
    counts.set(province.key, {
      count: (current?.count || 0) + 1,
      key: province.key,
      label: current?.label || province.label,
    });
  }
  return [...counts.values()].sort((left, right) => (
    right.count - left.count || left.label.localeCompare(right.label, "es")
  ));
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    timeZone: MOTORCYCLE_TIME_ZONE,
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthCounts(events: EventItem[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const month = event.start.slice(0, 7);
    counts.set(month, (counts.get(month) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, count]) => ({
      count,
      key: month,
      label: monthLabel(month),
      month,
    }));
}

function buildTerritories(events: EventItem[]) {
  return REGIONAL_REGION_IDS.map((id) => ({
    count: events.filter((event) => matchesRegionalCommunity(event, id)).length,
    href: REGIONAL_CONFIGS[id].publicPath,
    id,
    label: REGIONAL_CONFIGS[id].name,
  }))
    .filter((territory) => territory.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"));
}

export function buildMotorcycleConcentrationsModel(
  events: EventItem[],
  now: Date,
): MotorcycleConcentrationsModel {
  const today = madridIsoDate(now);
  const allEvents = deduplicateEvents(events.filter((event) => (
    isMotorcycleEvent(event) && isMotorcycleGatheringEvent(event)
  )));
  const upcomingEvents = sortUpcoming(
    allEvents.filter((event) => {
      const status = motorcycleTemporalStatus(event, today);
      return status === "ongoing" || status === "future";
    }),
    today,
  );
  const pastEvents = sortPast(
    allEvents.filter((event) => motorcycleTemporalStatus(event, today) === "past"),
  );
  const weekendRange = motorcycleWeekendRange(now);
  const weekendEvents = upcomingEvents.filter((event) => (
    event.start <= weekendRange.sunday
    && effectiveMotorcycleEventEnd(event) >= weekendRange.friday
  ));
  const thirtyDayLimit = addIsoDays(today, 30);
  const nextThirtyDaysEvents = upcomingEvents.filter((event) => (
    event.start <= thirtyDayLimit && effectiveMotorcycleEventEnd(event) >= today
  ));

  return {
    allEvents,
    monthCounts: buildMonthCounts(upcomingEvents),
    nextThirtyDaysEvents,
    pastEvents,
    provinceCounts: buildProvinceCounts(upcomingEvents),
    territories: buildTerritories(upcomingEvents),
    today,
    upcomingEvents,
    upcomingTotal: upcomingEvents.length,
    weekendEvents,
    weekendRange,
  };
}

export function parseMotorcycleLandingQuery(
  searchParams: Record<string, string | string[] | undefined>,
): MotorcycleLandingQuery {
  const when = firstParam(searchParams.when);
  const month = firstParam(searchParams.month);
  return {
    archiveAll: firstParam(searchParams.archive) === "all",
    month: /^2026-(?:0[1-9]|1[0-2])$/.test(month) ? month : "",
    province: provinceIdentity(firstParam(searchParams.province)).key,
    query: cleanText(firstParam(searchParams.q)),
    showAll: firstParam(searchParams.show) === "all",
    when: when === "weekend" || when === "next30" ? when : "upcoming",
  };
}

export function filterMotorcycleConcentrations(
  model: MotorcycleConcentrationsModel,
  query: MotorcycleLandingQuery,
) {
  const events = query.when === "weekend"
    ? model.weekendEvents
    : query.when === "next30"
      ? model.nextThirtyDaysEvents
      : model.upcomingEvents;
  const normalizedQuery = normalizeRegionalText(query.query);

  return events.filter((event) => {
    if (!isMotorcycleEvent(event) || !isMotorcycleGatheringEvent(event)) return false;
    if (query.month && !event.start.startsWith(`${query.month}-`)) return false;
    if (query.province && provinceIdentity(event.province).key !== query.province) return false;
    if (normalizedQuery) {
      const searchable = normalizeRegionalText([
        event.title,
        event.venue,
        event.city,
        event.province,
        event.championship,
        event.discipline,
        ...event.tags,
      ].filter(Boolean).join(" "));
      if (!searchable.includes(normalizedQuery)) return false;
    }
    return true;
  });
}
