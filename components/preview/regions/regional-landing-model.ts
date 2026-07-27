import type { Metadata } from "next";
import { getWeekendRange, isEventInWeekendRange } from "@/components/preview/weekend/weekend-preview-model";
import { normalizeZoneDiscipline, normalizeZoneProvince } from "@/components/zones/zone-preview-model";
import { SEO_COMMUNITIES, matchesSeoCommunity, type SeoCommunityConfig } from "@/lib/seo-communities";
import type { EventItem } from "@/types/event";

export type RegionalPreviewId = "cataluna" | "madrid";
export type RegionalFinderMode = "full" | "compact" | "hidden" | "empty";
export type RegionalFixtureId =
  | "cataluna-amplia"
  | "madrid-sin-finde"
  | "madrid-sin-futuros"
  | "un-evento"
  | "dos-eventos"
  | "aislamiento-territorial";

export type RegionalCount = {
  count: number;
  key: string;
  label: string;
};

export type RegionalLandingConfig = {
  description: string;
  eyebrow: string;
  faqs: Array<{ answer: string; question: string }>;
  h1: string;
  id: RegionalPreviewId;
  name: string;
  publicPath: string;
  relatedLinks: Array<{ href: string; label: string }>;
  seoParagraphs: string[];
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

const REGIONAL_CONFIGS: Record<RegionalPreviewId, RegionalLandingConfig> = {
  cataluna: {
    description: "Agenda de eventos en Barcelona, Girona, Lleida y Tarragona.",
    eyebrow: "Agenda territorial",
    faqs: [
      {
        question: "¿Qué eventos de motor aparecen en Cataluña?",
        answer:
          "La agenda reúne próximos eventos visibles cuya región, provincia o localidad corresponde de forma normalizada con Cataluña.",
      },
      {
        question: "¿Incluye eventos de Barcelona, Girona, Lleida y Tarragona?",
        answer:
          "Sí. Los accesos territoriales se generan únicamente para las provincias que tienen próximos eventos publicados.",
      },
      {
        question: "¿Cómo confirmo horarios o inscripciones?",
        answer:
          "Abre la ficha del evento y consulta la fuente oficial disponible antes de organizar el desplazamiento.",
      },
    ],
    h1: "Eventos de motor en Cataluña",
    id: "cataluna",
    name: "Cataluña",
    publicPath: "/eventos-motor-cataluna",
    relatedLinks: [
      { href: "/eventos-motor-barcelona", label: "Eventos de motor en Barcelona" },
      { href: "/eventos-motor-este-fin-de-semana", label: "Eventos este fin de semana" },
      { href: "/disciplinas/rallyes", label: "Rallyes" },
      { href: "/disciplinas/circuito", label: "Circuito y tandas" },
      { href: "/disciplinas/concentraciones", label: "Concentraciones" },
    ],
    seoParagraphs: [
      "Cataluña reúne una de las agendas de motor más variadas de España. Barcelona concentra grandes citas de circuito y encuentros vinculados al automóvil y la moto, mientras Girona, Lleida y Tarragona aportan rallyes, pruebas de montaña, karting, concentraciones, rutas, clásicos y actividades locales. Esta selección utiliza la ubicación estructurada de cada ficha para mostrar únicamente eventos relacionados con el territorio catalán y mantener separados los próximos eventos de los ya celebrados.",
      "Los resultados se ordenan por fecha, dando prioridad a los eventos que ya están en curso. Cada tarjeta resume cuándo se celebra la cita, su ciudad, provincia y disciplina, y enlaza con una ficha donde puede existir información adicional sobre el recinto, la organización, entradas, inscripción o fuente oficial. Antes de desplazarte conviene comprobar siempre los detalles publicados por el organizador, especialmente en competiciones, rutas o eventos sujetos a cambios de horario.",
      "Puedes explorar la agenda por provincia o por las disciplinas que realmente tienen inventario. El Circuit de Barcelona-Catalunya, los trazados de karting y las carreteras donde se celebran rallyes y pruebas de montaña forman parte del contexto habitual de la región, junto con concentraciones moteras, ferias y encuentros de vehículos clásicos.",
    ],
  },
  madrid: {
    description: "Agenda de coches, motos y competición en la Comunidad de Madrid.",
    eyebrow: "Agenda territorial",
    faqs: [
      {
        question: "¿Qué eventos de motor aparecen en Madrid?",
        answer:
          "Se muestran próximos eventos visibles relacionados de forma normalizada con Madrid como región, provincia o localidad.",
      },
      {
        question: "¿Qué ocurre si no hay eventos este fin de semana?",
        answer:
          "La página mantiene visibles las siguientes fechas publicadas y señala de forma compacta cuándo se celebra el próximo evento.",
      },
      {
        question: "¿Cómo publico un evento de Madrid?",
        answer:
          "Puedes enviarlo desde Publicar un evento con fecha, ubicación y una fuente verificable para su revisión.",
      },
    ],
    h1: "Eventos de motor en Madrid",
    id: "madrid",
    name: "Madrid",
    publicPath: "/eventos-motor-madrid",
    relatedLinks: [
      { href: "/eventos-motor-este-fin-de-semana", label: "Eventos este fin de semana" },
      { href: "/disciplinas/circuito", label: "Circuito y tandas" },
      { href: "/disciplinas/concentraciones", label: "Concentraciones" },
      { href: "/disciplinas/clasicos", label: "Clásicos" },
      { href: "/disciplinas/ferias", label: "Ferias del motor" },
    ],
    seoParagraphs: [
      "Madrid combina eventos de circuito, concentraciones moteras, karting, clásicos, ferias, rutas y encuentros de clubes repartidos entre la capital y los municipios de la comunidad. Esta agenda regional selecciona eventos mediante campos estructurados de región, provincia y ciudad, por lo que una referencia secundaria en el título no basta para incorporar una cita ubicada realmente en otro territorio. Los eventos futuros y en curso forman el total principal; los ya celebrados permanecen disponibles en un histórico independiente.",
      "El Circuito de Madrid Jarama es uno de los principales focos de actividad, junto con IFEMA, instalaciones de karting y municipios que acogen concentraciones, exposiciones o rutas. Las próximas citas se presentan por orden temporal y cada tarjeta enlaza con su ficha individual. Allí puedes revisar la información disponible sobre recinto, fuente oficial, entradas o inscripción antes de planificar la visita.",
      "Cuando no existe actividad publicada para el viernes, sábado o domingo más próximo, la landing no se presenta como vacía: señala la fecha del siguiente evento y muestra inmediatamente el resto del inventario futuro. Los accesos regionales aparecen solo cuando ofrecen una elección real y nunca se utilizan tarjetas deshabilitadas ni contadores con valor cero.",
    ],
  },
};

export const REGIONAL_DESKTOP_LIMIT = 8;
export const REGIONAL_MOBILE_LIMIT = 6;
const REGIONAL_FIXTURE_NOW = new Date("2026-01-01T12:00:00");
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

export function regionalFilterKey(value: string | null | undefined) {
  return normalizeRegionalText(value).replace(/\s+/g, "-");
}

function toDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function today(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

function communityFor(id: RegionalPreviewId): SeoCommunityConfig {
  return id === "cataluna" ? SEO_COMMUNITIES.cataluna : SEO_COMMUNITIES.madrid;
}

export function eventBelongsToRegionalLanding(
  event: EventItem,
  id: RegionalPreviewId,
) {
  return matchesSeoCommunity(event, communityFor(id));
}

export function regionalFinderMode(upcomingTotal: number): RegionalFinderMode {
  if (upcomingTotal >= 10) return "full";
  if (upcomingTotal >= 3) return "compact";
  if (upcomingTotal >= 1) return "hidden";
  return "empty";
}

export function buildRegionalLandingModel(
  events: EventItem[],
  id: RegionalPreviewId,
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
    disciplineCounts: buildCounts(upcomingEvents, (event) => normalizeZoneDiscipline(event.discipline)),
    finderMode: regionalFinderMode(upcomingEvents.length),
    nextThirtyDaysEvents,
    pastEvents,
    provinceCounts: buildCounts(upcomingEvents, (event) => normalizeZoneProvince(event.province)),
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

export function buildRegionalNoUpcomingFixture(
  model: RegionalLandingModel,
): RegionalLandingModel {
  return {
    ...model,
    disciplineCounts: [],
    finderMode: "empty",
    provinceCounts: [],
    nextThirtyDaysEvents: [],
    territorialTotal: model.pastEvents.length,
    upcomingEvents: [],
    upcomingTotal: 0,
    vehicleCounts: [],
    weekendEvents: [],
  };
}

export function regionalFixtureId(
  searchParams: Record<string, string | string[] | undefined>,
): RegionalFixtureId | null {
  const fixture = firstParam(searchParams.fixture);
  if (fixture === "sin-futuros") return "madrid-sin-futuros";
  if (
    fixture === "cataluna-amplia"
    || fixture === "madrid-sin-finde"
    || fixture === "madrid-sin-futuros"
    || fixture === "un-evento"
    || fixture === "dos-eventos"
    || fixture === "aislamiento-territorial"
  ) return fixture;
  return null;
}

export function regionalFixtureNow(fixture: RegionalFixtureId | null, now: Date) {
  if (fixture === "madrid-sin-futuros") {
    return new Date("2026-07-27T12:00:00");
  }
  return fixture ? new Date(REGIONAL_FIXTURE_NOW) : now;
}

function buildRegionalSparseFixture(
  model: RegionalLandingModel,
  count: 1 | 2,
): RegionalLandingModel {
  const upcomingEvents = model.upcomingEvents.slice(0, count);
  const upcomingKeys = new Set(upcomingEvents.map((event) => event.slug || event.id));
  return {
    ...model,
    disciplineCounts: buildCounts(upcomingEvents, (event) => normalizeZoneDiscipline(event.discipline)),
    finderMode: "hidden",
    nextThirtyDaysEvents: model.nextThirtyDaysEvents.filter((event) => (
      upcomingKeys.has(event.slug || event.id)
    )),
    provinceCounts: buildCounts(upcomingEvents, (event) => normalizeZoneProvince(event.province)),
    territorialTotal: upcomingEvents.length + model.pastEvents.length,
    upcomingEvents,
    upcomingTotal: upcomingEvents.length,
    vehicleCounts: buildCounts(upcomingEvents, canonicalVehicleLabel),
    weekendEvents: model.weekendEvents.filter((event) => upcomingKeys.has(event.slug || event.id)),
  };
}

export function buildRegionalInventoryFixture(
  model: RegionalLandingModel,
  fixture: RegionalFixtureId | null,
): RegionalLandingModel {
  if (fixture === "madrid-sin-futuros") return buildRegionalNoUpcomingFixture(model);
  if (fixture === "madrid-sin-finde") return { ...model, weekendEvents: [] };
  if (fixture === "un-evento") return buildRegionalSparseFixture(model, 1);
  if (fixture === "dos-eventos") return buildRegionalSparseFixture(model, 2);
  return model;
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
    if (query.province && regionalFilterKey(normalizeZoneProvince(event.province)) !== query.province) return false;
    if (query.discipline && regionalFilterKey(normalizeZoneDiscipline(event.discipline)) !== query.discipline) return false;
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

export function isRegionalPreviewId(value: string): value is RegionalPreviewId {
  return value === "cataluna" || value === "madrid";
}

export function isRegionalPreviewAvailable(vercelEnvironment: string | undefined) {
  return vercelEnvironment !== "production";
}

export function buildRegionalPreviewMetadata(id: string): Metadata {
  const config = isRegionalPreviewId(id) ? REGIONAL_CONFIGS[id] : null;
  return {
    title: {
      absolute: config
        ? `Preview regional: ${config.h1} | EventoMotor`
        : "Preview regional | EventoMotor",
    },
    description: "Preview aislada del diseño de inventario primero para landings regionales.",
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
