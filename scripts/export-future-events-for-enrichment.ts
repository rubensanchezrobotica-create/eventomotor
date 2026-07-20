import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ENRICHMENT_EXPORT_VERSION = "1.1.0";
export const ENRICHMENT_TIME_ZONE = "Europe/Madrid";
export const ENRICHMENT_PAGE_SIZE = 1000;
export const READ_ONLY_QUERY_OPERATIONS = ["select", "order", "range"] as const;

const OUTPUT_DIR = path.join(process.cwd(), "data", "research", "enrichment");
const DAY_MS = 86_400_000;
const RECENT_VERIFICATION_DAYS = 60;

export type ResearchStatus = "verify_only" | "enrich" | "urgent_review" | "possible_duplicate" | "cancelled_review";

export type ResearchEventRow = {
  id: string;
  slug: string | null;
  title: string;
  championship: string | null;
  discipline: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  country: string | null;
  level: string | null;
  source: string | null;
  source_url: string | null;
  source_id: string | null;
  ticket_url: string | null;
  official_url: string | null;
  registration_url: string | null;
  image_url: string | null;
  image_source_url: string | null;
  event_status: string | null;
  short_description: string | null;
  long_description: string | null;
  schedule_text: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  organizer_name: string | null;
  organizer_url: string | null;
  verified_at: string | null;
  source_type: string | null;
  confidence_score: number | null;
  needs_review: boolean | null;
  tags: string[] | null;
  vehicle_type: string | null;
  featured: boolean | null;
  visible: boolean | null;
  import_method: string | null;
  data_quality: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EnrichmentEvent = ResearchEventRow & {
  days_until_start: number;
  is_happening_now: boolean;
  duration_days: number;
  has_official_source: boolean;
  official_source_reason: OfficialSourceReason;
  has_registration: boolean;
  has_organizer: boolean;
  has_exact_address: boolean;
  exact_address_reason: ExactAddressReason;
  has_coordinates: boolean;
  has_short_description: boolean;
  has_long_description: boolean;
  has_schedule: boolean;
  has_image: boolean;
  has_image_source: boolean;
  is_recently_verified: boolean;
  normalized_province: string;
  normalized_region: string;
  normalized_discipline: string;
  missing_fields: string[];
  missing_fields_count: number;
  research_priority: number;
  research_status: ResearchStatus;
  duplicate_fingerprint: string;
  possible_duplicate_ids: string[];
  research_notes: string[];
};

export type OfficialSourceReason =
  | `primary_source_type:${string}`
  | "aggregator_source"
  | "secondary_source"
  | "missing_source"
  | "unknown_source_type";

export type ExactAddressReason =
  | "street_level_address"
  | "road_or_exit_address"
  | "generic_city_province"
  | "same_as_location_fields"
  | "missing_address"
  | "unconfirmed_address";

export type BatchPersistenceDecision = {
  action: "create" | "preserve" | "regenerate";
  preserved_ids: string[];
  inactive_ids: string[];
  disappeared_ids: string[];
};

export type ResearchBatchEvent = EnrichmentEvent & {
  research_questions: string[];
  research_sources: string[];
  proposed_values: Record<string, null>;
  observations: string;
};

export interface FutureEventRepository {
  fetchPage(from: number, to: number): Promise<ResearchEventRow[]>;
}

type ResearchDatabase = {
  public: {
    Tables: {
      events: {
        Row: ResearchEventRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const EVENT_FIELDS = [
  "id",
  "slug",
  "title",
  "championship",
  "discipline",
  "start_date",
  "end_date",
  "venue",
  "city",
  "province",
  "region",
  "country",
  "level",
  "source",
  "source_url",
  "source_id",
  "ticket_url",
  "official_url",
  "registration_url",
  "image_url",
  "image_source_url",
  "event_status",
  "short_description",
  "long_description",
  "schedule_text",
  "address",
  "latitude",
  "longitude",
  "organizer_name",
  "organizer_url",
  "verified_at",
  "source_type",
  "confidence_score",
  "needs_review",
  "tags",
  "vehicle_type",
  "featured",
  "visible",
  "import_method",
  "data_quality",
  "notes",
  "created_at",
  "updated_at",
] as const;

const EVENT_SELECT = EVENT_FIELDS.join(",");
const OFFICIAL_SOURCE_TYPES = new Set([
  "official",
  "organizer",
  "federation",
  "circuit",
  "municipality",
  "championship",
  "club",
  "organizing club",
  "club organizer",
]);
const AGGREGATOR_SOURCE_TYPES = new Set(["aggregator", "calendar aggregator", "directory", "directorio"]);
const SECONDARY_SOURCE_TYPES = new Set(["secondary", "media", "blog"]);
const KNOWN_AGGREGATOR_SOURCES = ["todocircuito", "concentracionesdemotos", "canal difusion"];
const KNOWN_SECONDARY_SOURCES = ["briefing sport"];

const PROVINCE_NORMALIZATION = new Map([
  ["a coruna", "A Coruña"],
  ["cadiz", "Cádiz"],
  ["leon", "León"],
  ["almeria", "Almería"],
  ["caceres", "Cáceres"],
  ["cordoba", "Córdoba"],
  ["malaga", "Málaga"],
  ["jaen", "Jaén"],
  ["alava", "Álava"],
  ["castellon", "Castellón"],
  ["baleares", "Illes Balears"],
  ["illes balears", "Illes Balears"],
  ["bizkaia", "Bizkaia"],
  ["vizcaya", "Bizkaia"],
  ["lleida", "Lleida"],
  ["lerida", "Lleida"],
]);

const REGION_NORMALIZATION = new Map([
  ["andalucia", "Andalucía"],
  ["aragon", "Aragón"],
  ["baleares", "Illes Balears"],
  ["illes balears", "Illes Balears"],
  ["canarias", "Canarias"],
  ["islas canarias", "Canarias"],
  ["castilla y leon", "Castilla y León"],
  ["cataluna", "Cataluña"],
  ["catalunya", "Cataluña"],
  ["comunidad de madrid", "Comunidad de Madrid"],
  ["madrid", "Comunidad de Madrid"],
  ["comunidad valenciana", "Comunitat Valenciana"],
  ["comunitat valenciana", "Comunitat Valenciana"],
  ["euskadi", "País Vasco"],
  ["pais vasco", "País Vasco"],
  ["murcia", "Región de Murcia"],
  ["region de murcia", "Región de Murcia"],
]);

const DISCIPLINE_NORMALIZATION = new Map([
  ["montana", "Montaña"],
  ["clasico", "Clásicos"],
  ["clasicos", "Clásicos"],
  ["clasica", "Clásicos"],
  ["clasicas", "Clásicos"],
  ["concentracion", "Concentraciones"],
  ["concentraciones", "Concentraciones"],
  ["feria", "Ferias"],
  ["ferias", "Ferias"],
  ["off road", "Offroad"],
  ["offroad", "Offroad"],
  ["rally", "Rally"],
  ["rallyes", "Rally"],
  ["ruta motera", "Rutas"],
  ["rutas", "Rutas"],
]);
const GENERIC_TITLE_WORDS = new Set([
  "2026",
  "campeonato",
  "copa",
  "espana",
  "gran",
  "premio",
  "evento",
  "circuito",
  "temporada",
  "jornada",
  "de",
  "del",
  "la",
  "el",
  "en",
]);

export function assertReadOnlyOperations(operations: readonly string[]) {
  const allowed = new Set<string>(READ_ONLY_QUERY_OPERATIONS);
  const forbidden = operations.filter((operation) => !allowed.has(operation));

  if (forbidden.length) {
    throw new Error(`Operacion Supabase de escritura o no autorizada: ${forbidden.join(", ")}`);
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function text(value: string | null | undefined) {
  return value?.trim() || "";
}

function normalize(value: string | null | undefined) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedAuditValue(value: string | null | undefined, mappings: Map<string, string>) {
  const original = text(value);
  if (!original) return "(sin dato)";
  return mappings.get(normalize(original)) || original;
}

export function normalizeProvince(value: string | null | undefined) {
  return normalizedAuditValue(value, PROVINCE_NORMALIZATION);
}

export function normalizeRegion(value: string | null | undefined) {
  return normalizedAuditValue(value, REGION_NORMALIZATION);
}

export function normalizeDiscipline(value: string | null | undefined) {
  return normalizedAuditValue(value, DISCIPLINE_NORMALIZATION);
}

function isPlaceholder(value: string | null | undefined) {
  const normalized = normalize(value);
  return !normalized || normalized === "por confirmar" || normalized === "pendiente" || normalized === "sin definir";
}

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) throw new Error(`Fecha ISO no valida: ${value}`);
  return date;
}

function differenceInDays(left: string, right: string) {
  return Math.round((parseDateOnly(left).getTime() - parseDateOnly(right).getTime()) / DAY_MS);
}

function addDays(value: string, days: number) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function effectiveEndDate(event: Pick<ResearchEventRow, "start_date" | "end_date">) {
  return event.end_date || event.start_date;
}

export function dateInTimeZone(date: Date, timeZone = ENRICHMENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isFutureOrOngoing(event: Pick<ResearchEventRow, "start_date" | "end_date">, today: string) {
  return effectiveEndDate(event) >= today;
}

export function isPublicEvent(event: Pick<ResearchEventRow, "visible" | "data_quality">) {
  return event.visible !== false && normalize(event.data_quality) !== "draft";
}

export function isCancelledEvent(event: Pick<ResearchEventRow, "event_status" | "data_quality">) {
  const statuses = [normalize(event.event_status), normalize(event.data_quality)];
  return statuses.some((status) => ["cancelled", "canceled", "cancelado", "cancelada"].includes(status));
}

function titleTokens(title: string) {
  return new Set(
    normalize(title)
      .split(" ")
      .filter((token) => token.length > 1 && !GENERIC_TITLE_WORDS.has(token))
      .map((token) => (token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token)),
  );
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

function sameLocation(left: ResearchEventRow, right: ResearchEventRow) {
  const cityMatch = normalize(left.city) && normalize(left.city) === normalize(right.city);
  const provinceMatch = normalize(left.province) && normalize(left.province) === normalize(right.province);
  const venueMatch = normalize(left.venue) && normalize(left.venue) === normalize(right.venue);
  return Boolean(venueMatch || (cityMatch && provinceMatch));
}

function rangesAreNear(left: ResearchEventRow, right: ResearchEventRow) {
  const leftEnd = effectiveEndDate(left);
  const rightEnd = effectiveEndDate(right);
  return left.start_date <= addDays(rightEnd, 3) && right.start_date <= addDays(leftEnd, 3);
}

export function duplicateFingerprint(event: Pick<ResearchEventRow, "title" | "start_date" | "city" | "venue">) {
  return [normalize(event.title), event.start_date, normalize(event.city) || normalize(event.venue)].join("|");
}

export function findPossibleDuplicateIds(events: ResearchEventRow[]) {
  const result = new Map(events.map((event) => [event.id, [] as string[]]));

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
      const left = events[leftIndex];
      const right = events[rightIndex];
      const exactFingerprint = duplicateFingerprint(left) === duplicateFingerprint(right);
      const disciplineCompatible = !text(left.discipline) || !text(right.discipline) || normalize(left.discipline) === normalize(right.discipline);
      const fuzzyMatch = sameLocation(left, right) && rangesAreNear(left, right) && disciplineCompatible && tokenSimilarity(left.title, right.title) >= 0.55;

      if (exactFingerprint || fuzzyMatch) {
        result.get(left.id)?.push(right.id);
        result.get(right.id)?.push(left.id);
      }
    }
  }

  for (const ids of result.values()) ids.sort();
  return result;
}

export function evaluateOfficialSource(event: Pick<ResearchEventRow, "source_type" | "source" | "source_url" | "official_url" | "organizer_url">) {
  const sourceType = normalize(event.source_type);
  const sourceName = normalize(event.source);
  const hasSourceUrl = Boolean(text(event.official_url) || text(event.source_url) || text(event.organizer_url));

  if (!hasSourceUrl) return { value: false, reason: "missing_source" as const };
  if (AGGREGATOR_SOURCE_TYPES.has(sourceType) || KNOWN_AGGREGATOR_SOURCES.some((name) => sourceName.includes(name))) {
    return { value: false, reason: "aggregator_source" as const };
  }
  if (SECONDARY_SOURCE_TYPES.has(sourceType) || KNOWN_SECONDARY_SOURCES.some((name) => sourceName.includes(name))) {
    return { value: false, reason: "secondary_source" as const };
  }
  if (OFFICIAL_SOURCE_TYPES.has(sourceType)) {
    return { value: true, reason: `primary_source_type:${sourceType}` as const };
  }
  return { value: false, reason: "unknown_source_type" as const };
}

export function isOfficialSource(event: Pick<ResearchEventRow, "source_type" | "source" | "source_url" | "official_url" | "organizer_url">) {
  return evaluateOfficialSource(event).value;
}

function addressMatchesLocationFields(event: Pick<ResearchEventRow, "address" | "venue" | "city" | "province" | "region" | "country">) {
  const addressTokens = normalize(event.address).split(" ").filter(Boolean);
  const locationTokens = new Set(
    [event.venue, event.city, event.province, event.region, event.country, "espana", "spain", "es"]
      .flatMap((value) => normalize(value).split(" "))
      .filter(Boolean),
  );
  return addressTokens.length > 0 && addressTokens.every((token) => locationTokens.has(token));
}

export function evaluateExactAddress(event: Pick<ResearchEventRow, "address" | "venue" | "city" | "province" | "region" | "country">) {
  const address = text(event.address);
  const normalized = normalize(address);
  if (!address) return { value: false, reason: "missing_address" as const };
  if (/\b(por confirmar|pendiente|sin definir)\b/.test(normalized)) {
    return { value: false, reason: "unconfirmed_address" as const };
  }

  const roadSignal = /\b(carretera|autovia|autopista|salida|kilometro|km|n \d+|a \d+|ap \d+|cv \d+|ma \d+)\b/.test(normalized);
  if (roadSignal) return { value: true, reason: "road_or_exit_address" as const };

  const streetSignal = /\b(calle|avenida|avda|plaza|paseo|camino|poligono|urbanizacion|ronda|travesia|via)\b/.test(normalized);
  const numberSignal = /\b\d{1,4}[a-z]?\b/.test(normalized) || /\bs\s*n\b/.test(normalized);
  if (streetSignal || numberSignal) return { value: true, reason: "street_level_address" as const };
  if (addressMatchesLocationFields(event)) return { value: false, reason: "same_as_location_fields" as const };
  return { value: false, reason: "generic_city_province" as const };
}

export function isExactAddress(event: Pick<ResearchEventRow, "address" | "venue" | "city" | "province" | "region" | "country">) {
  return evaluateExactAddress(event).value;
}

function hasCoordinates(event: ResearchEventRow) {
  return Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
}

function isRecentlyVerified(event: ResearchEventRow, today: string) {
  if (!event.verified_at) return false;
  const verifiedDate = event.verified_at.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedDate)) return false;
  const age = differenceInDays(today, verifiedDate);
  return age >= 0 && age <= RECENT_VERIFICATION_DAYS;
}

export function calculateMissingFields(event: ResearchEventRow, today: string) {
  const missing: string[] = [];
  if (isPlaceholder(event.slug)) missing.push("slug");
  if (isPlaceholder(event.country)) missing.push("country");
  if (isPlaceholder(event.discipline)) missing.push("discipline");
  if (isPlaceholder(event.venue)) missing.push("venue");
  if (isPlaceholder(event.city)) missing.push("city");
  if (isPlaceholder(event.province)) missing.push("province");
  if (!isOfficialSource(event)) missing.push("official_source");
  if (!text(event.registration_url) && !text(event.ticket_url)) missing.push("registration");
  if (!text(event.organizer_name)) missing.push("organizer");
  if (!isExactAddress(event)) missing.push("exact_address");
  if (!hasCoordinates(event)) missing.push("coordinates");
  if (!text(event.short_description)) missing.push("short_description");
  if (!text(event.long_description)) missing.push("long_description");
  if (!text(event.schedule_text)) missing.push("schedule");
  if (!text(event.image_url)) missing.push("image");
  if (!text(event.image_source_url)) missing.push("image_source");
  if (!event.verified_at) missing.push("verified_at");
  if (event.confidence_score === null) missing.push("confidence_score");
  if (event.verified_at && !isRecentlyVerified(event, today)) missing.push("recent_verification");
  return missing;
}

export function calculateResearchPriority(
  event: ResearchEventRow,
  today: string,
  missingFields: string[],
  possibleDuplicateIds: string[],
) {
  const daysUntilStart = differenceInDays(event.start_date, today);
  const happeningNow = event.start_date <= today && effectiveEndDate(event) >= today;
  let score = happeningNow ? 50 : daysUntilStart <= 7 ? 42 : daysUntilStart <= 30 ? 34 : daysUntilStart <= 60 ? 26 : daysUntilStart <= 90 ? 18 : daysUntilStart <= 180 ? 10 : 4;
  const weights: Record<string, number> = {
    official_source: 18,
    exact_address: 10,
    short_description: 8,
    long_description: 6,
    image: 10,
    schedule: 8,
    organizer: 6,
    registration: 4,
    coordinates: 4,
    image_source: 3,
    verified_at: 10,
    recent_verification: 8,
    confidence_score: 6,
  };
  for (const field of missingFields) score += weights[field] || 0;
  if (event.needs_review === true) score += 15;
  if (event.confidence_score !== null) {
    if (event.confidence_score < 50) score += 15;
    else if (event.confidence_score < 70) score += 10;
    else if (event.confidence_score < 85) score += 4;
  }
  if (possibleDuplicateIds.length) score += 18;
  return score;
}

function determineResearchStatus(event: ResearchEventRow, daysUntilStart: number, missingFields: string[], possibleDuplicateIds: string[]): ResearchStatus {
  if (isCancelledEvent(event)) return "cancelled_review";
  if (possibleDuplicateIds.length) return "possible_duplicate";
  if ((daysUntilStart <= 30 && (event.needs_review === true || missingFields.includes("official_source") || missingFields.length >= 6)) || (event.confidence_score !== null && event.confidence_score < 50)) {
    return "urgent_review";
  }
  if (event.needs_review === true || missingFields.length >= 3) return "enrich";
  return "verify_only";
}

function researchNotes(event: ResearchEventRow, happeningNow: boolean, duplicateIds: string[]) {
  const notes: string[] = [];
  if (happeningNow) notes.push("Evento en curso en la fecha de exportación.");
  if (event.needs_review === true) notes.push("Marcado para revisión editorial.");
  if (duplicateIds.length) notes.push(`Revisar posible coincidencia con: ${duplicateIds.join(", ")}.`);
  if (isCancelledEvent(event)) notes.push("Evento futuro almacenado como cancelado; revisar antes de mantenerlo publicado.");
  return notes;
}

export function auditEvent(event: ResearchEventRow, today: string, possibleDuplicateIds: string[]) {
  const daysUntilStart = differenceInDays(event.start_date, today);
  const happeningNow = event.start_date <= today && effectiveEndDate(event) >= today;
  const missingFields = calculateMissingFields(event, today);
  const officialSource = evaluateOfficialSource(event);
  const exactAddress = evaluateExactAddress(event);
  return {
    ...event,
    days_until_start: daysUntilStart,
    is_happening_now: happeningNow,
    duration_days: differenceInDays(effectiveEndDate(event), event.start_date) + 1,
    has_official_source: officialSource.value,
    official_source_reason: officialSource.reason,
    has_registration: Boolean(text(event.registration_url) || text(event.ticket_url)),
    has_organizer: Boolean(text(event.organizer_name)),
    has_exact_address: exactAddress.value,
    exact_address_reason: exactAddress.reason,
    has_coordinates: hasCoordinates(event),
    has_short_description: Boolean(text(event.short_description)),
    has_long_description: Boolean(text(event.long_description)),
    has_schedule: Boolean(text(event.schedule_text)),
    has_image: Boolean(text(event.image_url)),
    has_image_source: Boolean(text(event.image_source_url)),
    is_recently_verified: isRecentlyVerified(event, today),
    normalized_province: normalizeProvince(event.province),
    normalized_region: normalizeRegion(event.region),
    normalized_discipline: normalizeDiscipline(event.discipline),
    missing_fields: missingFields,
    missing_fields_count: missingFields.length,
    research_priority: calculateResearchPriority(event, today, missingFields, possibleDuplicateIds),
    research_status: determineResearchStatus(event, daysUntilStart, missingFields, possibleDuplicateIds),
    duplicate_fingerprint: duplicateFingerprint(event),
    possible_duplicate_ids: possibleDuplicateIds,
    research_notes: researchNotes(event, happeningNow, possibleDuplicateIds),
  } satisfies EnrichmentEvent;
}

export function sortEnrichmentEvents(events: EnrichmentEvent[]) {
  return [...events].sort((left, right) => {
    return left.start_date.localeCompare(right.start_date) || right.research_priority - left.research_priority || left.title.localeCompare(right.title, "es");
  });
}

function researchQuestions(event: EnrichmentEvent) {
  const questions: string[] = [];
  const prompts: Record<string, string> = {
    official_source: "¿Cuál es la URL oficial específica del evento?",
    registration: "¿Existe una URL de inscripción o venta de entradas?",
    organizer: "¿Quien organiza el evento y cual es su web oficial?",
    venue: "¿Cuál es el recinto o lugar exacto?",
    exact_address: "¿Cuál es la dirección postal exacta del evento?",
    coordinates: "¿Cuáles son las coordenadas verificadas del recinto?",
    short_description: "¿Cómo se resume el evento en una descripción breve y verificable?",
    long_description: "¿Qué información oficial permite ampliar la descripción?",
    schedule: "¿Cuál es el programa u horario oficial?",
    image: "¿Existe un cartel o imagen oficial reutilizable?",
    image_source: "¿Cuál es la fuente y licencia de la imagen?",
    verified_at: "¿Siguen vigentes la fecha, ubicacion y estado del evento?",
    recent_verification: "¿Sigue vigente la información tras la última verificación?",
    confidence_score: "¿Qué nivel de confianza merece la información tras verificarla?",
  };
  for (const field of event.missing_fields) if (prompts[field]) questions.push(prompts[field]);
  if (event.possible_duplicate_ids.length) questions.push(`¿Es un evento distinto de ${event.possible_duplicate_ids.join(", ")}?`);
  if (!questions.length) questions.push("¿Siguen vigentes la fecha, ubicacion, estado y fuente oficial?");
  return questions;
}

export function createResearchBatch(events: EnrichmentEvent[], size = 20) {
  return sortEnrichmentEvents(events)
    .slice(0, size)
    .map<ResearchBatchEvent>((event) => ({
      ...event,
      research_questions: researchQuestions(event),
      research_sources: [],
      proposed_values: Object.fromEntries(event.missing_fields.map((field) => [field, null])),
      observations: "",
    }));
}

export async function fetchAllFutureEventRows(repository: FutureEventRepository, pageSize = ENRICHMENT_PAGE_SIZE) {
  const rows: ResearchEventRow[] = [];
  let from = 0;
  while (true) {
    const page = await repository.fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export class SupabaseFutureEventRepository implements FutureEventRepository {
  constructor(private readonly supabase: SupabaseClient<ResearchDatabase>) {}

  async fetchPage(from: number, to: number) {
    assertReadOnlyOperations(READ_ONLY_QUERY_OPERATIONS);
    const { data, error } = await this.supabase.from("events").select(EVENT_SELECT).order("start_date", { ascending: true }).order("id", { ascending: true }).range(from, to);
    if (error) throw new Error(`No se pudieron leer eventos para enriquecimiento: ${error.message}`);
    return (data ?? []) as unknown as ResearchEventRow[];
  }
}

function countBy(events: EnrichmentEvent[], field: "normalized_discipline" | "normalized_province" | "normalized_region") {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const key = text(event[field]) || "(sin dato)";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey, "es")));
}

function buildSummary(active: EnrichmentEvent[], cancelled: EnrichmentEvent[]) {
  const inWindow = (days: number) => active.filter((event) => event.days_until_start >= 0 && event.days_until_start <= days).length;
  return {
    total_future_events: active.length,
    happening_now: active.filter((event) => event.is_happening_now).length,
    next_30_days: inWindow(30),
    next_60_days: inWindow(60),
    next_90_days: inWindow(90),
    by_discipline: countBy(active, "normalized_discipline"),
    by_province: countBy(active, "normalized_province"),
    by_region: countBy(active, "normalized_region"),
    without_official_source: active.filter((event) => !event.has_official_source).length,
    without_registration: active.filter((event) => !event.has_registration).length,
    without_organizer: active.filter((event) => !event.has_organizer).length,
    without_exact_address: active.filter((event) => !event.has_exact_address).length,
    without_coordinates: active.filter((event) => !event.has_coordinates).length,
    without_short_description: active.filter((event) => !event.has_short_description).length,
    without_long_description: active.filter((event) => !event.has_long_description).length,
    without_schedule: active.filter((event) => !event.has_schedule).length,
    without_image: active.filter((event) => !event.has_image).length,
    without_image_source: active.filter((event) => !event.has_image_source).length,
    never_verified: active.filter((event) => !event.verified_at).length,
    low_or_unknown_confidence: active.filter((event) => event.confidence_score === null || event.confidence_score < 70).length,
    needs_review: active.filter((event) => event.needs_review === true).length,
    possible_duplicates: active.filter((event) => event.possible_duplicate_ids.length > 0).length,
    cancelled_future_events: cancelled.length,
  };
}

function metadata(generatedAt: Date, today: string) {
  return {
    generated_at: generatedAt.toISOString(),
    version: ENRICHMENT_EXPORT_VERSION,
    timezone: ENRICHMENT_TIME_ZONE,
    today,
    source: "public.events (Supabase, select-only)",
    criteria: {
      future_or_ongoing: "end_date >= today; when end_date is null, start_date >= today",
      public: "visible is not false and data_quality is not draft",
      cancelled: "event_status or data_quality is cancelled; exported separately from the active backlog",
      recently_verified: `verified_at is within the previous ${RECENT_VERIFICATION_DAYS} days`,
      ordering: "start_date ascending, research_priority descending for equal dates, title ascending",
      priority_formula: "date urgency (4-50) + missing-field weights + needs_review (15) + low confidence (4-15) + possible duplicate (18)",
      official_source: "a URL is primary only with a primary source_type; aggregators and secondary sources remain non-official",
      exact_address: "requires street, road, exit or number-level signals; city/province/venue-only text remains generic",
      normalized_grouping: "province, region and discipline are normalized only in calculated fields and aggregate reports",
    },
    database_fields: EVENT_FIELDS,
    unavailable_columns: ["is_published", "modality", "price", "deleted_at"],
  };
}

export function createResearchArtifacts(rows: ResearchEventRow[], generatedAt = new Date()) {
  const today = dateInTimeZone(generatedAt);
  const futurePublic = rows.filter((event) => isPublicEvent(event) && isFutureOrOngoing(event, today));
  const duplicateMap = findPossibleDuplicateIds(futurePublic.filter((event) => !isCancelledEvent(event)));
  const audited = futurePublic.map((event) => auditEvent(event, today, duplicateMap.get(event.id) || []));
  const active = sortEnrichmentEvents(audited.filter((event) => !isCancelledEvent(event)));
  const cancelled = sortEnrichmentEvents(audited.filter((event) => isCancelledEvent(event)));
  const batch = createResearchBatch(active, 20);
  return {
    metadata: metadata(generatedAt, today),
    summary: buildSummary(active, cancelled),
    events: active,
    cancelled_events: cancelled,
    batch,
  };
}

function csvValue(value: unknown) {
  const serialized = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value === null || value === undefined ? "" : String(value);
  return `"${serialized.replace(/"/g, '""')}"`;
}

function toCsv(events: EnrichmentEvent[]) {
  const computedFields = [
    "days_until_start",
    "is_happening_now",
    "duration_days",
    "has_official_source",
    "official_source_reason",
    "has_registration",
    "has_organizer",
    "has_exact_address",
    "exact_address_reason",
    "has_coordinates",
    "has_short_description",
    "has_long_description",
    "has_schedule",
    "has_image",
    "has_image_source",
    "is_recently_verified",
    "normalized_province",
    "normalized_region",
    "normalized_discipline",
    "missing_fields",
    "missing_fields_count",
    "research_priority",
    "research_status",
    "duplicate_fingerprint",
    "possible_duplicate_ids",
    "research_notes",
  ] as const;
  const headers = [...EVENT_FIELDS, ...computedFields];
  const lines = [headers.map(csvValue).join(",")];
  for (const event of events) lines.push(headers.map((field) => csvValue(event[field])).join(","));
  return `\uFEFF${lines.join("\n")}\n`;
}

function markdownCounts(title: string, counts: Record<string, number>) {
  const rows = Object.entries(counts).map(([name, count]) => `| ${name} | ${count} |`).join("\n");
  return `## ${title}\n\n| Valor | Eventos |\n|---|---:|\n${rows || "| (sin datos) | 0 |"}`;
}

function toMarkdown(artifacts: ReturnType<typeof createResearchArtifacts>) {
  const { metadata: meta, summary, batch, cancelled_events: cancelled } = artifacts;
  const batchRows = batch.map((event, index) => `| ${index + 1} | ${event.start_date} | ${event.title} | ${event.city || "(sin ciudad)"} | ${event.research_priority} | ${event.research_status} | ${event.missing_fields_count} |`).join("\n");
  const duplicateRows = artifacts.events.filter((event) => event.possible_duplicate_ids.length).map((event) => `- ${event.title} (${event.id}): ${event.possible_duplicate_ids.join(", ")}`).join("\n");
  const cancelledRows = cancelled.map((event) => `- ${event.start_date}: ${event.title} (${event.id})`).join("\n");
  return `# Auditoría de eventos futuros para enriquecimiento\n\n` +
    `- Generado: ${meta.generated_at}\n- Zona horaria: ${meta.timezone}\n- Fecha de corte: ${meta.today}\n- Fórmula de prioridad: ${meta.criteria.priority_formula}\n\n` +
    `## Resumen\n\n| Métrica | Total |\n|---|---:|\n` +
    `| Eventos futuros activos | ${summary.total_future_events} |\n| Celebrándose ahora | ${summary.happening_now} |\n| Próximos 30 días | ${summary.next_30_days} |\n| Próximos 60 días | ${summary.next_60_days} |\n| Próximos 90 días | ${summary.next_90_days} |\n` +
    `| Sin fuente oficial | ${summary.without_official_source} |\n| Sin inscripción | ${summary.without_registration} |\n| Sin organizador | ${summary.without_organizer} |\n| Sin dirección exacta | ${summary.without_exact_address} |\n| Sin coordenadas | ${summary.without_coordinates} |\n| Sin descripción corta | ${summary.without_short_description} |\n| Sin descripción larga | ${summary.without_long_description} |\n| Sin programa | ${summary.without_schedule} |\n| Sin imagen | ${summary.without_image} |\n| Sin fuente de imagen | ${summary.without_image_source} |\n| Sin verificar | ${summary.never_verified} |\n| Confianza baja o desconocida | ${summary.low_or_unknown_confidence} |\n| Marcados para revisión | ${summary.needs_review} |\n| Eventos con posibles duplicados | ${summary.possible_duplicates} |\n| Futuros cancelados | ${summary.cancelled_future_events} |\n\n` +
    `${markdownCounts("Eventos por disciplina", summary.by_discipline)}\n\n${markdownCounts("Eventos por provincia", summary.by_province)}\n\n${markdownCounts("Eventos por región", summary.by_region)}\n\n` +
    `## Posibles duplicados\n\n${duplicateRows || "No se detectaron posibles duplicados con el criterio orientativo."}\n\n` +
    `## Eventos futuros cancelados\n\n${cancelledRows || "No se encontraron eventos futuros marcados como cancelados."}\n\n` +
    `## Lote de Investigación 001\n\n| # | Fecha | Evento | Ciudad | Prioridad | Estado | Campos ausentes |\n|---:|---|---|---|---:|---|---:|\n${batchRows}\n`;
}

function batchIds(value: unknown) {
  if (!value || typeof value !== "object" || !("events" in value) || !Array.isArray(value.events)) {
    throw new Error("El Lote de Investigación 001 existente no tiene una estructura válida.");
  }
  const ids = value.events.map((event) => {
    if (!event || typeof event !== "object" || !("id" in event) || typeof event.id !== "string") {
      throw new Error("El Lote de Investigación 001 existente contiene un evento sin ID válido.");
    }
    return event.id;
  });
  if (new Set(ids).size !== ids.length) throw new Error("El Lote de Investigación 001 existente contiene IDs duplicados.");
  return ids;
}

export function decideResearchBatchPersistence(
  existingBatch: unknown | null,
  generatedIds: string[],
  activeBacklogIds: Set<string>,
  allRowIds: Set<string>,
  regenerateBatch: boolean,
): BatchPersistenceDecision {
  if (existingBatch === null) {
    return { action: "create", preserved_ids: generatedIds, inactive_ids: [], disappeared_ids: [] };
  }
  if (regenerateBatch) {
    return { action: "regenerate", preserved_ids: generatedIds, inactive_ids: [], disappeared_ids: [] };
  }

  const preservedIds = batchIds(existingBatch);
  const missingFromActive = preservedIds.filter((id) => !activeBacklogIds.has(id));
  return {
    action: "preserve",
    preserved_ids: preservedIds,
    inactive_ids: missingFromActive.filter((id) => allRowIds.has(id)),
    disappeared_ids: missingFromActive.filter((id) => !allRowIds.has(id)),
  };
}

async function readOptionalFile(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

type PreviousBacklog = {
  summary?: {
    total_future_events?: number;
    without_official_source?: number;
    without_exact_address?: number;
    by_province?: Record<string, number>;
    by_discipline?: Record<string, number>;
  };
  events?: Array<{
    id: string;
    has_official_source?: boolean;
    has_exact_address?: boolean;
    research_priority?: number;
  }>;
};

function comparisonCounts(before: Record<string, number> | undefined, after: Record<string, number>) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after)])].sort((left, right) => left.localeCompare(right, "es"));
  return keys.map((key) => `| ${key} | ${before?.[key] || 0} | ${after[key] || 0} |`).join("\n");
}

