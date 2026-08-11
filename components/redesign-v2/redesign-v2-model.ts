import type { EventItem } from "@/types/event";
import { assignV2HomeEventImages } from "./discipline-fallback-resolver";

export type PreviewEvent = Pick<
  EventItem,
  | "id"
  | "slug"
  | "title"
  | "championship"
  | "discipline"
  | "start"
  | "end"
  | "venue"
  | "city"
  | "province"
  | "region"
  | "tags"
  | "vehicleType"
  | "featured"
  | "imageUrl"
>;

export type ImageKind = "event" | "representative" | "neutral";

export type ResolvedEventImage = {
  src: string | null;
  kind: ImageKind;
  alt: string;
  label?: "Imagen representativa";
};

export type PreviewEventStatus = "Hoy" | "En curso" | "Próximamente";

export type SearchFilters = {
  place: string;
  date: string;
  discipline: string;
  vehicle: string;
};

export function reconcileAppliedTextFilter(
  filters: SearchFilters,
  nextPlace: string,
): SearchFilters {
  if (nextPlace !== "" || filters.place === "") {
    return filters;
  }

  return { ...filters, place: "" };
}

export function clearAppliedDateFilter(filters: SearchFilters): SearchFilters {
  if (filters.date === "") return filters;
  return { ...filters, date: "" };
}

export const REDESIGN_DISCIPLINES = [
  { name: "Rallyes", href: "/disciplinas/rallyes", image: "/images/disciplines/icons/web/discipline-rallyes.png", terms: ["rally", "rallye", "rallysprint", "subida", "montaña", "montana", "rally tt", "baja", "eco rallye"] },
  { name: "Circuito", href: "/disciplinas/circuito", image: "/images/disciplines/icons/web/discipline-circuito.png", terms: ["motogp", "superbike", "velocidad", "trackday", "circuito", "tandas", "esbk", "gt", "racing weekend"] },
  { name: "Concentraciones", href: "/disciplinas/concentraciones", image: "/images/disciplines/icons/web/discipline-concentraciones.png", terms: ["concentración", "concentracion", "motoalmuerzo", "custom", "bikers", "festival motero"] },
  { name: "Offroad", href: "/disciplinas/offroad", image: "/images/disciplines/icons/web/discipline-offroad.png", terms: ["motocross", "enduro", "trial", "offroad", "mx", "4x4", "overland", "raid"] },
  { name: "Clásicos", href: "/disciplinas/clasicos", image: "/images/disciplines/icons/web/discipline-clasicos.png", terms: ["clásicos", "clasicos", "clásicas", "clasicas", "histórico", "historico", "classic", "retro", "americanos"] },
  { name: "Karting", href: "/disciplinas/karting", image: "/images/disciplines/icons/web/discipline-karting.png", terms: ["kart", "karting"] },
  { name: "Rutas", href: "/disciplinas/rutas", image: "/images/disciplines/icons/web/discipline-rutas.png", terms: ["ruta", "ruta motera", "mototurismo", "touring", "rider", "viaje", "trail touring", "road trip", "paseo motero"] },
  { name: "Ferias", href: "/disciplinas/ferias", image: "/images/disciplines/icons/web/discipline-ferias.png", terms: ["feria", "salón", "salon", "expo", "exposición", "exposicion", "motor show", "motorshow", "festival", "muestra"] },
] as const;

export const REDESIGN_TERRITORIES = [
  { name: "Madrid", href: "/eventos-motor-madrid", image: "/images/redesign-v2/locations/madrid.webp", terms: ["madrid"] },
  { name: "Barcelona", href: "/eventos-motor-cataluna", image: "/images/redesign-v2/locations/barcelona.webp", terms: ["barcelona", "cataluna", "cataluña"] },
  { name: "Valencia", href: "/eventos-motor-valencia", image: "/images/redesign-v2/locations/valencia.webp", terms: ["valencia", "valenciana"] },
  { name: "Asturias", href: "/eventos-motor-asturias", image: "/images/redesign-v2/locations/asturias.webp", terms: ["asturias"] },
  { name: "Murcia", href: "/eventos-motor-murcia", image: "/images/redesign-v2/locations/murcia.webp", terms: ["murcia"] },
  { name: "Andalucía", href: "/eventos-motor-andalucia", image: "/images/redesign-v2/locations/sevilla.webp", terms: ["andalucia", "andalucía", "sevilla", "malaga", "málaga", "cadiz", "cádiz", "cordoba", "córdoba", "granada", "huelva", "jaen", "jaén", "almeria", "almería"] },
] as const;

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function eventText(event: PreviewEvent): string {
  return normalize([
    event.title,
    event.championship,
    event.venue,
    event.city,
    event.province,
    event.region,
    event.discipline,
    event.tags.join(" "),
    event.vehicleType,
  ].join(" "));
}

