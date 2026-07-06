import type { EventCandidate } from "@/lib/event-candidates/types";

const COUNTRY_ALIASES: Record<string, string> = {
  espana: "ES",
  spain: "ES",
  es: "ES",
  portugal: "PT",
  pt: "PT",
  francia: "FR",
  france: "FR",
  fr: "FR",
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTitle(input: string) {
  return compactWhitespace(input.replace(/[\r\n\t]+/g, " "));
}

export function normalizeCountry(input?: string | null): "ES" | "PT" | "FR" | string {
  const value = compactWhitespace(String(input || ""));

  if (!value) return "ES";

  const key = stripAccents(value).toLowerCase();
  return COUNTRY_ALIASES[key] || value.toUpperCase();
}

export function normalizeText(input?: string | null) {
  const value = compactWhitespace(String(input || "").replace(/[\r\n\t]+/g, " "));
  return value || null;
}

export function normalizeCategory(input?: string | null) {
  return normalizeText(input);
}

export function normalizeVehicleType(input?: string | null) {
  const value = stripAccents(compactWhitespace(String(input || "")).toLowerCase());

  if (!value) return null;
  if (["moto", "motocicleta", "motociclismo", "motos"].includes(value)) return "moto";
  if (["coche", "coches", "auto", "automovil", "automovilismo"].includes(value)) return "coche";
  if (["mixto", "coches y motos", "moto y coche"].includes(value)) return "mixto";
  if (["kart", "karting"].includes(value)) return "karting";
  if (["otros", "otro"].includes(value)) return "otros";

  return value;
}

export function slugifyCandidatePart(input?: string | null) {
  return stripAccents(String(input || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function buildCandidateSlug(input: Pick<EventCandidate, "normalized_title" | "city" | "start_date">) {
  return [input.normalized_title, input.city, input.start_date]
    .map(slugifyCandidatePart)
    .filter(Boolean)
    .join("-")
    .slice(0, 160)
    .replace(/-+$/g, "");
}

export function normalizeCandidateCore(candidate: EventCandidate) {
  return {
    normalized_title: normalizeTitle(candidate.normalized_title || candidate.raw_title || ""),
    country: normalizeCountry(candidate.country),
    source_name: normalizeText(candidate.source_name),
    source_type: normalizeText(candidate.source_type),
    source_country: normalizeCountry(candidate.source_country || candidate.country),
    raw_title: normalizeText(candidate.raw_title),
    raw_text: normalizeText(candidate.raw_text),
    description: normalizeText(candidate.description),
    city: normalizeText(candidate.city),
    province: normalizeText(candidate.province),
    region: normalizeText(candidate.region),
    location_name: normalizeText(candidate.location_name),
    address: normalizeText(candidate.address),
    category: normalizeCategory(candidate.category),
    discipline: normalizeCategory(candidate.discipline),
    vehicle_type: normalizeVehicleType(candidate.vehicle_type),
    organizer_name: normalizeText(candidate.organizer_name),
    organizer_url: normalizeText(candidate.organizer_url),
    contact_email: normalizeText(candidate.contact_email),
    contact_phone: normalizeText(candidate.contact_phone),
    image_url: normalizeText(candidate.image_url),
    price_text: normalizeText(candidate.price_text),
    registration_url: normalizeText(candidate.registration_url),
  };
}
