import type { Metadata } from "next";
import {
  classifyEventMacroZone,
  MACRO_ZONE_IDS,
  type MacroZoneId,
} from "@/lib/event-macro-zone";
import { SEO_ZONES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

export type ZonePeriod = "upcoming" | "weekend" | "next30" | "month" | "all";

export type ZoneDisciplineGroupId =
  | "rallyes"
  | "concentraciones"
  | "circuito"
  | "offroad"
  | "clasicos-ferias"
  | "otros";

export type ZoneFilters = {
  discipline: string;
  group: ZoneDisciplineGroupId | "";
  period: ZonePeriod;
  province: string;
  query: string;
};

export type ZoneFilterOption = {
  count: number;
  key: string;
  label: string;
};

export type ZoneDisciplineGroup = {
  count: number;
  id: ZoneDisciplineGroupId;
  label: string;
};

export type ZonePreviewData = {
  dateRange: {
    max: string | null;
    min: string | null;
  };
  disciplineGroups: ZoneDisciplineGroup[];
  disciplineOptions: ZoneFilterOption[];
  events: EventItem[];
  featuredEvents: EventItem[];
  localityOptions: ZoneFilterOption[];
  monthCounts: ZoneFilterOption[];
  pastEvents: EventItem[];
  provinceOptions: ZoneFilterOption[];
  statusOptions: ZoneFilterOption[];
  stats: {
    disciplines: number;
    future: number;
    past: number;
    provinces: number;
    total: number;
  };
  upcomingEvents: EventItem[];
  vehicleOptions: ZoneFilterOption[];
  weekendEvents: EventItem[];
  zone: {
    description: string;
    h1: string;
    id: MacroZoneId;
    intro: string;
    title: string;
  };
};

export const DEFAULT_ZONE_FILTERS: ZoneFilters = {
  discipline: "",
  group: "",
  period: "upcoming",
  province: "",
  query: "",
};

export const ZONE_PERIODS: Array<{ id: ZonePeriod; label: string }> = [
  { id: "upcoming", label: "Próximos" },
  { id: "weekend", label: "Este fin de semana" },
  { id: "next30", label: "Próximos 30 días" },
  { id: "month", label: "Este mes" },
  { id: "all", label: "Todos los eventos" },
];

export const ZONE_PERIOD_TABS = ZONE_PERIODS.filter((period) => period.id !== "weekend");

export const ZONE_DISCIPLINE_GROUPS: Array<{
  id: ZoneDisciplineGroupId;
  label: string;
  terms: string[];
}> = [
  {
    id: "rallyes",
    label: "Rallyes",
    terms: [
      "rally",
      "rallye",
      "rallysprint",
      "rallymix",
      "rally tt",
      "subida",
      "montana",
      "slalom",
      "regularidad",
      "baja",
    ],
  },
  {
    id: "concentraciones",
    label: "Concentraciones",
    terms: [
      "concentracion",
      "motoalmuerzo",
      "almuerzo motero",
      "quedada motera",
      "ruta motera",
      "moto topaketa",
      "matinal motera",
      "encuentro nacional",
    ],
  },
  {
    id: "circuito",
    label: "Circuito y tandas",
    terms: [
      "circuito",
      "trackday",
      "track day",
      "tandas",
      "rodada",
      "velocidad",
      "superbike",
      "karting",
      "pitbike",
      "minimoto",
      "minivelocidad",
      "supermotard",
      "resistencia",
    ],
  },
  {
    id: "offroad",
    label: "Offroad",
    terms: [
      "motocross",
      "supercross",
      "enduro",
      "trial",
      "offroad",
      "cross country",
      "4x4",
      "raid",
    ],
  },
  {
    id: "clasicos-ferias",
    label: "Clásicos y ferias",
    terms: [
      "clasico",
      "historico",
      "feria",
      "salon",
      "exposicion",
      "motor show",
      "retro",
    ],
  },
  {
    id: "otros",
    label: "Otros eventos",
    terms: [],
  },
];

const ZONE_DESCRIPTIONS: Record<MacroZoneId, string> = {
  norte:
    "Rallyes, concentraciones, rutas, montaña y offroad en Galicia, Asturias, Cantabria, País Vasco, Navarra y La Rioja.",
  centro:
    "Rallyes, concentraciones, circuitos, rutas, clásicos y ferias en Madrid, Castilla y León, Castilla-La Mancha y provincias cercanas.",
  "cataluna-aragon":
    "Circuitos, rallyes, concentraciones, rutas y ferias en Cataluña, Aragón y sus principales provincias.",
  levante:
    "Circuitos, rallyes, concentraciones, rutas y ferias en Valencia, Alicante, Castellón, Murcia y Baleares.",
  sur:
    "Rallyes, montaña, concentraciones, offroad, rutas y ferias en Andalucía, Extremadura, Ceuta y Melilla.",
  canarias:
    "Rallyes, subidas, clásicos y concentraciones en Tenerife, Gran Canaria y el resto del archipiélago.",
};

const PROVINCE_ALIASES: Record<string, string> = {
  "la coruna": "a coruna",
  "islas baleares": "baleares",
  "illes balears": "baleares",
  castello: "castellon",
  guipuzcoa: "gipuzkoa",
  lerida: "lleida",
  orense: "ourense",
  vizcaya: "bizkaia",
};

const CANONICAL_PROVINCES: Record<string, string> = {
  "a coruna": "A Coruña",
  alava: "Álava",
  almeria: "Almería",
  avila: "Ávila",
  baleares: "Baleares",
  bizkaia: "Bizkaia",
  caceres: "Cáceres",
  cadiz: "Cádiz",
  castellon: "Castellón",
  cordoba: "Córdoba",
  gipuzkoa: "Gipuzkoa",
  jaen: "Jaén",
  leon: "León",
  lleida: "Lleida",
  malaga: "Málaga",
  ourense: "Ourense",
};

const DISCIPLINE_LABELS: Record<string, string> = {
  clasicos: "Clásicos",
  concentracion: "Concentración",
  concentraciones: "Concentraciones",
  montana: "Montaña",
  minivelocidad: "MiniVelocidad",
};

const LOCALITY_LABELS: Record<string, string> = {
  "a coruna": "A Coruña",
  "alcaniz": "Alcañiz",
  "alcarras": "Alcarràs",
  "almeria": "Almería",
  "almodovar del rio": "Almodóvar del Río",
  "avila": "Ávila",
  "benahavis": "Benahavís",
  "caceres": "Cáceres",
  "cadiz": "Cádiz",
  "castellon": "Castellón",
  "cordoba": "Córdoba",
  "gijon": "Gijón",
  "guia de isora": "Guía de Isora",
  "jaen": "Jaén",
  "la coruna": "A Coruña",
  "leon": "León",
  "malaga": "Málaga",
  "montmelo": "Montmeló",
  "ribamontan al mar": "Ribamontán al Mar",
  "san sebastian de los reyes": "San Sebastián de los Reyes",
  "sanlucar de barrameda": "Sanlúcar de Barrameda",
  "santa eulalia de roncana": "Santa Eulàlia de Ronçana",
  "xativa": "Xàtiva",
};

function cleanText(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeZoneText(value: string | null | undefined) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function provinceKey(value: string | null | undefined) {
  const normalized = normalizeZoneText(value);
  return PROVINCE_ALIASES[normalized] || normalized;
}

export function normalizeZoneProvince(value: string | null | undefined) {
  const raw = cleanText(value);
  const key = provinceKey(raw);
  return CANONICAL_PROVINCES[key] || raw;
}

function provinceFilterKey(value: string | null | undefined) {
  return zoneFilterKey(normalizeZoneProvince(value));
}

export function zoneFilterKey(value: string | null | undefined) {
  return normalizeZoneText(value).replace(/\s+/g, "-");
}

export function normalizeZoneDiscipline(value: string | null | undefined) {
  const raw = cleanText(value);
  return DISCIPLINE_LABELS[normalizeZoneText(raw)] || raw;
}

export function normalizeZoneLocality(value: string | null | undefined) {
  const raw = cleanText(value);
  return LOCALITY_LABELS[normalizeZoneText(raw)] || raw;
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

function todayDate(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function eventStart(event: EventItem) {
  return toDate(event.start);
}

function eventEnd(event: EventItem) {
  return toDate(event.end || event.start);
}

function isFutureEvent(event: EventItem, now: Date) {
  return eventEnd(event).getTime() >= todayDate(now).getTime();
}

function isPastEvent(event: EventItem, now: Date) {
  return !isFutureEvent(event, now);
}

export function getZoneWeekendRange(now: Date) {
  const today = todayDate(now);
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

function eventOverlapsRange(event: EventItem, start: Date, end: Date) {
  return eventStart(event).getTime() <= end.getTime()
    && eventEnd(event).getTime() >= start.getTime();
}

function eventIsThisWeekend(event: EventItem, now: Date) {
  const range = getZoneWeekendRange(now);
  return eventOverlapsRange(event, toDate(range.friday), toDate(range.sunday));
}

function eventIsNext30Days(event: EventItem, now: Date) {
  const start = todayDate(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 30);
  return eventOverlapsRange(event, start, end);
}

function eventIsThisMonth(event: EventItem, now: Date) {
  const start = todayDate(now);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return eventOverlapsRange(event, start, end);
}

function eventSearchText(event: EventItem) {
  return normalizeZoneText([
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

function familyText(event: EventItem) {
  return normalizeZoneText([
    event.discipline,
    event.title,
    ...(event.tags || []),
  ].join(" "));
}

export function classifyZoneDisciplineGroup(event: EventItem): ZoneDisciplineGroupId {
  const text = familyText(event);

  for (const group of ZONE_DISCIPLINE_GROUPS) {
    if (group.id === "otros") continue;
    if (group.terms.some((term) => text.includes(normalizeZoneText(term)))) return group.id;
  }

  return "otros";
}

export function sortUpcomingZoneEvents(events: EventItem[]) {
  return [...events].sort((left, right) => (
    left.start.localeCompare(right.start)
    || (left.end || left.start).localeCompare(right.end || right.start)
    || normalizeZoneText(left.title).localeCompare(normalizeZoneText(right.title), "es")
  ));
}

export function sortPastZoneEvents(events: EventItem[]) {
  return [...events].sort((left, right) => (
    (right.end || right.start).localeCompare(left.end || left.start)
    || right.start.localeCompare(left.start)
    || normalizeZoneText(left.title).localeCompare(normalizeZoneText(right.title), "es")
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

function periodEvents(events: EventItem[], period: ZonePeriod, now: Date) {
  if (period === "all") {
    const upcoming = sortUpcomingZoneEvents(events.filter((event) => isFutureEvent(event, now)));
    const past = sortPastZoneEvents(events.filter((event) => isPastEvent(event, now)));
    return [...upcoming, ...past];
  }

  const upcoming = events.filter((event) => isFutureEvent(event, now));
  if (period === "weekend") return sortUpcomingZoneEvents(upcoming.filter((event) => eventIsThisWeekend(event, now)));
  if (period === "next30") return sortUpcomingZoneEvents(upcoming.filter((event) => eventIsNext30Days(event, now)));
  if (period === "month") return sortUpcomingZoneEvents(upcoming.filter((event) => eventIsThisMonth(event, now)));
  return sortUpcomingZoneEvents(upcoming);
}

export function filterZoneEvents(
  events: EventItem[],
  filters: ZoneFilters,
  now: Date,
) {
  const query = normalizeZoneText(filters.query);

  return periodEvents(events, filters.period, now).filter((event) => {
    if (filters.province && provinceFilterKey(event.province) !== filters.province) return false;
    if (filters.discipline && zoneFilterKey(normalizeZoneDiscipline(event.discipline)) !== filters.discipline) return false;
    if (filters.group && classifyZoneDisciplineGroup(event) !== filters.group) return false;
    if (query && !eventSearchText(event).includes(query)) return false;
    return true;
  });
}

export function zoneResultTitleParts(period: ZonePeriod, zoneTitle: string) {
  const lead = period === "weekend"
    ? "Eventos de este fin de semana en la"
    : period === "next30"
      ? "Eventos de los próximos 30 días en la"
      : period === "month"
        ? "Eventos de este mes en la"
        : period === "all"
          ? "Todos los eventos de motor en la"
          : "Próximos eventos de motor en la";

  return {
    lead,
    zone: `zona ${zoneTitle.toLowerCase()}`,
  };
}

export function zoneResultTitle(period: ZonePeriod, zoneTitle: string) {
  const title = zoneResultTitleParts(period, zoneTitle);
  return `${title.lead} ${title.zone}`;
}

const FAMILY_COUNT_LABELS: Record<number, string> = {
  1: "una",
  2: "dos",
  3: "tres",
  4: "cuatro",
  5: "cinco",
  6: "seis",
};

export function zoneFamilySummary(disciplineCount: number, familyCount: number) {
  const familyLabel = FAMILY_COUNT_LABELS[familyCount] || String(familyCount);
  if (disciplineCount === 1) {
    return `La disciplina de la zona se agrupa en ${familyLabel} ${
      familyCount === 1 ? "gran familia" : "grandes familias"
    }.`;
  }
  return `Las ${disciplineCount} disciplinas de la zona se agrupan en ${familyLabel} ${
    familyCount === 1 ? "gran familia" : "grandes familias"
  }.`;
}

export function createWeekendZoneFilters(): ZoneFilters {
  return {
    ...DEFAULT_ZONE_FILTERS,
    period: "weekend",
  };
}

export function hasSpecificZoneFilters(filters: ZoneFilters) {
  return Boolean(
    filters.discipline
    || filters.group
    || filters.province
    || filters.query,
  );
}

export function visibleZoneLocalities(
  localities: ZoneFilterOption[],
  expanded: boolean,
  limit = 10,
) {
  return expanded ? localities : localities.slice(0, limit);
}

export function visibleZoneProvinces(
  provinces: ZoneFilterOption[],
  expanded: boolean,
) {
  return expanded ? provinces : provinces.slice(0, 8);
}

function buildOptions(
  events: EventItem[],
  readLabel: (event: EventItem) => string,
  minimum = 1,
) {
  const options = new Map<string, ZoneFilterOption>();

  for (const event of events) {
    const label = readLabel(event);
    const key = zoneFilterKey(label);
    if (!key) continue;
    const current = options.get(key);
    options.set(key, {
      count: (current?.count || 0) + 1,
      key,
      label: current?.label || label,
    });
  }

  return [...options.values()]
    .filter((item) => item.count >= minimum)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"));
}

function buildMonthCounts(events: EventItem[]) {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  });
  const options = new Map<string, ZoneFilterOption>();

  for (const event of events) {
    const date = eventStart(event);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = options.get(key);
    options.set(key, {
      count: (current?.count || 0) + 1,
      key,
      label: formatter.format(date),
    });
  }

  return [...options.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function buildZonePreviewData(
  events: EventItem[],
  zoneId: MacroZoneId,
  now: Date,
): ZonePreviewData {
  const zoneConfig = SEO_ZONES.find((zone) => zone.slug === zoneId);
  if (!zoneConfig) throw new Error(`Zona desconocida: ${zoneId}`);

  const zoneEvents = deduplicateEvents(events.filter((event) => classifyEventMacroZone(event) === zoneId));
  const upcomingEvents = sortUpcomingZoneEvents(zoneEvents.filter((event) => isFutureEvent(event, now)));
  const pastEvents = sortPastZoneEvents(zoneEvents.filter((event) => isPastEvent(event, now)));
  const provinceOptions = buildOptions(upcomingEvents, (event) => normalizeZoneProvince(event.province));
  const disciplineOptions = buildOptions(upcomingEvents, (event) => normalizeZoneDiscipline(event.discipline));
  const localityOptions = buildOptions(
    upcomingEvents,
    (event) => normalizeZoneLocality(event.city),
    2,
  );
  const weekendEvents = sortUpcomingZoneEvents(
    upcomingEvents.filter((event) => eventIsThisWeekend(event, now)),
  );
  const dates = zoneEvents.flatMap((event) => [event.start, event.end || event.start]).filter(Boolean).sort();

  return {
    dateRange: {
      max: dates.at(-1) || null,
      min: dates[0] || null,
    },
    disciplineGroups: ZONE_DISCIPLINE_GROUPS.map((group) => ({
      count: upcomingEvents.filter((event) => classifyZoneDisciplineGroup(event) === group.id).length,
      id: group.id,
      label: group.label,
    })).filter((group) => group.count > 0),
    disciplineOptions,
    events: [...upcomingEvents, ...pastEvents],
    featuredEvents: upcomingEvents.filter((event) => event.featured),
    localityOptions,
    monthCounts: buildMonthCounts(upcomingEvents),
    pastEvents,
    provinceOptions,
    statusOptions: buildOptions(upcomingEvents, (event) => zoneEventStatusLabel(event)),
    stats: {
      disciplines: disciplineOptions.length,
      future: upcomingEvents.length,
      past: pastEvents.length,
      provinces: provinceOptions.length,
      total: zoneEvents.length,
    },
    upcomingEvents,
    vehicleOptions: buildOptions(upcomingEvents, (event) => zoneVehicleLabel(event)),
    weekendEvents,
    zone: {
      description: ZONE_DESCRIPTIONS[zoneId],
      h1: zoneConfig.h1,
      id: zoneId,
      intro: zoneConfig.intro,
      title: zoneConfig.title,
    },
  };
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function parseZoneFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ZoneFilters {
  const period = paramValue(searchParams.periodo);
  const group = paramValue(searchParams.tipo);

  return {
    discipline: zoneFilterKey(paramValue(searchParams.disciplina)),
    group: ZONE_DISCIPLINE_GROUPS.some((item) => item.id === group)
      ? group as ZoneDisciplineGroupId
      : "",
    period: ZONE_PERIODS.some((item) => item.id === period)
      ? period as ZonePeriod
      : "upcoming",
    province: provinceFilterKey(paramValue(searchParams.provincia)),
    query: cleanText(paramValue(searchParams.q)),
  };
}

export function nextZoneVisibleLimit(current: number, pageSize: number, total: number) {
  return Math.min(current + pageSize, total);
}

export function isZonePreviewAvailable(vercelEnvironment: string | undefined) {
  return vercelEnvironment !== "production";
}

export function isZonePreviewId(value: string): value is MacroZoneId {
  return MACRO_ZONE_IDS.includes(value as MacroZoneId);
}

export function buildZonePreviewMetadata(zone: string): Metadata {
  const config = SEO_ZONES.find((item) => item.slug === zone);

  return {
    title: config
      ? `Preview territorial: ${config.title} | EventoMotor`
      : "Preview territorial | EventoMotor",
    description: "Preview aislada del rediseño de páginas territoriales de EventoMotor.",
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export function zoneEventDateLabel(event: EventItem) {
  const start = eventStart(event);
  const end = eventEnd(event);
  const formatter = new Intl.DateTimeFormat("es-ES", { month: "short" });
  const startMonth = formatter.format(start).replace(".", "").toUpperCase();
  const endMonth = formatter.format(end).replace(".", "").toUpperCase();

  if (start.getTime() === end.getTime()) {
    return { kind: "single" as const, day: String(start.getDate()), month: startMonth };
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
    endDay: String(end.getDate()).padStart(2, "0"),
    endMonth,
    startDay: String(start.getDate()).padStart(2, "0"),
    startMonth,
  };
}

export function zoneEventStatusLabel(event: EventItem) {
  const labels: Record<string, string> = {
    cancelled: "Cancelado",
    postponed: "Aplazado",
    tentative: "Fecha provisional",
  };

  return labels[cleanText(event.eventStatus)] || "";
}

export function zoneVehicleLabel(event: EventItem) {
  const labels: Record<string, string> = {
    coche: "Coche",
    karting: "Karting",
    mixto: "Mixto",
    moto: "Moto",
    otros: "Otros",
  };
  const value = event.vehicleType || event.vehicle_type || "";
  return labels[value] || cleanText(value);
}
