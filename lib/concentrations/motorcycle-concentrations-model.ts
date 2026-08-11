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

export const MOTORCYCLE_DESKTOP_LIMIT = 8;
export const MOTORCYCLE_MOBILE_LIMIT = 6;
export const MOTORCYCLE_TIME_ZONE = "Europe/Madrid";

const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "cancelado", "cancelada"]);
const EXCLUDED_VEHICLES = new Set(["coche", "coches", "automovil", "automovilismo", "kart", "karting"]);
const DIRECT_MOTORCYCLE_VEHICLES = new Set([
  "moto",
  "motos",
  "motocicleta",
  "motocicletas",
  "motociclismo",
]);
const POSITIVE_MOTORCYCLE_SIGNAL = /(?:^| )(?:moto|motos|motera|moteras|motero|moteros|motocicleta|motocicletas|motociclismo|motoalmuerzo|motoalmuerzos|mototurismo|biker|bikers)(?: |$)/;
const GATHERING_DISCIPLINES = new Set([
  "concentracion",
  "concentraciones",
  "encuentro",
  "encuentros",
  "matinal",
  "matinales",
  "motoalmuerzo",
  "motoalmuerzos",
  "quedada",
  "quedadas",
  "reunion",
  "reuniones",
]);
const STRONG_GATHERING_SIGNAL = /(?:^| )(?:concentracion(?:es)?|encuentro(?:s)?|reunion(?:es)?|quedada(?:s)?|matinal(?:es)?)(?: (?:biker|bikers|motera|moteras|motero|moteros)| de (?:las )?(?:moto|motos|motocicleta|motocicletas))(?: |$)|(?:^| )(?:almuerzo motero|convivencia motera|fiesta motera|meeting biker|moto ?almuerzo(?:s)?|moto ?asado(?:s)?|moto ?encuentro(?:s)?|xuntanza motera)(?: |$)/;
const GENERIC_GATHERING_TITLE_SIGNAL = /(?:^| )(?:concentracion(?:es)?|encuentro(?:s)?|matinal(?:es)?|quedada(?:s)?|reunion(?:es)?)(?: |$)/;
const JOINT_CAR_MOTORCYCLE_GATHERING_SIGNAL = /(?:^| )(?:concentracion(?:es)?|encuentro(?:s)?|matinal(?:es)?|quedada(?:s)?|reunion(?:es)?)[^.?!]{0,80}(?:moto|motos|motocicleta|motocicletas)(?: |$)/;
const EXCLUDED_GATHERING_DISCIPLINE_SIGNAL = /(?:^| )(?:circuito|cross country|curso|enduret|enduro|entrenamiento|feria|ferias|freestyle|hard enduro|juniorgp|minivelocidad|motocross|motogp|off road|offroad|raid|rally raid|resistencia|rodada|rodadas|salon|salones|superbike|supercross|supermotard|supermoto|tanda|tandas|todo terreno|trackday|trial|velocidad)(?: |$)/;
const EXCLUDED_GATHERING_PRIMARY_SIGNAL = /(?:^| )(?:campeonato|carrera|carreras|circuito|copa|curso de conduccion|enduro|entrenamiento|escuela de pilotaje|exhibicion comercial|feria|motocross|off road|offroad|raid|racing|rodada|rodadas|salon|supercross|tanda|tandas|track ?day|trackday|trial|trofeo|velocidad)(?: |$)/;

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

export function isValidIsoDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function effectiveMotorcycleEventEnd(event: EventItem) {
  return isValidIsoDate(event.end) ? event.end : event.start;
}

