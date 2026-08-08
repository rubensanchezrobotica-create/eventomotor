import type { EventItem } from "@/types/event";

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
  { name: "Circuito", href: "/disciplinas/circuito", image: "/images/redesign-v2/disciplines/circuit.webp", terms: ["circuito", "trackday", "velocidad"] },
  { name: "Rally", href: "/disciplinas/rally", image: "/images/redesign-v2/disciplines/rally-asphalt.webp", terms: ["rally", "rallysprint", "regularidad"] },
  { name: "Todoterreno", href: "/disciplinas/todoterreno", image: "/images/redesign-v2/disciplines/offroad.webp", terms: ["todoterreno", "off road", "offroad", "raid", "4x4"] },
  { name: "Karting", href: "/disciplinas/karting", image: "/images/redesign-v2/disciplines/karting.webp", terms: ["karting", "kart"] },
  { name: "Motos", href: "/disciplinas/motos", image: "/images/redesign-v2/disciplines/motorcycles.webp", terms: ["moto", "motociclismo", "motoalmuerzo", "motero"] },
  { name: "Clásicos", href: "/disciplinas/clasicos", image: "/images/redesign-v2/disciplines/classics.webp", terms: ["clasico", "clásico", "historico", "histórico", "vintage"] },
  { name: "Concentraciones", href: "/disciplinas/concentraciones", image: "/images/redesign-v2/disciplines/meetup.webp", terms: ["concentracion", "concentración", "encuentro", "quedada"] },
  { name: "Ferias del motor", href: "/disciplinas/ferias", image: "/images/redesign-v2/disciplines/motor-fair.webp", terms: ["feria", "salon", "salón", "exposicion", "exposición"] },
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

const EVENT_IMAGE_PATHS = {
  circuit: "/images/redesign-v2/disciplines/circuit.webp",
  classics: "/images/redesign-v2/disciplines/classics.webp",
  karting: "/images/redesign-v2/disciplines/karting.webp",
  meetup: "/images/redesign-v2/disciplines/meetup.webp",
  fair: "/images/redesign-v2/disciplines/motor-fair.webp",
  motorcycles: "/images/redesign-v2/disciplines/motorcycles.webp",
  offroad: "/images/redesign-v2/disciplines/offroad.webp",
  rally: "/images/redesign-v2/disciplines/rally-asphalt.webp",
} as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function uniqueImages(images: readonly string[]): string[] {
  return [...new Set(images)];
}

function fallbackImageCandidates(event: PreviewEvent): string[] {
  const text = eventText(event);
  const vehicle = normalize(event.vehicleType);
  const isMotorcycle = /\b(moto|motocicleta|motociclismo)\b/.test(vehicle)
    || /\b(motogp|superbike|moto|motocross|supercross|enduro|trial|motoalmuerzo)\b/.test(text);
  const isCar = /\b(coche|automovil|turismo|4x4)\b/.test(vehicle);

  if (/\b(kart|karting)\b/.test(text)) return [EVENT_IMAGE_PATHS.karting];
  if (/\b(motocross|enduro|trial|off road|offroad|todoterreno|raid|4x4)\b/.test(text)) {
    return uniqueImages([EVENT_IMAGE_PATHS.offroad, ...(isMotorcycle ? [EVENT_IMAGE_PATHS.motorcycles] : [EVENT_IMAGE_PATHS.rally])]);
  }
  if (/\b(motogp|superbike|circuito|circuit|trackday|tandas|velocidad)\b/.test(text)) {
    return uniqueImages([EVENT_IMAGE_PATHS.circuit, ...(isMotorcycle ? [EVENT_IMAGE_PATHS.motorcycles] : [EVENT_IMAGE_PATHS.rally])]);
  }
  if (/\b(rally|rallye|rallysprint|regularidad)\b/.test(text)) return [EVENT_IMAGE_PATHS.rally, EVENT_IMAGE_PATHS.offroad];
  if (/\b(clasico|historico|vintage)\b/.test(text)) return [EVENT_IMAGE_PATHS.classics, EVENT_IMAGE_PATHS.meetup];
  if (/\b(concentracion|encuentro|quedada|motoalmuerzo)\b/.test(text)) {
    return uniqueImages([...(isMotorcycle ? [EVENT_IMAGE_PATHS.motorcycles] : []), EVENT_IMAGE_PATHS.meetup]);
  }
  if (/\b(feria|salon|exposicion)\b/.test(text)) return [EVENT_IMAGE_PATHS.fair, EVENT_IMAGE_PATHS.meetup];
  if (isMotorcycle) return [EVENT_IMAGE_PATHS.motorcycles, EVENT_IMAGE_PATHS.offroad, EVENT_IMAGE_PATHS.circuit];
  if (vehicle.includes("kart")) return [EVENT_IMAGE_PATHS.karting];
  if (isCar) {
    return [EVENT_IMAGE_PATHS.rally, EVENT_IMAGE_PATHS.circuit, EVENT_IMAGE_PATHS.classics, EVENT_IMAGE_PATHS.meetup, EVENT_IMAGE_PATHS.fair];
  }
  return [];
}

function representativeImage(src: string | null): ResolvedEventImage {
  if (!src) return { src: null, kind: "neutral", alt: "" };
  return { src, kind: "representative", alt: "Imagen representativa del tipo de evento", label: "Imagen representativa" };
}

export function resolveRedesignEventImage(event: PreviewEvent): ResolvedEventImage {
  const source = event.imageUrl?.trim();
  if (source) return { src: source, kind: "event", alt: `Imagen del evento ${event.title}` };
  const candidates = fallbackImageCandidates(event);
  return representativeImage(candidates.length ? candidates[stableHash(event.id) % candidates.length] : null);
}

export function resolveRedesignEventImages(events: readonly PreviewEvent[]): ResolvedEventImage[] {
  const used = new Set<string>();
  return events.map((event) => {
    const source = event.imageUrl?.trim();
    if (source) {
      used.add(source);
      return { src: source, kind: "event", alt: `Imagen del evento ${event.title}` };
    }
    const candidates = fallbackImageCandidates(event);
    if (!candidates.length) return representativeImage(null);
    const offset = stableHash(event.id) % candidates.length;
    const ordered = candidates.map((_, index) => candidates[(offset + index) % candidates.length]);
    const selected = ordered.find((candidate) => !used.has(candidate)) ?? ordered[0];
    used.add(selected);
    return representativeImage(selected);
  });
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
