import {
  isCalendarDateKey,
  madridCalendarDateKey,
} from "@/components/redesign-v2/calendar/calendar-page-model";
import {
  isSpanishTerritoryEvent,
  matchEventToSpanishTerritory,
  normalizeTerritoryValue,
  SPANISH_TERRITORIES,
  type SpanishTerritoryId,
  type SpanishTerritoryKind,
} from "@/lib/regions/territory-contract";
import type { EventItem } from "@/types/event";

export type TerritoryDirectoryItem = Readonly<{
  activeProvinceCount: number;
  displayName: string;
  href: string | null;
  id: SpanishTerritoryId;
  kind: SpanishTerritoryKind;
  upcomingEventCount: number;
}>;

export type TerritoryDirectoryModel = Readonly<{
  activeCommunityCount: number;
  autonomousCities: readonly TerritoryDirectoryItem[];
  communities: readonly TerritoryDirectoryItem[];
  portugueseEventCountExcluded: number;
  territoriallyAssignedSpanishEventCount: number;
  today: string;
  totalSpanishUpcomingCount: number;
  totalUpcomingEventCount: number;
  unassignedSpanishGeographyCount: number;
}>;

const UNKNOWN_PROVINCES = new Set([
  "",
  "a confirmar",
  "por confirmar",
  "sin determinar",
  "sin provincia",
]);

const SPANISH_DIRECTORY_COLLATOR = new Intl.Collator("es", {
  sensitivity: "base",
  usage: "sort",
});

function eventIdentity(event: EventItem) {
  return String(event.slug || event.id).trim();
}

function deduplicateVisibleEvents(events: readonly EventItem[]) {
  const unique = new Map<string, EventItem>();

  for (const event of events) {
    if (event.visible === false) continue;
    const identity = eventIdentity(event);
    if (!identity || unique.has(identity)) continue;
    unique.set(identity, event);
  }

  return [...unique.values()];
}

function validDateKey(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return isCalendarDateKey(normalized) ? normalized : null;
}

export function isUpcomingTerritoryEvent(event: EventItem, today: string) {
  const start = validDateKey(event.start);
  if (!start) return false;
  const end = validDateKey(event.end);
  return (end && end >= start ? end : start) >= today;
}

function isPortugueseEvent(event: Pick<EventItem, "country">) {
  const country = normalizeTerritoryValue(event.country);
  return country === "pt" || country === "portugal";
}

function provinceActivityKey(value: string | null | undefined) {
  const normalized = normalizeTerritoryValue(value);
  return UNKNOWN_PROVINCES.has(normalized) ? null : normalized;
}

export function territoryUpcomingCountLabel(count: number) {
  if (count === 0) return "Sin próximos eventos";
  if (count === 1) return "1 evento próximo";
  return `${count} eventos próximos`;
}

export function territoryProvinceActivityLabel(count: number) {
  if (count === 0) return "Sin provincias con actividad";
  if (count === 1) return "1 provincia con actividad";
  return `${count} provincias con actividad`;
}

export function buildTerritoryDirectoryModel(
  events: readonly EventItem[],
  now: string | Date = new Date(),
): TerritoryDirectoryModel {
  const today = madridCalendarDateKey(now);
  const upcomingEvents = deduplicateVisibleEvents(events)
    .filter((event) => isUpcomingTerritoryEvent(event, today));
  const eventCounts = new Map<SpanishTerritoryId, number>();
  const activeProvinces = new Map<SpanishTerritoryId, Set<string>>();
  let totalSpanishUpcomingCount = 0;
  let territoriallyAssignedSpanishEventCount = 0;
  let unassignedSpanishGeographyCount = 0;

  for (const event of upcomingEvents) {
    if (!isSpanishTerritoryEvent(event)) continue;
    totalSpanishUpcomingCount += 1;

    const territory = matchEventToSpanishTerritory(event);
    if (!territory) {
      unassignedSpanishGeographyCount += 1;
      continue;
    }

    territoriallyAssignedSpanishEventCount += 1;
    eventCounts.set(territory.id, (eventCounts.get(territory.id) ?? 0) + 1);

    const province = provinceActivityKey(event.province);
    if (province) {
      const provinces = activeProvinces.get(territory.id) ?? new Set<string>();
      provinces.add(province);
      activeProvinces.set(territory.id, provinces);
    }
  }

  const items = SPANISH_TERRITORIES.map((territory): TerritoryDirectoryItem => ({
    activeProvinceCount: activeProvinces.get(territory.id)?.size ?? 0,
    displayName: territory.displayName,
    href: territory.currentPublicCanonicalHref,
    id: territory.id,
    kind: territory.kind,
    upcomingEventCount: eventCounts.get(territory.id) ?? 0,
  }));
  const byDisplayName = (left: TerritoryDirectoryItem, right: TerritoryDirectoryItem) => (
    SPANISH_DIRECTORY_COLLATOR.compare(
      normalizeTerritoryValue(left.displayName),
      normalizeTerritoryValue(right.displayName),
    )
  );
  const communities = items
    .filter((item) => item.kind === "AUTONOMOUS_COMMUNITY")
    .sort(byDisplayName);
  const autonomousCities = items
    .filter((item) => item.kind === "AUTONOMOUS_CITY")
    .sort(byDisplayName);

  return {
    activeCommunityCount: communities.filter((item) => item.upcomingEventCount > 0).length,
    autonomousCities,
    communities,
    portugueseEventCountExcluded: upcomingEvents.filter(isPortugueseEvent).length,
    territoriallyAssignedSpanishEventCount,
    today,
    totalSpanishUpcomingCount,
    totalUpcomingEventCount: upcomingEvents.length,
    unassignedSpanishGeographyCount,
  };
}