export function madridIsoDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: MOTORCYCLE_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addIsoDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function isoWeekday(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function motorcycleWeekendRange(now: Date) {
  const current = madridIsoDate(now);
  const weekday = isoWeekday(current);
  const daysToFriday = weekday === 0 ? -2 : weekday === 6 ? -1 : weekday === 5 ? 0 : 5 - weekday;
  const friday = addIsoDays(current, daysToFriday);
  return { friday, sunday: addIsoDays(friday, 2) };
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

function hasMotorcycleSignal(event: EventItem) {
  const fields = [
    event.discipline,
    event.championship,
    ...event.tags,
    event.title,
    event.shortDescription,
    event.longDescription,
  ];
  return fields.some((field) => POSITIVE_MOTORCYCLE_SIGNAL.test(normalizeRegionalText(field)));
}

function optionalCategory(event: EventItem) {
  return (event as EventItem & { category?: string }).category;
}

function hasStructuredMotorcycleSignal(event: EventItem) {
  const vehicle = normalizeRegionalText(event.vehicleType || event.vehicle_type);
  if (DIRECT_MOTORCYCLE_VEHICLES.has(vehicle)) return true;

  return [
    event.discipline,
    event.championship,
    optionalCategory(event),
    ...event.tags,
  ].some((field) => POSITIVE_MOTORCYCLE_SIGNAL.test(normalizeRegionalText(field)));
}

export function isMotorcycleEvent(event: EventItem) {
  if (event.visible !== true) return false;
  if (event.dataQuality === "cancelled" || event.dataQuality === "pending_date") return false;
  if (CANCELLED_STATUSES.has(normalizeRegionalText(event.eventStatus))) return false;
  if (!isValidIsoDate(event.start) || !event.start.startsWith("2026-")) return false;
  if (isValidIsoDate(event.end) && event.end < event.start) return false;

  const vehicle = normalizeRegionalText(event.vehicleType || event.vehicle_type);
  if (DIRECT_MOTORCYCLE_VEHICLES.has(vehicle)) return true;
  if (EXCLUDED_VEHICLES.has(vehicle)) return false;
  return hasMotorcycleSignal(event);
}

/**
 * Classifies the event's primary intent independently from motorcycle affinity.
 * Quality/date/visibility and motorcycle checks stay in isMotorcycleEvent.
 */
export function isMotorcycleGatheringEvent(event: EventItem) {
  const discipline = normalizeRegionalText(event.discipline);
  const title = normalizeRegionalText(event.title);
  const championship = normalizeRegionalText(event.championship);
  const category = normalizeRegionalText(optionalCategory(event));
  const tags = event.tags.map(normalizeRegionalText);
  const descriptions = [event.shortDescription, event.longDescription]
    .map(normalizeRegionalText)
    .filter(Boolean);

  // A dedicated structured discipline is the strongest primary-intent signal.
  if (GATHERING_DISCIPLINES.has(discipline)) return true;

  // An explicit gathering phrase in the title remains primary even if the venue
  // or event name contains words such as "circuito" or "rally".
  if (
    STRONG_GATHERING_SIGNAL.test(title)
    || JOINT_CAR_MOTORCYCLE_GATHERING_SIGNAL.test(title)
  ) return true;

  const hasExcludedPrimaryIntent = EXCLUDED_GATHERING_DISCIPLINE_SIGNAL.test(discipline)
    || EXCLUDED_GATHERING_PRIMARY_SIGNAL.test(title)
    || EXCLUDED_GATHERING_PRIMARY_SIGNAL.test(championship)
    || EXCLUDED_GATHERING_PRIMARY_SIGNAL.test(category);
  if (hasExcludedPrimaryIntent) return false;

  // Generic "matinal", "quedada" or "encuentro" only counts in the title
  // when a separate structured field establishes motorcycle affinity.
  if (
    GENERIC_GATHERING_TITLE_SIGNAL.test(title)
    && hasStructuredMotorcycleSignal(event)
  ) return true;

  const secondaryFields = [championship, category, ...tags];
  if (secondaryFields.some((field) => STRONG_GATHERING_SIGNAL.test(field))) return true;

  // Descriptions are deliberately last: they may confirm an explicit social
  // gathering (including a joint car-and-motorcycle event), never override a
  // primary racing, circuit, training, off-road or commercial intent.
  return descriptions.some((field) => (
    STRONG_GATHERING_SIGNAL.test(field)
    || JOINT_CAR_MOTORCYCLE_GATHERING_SIGNAL.test(field)
  ));
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