function countSourceTypes(events: EnrichmentEvent[]) {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const key = text(event.source_type) || "(sin dato)";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, "es"));
}

function toCorrectionsMarkdown(
  previous: PreviousBacklog | null,
  artifacts: ReturnType<typeof createResearchArtifacts>,
  decision: BatchPersistenceDecision,
) {
  const previousById = new Map((previous?.events || []).map((event) => [event.id, event]));
  const sourceAffected = artifacts.events.filter((event) => previousById.get(event.id)?.has_official_source === true && !event.has_official_source);
  const addressAffected = artifacts.events.filter((event) => previousById.get(event.id)?.has_exact_address === true && !event.has_exact_address);
  const priorityAffected = artifacts.events
    .map((event) => ({ event, before: previousById.get(event.id)?.research_priority }))
    .filter((item) => typeof item.before === "number" && item.before !== item.event.research_priority)
    .sort((left, right) => Math.abs(right.event.research_priority - (right.before || 0)) - Math.abs(left.event.research_priority - (left.before || 0)));
  const sourceRows = sourceAffected.map((event) => `| ${event.id} | ${event.title} | ${event.source_type || "(sin dato)"} | ${event.source || "(sin dato)"} | ${event.official_source_reason} |`).join("\n");
  const addressRows = addressAffected.map((event) => `| ${event.id} | ${event.title} | ${event.address || "(sin dato)"} | ${event.exact_address_reason} |`).join("\n");
  const priorityRows = priorityAffected.map(({ event, before }) => `| ${event.id} | ${before} | ${event.research_priority} | ${event.research_priority - (before || 0)} |`).join("\n");
  const sourceTypeRows = countSourceTypes(artifacts.events).map(([value, count]) => `| ${value} | ${count} |`).join("\n");

  return `# Correcciones de la auditoría de eventos futuros\n\n` +
    `- Generado: ${artifacts.metadata.generated_at}\n` +
    `- Lote 001: ${decision.action === "preserve" ? "preservado sin escritura" : decision.action}\n` +
    `- IDs conservados: ${decision.preserved_ids.length}\n` +
    `- IDs ya no activos: ${decision.inactive_ids.length}\n` +
    `- IDs desaparecidos: ${decision.disappeared_ids.length}\n\n` +
    `## Comparación general\n\n| Métrica | Antes | Después |\n|---|---:|---:|\n` +
    `| Eventos futuros | ${previous?.summary?.total_future_events ?? "(sin base)"} | ${artifacts.summary.total_future_events} |\n` +
    `| Sin fuente oficial | ${previous?.summary?.without_official_source ?? "(sin base)"} | ${artifacts.summary.without_official_source} |\n` +
    `| Sin dirección exacta | ${previous?.summary?.without_exact_address ?? "(sin base)"} | ${artifacts.summary.without_exact_address} |\n` +
    `| Prioridades modificadas | - | ${priorityAffected.length} |\n\n` +
    `## Valores reales de source_type\n\n| Valor | Eventos |\n|---|---:|\n${sourceTypeRows}\n\n` +
    `## Provincias antes y después\n\n| Provincia | Antes | Después normalizado |\n|---|---:|---:|\n${comparisonCounts(previous?.summary?.by_province, artifacts.summary.by_province)}\n\n` +
    `## Disciplinas antes y después\n\n| Disciplina | Antes | Después normalizado |\n|---|---:|---:|\n${comparisonCounts(previous?.summary?.by_discipline, artifacts.summary.by_discipline)}\n\n` +
    `## Fuentes reclasificadas\n\n| ID | Evento | source_type | Fuente | Motivo |\n|---|---|---|---|---|\n${sourceRows || "| - | Ninguna | - | - | - |"}\n\n` +
    `## Direcciones reclasificadas\n\n| ID | Evento | Dirección | Motivo |\n|---|---|---|---|\n${addressRows || "| - | Ninguna | - | - |"}\n\n` +
    `## Prioridades modificadas\n\n| ID | Antes | Después | Diferencia |\n|---|---:|---:|---:|\n${priorityRows || "| - | - | - | 0 |"}\n`;
}

