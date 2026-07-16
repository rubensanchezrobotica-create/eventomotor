import type { EventItem } from "@/types/event";

export type WeekendDayFilter = "todos" | "viernes" | "sabado" | "domingo" | "varios";

export type WeekendFamilyId = "concentraciones" | "rallyes" | "circuito" | "otros";

export type WeekendFilters = {
  day: WeekendDayFilter;
  discipline: string;
  family: WeekendFamilyId | "";
  province: string;
  query: string;
};

export type WeekendRange = {
  friday: string;
  saturday: string;
  sunday: string;
};

export type WeekendFilterOption = {
  count: number;
  key: string;
  label: string;
};

export type WeekendFamily = {
  description: string;
  id: WeekendFamilyId;
  label: string;
};

export type WeekendPreviewData = {
  dayCounts: Record<WeekendDayFilter, number>;
  disciplineOptions: WeekendFilterOption[];
  events: EventItem[];
  families: Array<WeekendFamily & { count: number }>;
  provinceOptions: WeekendFilterOption[];
  range: WeekendRange;
  rangeLabel: string;
  stats: {
    disciplines: number;
    events: number;
    provinces: number;
  };
  topProvinces: WeekendFilterOption[];
  updatedLabel: string;
};

export const DEFAULT_WEEKEND_FILTERS: WeekendFilters = {
  day: "todos",
  discipline: "",
  family: "",
  province: "",
  query: "",
};

export const WEEKEND_FAMILIES: WeekendFamily[] = [
  {
    id: "concentraciones",
    label: "Concentraciones y motoalmuerzos",
    description: "Quedadas, rutas, matinales y encuentros para compartir carretera y afición.",
  },
  {
    id: "rallyes",
    label: "Rallyes y rallysprint",
    description: "Pruebas de rally, montaña, regularidad y formatos sprint publicados para el fin de semana.",
  },
  {
    id: "circuito",
    label: "Circuito, tandas y trackdays",
    description: "Rodadas, tandas, campeonatos y experiencias previstas en circuitos.",
  },
  {
    id: "otros",
    label: "Ferias, clásicos y otros eventos",
    description: "Ferias, exposiciones, clásicos, karting, offroad y otros planes de motor.",
  },
];

const FAMILY_TERMS: Array<{
  id: Exclude<WeekendFamilyId, "otros">;
  terms: string[];
}> = [
  {
    id: "rallyes",
    terms: [
      "rally",
      "rallye",
      "rallysprint",
      "rally sprint",
      "rallymix",
      "rally mix",
      "rally tt",
      "subida",
      "montaña",
      "slalom",
      "regularidad",
    ],
  },
  {
    id: "concentraciones",
    terms: [
      "concentracion",
      "concentración",
      "motoalmuerzo",
      "moto almuerzo",
      "almuerzo motero",
      "ruta motera",
      "quedada motera",
      "encuentro nacional",
      "moto topaketa",
      "matinal motera",
    ],
  },
  {
    id: "circuito",
    terms: [
      "circuito",
      "trackday",
      "track day",
      "rodada",
      "rodadas",
      "tandas",
      "velocidad",
      "superbike",
      "motocross",
      "supercross",
      "karting",
      "kart",
      "pitbike",
      "minimoto",
      "minivelocidad",
      "supermotard",
      "resistencia",
    ],
  },
];

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

export function normalizeWeekendText(value: string | null | undefined) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function weekendFilterKey(value: string | null | undefined) {
  return normalizeWeekendText(value).replace(/\s+/g, "-");
}

function toDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekendRange(now: Date): WeekendRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay();
  const daysUntilSaturday = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() - 1);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  return {
    friday: toIsoDate(friday),
    saturday: toIsoDate(saturday),
    sunday: toIsoDate(sunday),
  };
}

function eventStart(event: EventItem) {
  return toDate(event.start);
}

function eventEnd(event: EventItem) {
  return toDate(event.end || event.start);
}

