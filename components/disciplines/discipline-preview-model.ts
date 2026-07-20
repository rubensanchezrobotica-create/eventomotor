import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";
import {
  getZoneWeekendRange,
  normalizeZoneLocality,
  normalizeZoneProvince,
  normalizeZoneText,
  sortPastZoneEvents,
  sortUpcomingZoneEvents,
  zoneFilterKey,
  zoneVehicleLabel,
  type ZoneFilterOption,
} from "@/components/zones/zone-preview-model";

export type DisciplineSlug = (typeof SEO_DISCIPLINES)[number]["slug"];
export type DisciplinePeriod = "upcoming" | "weekend" | "next30" | "month" | "all";

export type DisciplineFilters = {
  locality: string;
  modality: string;
  period: DisciplinePeriod;
  province: string;
  query: string;
  vehicle: string;
};

export type DisciplineModality = {
  count: number;
  id: string;
  label: string;
};

export type DisciplineEditorial = {
  allEventsTitle: string;
  ctaText: string;
  ctaTitle: string;
  heroDescription: string;
  monthTitle: string;
  next30Title: string;
  upcomingTitle: string;
  weekendTitle: string;
};

export type DisciplinePreviewData = {
  discipline: {
    description: string;
    h1: string;
    intro: string;
    slug: DisciplineSlug;
    title: string;
  };
  editorial: DisciplineEditorial;
  events: EventItem[];
  localityOptions: ZoneFilterOption[];
  modalities: DisciplineModality[];
  otherDisciplines: Array<{ count: number; slug: DisciplineSlug; title: string }>;
  pastEvents: EventItem[];
  provinceOptions: ZoneFilterOption[];
  stats: {
    past: number;
    provinces: number;
    total: number;
    unknownProvince: number;
    upcoming: number;
  };
  upcomingEvents: EventItem[];
  vehicleOptions: ZoneFilterOption[];
  weekendEvents: EventItem[];
};

export const DEFAULT_DISCIPLINE_FILTERS: DisciplineFilters = {
  locality: "",
  modality: "",
  period: "upcoming",
  province: "",
  query: "",
  vehicle: "",
};

export const DISCIPLINE_PERIODS: Array<{ id: DisciplinePeriod; label: string }> = [
  { id: "upcoming", label: "Próximos" },
  { id: "weekend", label: "Este fin de semana" },
  { id: "next30", label: "Próximos 30 días" },
  { id: "month", label: "Este mes" },
  { id: "all", label: "Todos los eventos" },
];

const EDITORIAL: Record<DisciplineSlug, DisciplineEditorial> = {
  rallyes: {
    allEventsTitle: "Todos los rallyes",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas un rally?",
    heroDescription: "Rallyes, rallysprint, subidas, slalom, regularidad, bajas y pruebas de tierra en toda España.",
    monthTitle: "Rallyes de este mes",
    next30Title: "Rallyes de los próximos 30 días",
    upcomingTitle: "Próximos rallyes",
    weekendTitle: "Rallyes este fin de semana",
  },
  circuito: {
    allEventsTitle: "Todos los eventos de circuito",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas un evento de circuito?",
    heroDescription: "Circuito, tandas, velocidad, resistencia y drift en toda España.",
    monthTitle: "Eventos de circuito de este mes",
    next30Title: "Eventos de circuito de los próximos 30 días",
    upcomingTitle: "Próximos eventos de circuito",
    weekendTitle: "Eventos de circuito este fin de semana",
  },
  concentraciones: {
    allEventsTitle: "Todas las concentraciones",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas una concentración?",
    heroDescription: "Concentraciones, motoalmuerzos y encuentros custom en toda España.",
    monthTitle: "Concentraciones de este mes",
    next30Title: "Concentraciones de los próximos 30 días",
    upcomingTitle: "Próximas concentraciones",
    weekendTitle: "Concentraciones este fin de semana",
  },
  offroad: {
    allEventsTitle: "Todos los eventos offroad",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas una prueba offroad?",
    heroDescription: "Motocross, enduro, trial y pruebas todoterreno en toda España.",
    monthTitle: "Eventos offroad de este mes",
    next30Title: "Eventos offroad de los próximos 30 días",
    upcomingTitle: "Próximos eventos offroad",
    weekendTitle: "Eventos offroad este fin de semana",
  },
  clasicos: {
    allEventsTitle: "Todos los eventos de clásicos",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas un evento de clásicos?",
    heroDescription: "Encuentros, rutas y competiciones de vehículos clásicos en toda España.",
    monthTitle: "Eventos de clásicos de este mes",
    next30Title: "Eventos de clásicos de los próximos 30 días",
    upcomingTitle: "Próximos eventos de clásicos",
    weekendTitle: "Eventos de clásicos este fin de semana",
  },
  karting: {
    allEventsTitle: "Todos los eventos de karting",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas una prueba de karting?",
    heroDescription: "Carreras, campeonatos y encuentros de karting en toda España.",
    monthTitle: "Eventos de karting de este mes",
    next30Title: "Eventos de karting de los próximos 30 días",
    upcomingTitle: "Próximos eventos de karting",
    weekendTitle: "Eventos de karting este fin de semana",
  },
  rutas: {
    allEventsTitle: "Todas las rutas",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas una ruta motera?",
    heroDescription: "Rutas moteras y planes de mototurismo en toda España.",
    monthTitle: "Rutas de este mes",
    next30Title: "Rutas de los próximos 30 días",
    upcomingTitle: "Próximas rutas",
    weekendTitle: "Rutas este fin de semana",
  },
  ferias: {
    allEventsTitle: "Todas las ferias",
    ctaText: "Publica tu evento y llega a aficionados de toda España.",
    ctaTitle: "¿Organizas una feria del motor?",
    heroDescription: "Ferias, salones y exposiciones del motor en toda España.",
    monthTitle: "Ferias de este mes",
    next30Title: "Ferias de los próximos 30 días",
    upcomingTitle: "Próximas ferias",
    weekendTitle: "Ferias este fin de semana",
  },
};