async function writeArtifacts(
  artifacts: ReturnType<typeof createResearchArtifacts>,
  rows: ResearchEventRow[],
  regenerateBatch: boolean,
) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const backlogPath = path.join(OUTPUT_DIR, "future-events-backlog.json");
  const batchPath = path.join(OUTPUT_DIR, "lote-investigacion-001.json");
  const previousBacklogRaw = await readOptionalFile(backlogPath);
  const existingBatchRaw = await readOptionalFile(batchPath);
  const previousBacklog = previousBacklogRaw ? JSON.parse(previousBacklogRaw) as PreviousBacklog : null;
  const existingBatch = existingBatchRaw ? JSON.parse(existingBatchRaw) as unknown : null;
  const decision = decideResearchBatchPersistence(
    existingBatch,
    artifacts.batch.map((event) => event.id),
    new Set(artifacts.events.map((event) => event.id)),
    new Set(rows.map((event) => event.id)),
    regenerateBatch,
  );
  const backlog = {
    metadata: artifacts.metadata,
    summary: artifacts.summary,
    events: artifacts.events,
    cancelled_events: artifacts.cancelled_events,
  };
  const batch = {
    metadata: { ...artifacts.metadata, batch: "lote-investigacion-001", size: artifacts.batch.length },
    events: artifacts.batch,
  };
  const writes = [
    writeFile(backlogPath, `${JSON.stringify(backlog, null, 2)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "future-events-backlog.csv"), toCsv(artifacts.events), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "future-events-audit-summary.md"), `${toMarkdown(artifacts)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "future-events-audit-corrections.md"), `${toCorrectionsMarkdown(previousBacklog, artifacts, decision)}\n`, "utf8"),
  ];
  if (decision.action !== "preserve") {
    writes.push(writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8"));
  }
  await Promise.all(writes);
  return decision;
}