function dateKey(value: string | null | undefined): string | null {
  const candidate = String(value ?? "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (
    parsed.getFullYear() !== Number(year)
    || parsed.getMonth() !== Number(month) - 1
    || parsed.getDate() !== Number(day)
  ) return null;
  return candidate;
}

function spainDateKey(nowIso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).formatToParts(new Date(nowIso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function eventDateRange(event: PreviewEvent): { start: string; end: string } | null {
  const start = dateKey(event.start);
  if (!start) return null;
  const candidateEnd = dateKey(event.end);
  return { start, end: candidateEnd && candidateEnd >= start ? candidateEnd : start };
}

export type PreviewEventDateLabel =
  | { kind: "single"; day: string; month: string; ariaLabel: string }
  | { kind: "range"; day: string; month: string; ariaLabel: string }
  | {
      kind: "cross-month";
      startDay: string;
      startMonth: string;
      endDay: string;
      endMonth: string;
      ariaLabel: string;
    };

const VISUAL_MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"] as const;
const spokenDateFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" });

function dateLabelParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);

  return {
    day: String(day).padStart(2, "0"),
    month: VISUAL_MONTHS[month - 1],
    spoken: spokenDateFormatter.format(date),
  };
}

export function formatPreviewSelectedDate(value: string): string | null {
  const key = dateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  return `${day} ${VISUAL_MONTHS[month - 1].toLocaleLowerCase("es-ES")} ${year}`;
}

export function previewEventDateLabel(event: PreviewEvent): PreviewEventDateLabel | null {
  const range = eventDateRange(event);
  if (!range) return null;

  const start = dateLabelParts(range.start);
  if (range.end === range.start) {
    return {
      kind: "single",
      day: start.day,
      month: start.month,
      ariaLabel: `Fecha: ${start.spoken}`,
    };
  }

  const end = dateLabelParts(range.end);
  if (range.start.slice(0, 7) === range.end.slice(0, 7)) {
    return {
      kind: "range",
      day: `${start.day}–${end.day}`,
      month: start.month,
      ariaLabel: `Fecha: del ${Number(start.day)} al ${end.spoken}`,
    };
  }

  return {
    kind: "cross-month",
    startDay: start.day,
    startMonth: start.month,
    endDay: end.day,
    endMonth: end.month,
    ariaLabel: `Fecha: del ${start.spoken} al ${end.spoken}`,
  };
}

function matchesTerms(event: PreviewEvent, terms: readonly string[]): boolean {
  const text = eventText(event);
  return terms.some((term) => text.includes(normalize(term)));
}

export function projectPreviewEvent(event: EventItem): PreviewEvent {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    championship: event.championship,
    discipline: event.discipline,
    start: event.start,
    end: event.end,
    venue: event.venue,
    city: event.city,
    province: event.province,
    region: event.region,
    tags: event.tags,
    vehicleType: event.vehicleType,
    featured: event.featured,
    imageUrl: event.imageUrl,
  };
}

export function upcomingPreviewEvents(events: readonly PreviewEvent[], nowIso: string): PreviewEvent[] {
  const today = spainDateKey(nowIso);
  return [...events]
    .filter((event) => {
      const range = eventDateRange(event);
      return Boolean(range && range.end >= today);
    })
    .sort((left, right) => (dateKey(left.start) ?? "9999-12-31").localeCompare(dateKey(right.start) ?? "9999-12-31"));
}