type ModalityDefinition = {
  id: string;
  label: string;
  terms: string[];
};

const MODALITIES: Record<DisciplineSlug, ModalityDefinition[]> = {
  rallyes: [
    { id: "rallyes", label: "Rallyes", terms: ["rally"] },
    { id: "rallysprint-rallycrono", label: "Rallysprint y rallycrono", terms: ["rallysprint", "rallycrono"] },
    { id: "rallymix-rallycross", label: "Rallymix y rallycross", terms: ["rallymix", "rallycross"] },
    { id: "montana-subidas", label: "Montaña y subidas", terms: ["montana", "subida", "cronometrada", "tramo cronometrado de subida"] },
    { id: "tierra", label: "Rallyes de tierra", terms: ["rally tierra", "tramo de tierra"] },
    { id: "regularidad-historicos", label: "Regularidad e históricos", terms: ["regularidad", "eco rally", "rally historico"] },
    { id: "bajas-rally-tt", label: "Bajas y Rally TT", terms: ["rally tt", "rally raid", "baja"] },
    { id: "slalom", label: "Slalom", terms: ["slalom"] },
  ],
  circuito: [
    { id: "circuito-tandas", label: "Circuito y tandas", terms: ["circuito", "tandas", "trackday"] },
    { id: "velocidad-resistencia", label: "Velocidad y resistencia", terms: ["velocidad", "motogp", "superbike", "worldsbk", "juniorgp", "resistencia", "resistencia ciclomotores"] },
    { id: "minivelocidad", label: "MiniVelocidad", terms: ["minivelocidad", "pitbike", "minimotard"] },
    { id: "supermotard", label: "Supermotard", terms: ["supermotard", "supermoto"] },
    { id: "drift", label: "Drift", terms: ["drift"] },
  ],
  concentraciones: [
    { id: "concentraciones", label: "Concentraciones", terms: ["concentracion", "concentraciones"] },
    { id: "motoalmuerzos", label: "Motoalmuerzos", terms: ["motoalmuerzo"] },
    { id: "custom", label: "Custom", terms: ["custom"] },
  ],
  offroad: [
    { id: "motocross-supercross", label: "Motocross y supercross", terms: ["motocross", "supercross"] },
    { id: "enduro", label: "Enduro", terms: ["enduro", "enduro indoor", "enduro country", "hard enduro", "enduret", "enduro clasicas"] },
    { id: "trial", label: "Trial", terms: ["trial", "trialgp", "trial clasicas"] },
    { id: "cross-country", label: "Cross country", terms: ["cross country", "resistencia tierra"] },
    { id: "todoterreno", label: "4x4 y todoterreno", terms: ["offroad", "off road", "todoterreno", "autocross", "todo terreno clasico"] },
  ],
  clasicos: [
    { id: "encuentros-clasicos", label: "Encuentros de clásicos", terms: ["clasicos", "clasicas"] },
    { id: "competicion-historica", label: "Competición histórica", terms: ["regularidad clasicos", "velocidad clasicas", "resistencia clasicas asfalto"] },
  ],
  karting: [
    { id: "karting", label: "Karting", terms: ["karting", "karting minivelocidad"] },
  ],
  rutas: [
    { id: "rutas-moteras", label: "Rutas moteras", terms: ["rutas", "ruta motera"] },
    { id: "mototurismo", label: "Mototurismo", terms: ["mototurismo"] },
  ],
  ferias: [
    { id: "ferias", label: "Ferias y salones", terms: ["feria", "ferias"] },
  ],
};

