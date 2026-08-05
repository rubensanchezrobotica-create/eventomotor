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

export type ImageKind = "event" | "representative";

export type ResolvedEventImage = {
  src: string;
  kind: ImageKind;
  alt: string;
  label?: "Imagen representativa";
};

export type SearchFilters = {
  place: string;
  date: string;
  discipline: string;
  vehicle: string;
};

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

function asTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
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
  const today = new Date(nowIso);
  today.setHours(0, 0, 0, 0);
  return [...events]
    .filter((event) => {
      const endpoint = asTimestamp(event.end || event.start);
      return Number.isFinite(endpoint) && endpoint >= today.getTime();
    })
    .sort((left, right) => asTimestamp(left.start) - asTimestamp(right.start));
}

export function selectFeaturedEvent(events: readonly PreviewEvent[]): { event: PreviewEvent | null; eyebrow: "Evento destacado" | "Próximo evento" } {
  const event = events.find((candidate) => candidate.featured) ?? events[0] ?? null;
  return { event, eyebrow: event?.featured ? "Evento destacado" : "Próximo evento" };
}

export function resolveRedesignEventImage(event: PreviewEvent): ResolvedEventImage {
  const source = event.imageUrl?.trim();
  if (source) return { src: source, kind: "event", alt: `Imagen del evento ${event.title}` };

  const discipline = REDESIGN_DISCIPLINES.find((candidate) => matchesTerms(event, candidate.terms)) ?? REDESIGN_DISCIPLINES[0];
  return {
    src: discipline.image,
    kind: "representative",
    alt: `Imagen representativa de ${discipline.name.toLowerCase()}`,
    label: "Imagen representativa",
  };
}

export function isRemoteImage(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

export function buildDisciplineCards(events: readonly PreviewEvent[]) {
  return REDESIGN_DISCIPLINES.map((discipline) => ({ ...discipline, count: events.filter((event) => matchesTerms(event, discipline.terms)).length }));
}

export function buildTerritoryCards(events: readonly PreviewEvent[]) {
  return REDESIGN_TERRITORIES.map((territory) => ({ ...territory, count: events.filter((event) => matchesTerms(event, territory.terms)).length }));
}

export function previewEventStatus(event: PreviewEvent, nowIso: string): "Hoy" | "Próximamente" {
  const eventDate = new Date(event.start);
  const now = new Date(nowIso);
  const sameDay = eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth() && eventDate.getDate() === now.getDate();
  return sameDay ? "Hoy" : "Próximamente";
}

export function filterPreviewEvents(events: readonly PreviewEvent[], filters: SearchFilters): PreviewEvent[] {
  const place = normalize(filters.place);
  const discipline = normalize(filters.discipline);
  const vehicle = normalize(filters.vehicle);
  const selectedDate = filters.date ? new Date(`${filters.date}T00:00:00`).getTime() : null;

  return events.filter((event) => {
    const text = eventText(event);
    if (place && !text.includes(place)) return false;
    if (discipline && !text.includes(discipline)) return false;
    if (vehicle && !normalize(event.vehicleType).includes(vehicle) && !text.includes(vehicle)) return false;
    if (selectedDate !== null) {
      const start = asTimestamp(event.start);
      const end = asTimestamp(event.end || event.start);
      if (selectedDate < start || selectedDate > end) return false;
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