export function selectFeaturedEvent(events: readonly PreviewEvent[]): { event: PreviewEvent | null; eyebrow: "Evento destacado" | "Próximo evento" } {
  const complete = events.filter(isEditoriallyComplete);
  const event = complete.find((candidate) => candidate.featured)
    ?? complete[0]
    ?? events.find((candidate) => candidate.featured)
    ?? events[0]
    ?? null;
  return { event, eyebrow: event?.featured ? "Evento destacado" : "Próximo evento" };
}

export function excludePreviewEventById(events: readonly PreviewEvent[], excludedId: string | null | undefined): PreviewEvent[] {
  if (!excludedId) return [...events];
  return events.filter((event) => event.id !== excludedId);
}

export function resolveRedesignEventImage(event: PreviewEvent): ResolvedEventImage {
  const [resolved] = assignV2HomeEventImages([event]);
  return resolved.label
    ? { src: resolved.src, kind: resolved.kind, alt: resolved.alt, label: resolved.label }
    : { src: resolved.src, kind: resolved.kind, alt: resolved.alt };
}

export function resolveRedesignEventImages(events: readonly PreviewEvent[]): ResolvedEventImage[] {
  return assignV2HomeEventImages(events).map(({ src, kind, alt, label }) => (
    label ? { src, kind, alt, label } : { src, kind, alt }
  ));
}

export function isRemoteImage(src: string | null): boolean {
  return Boolean(src && /^https?:\/\//i.test(src));
}

function hasUsefulValue(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  return Boolean(normalized && !/(^|\b)(a confirmar|por confirmar|pendiente|desconocid[oa]|sin determinar)(\b|$)/.test(normalized));
}

export function isEditoriallyComplete(event: PreviewEvent): boolean {
  return Boolean(
    eventDateRange(event)
    && hasUsefulValue(event.title)
    && hasUsefulValue(event.discipline)
    && [event.city, event.province, event.venue].some(hasUsefulValue),
  );
}

export function prioritizeEditorialEvents(events: readonly PreviewEvent[]): PreviewEvent[] {
  return [...events].sort((left, right) => {
    const completeness = Number(isEditoriallyComplete(right)) - Number(isEditoriallyComplete(left));
    if (completeness) return completeness;
    return (dateKey(left.start) ?? "9999-12-31").localeCompare(dateKey(right.start) ?? "9999-12-31");
  });
}

export function buildDisciplineCards(events: readonly PreviewEvent[]) {
  return REDESIGN_DISCIPLINES.map((discipline) => ({ ...discipline, count: events.filter((event) => matchesTerms(event, discipline.terms)).length }));
}

export function buildTerritoryCards(events: readonly PreviewEvent[]) {
  return REDESIGN_TERRITORIES.map((territory) => ({ ...territory, count: events.filter((event) => matchesTerms(event, territory.terms)).length }));
}

export function previewEventStatus(event: PreviewEvent, nowIso: string): PreviewEventStatus {
  const range = eventDateRange(event);
  const today = spainDateKey(nowIso);
  if (range?.start === today && range.end === today) return "Hoy";
  if (range && range.start <= today && range.end >= today) return "En curso";
  return "Próximamente";
}

export function filterPreviewEvents(events: readonly PreviewEvent[], filters: SearchFilters): PreviewEvent[] {
  const place = normalize(filters.place);
  const discipline = normalize(filters.discipline);
  const vehicle = normalize(filters.vehicle);
  const selectedDate = dateKey(filters.date);

  return events.filter((event) => {
    const text = eventText(event);
    if (place && !text.includes(place)) return false;
    if (discipline && !text.includes(discipline)) return false;
    if (vehicle && !normalize(event.vehicleType).includes(vehicle) && !text.includes(vehicle)) return false;
    if (selectedDate !== null) {
      const range = eventDateRange(event);
      if (!range || selectedDate < range.start || selectedDate > range.end) return false;
    }
    return true;
  });
}

export function previewEventHref(event: PreviewEvent): string {
  return `/evento/${event.slug || event.id}`;
}

export function previewVehicleLabel(event: PreviewEvent): string {
  return event.vehicleType?.trim() || "Motor";
}

export function isRedesignPreviewAvailable(vercelEnv = process.env.VERCEL_ENV): boolean {
  return vercelEnv !== "production";
}