const DISCIPLINE_BY_VALUE = new Map<string, DisciplineSlug>();
for (const discipline of SEO_DISCIPLINES) {
  for (const modality of MODALITIES[discipline.slug]) {
    for (const term of modality.terms) DISCIPLINE_BY_VALUE.set(term, discipline.slug);
  }
}

const UNCONFIRMED_PROVINCES = new Set([
  "por confirmar",
  "sin provincia",
  "ubicacion por confirmar",
]);

function cleanText(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function eventIdentity(event: EventItem) {
  return event.slug || event.id;
}

function deduplicateEvents(events: EventItem[]) {
  const unique = new Map<string, EventItem>();
  for (const event of events) {
    if (!unique.has(eventIdentity(event))) unique.set(eventIdentity(event), event);
  }
  return [...unique.values()];
}

function toDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function today(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isUpcoming(event: EventItem, now: Date) {
  return toDate(event.end || event.start).getTime() >= today(now).getTime();
}

function overlaps(event: EventItem, start: Date, end: Date) {
  return toDate(event.start).getTime() <= end.getTime()
    && toDate(event.end || event.start).getTime() >= start.getTime();
}

function isWeekend(event: EventItem, now: Date) {
  const range = getZoneWeekendRange(now);
  return overlaps(event, toDate(range.friday), toDate(range.sunday));
}

function isNext30Days(event: EventItem, now: Date) {
  const start = today(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 30);
  end.setHours(23, 59, 59, 999);
  return overlaps(event, start, end);
}

function isThisMonth(event: EventItem, now: Date) {
  return overlaps(event, today(now), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
}

function searchText(event: EventItem) {
  return normalizeZoneText([
    event.title,
    event.venue,
    event.city,
    event.province,
    event.region,
  ].join(" "));
}

function buildOptions(events: EventItem[], readLabel: (event: EventItem) => string, minimum = 1) {
  const options = new Map<string, ZoneFilterOption>();
  for (const event of events) {
    const label = cleanText(readLabel(event));
    const key = zoneFilterKey(label);
    if (!key) continue;
    const current = options.get(key);
    options.set(key, { count: (current?.count || 0) + 1, key, label: current?.label || label });
  }
  return [...options.values()]
    .filter((option) => option.count >= minimum)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"));
}

export function isDisciplineSlug(value: string): value is DisciplineSlug {
  return SEO_DISCIPLINES.some((discipline) => discipline.slug === value);
}

export function classifyEventDisciplinePage(event: EventItem): DisciplineSlug | null {
  const vehicle = normalizeZoneText(event.vehicleType || event.vehicle_type);
  if (vehicle === "karting") return "karting";
  return DISCIPLINE_BY_VALUE.get(normalizeZoneText(event.discipline)) || null;
}

export function eventBelongsToDiscipline(event: EventItem, slug: DisciplineSlug) {
  return classifyEventDisciplinePage(event) === slug;
}

export function classifyDisciplineModality(event: EventItem, slug: DisciplineSlug) {
  if (!eventBelongsToDiscipline(event, slug)) return null;
  const value = normalizeZoneText(event.discipline);
  if (slug === "karting" && normalizeZoneText(event.vehicleType || event.vehicle_type) === "karting") {
    return MODALITIES.karting[0].id;
  }
  return MODALITIES[slug].find((modality) => modality.terms.includes(value))?.id || null;
}

export function periodDisciplineEvents(events: EventItem[], period: DisciplinePeriod, now: Date) {
  if (period === "all") {
    return [
      ...sortUpcomingZoneEvents(events.filter((event) => isUpcoming(event, now))),
      ...sortPastZoneEvents(events.filter((event) => !isUpcoming(event, now))),
    ];
  }
  const upcoming = events.filter((event) => isUpcoming(event, now));
  if (period === "weekend") return sortUpcomingZoneEvents(upcoming.filter((event) => isWeekend(event, now)));
  if (period === "next30") return sortUpcomingZoneEvents(upcoming.filter((event) => isNext30Days(event, now)));
  if (period === "month") return sortUpcomingZoneEvents(upcoming.filter((event) => isThisMonth(event, now)));
  return sortUpcomingZoneEvents(upcoming);
}

export function filterDisciplineEvents(events: EventItem[], filters: DisciplineFilters, now: Date) {
  const query = normalizeZoneText(filters.query);
  return periodDisciplineEvents(events, filters.period, now).filter((event) => {
    if (filters.province && zoneFilterKey(normalizeZoneProvince(event.province)) !== filters.province) return false;
    if (filters.locality && zoneFilterKey(normalizeZoneLocality(event.city)) !== filters.locality) return false;
    if (filters.vehicle && zoneFilterKey(zoneVehicleLabel(event)) !== filters.vehicle) return false;
    if (filters.modality) {
      const slug = classifyEventDisciplinePage(event);
      if (!slug || classifyDisciplineModality(event, slug) !== filters.modality) return false;
    }
    if (query && !searchText(event).includes(query)) return false;
    return true;
  });
}

export function hasAdvancedDisciplineFilters(filters: DisciplineFilters) {
  return Boolean(
    filters.modality
    || filters.vehicle
    || filters.locality
    || filters.query
    || filters.period === "next30"
    || filters.period === "month"
    || filters.period === "all",
  );
}

export function hasSpecificDisciplineFilters(filters: DisciplineFilters) {
  return Boolean(
    filters.modality || filters.vehicle || filters.locality || filters.province || filters.query,
  );
}

export function nextDisciplineVisibleLimit(current: number, pageSize: number, total: number) {
  return Math.min(current + pageSize, total);
}

export function disciplineEventCount(count: number) {
  return `${count} ${count === 1 ? "evento" : "eventos"}`;
}

export function disciplineResultTitle(
  period: DisciplinePeriod,
  title: string,
  mobile = false,
  slug?: DisciplineSlug,
) {
  if (slug) {
    const editorial = EDITORIAL[slug];
    if (period === "weekend") return editorial.weekendTitle;
    if (period === "next30") return editorial.next30Title;
    if (period === "month") return editorial.monthTitle;
    if (period === "all") return editorial.allEventsTitle;
    return editorial.upcomingTitle;
  }
  const name = title.toLocaleLowerCase("es");
  if (period === "weekend") return `${title} este fin de semana`;
  if (period === "next30") return `${title} de los próximos 30 días`;
  if (period === "month") return `${title} de este mes`;
  if (period === "all") return `Todos los ${name}`;
  return mobile ? `Próximos ${name}` : `Próximos eventos de ${name} en España`;
}

export function disciplineResultMeta(count: number) {
  return `${count} ${count === 1 ? "evento" : "eventos"} en España · ${
    count === 1 ? "Ordenado" : "Ordenados"
  } por fecha`;
}

export function featuredDisciplineProvinces(options: ZoneFilterOption[]) {
  return options.filter((option) => !UNCONFIRMED_PROVINCES.has(normalizeZoneText(option.label)));
}

export function buildDisciplinePreviewData(
  events: EventItem[],
  slug: DisciplineSlug,
  now: Date,
): DisciplinePreviewData {
  const config = SEO_DISCIPLINES.find((discipline) => discipline.slug === slug);
  if (!config) throw new Error(`Disciplina desconocida: ${slug}`);
  const visible = deduplicateEvents(events.filter((event) => event.visible !== false));
  const disciplineEvents = visible.filter((event) => eventBelongsToDiscipline(event, slug));
  const upcomingEvents = sortUpcomingZoneEvents(disciplineEvents.filter((event) => isUpcoming(event, now)));
  const pastEvents = sortPastZoneEvents(disciplineEvents.filter((event) => !isUpcoming(event, now)));
  const provinceOptions = buildOptions(upcomingEvents, (event) => normalizeZoneProvince(event.province));
  const localityOptions = buildOptions(upcomingEvents, (event) => normalizeZoneLocality(event.city), 2);
  const modalities = MODALITIES[slug].map((modality) => ({
    count: upcomingEvents.filter((event) => classifyDisciplineModality(event, slug) === modality.id).length,
    id: modality.id,
    label: modality.label,
  })).filter((modality) => modality.count > 0);

  return {
    discipline: {
      description: config.description,
      h1: config.h1,
      intro: config.intro,
      slug,
      title: config.title,
    },
    editorial: EDITORIAL[slug],
    events: [...upcomingEvents, ...pastEvents],
    localityOptions,
    modalities,
    otherDisciplines: SEO_DISCIPLINES
      .filter((discipline) => discipline.slug !== slug)
      .map((discipline) => ({
        count: visible.filter((event) => (
          eventBelongsToDiscipline(event, discipline.slug) && isUpcoming(event, now)
        )).length,
        slug: discipline.slug,
        title: discipline.title,
      })),
    pastEvents,
    provinceOptions,
    stats: {
      past: pastEvents.length,
      provinces: featuredDisciplineProvinces(provinceOptions).length,
      total: disciplineEvents.length,
      unknownProvince: upcomingEvents.filter((event) => (
        !cleanText(event.province)
        || UNCONFIRMED_PROVINCES.has(normalizeZoneText(event.province))
      )).length,
      upcoming: upcomingEvents.length,
    },
    upcomingEvents,
    vehicleOptions: buildOptions(upcomingEvents, (event) => zoneVehicleLabel(event)),
    weekendEvents: upcomingEvents.filter((event) => isWeekend(event, now)),
  };
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function parseDisciplineFilters(params: Record<string, string | string[] | undefined>) {
  const period = paramValue(params.periodo);
  return {
    locality: paramValue(params.localidad),
    modality: paramValue(params.modalidad),
    period: DISCIPLINE_PERIODS.some((option) => option.id === period)
      ? period as DisciplinePeriod
      : "upcoming",
    province: paramValue(params.provincia),
    query: paramValue(params.q),
    vehicle: paramValue(params.vehiculo),
  } satisfies DisciplineFilters;
}

export function disciplineFiltersToSearchParams(filters: DisciplineFilters) {
  const params = new URLSearchParams();
  if (filters.province) params.set("provincia", filters.province);
  if (filters.modality) params.set("modalidad", filters.modality);
  if (filters.vehicle) params.set("vehiculo", filters.vehicle);
  if (filters.locality) params.set("localidad", filters.locality);
  if (filters.period !== "upcoming") params.set("periodo", filters.period);
  if (filters.query) params.set("q", filters.query);
  return params;
}

export function isDisciplinePreviewAvailable(vercelEnvironment: string | undefined) {
  return vercelEnvironment !== "production";
}

export function buildDisciplinePreviewMetadata(slug: string): Metadata {
  const config = SEO_DISCIPLINES.find((discipline) => discipline.slug === slug);
  if (!config) return { robots: { follow: false, index: false } };
  return {
    description: config.metaDescription,
    robots: { follow: false, index: false },
    title: `Preview: ${config.metaTitle}`,
  };
}

export function buildDisciplinePublicMetadata(slug: string): Metadata {
  const config = SEO_DISCIPLINES.find((discipline) => discipline.slug === slug);
  if (!config) return {};

  const canonical = `${SITE_URL}/disciplinas/${config.slug}`;
  const image = absoluteUrl(DEFAULT_OG_IMAGE);

  return {
    title: config.metaTitle,
    description: config.metaDescription,
    robots: { follow: true, index: true },
    alternates: { canonical },
    openGraph: {
      title: config.metaTitle,
      description: config.metaDescription,
      url: canonical,
      siteName: "EventoMotor",
      locale: "es_ES",
      type: "website",
      images: [{
        url: image,
        width: 1024,
        height: 1024,
        alt: "EventoMotor",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: config.metaTitle,
      description: config.metaDescription,
      images: [image],
    },
  };
}

export function disciplineModalities(slug: DisciplineSlug) {
  return MODALITIES[slug].map(({ id, label }) => ({ id, label }));
}

export function disciplineEditorial(slug: DisciplineSlug) {
  return EDITORIAL[slug];
}