export function eventOverlapsDate(event: EventItem, date: string) {
  const day = toDate(date).getTime();
  return eventStart(event).getTime() <= day && eventEnd(event).getTime() >= day;
}

export function isMultiDayWeekendEvent(event: EventItem) {
  return eventEnd(event).getTime() > eventStart(event).getTime();
}

export function isEventInWeekendRange(event: EventItem, range: WeekendRange) {
  return eventStart(event).getTime() <= toDate(range.sunday).getTime()
    && eventEnd(event).getTime() >= toDate(range.friday).getTime();
}

function eventSearchText(event: EventItem) {
  return normalizeWeekendText([
    event.title,
    event.championship,
    event.discipline,
    event.venue,
    event.city,
    event.province,
    event.region,
    event.vehicleType,
    event.vehicle_type,
    ...(event.tags || []),
  ].join(" "));
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalizeWeekendText(term)));
}

function eventFamilyText(event: EventItem) {
  return normalizeWeekendText([
    event.discipline,
    event.title,
    ...(event.tags || []),
  ].join(" "));
}

export function classifyWeekendFamily(event: EventItem): WeekendFamilyId {
  const text = eventFamilyText(event);
  return FAMILY_TERMS.find(({ terms }) => includesAny(text, terms))?.id || "otros";
}

export function eventMatchesWeekendFamily(event: EventItem, family: WeekendFamilyId) {
  return classifyWeekendFamily(event) === family;
}

function dayMatches(event: EventItem, day: WeekendDayFilter, range: WeekendRange) {
  if (day === "todos") return true;
  if (day === "varios") return isMultiDayWeekendEvent(event);
  if (day === "viernes") return eventOverlapsDate(event, range.friday);
  if (day === "sabado") return eventOverlapsDate(event, range.saturday);
  return eventOverlapsDate(event, range.sunday);
}

export function sortWeekendEvents(events: EventItem[]) {
  return [...events].sort((left, right) => (
    left.start.localeCompare(right.start)
    || Number(isMultiDayWeekendEvent(right)) - Number(isMultiDayWeekendEvent(left))
    || normalizeWeekendText(left.province).localeCompare(normalizeWeekendText(right.province))
    || left.title.localeCompare(right.title, "es")
  ));
}

export function filterWeekendEvents(
  events: EventItem[],
  filters: WeekendFilters,
  range: WeekendRange,
) {
  const query = normalizeWeekendText(filters.query);

  return sortWeekendEvents(events.filter((event) => {
    if (filters.province && weekendFilterKey(event.province) !== filters.province) return false;
    if (filters.discipline && weekendFilterKey(event.discipline) !== filters.discipline) return false;
    if (filters.family && !eventMatchesWeekendFamily(event, filters.family)) return false;
    if (query && !eventSearchText(event).includes(query)) return false;
    return dayMatches(event, filters.day, range);
  }));
}

export function getWeekendDayCounts(events: EventItem[], range: WeekendRange) {
  return {
    todos: events.length,
    viernes: events.filter((event) => dayMatches(event, "viernes", range)).length,
    sabado: events.filter((event) => dayMatches(event, "sabado", range)).length,
    domingo: events.filter((event) => dayMatches(event, "domingo", range)).length,
    varios: events.filter(isMultiDayWeekendEvent).length,
  };
}

function buildOptions(events: EventItem[], field: "discipline" | "province") {
  const options = new Map<string, WeekendFilterOption>();

  for (const event of events) {
    const label = cleanText(event[field]);
    const key = weekendFilterKey(label);
    if (!key) continue;
    const current = options.get(key);
    options.set(key, {
      count: (current?.count || 0) + 1,
      key,
      label: current?.label || label,
    });
  }

  return Array.from(options.values()).sort((left, right) => (
    right.count - left.count || left.label.localeCompare(right.label, "es")
  ));
}

