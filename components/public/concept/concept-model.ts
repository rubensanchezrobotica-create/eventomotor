import { formatRange, parseDate, statusOf } from "@/lib/date-utils";
import { createEventSlug } from "@/lib/slug";
import type { EventItem } from "@/types/event";

export type ConceptZone = {
  name: string;
  x: number;
  y: number;
  color: string;
  terms: string[];
  events: EventItem[];
  upcoming: EventItem[];
  provinces: string[];
};

export type ConceptIntent = {
  label: string;
  short: string;
  terms: string[];
  color: string;
  events: EventItem[];
};

export const ZONE_DEFINITIONS = [
  { name: "Norte", x: 260, y: 172, color: "var(--emc-blue)", terms: ["galicia", "asturias", "cantabria", "país vasco", "pais vasco", "navarra", "la rioja", "león", "leon", "burgos"] },
  { name: "Centro", x: 462, y: 306, color: "var(--emc-orange)", terms: ["madrid", "castilla-la mancha", "castilla y león", "castilla y leon", "toledo", "guadalajara", "cuenca", "segovia", "avila", "ávila"] },
  { name: "Cataluña / Aragón", x: 680, y: 214, color: "var(--emc-orange)", terms: ["cataluña", "catalunya", "cataluna", "aragón", "aragon", "barcelona", "girona", "lleida", "tarragona", "zaragoza", "huesca", "teruel"] },
  { name: "Levante", x: 665, y: 410, color: "var(--emc-purple)", terms: ["comunidad valenciana", "valencia", "alicante", "castellón", "castellon", "murcia", "baleares", "illes balears", "mallorca"] },
  { name: "Sur", x: 405, y: 468, color: "var(--emc-green)", terms: ["andalucía", "andalucia", "extremadura", "sevilla", "cádiz", "cadiz", "málaga", "malaga", "granada", "córdoba", "cordoba", "huelva", "almería", "almeria", "jaén", "jaen", "badajoz", "cáceres", "caceres"] },
  { name: "Canarias", x: 312, y: 556, color: "var(--emc-green)", terms: ["canarias", "tenerife", "gran canaria", "palmas", "santa cruz"] },
];

export const INTENT_DEFINITIONS = [
  { label: "Quiero rodar", short: "Rodar", terms: ["trackday", "trackdays", "tandas", "velocidad", "minivelocidad"], color: "var(--emc-orange)" },
  { label: "Quiero ruta", short: "Ruta", terms: ["ruta", "rutas", "mototurismo", "turismo"], color: "var(--emc-blue)" },
  { label: "Quiero show", short: "Ver show", terms: ["feria", "ferias", "concentración", "concentracion", "concentraciones", "clásicos", "clasicos", "exhibición", "exhibicion"], color: "var(--emc-purple)" },
  { label: "Quiero tierra", short: "Tierra", terms: ["enduro", "motocross", "trial", "cross country", "hard enduro", "offroad"], color: "var(--emc-green)" },
];

export function eventText(event: EventItem) {
  return [
    event.title,
    event.championship,
    event.discipline,
    event.venue,
    event.city,
    event.province,
    event.region,
    event.tags.join(" "),
  ].join(" ").toLowerCase();
}

export function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}

export function matchesTerms(event: EventItem, terms: string[]) {
  const text = eventText(event);
  return terms.some((term) => text.includes(term.toLowerCase()));
}

export function buildZones(events: EventItem[]): ConceptZone[] {
  return ZONE_DEFINITIONS.map((zone) => {
    const zoneEvents = events.filter((event) => matchesTerms(event, zone.terms));
    return {
      ...zone,
      events: zoneEvents,
      upcoming: zoneEvents.filter((event) => statusOf(event) !== "finalizado"),
      provinces: unique(zoneEvents.map((event) => event.province)),
    };
  }).filter((zone) => zone.events.length > 0);
}

export function buildIntents(events: EventItem[]): ConceptIntent[] {
  return INTENT_DEFINITIONS.map((intent) => ({
    ...intent,
    events: events.filter((event) => matchesTerms(event, intent.terms)),
  }));
}

export function eventHref(event: EventItem) {
  return `/evento/${event.slug || createEventSlug(event.title, event.start)}`;
}

export function dayLabel(event: EventItem) {
  const date = parseDate(event.start);
  return {
    day: String(date.getDate()),
    month: new Intl.DateTimeFormat("es-ES", { month: "short" }).format(date).replace(".", "").toUpperCase(),
  };
}

export function eventLine(event: EventItem) {
  return `${event.city} / ${event.province} / ${formatRange(event)}`;
}