async function main() {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter((arg) => arg !== "--regenerate-batch");
  if (unknownArgs.length) throw new Error(`Argumentos no reconocidos: ${unknownArgs.join(", ")}`);
  const regenerateBatch = args.includes("--regenerate-batch");
  loadEnvConfig(process.cwd());
  const supabase = createClient<ResearchDatabase>(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repository = new SupabaseFutureEventRepository(supabase);
  const rows = await fetchAllFutureEventRows(repository);
  const artifacts = createResearchArtifacts(rows);
  const batchDecision = await writeArtifacts(artifacts, rows, regenerateBatch);
  console.log("Export read-only de eventos futuros completado.");
  console.log(`- filas leidas: ${rows.length}`);
  console.log(`- eventos futuros activos: ${artifacts.summary.total_future_events}`);
  console.log(`- eventos en curso: ${artifacts.summary.happening_now}`);
  console.log(`- proximos 30/60/90 dias: ${artifacts.summary.next_30_days}/${artifacts.summary.next_60_days}/${artifacts.summary.next_90_days}`);
  console.log(`- posibles duplicados: ${artifacts.summary.possible_duplicates}`);
  console.log(`- futuros cancelados: ${artifacts.summary.cancelled_future_events}`);
  console.log(`- lote de investigacion: ${batchDecision.action} (${batchDecision.preserved_ids.length} IDs)`);
  if (batchDecision.inactive_ids.length) console.warn(`- IDs del lote ya no activos: ${batchDecision.inactive_ids.join(", ")}`);
  if (batchDecision.disappeared_ids.length) console.warn(`- IDs del lote desaparecidos: ${batchDecision.disappeared_ids.join(", ")}`);
  console.log(`- salida: ${OUTPUT_DIR}`);
  console.log("- Supabase: SELECT paginado; cero escrituras.");
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(`\nExport de enriquecimiento fallido: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