function formatWeekendRangeLabel(range: WeekendRange) {
  const friday = toDate(range.friday);
  const sunday = toDate(range.sunday);
  const formatter = new Intl.DateTimeFormat("es-ES", { month: "long" });
  const fridayMonth = formatter.format(friday);
  const sundayMonth = formatter.format(sunday);

  if (friday.getMonth() === sunday.getMonth()) {
    return `Agenda del ${friday.getDate()} al ${sunday.getDate()} de ${sundayMonth}`;
  }

  return `Agenda del ${friday.getDate()} de ${fridayMonth} al ${sunday.getDate()} de ${sundayMonth}`;
}

export function buildWeekendPreviewData(events: EventItem[], now: Date): WeekendPreviewData {
  const range = getWeekendRange(now);
  const weekendEvents = sortWeekendEvents(events.filter((event) => isEventInWeekendRange(event, range)));
  const provinceOptions = buildOptions(weekendEvents, "province");
  const disciplineOptions = buildOptions(weekendEvents, "discipline");

  return {
    dayCounts: getWeekendDayCounts(weekendEvents, range),
    disciplineOptions,
    events: weekendEvents,
    families: WEEKEND_FAMILIES.map((family) => ({
      ...family,
      count: weekendEvents.filter((event) => classifyWeekendFamily(event) === family.id).length,
    })),
    provinceOptions,
    range,
    rangeLabel: formatWeekendRangeLabel(range),
    stats: {
      disciplines: disciplineOptions.length,
      events: weekendEvents.length,
      provinces: provinceOptions.length,
    },
    topProvinces: provinceOptions.slice(0, 5),
    updatedLabel: new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now),
  };
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function parseWeekendFilters(
  searchParams: Record<string, string | string[] | undefined>,
): WeekendFilters {
  const day = paramValue(searchParams.dia);
  const family = paramValue(searchParams.tipo);

  return {
    day: ["todos", "viernes", "sabado", "domingo", "varios"].includes(day)
      ? day as WeekendDayFilter
      : "todos",
    discipline: weekendFilterKey(paramValue(searchParams.disciplina)),
    family: WEEKEND_FAMILIES.some((item) => item.id === family)
      ? family as WeekendFamilyId
      : "",
    province: weekendFilterKey(paramValue(searchParams.provincia)),
    query: paramValue(searchParams.q).trim(),
  };
}

export function isWeekendPreviewAvailable(nodeEnvironment: string | undefined, vercelEnvironment: string | undefined) {
  return nodeEnvironment !== "production" && vercelEnvironment !== "production";
}

export function nextWeekendVisibleLimit(current: number, pageSize: number, total: number) {
  return Math.min(current + pageSize, total);
}

export function weekendEventDateLabel(event: EventItem) {
  const start = eventStart(event);
  const end = eventEnd(event);
  const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "short" });
  const startMonth = monthFormatter.format(start).replace(".", "").toUpperCase();
  const endMonth = monthFormatter.format(end).replace(".", "").toUpperCase();

  if (!isMultiDayWeekendEvent(event)) {
    return {
      kind: "single" as const,
      day: String(start.getDate()),
      month: startMonth,
    };
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return {
      kind: "range" as const,
      day: `${start.getDate()}–${end.getDate()}`,
      month: startMonth,
    };
  }

  return {
    kind: "cross-month" as const,
    startDay: String(start.getDate()).padStart(2, "0"),
    startMonth,
    endDay: String(end.getDate()).padStart(2, "0"),
    endMonth,
  };
}

export function weekendEventStatusLabel(event: EventItem) {
  const labels: Record<string, string> = {
    tentative: "Fecha provisional",
    postponed: "Aplazado",
    cancelled: "Cancelado",
  };

  return labels[cleanText(event.eventStatus)] || "";
}

export function weekendVehicleLabel(event: EventItem) {
  const labels: Record<string, string> = {
    moto: "Moto",
    coche: "Coche",
    mixto: "Mixto",
    karting: "Karting",
    otros: "Otros",
  };
  const vehicleType = event.vehicleType || event.vehicle_type || "";
  return labels[vehicleType] || cleanText(vehicleType);
}
