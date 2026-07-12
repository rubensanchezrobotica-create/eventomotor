import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getVehicleType } from "../lib/event-classification";
import type { EventUpsert } from "../lib/supabase";

type BatchEventInput = Record<string, unknown>;

type ExistingEventRow = {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  province: string | null;
  discipline: string | null;
  vehicle_type: string | null;
  source_url: string | null;
  official_url?: string | null;
};

type Database = {
  public: {
    Tables: {
      events: {
        Row: ExistingEventRow;
        Insert: EventUpsert;
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

type ValidatedEvent = {
  index: number;
  input: BatchEventInput;
  row: EventUpsert | null;
  errors: string[];
  warnings: string[];
  duplicateReasons: string[];
  possibleDuplicateReasons: string[];
  classification: "insertable" | "reviewed_insertable" | "duplicate" | "possible_duplicate" | "invalid";
};

const PAGE_SIZE = 1000;
const DATE_TOLERANCE_DAYS = 3;
const ALLOWED_EVENT_STATUSES = new Set(["confirmed", "tentative", "postponed", "cancelled"]);
const ALLOWED_SOURCE_TYPES = new Set([
  "official",
  "organizer",
  "federation",
  "circuit",
  "municipality",
  "media",
  "aggregator",
  "secondary",
  "unknown",
]);
const ALLOWED_DUPLICATE_REVIEW_STATUSES = new Set(["approved_distinct", "rejected_duplicate"]);
const GENERIC_TITLE_WORDS = new Set([
  "2026",
  "campeonato",
  "copa",
  "espana",
  "gran",
  "premio",
  "evento",
  "circuito",
  "tandas",
  "temporada",
  "jornada",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "en",
  "para",
  "y",
]);
const STRONG_KEYWORD_GROUPS = [
  ["esbk", "superbike", "superbikes"],
  ["motogp"],
  ["gt", "gt-open", "gt-world-challenge", "international-gt-open"],
  ["motorland"],
  ["jarama", "race"],
  ["montmelo", "barcelona-catalunya"],
  ["navarra"],
  ["cheste"],
  ["rfme"],
];
const URL_LANGUAGE_SEGMENTS = new Set(["ca", "cat", "en", "es", "eu", "fr", "gl", "pt"]);
const GENERIC_URL_PATHS = new Set([
  "calendario",
  "calendar",
  "calendar/trackdays",
  "calendar/trackdays/bike",
  "entradas",
  "eventos",
  "events",
  "ticketing",
  "tickets",
  "venta-de-entradas",
]);
const GENERIC_URL_LAST_SEGMENTS = new Set(["calendario", "calendar", "entradas", "eventos", "events", "tickets", "venta-de-entradas"]);

loadEnvConfig(process.cwd());

function getArg(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) return null;

  return process.argv[index + 1] || null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isRecord(value: unknown): value is BatchEventInput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function normalizeComparable(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeUrlForDuplicate(value: unknown) {
  const text = normalizeText(value);

  if (!text) return null;

  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathName = url.pathname
      .split("/")
      .map((segment) => normalizeComparable(decodeURIComponent(segment)))
      .filter(Boolean)
      .join("/");

    return `${host}/${pathName}`.replace(/\/+$/g, "");
  } catch {
    return null;
  }
}

function effectiveUrlPath(value: string) {
  const [, ...pathParts] = value.split("/");

  while (pathParts.length && URL_LANGUAGE_SEGMENTS.has(pathParts[0])) {
    pathParts.shift();
  }

  return pathParts.join("/");
}

function isGenericListingUrl(value: unknown) {
  const text = normalizeText(value);

  if (!text) return false;

  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathName = decodeURIComponent(url.pathname).toLowerCase();
    const pathWithoutAccents = pathName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (host === "calendarios.rfeda.es") return true;
    if (host.endsWith("rfeda.es")) {
      if (pathWithoutAccents.includes("/docs/pdf/")) return true;
      if (pathWithoutAccents.endsWith(".pdf")) return true;
      if (pathWithoutAccents.includes("calendario")) return true;
    }
    if (host === "fiasct.com") {
      if (pathWithoutAccents.includes("/documentacion/calendario_2026")) return true;
      if (pathWithoutAccents.includes("/documentacion/") && pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) {
        return true;
      }
    }
    if (host === "fga.es") {
      if (pathWithoutAccents.includes("/wp-content/uploads/2025/12/calendario-2026")) return true;
      if (pathWithoutAccents === "/calendario/" || pathWithoutAccents === "/calendario") return true;
      if (pathWithoutAccents.includes("/project_category/probas-2026")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "faa.net") {
      if (pathWithoutAccents.includes("/wp-content/uploads/") && pathWithoutAccents.includes("calendario-26")) return true;
      if (pathWithoutAccents === "/calendario/" || pathWithoutAccents === "/calendario") return true;
      if (pathWithoutAccents.includes("/2015-campeonato-de-montana")) return true;
      if (pathWithoutAccents === "/cava/" || pathWithoutAccents === "/cava") return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fcautomovilismo.com") {
      if (pathWithoutAccents.includes("/wp-content/uploads/") && pathWithoutAccents.includes("calendario-deportivo-2026")) return true;
      if (pathWithoutAccents === "/calendario/" || pathWithoutAccents === "/calendario") return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fexa.es") {
      if (pathWithoutAccents === "/eventos/" || pathWithoutAccents === "/eventos") return true;
      if (pathWithoutAccents.includes("/eventos/")) return true;
      if (pathWithoutAccents.includes("/pre-calendario-2026")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fedacv.com") {
      if (["/rallyes", "/regularidad-rallyes", "/montana", "/slalom", "/velocidad", "/xii-hivern-karting", "/calendario"].includes(pathWithoutAccents.replace(/\/$/g, ""))) {
        return true;
      }
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fmautomovilismo.com") {
      if (pathWithoutAccents === "/proximas-pruebas" || pathWithoutAccents === "/proximas-pruebas/") return true;
      if (pathWithoutAccents.includes("/wp-content/uploads/") && pathWithoutAccents.includes("calen_2026")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "facyl.com") {
      if (pathWithoutAccents.includes("/wp-content/uploads/") && pathWithoutAccents.includes("calendario_facyl-2026")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fenauto.com") {
      if (pathWithoutAccents.includes("/calendario-definitivo-2026")) return true;
      if (pathWithoutAccents.includes("/calendario")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fa-ib.com") {
      if (pathWithoutAccents.includes("/web/calendario-2026")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fca.cat") {
      if (pathWithoutAccents === "/ca/agenda" || pathWithoutAccents === "/ca/agenda/") return true;
      if (pathWithoutAccents === "/agenda" || pathWithoutAccents === "/agenda/") return true;
      if (pathWithoutAccents.includes("calendari") && pathWithoutAccents.endsWith(".pdf")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "farmu.es") {
      if (pathWithoutAccents === "/agenda.asp") return true;
      if (pathWithoutAccents.includes("calendario") || pathWithoutAccents.includes("agenda")) return true;
    }
    if (host === "superweb.net" && pathWithoutAccents.includes("/farmu/descargas/") && pathWithoutAccents.includes("calendario")) return true;
    if (host === "fada.es") {
      if (pathWithoutAccents.includes("/wp-content/uploads/") && pathWithoutAccents.includes("calendario")) return true;
      if (pathWithoutAccents === "/calendario/" || pathWithoutAccents === "/calendario") return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fcta.es") return true;
    if (host === "cantabriaclassicrally.com" && (pathWithoutAccents === "/eventos.html" || pathWithoutAccents === "/eventos")) return true;
    if (host === "auto.sport2fit.com" && pathWithoutAccents.includes("/uploads/descargas/") && pathWithoutAccents.includes("calendario")) return true;
    if (host === "eaf-fva.net") {
      if (pathWithoutAccents === "/" || pathWithoutAccents === "") return true;
      if (pathWithoutAccents.includes("/calendario-anual")) return true;
      if (pathWithoutAccents.includes("/storage/") && pathWithoutAccents.includes("calendario")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "federautorioja.org") {
      if (pathWithoutAccents.includes("/wp") && pathWithoutAccents.includes("calendario")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "famotos.com") {
      if (pathWithoutAccents.includes("/calendario-campeonatos")) return true;
      if (pathWithoutAccents.includes("/calendario")) return true;
      if (pathWithoutAccents.includes("/wp-content/uploads/") && pathWithoutAccents.includes("calendario")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fmcv.es") {
      if (pathWithoutAccents.includes("/calendario-lista-todos")) return true;
      if (pathWithoutAccents.includes("/publicados-los-calendarios-fmcv-2026")) return true;
      if (pathWithoutAccents.includes("/calendario")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fcm.cat") {
      if (pathWithoutAccents.includes("/wp-content/uploads/2025/12/calendari-esportiu-2026-1.pdf")) return true;
      if (pathWithoutAccents.includes("/fcm/calendari-esportiu-2026")) return true;
      if (pathWithoutAccents.includes("/competicio/calendari-general")) return true;
      if (pathWithoutAccents.includes("/competicio/calendari-campionat-de-catalunya")) return true;
      if (pathWithoutAccents.includes("/competicio/calendari-no-puntuable")) return true;
    }
    if (host === "fedemadrid.com") {
      if (pathWithoutAccents.includes("/calendario-campeonatos")) return true;
      if (pathWithoutAccents.includes("/wp-content/uploads/2026/")) return true;
      if (pathWithoutAccents.includes("/noticias/actualizado-el-calendario")) return true;
      if (pathWithoutAccents.includes("/noticias/definido-el-calendario")) return true;
      if (pathWithoutAccents.includes("/noticias/modificaciones-en-el-calendario-del-campeonato-de-la-comunidad-de-madrid-de-motocross-2026")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fcmm.net") {
      if (pathWithoutAccents.includes("/calendario")) return true;
      if (pathWithoutAccents.includes("/wp-content/uploads/2026/")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
    }
    if (host === "fedemotocyl.es") {
      if (pathWithoutAccents.includes("/calendario")) return true;
      if (pathWithoutAccents.includes("/temporada-2026")) return true;
    }
    if (host === "motos.coches.net" && pathWithoutAccents.includes("/noticias/calendario")) return true;
    if (host.endsWith("coches.net") && pathWithoutAccents.includes("calendario-motosnet")) return true;
    if (pathWithoutAccents.includes("/noticias/calendario")) return true;
    if (host === "suntosun.es" && /^\/sun-to-sun-\d{4}\/?$/.test(pathWithoutAccents)) return true;
    if (host === "rallyclassics.club") {
      if (pathWithoutAccents.includes("/calendario")) return true;
      if (pathWithoutAccents.includes("classic-series-2026-y-motoclassic-series-2026")) return true;
      if (pathWithoutAccents.includes("classic-series") || pathWithoutAccents.includes("motoclassic-series")) return true;
    }
    if (host === "rallybarcelonasitges.com" && pathWithoutAccents.includes("/68-edicio-2026")) return true;
    if (pathWithoutAccents.includes("/calendar/trackdays/")) return true;
    if (pathWithoutAccents.includes("/calendario-eventos")) return true;
    if (host === "circuitcalafat.com" && pathWithoutAccents.includes("/calendario-eventos")) return true;
    if (host === "ontrackmoto.info" && pathWithoutAccents.includes("/venue/")) return true;
    if (pathWithoutAccents.includes("/venue/motorland-aragon")) return true;
    if (host === "fapaonline.es" && pathWithoutAccents.includes("/calendario-de-competiciones")) return true;
    if (pathWithoutAccents.includes("/calendario-de-competiciones")) return true;
    if (host === "revistascratch.com" && pathWithoutAccents.includes("/nacional-tierra/noticia/el-cert-2026-presenta-su-calendario")) return true;
    if (pathWithoutAccents.includes("el-cert-2026-presenta-su-calendario")) return true;
    if (host === "rfme.com") {
      if (pathWithoutAccents.includes("/campeonatos/")) return true;
      if (pathWithoutAccents.includes("/calendario-campeonatos")) return true;
    }
    if (host === "motorlandaragon.com") {
      if (pathWithoutAccents.includes("/sites/default/files/")) return true;
      if (pathWithoutAccents.endsWith(".pdf")) return true;
      if (pathWithoutAccents.includes("0accgu~n.pdf")) return true;
    }
    if (host === "circuitricardotormo.com") {
      if (pathWithoutAccents.includes("/el-circuit-presenta-su-calendario")) return true;
      if (pathWithoutAccents.includes("motogp-como-gran-cita-del-ano-2026")) return true;
    }
    if (host === "jarama.org") {
      if (pathWithoutAccents.includes("/wp-content/uploads/") && pathWithoutAccents.includes("calendario-jarama-race")) return true;
      if (pathWithoutAccents.includes("calendario") && pathWithoutAccents.endsWith(".pdf")) return true;
      if (pathWithoutAccents.includes("/actualidad/noticias/el-campeonato-race-de-velocidad")) return true;
      if (pathWithoutAccents.includes("campeonato-race-de-velocidad-inicia-la-temporada")) return true;
    }
    if (host === "riderspirit.es" && (pathWithoutAccents === "/eventos/" || pathWithoutAccents === "/eventos")) return true;
    if (host === "concentracionesdemotos.com") {
      if (/^\/(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)-20\d{2}\/?$/.test(pathWithoutAccents)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  const normalized = normalizeUrlForDuplicate(value);

  if (!normalized) return false;

  const path = effectiveUrlPath(normalized);
  const segments = path.split("/").filter(Boolean);

  if (!segments.length) return true;
  if (GENERIC_URL_PATHS.has(path)) return true;
  if (segments.length <= 2 && GENERIC_URL_LAST_SEGMENTS.has(segments[segments.length - 1])) return true;

  return false;
}

function specificEventUrlKey(value: unknown) {
  if (isGenericListingUrl(value)) return null;

  return normalizeUrlForDuplicate(value);
}

function normalizeTitleToken(value: string) {
  if (value === "superbikes") return "superbike";
  if (value === "motos") return "moto";
  if (value === "coches") return "coche";
  if (value.endsWith("s") && value.length > 5) return value.slice(0, -1);

  return value;
}

function relevantTitleTokens(value: unknown) {
  const normalized = normalizeComparable(String(value || "").replace(/\b20\d{2}\b/g, ""));
  const tokens = normalized
    .split("-")
    .map(normalizeTitleToken)
    .filter((token) => token.length >= 3 && !GENERIC_TITLE_WORDS.has(token));

  return new Set(tokens);
}

function tokenOverlap(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;

  let shared = 0;

  for (const token of left) {
    if (right.has(token)) shared += 1;
  }

  return shared / Math.min(left.size, right.size);
}

function keywordGroups(value: unknown) {
  const normalized = normalizeComparable(value);
  const groups = new Set<string>();

  for (const group of STRONG_KEYWORD_GROUPS) {
    if (group.some((keyword) => normalized.includes(normalizeComparable(keyword)))) {
      groups.add(group[0]);
    }
  }

  return groups;
}

function sharedKeywordGroups(left: Set<string>, right: Set<string>) {
  return [...left].filter((group) => right.has(group));
}

function dateToTime(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function formatExistingDate(row: ExistingEventRow) {
  return row.end_date && row.end_date !== row.start_date ? `${row.start_date} a ${row.end_date}` : row.start_date;
}

function rangesOverlapOrClose(row: EventUpsert, existing: ExistingEventRow) {
  const start = dateToTime(row.start_date);
  const end = dateToTime(row.end_date || row.start_date);
  const existingStart = dateToTime(existing.start_date);
  const existingEnd = dateToTime(existing.end_date || existing.start_date);

  if (start === null || end === null || existingStart === null || existingEnd === null) return false;

  const tolerance = DATE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;

  return start <= existingEnd + tolerance && existingStart <= end + tolerance;
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);

  if (!text) return null;

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function normalizeBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;

  return undefined;
}

function normalizeTags(value: unknown) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return undefined;

  const tags = new Map<string, string>();

  for (const tag of value) {
    if (typeof tag !== "string") return undefined;

    const trimmed = tag.trim();

    if (!trimmed) continue;

    tags.set(trimmed.toLowerCase(), trimmed);
  }

  return [...tags.values()];
}

function optionalText(input: BatchEventInput, field: string) {
  return normalizeText(input[field]);
}

function preferredText(input: BatchEventInput, fields: string[]) {
  for (const field of fields) {
    const value = optionalText(input, field);

    if (value) return value;
  }

  return null;
}

function duplicateReviewStatus(input: BatchEventInput) {
  const status = optionalText(input, "duplicate_review_status");

  return status && ALLOWED_DUPLICATE_REVIEW_STATUSES.has(status) ? status : null;
}

function duplicateKey(row: Pick<EventUpsert, "title" | "start_date" | "city" | "province">, field: "city" | "province") {
  return [normalizeComparable(row.title), row.start_date, normalizeComparable(row[field])].join("|");
}

function toExistingKey(row: ExistingEventRow, field: "city" | "province") {
  return [normalizeComparable(row.title), row.start_date, normalizeComparable(row[field])].join("|");
}

function mapExistingByText(rows: ExistingEventRow[], getter: (row: ExistingEventRow) => string | null | undefined) {
  const map = new Map<string, ExistingEventRow>();

  for (const row of rows) {
    const key = getter(row);

    if (key) map.set(key, row);
  }

  return map;
}

function mapExistingByDuplicateKey(rows: ExistingEventRow[], field: "city" | "province") {
  const map = new Map<string, ExistingEventRow>();

  for (const row of rows) {
    if (!row[field]) continue;

    map.set(toExistingKey(row, field), row);
  }

  return map;
}

function sameLocation(row: EventUpsert, existing: ExistingEventRow) {
  const sameCityProvince =
    Boolean(row.city && row.province && existing.city && existing.province) &&
    normalizeComparable(row.city) === normalizeComparable(existing.city) &&
    normalizeComparable(row.province) === normalizeComparable(existing.province);
  const sameVenue =
    Boolean(row.venue && existing.venue) &&
    normalizeComparable(row.venue) === normalizeComparable(existing.venue);

  return { sameCityProvince, sameVenue, matches: sameCityProvince || sameVenue };
}

function sameDisciplineOrVehicle(row: EventUpsert, existing: ExistingEventRow) {
  const sameDiscipline =
    Boolean(row.discipline && existing.discipline) &&
    normalizeComparable(row.discipline) === normalizeComparable(existing.discipline);
  const sameVehicle =
    Boolean(row.vehicle_type && existing.vehicle_type) &&
    normalizeComparable(row.vehicle_type) === normalizeComparable(existing.vehicle_type);

  return sameDiscipline || sameVehicle;
}

function possibleDuplicateReason(row: EventUpsert, existing: ExistingEventRow) {
  const location = sameLocation(row, existing);

  if (!location.matches || !rangesOverlapOrClose(row, existing)) {
    return null;
  }

  const rowTokens = relevantTitleTokens(row.title);
  const existingTokens = relevantTitleTokens(existing.title);
  const titleSimilarity = tokenOverlap(rowTokens, existingTokens);
  const rowKeywords = keywordGroups([row.title, row.championship, row.discipline, row.vehicle_type, row.venue, ...(row.tags || [])].join(" "));
  const existingKeywords = keywordGroups([existing.title, existing.discipline, existing.vehicle_type, existing.venue].join(" "));
  const sharedKeywords = sharedKeywordGroups(rowKeywords, existingKeywords);
  const sameType = sameDisciplineOrVehicle(row, existing);
  const rowUrls = new Set([specificEventUrlKey(row.source_url), specificEventUrlKey(row.official_url)].filter(Boolean));
  const sharesSpecificUrl = [specificEventUrlKey(existing.source_url), specificEventUrlKey(existing.official_url)].some(
    (url) => Boolean(url && rowUrls.has(url)),
  );
  const titleLooksSimilar = titleSimilarity >= 0.5 || sharedKeywords.length >= 2 || (sharedKeywords.length >= 1 && titleSimilarity >= 0.3);

  if (!titleLooksSimilar && !(sameType && sharedKeywords.length >= 1 && titleSimilarity >= 0.25)) {
    return null;
  }

  const reasons = [
    location.sameVenue ? "mismo venue" : "misma ciudad/provincia",
    "fechas solapadas o cercanas",
  ];

  if (titleSimilarity >= 0.5) reasons.push("titulos parecidos");
  if (sharedKeywords.length) reasons.push(`keywords: ${sharedKeywords.join(", ")}`);
  if (sameType) reasons.push("misma disciplina/tipo");
  if (sharesSpecificUrl) reasons.push("misma URL especifica");

  return `posible duplicado con "${existing.title}" (${formatExistingDate(existing)}, slug: ${existing.slug || existing.id}) por ${reasons.join("; ")}`;
}

async function readBatch(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const content = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("El archivo de importacion debe contener un array de eventos.");
  }

  return parsed.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Evento ${index + 1}: se esperaba un objeto.`);
    }

    return item;
  });
}

export function validateEvent(input: BatchEventInput, index: number, updatedAt: string): ValidatedEvent {
  const errors: string[] = [];
  const warnings: string[] = [];
  const title = optionalText(input, "title");
  const slug = optionalText(input, "slug");
  const startDate = normalizeDate(input.start_date);
  const endDate = normalizeDate(input.end_date) || startDate;
  const city = optionalText(input, "city");
  const province = optionalText(input, "province");
  const country = optionalText(input, "country") || "ES";
  const sourceUrl = preferredText(input, ["source_url", "sourceUrl"]);
  const officialUrl = optionalText(input, "official_url");
  const registrationUrl = preferredText(input, ["registration_url", "ticket_url", "ticketUrl"]);
  const eventStatus = optionalText(input, "event_status");
  const sourceType = optionalText(input, "source_type");
  const confidenceScore = normalizeNumber(input.confidence_score);
  const latitude = normalizeNumber(input.latitude);
  const longitude = normalizeNumber(input.longitude);
  const needsReview = normalizeBoolean(input.needs_review);
  const tags = normalizeTags(input.tags);
  const reviewStatus = optionalText(input, "duplicate_review_status");
  const reviewNote = optionalText(input, "duplicate_review_note");

  if (!title) errors.push("title obligatorio.");
  if (!slug) errors.push("slug obligatorio.");
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("slug con formato no valido.");
  if (!startDate) errors.push("start_date obligatorio y debe usar YYYY-MM-DD.");
  if (input.end_date && !normalizeDate(input.end_date)) errors.push("end_date debe usar YYYY-MM-DD si se informa.");
  if (!city) warnings.push("city recomendado.");
  if (!province) warnings.push("province recomendado.");
  if (!sourceUrl && !officialUrl) warnings.push("source_url u official_url recomendado.");
  if (eventStatus && !ALLOWED_EVENT_STATUSES.has(eventStatus)) errors.push("event_status no permitido.");
  if (sourceType && !ALLOWED_SOURCE_TYPES.has(sourceType)) errors.push("source_type no permitido.");
  if (Number.isNaN(confidenceScore) || (confidenceScore !== null && (confidenceScore < 0 || confidenceScore > 100))) {
    errors.push("confidence_score debe estar entre 0 y 100.");
  }
  if (Number.isNaN(latitude)) errors.push("latitude debe ser numerico.");
  if (Number.isNaN(longitude)) errors.push("longitude debe ser numerico.");
  if (needsReview === undefined) errors.push("needs_review debe ser boolean si se informa.");
  if (tags === undefined) errors.push("tags debe ser array de strings si se informa.");
  if (reviewStatus && !ALLOWED_DUPLICATE_REVIEW_STATUSES.has(reviewStatus)) errors.push("duplicate_review_status no permitido.");
  if (reviewStatus && !reviewNote) errors.push("duplicate_review_note obligatorio cuando duplicate_review_status esta informado.");

  if (errors.length || !title || !slug || !startDate) {
    return {
      index,
      input,
      row: null,
      errors,
      warnings,
      duplicateReasons: [],
      possibleDuplicateReasons: [],
      classification: "invalid",
    };
  }

  const category = preferredText(input, ["category", "championship"]);
  const discipline = optionalText(input, "discipline") || category || "Motor";
  const source = preferredText(input, ["source", "source_name"]) || "Importacion por lotes";
  const normalizedTags =
    tags && tags.length
      ? tags
      : [discipline, category, city, province].filter((tag): tag is string => Boolean(tag));
  const computedNeedsReview = needsReview ?? false;
  const dataQuality = confidenceScore !== null && confidenceScore >= 85 && computedNeedsReview === false ? "reviewed" : "needs_review";
  const row: EventUpsert = {
    id: optionalText(input, "id") || `batch-${slug}`,
    slug,
    title,
    championship: category || discipline,
    discipline,
    start_date: startDate,
    end_date: endDate,
    venue: optionalText(input, "venue") || null,
    city,
    province,
    region: optionalText(input, "region") || province,
    country,
    level: optionalText(input, "level") || "Publicado",
    source,
    source_url: sourceUrl,
    ticket_url: preferredText(input, ["ticket_url", "ticketUrl"]) || registrationUrl,
    official_url: officialUrl,
    registration_url: registrationUrl,
    image_url: optionalText(input, "image_url"),
    image_source_url: optionalText(input, "image_source_url"),
    event_status: eventStatus,
    short_description: optionalText(input, "short_description"),
    long_description: optionalText(input, "long_description"),
    schedule_text: optionalText(input, "schedule_text"),
    address: optionalText(input, "address"),
    latitude,
    longitude,
    organizer_name: optionalText(input, "organizer_name"),
    organizer_url: optionalText(input, "organizer_url"),
    verified_at: optionalText(input, "verified_at"),
    source_type: sourceType,
    confidence_score: confidenceScore,
    needs_review: computedNeedsReview,
    tags: normalizedTags,
    vehicle_type: optionalText(input, "vehicle_type") || getVehicleType({ title, championship: category, discipline, tags: normalizedTags, source }),
    featured: typeof input.featured === "boolean" ? input.featured : false,
    visible: typeof input.visible === "boolean" ? input.visible : true,
    import_method: "batch_import",
    data_quality: dataQuality,
    notes: optionalText(input, "notes"),
    updated_at: updatedAt,
  };

  return {
    index,
    input,
    row,
    errors,
    warnings,
    duplicateReasons: [],
    possibleDuplicateReasons: [],
    classification: "insertable",
  };
}

async function createSupabaseClient() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchExistingEvents(supabase: Awaited<ReturnType<typeof createSupabaseClient>>) {
  const events: ExistingEventRow[] = [];
  let from = 0;
  let selectFields = "id,slug,title,start_date,end_date,venue,city,province,discipline,vehicle_type,source_url,official_url";

  while (true) {
    const to = from + PAGE_SIZE - 1;
    let { data, error } = await supabase.from("events").select(selectFields).range(from, to);

    if (error && selectFields.includes("official_url")) {
      selectFields = "id,slug,title,start_date,end_date,venue,city,province,discipline,vehicle_type,source_url";
      from = 0;
      events.length = 0;
      ({ data, error } = await supabase.from("events").select(selectFields).range(from, to));
      console.warn("Aviso: no se pudo leer official_url; se omite esa comprobacion de duplicados.");
    }

    if (error) {
      throw new Error(`No se pudieron leer eventos actuales para duplicados: ${error.message}`);
    }

    const page = (data ?? []) as unknown as ExistingEventRow[];
    events.push(...page);

    if (page.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return events;
}

export function classifyDuplicates(events: ValidatedEvent[], existingRows: ExistingEventRow[]) {
  const existingIds = mapExistingByText(existingRows, (row) => row.id);
  const existingSlugs = mapExistingByText(existingRows, (row) => row.slug);
  const existingTitleDateCity = mapExistingByDuplicateKey(existingRows, "city");
  const existingTitleDateProvince = mapExistingByDuplicateKey(existingRows, "province");
  const batchSlugs = new Map<string, number>();
  const batchTitleDateCities = new Map<string, number>();

  for (const event of events) {
    const row = event.row;

    if (!row) continue;

    batchSlugs.set(row.slug || "", (batchSlugs.get(row.slug || "") || 0) + 1);

    if (row.city) {
      const key = duplicateKey(row, "city");
      batchTitleDateCities.set(key, (batchTitleDateCities.get(key) || 0) + 1);
    }
  }

  for (const event of events) {
    const row = event.row;

    if (!row) continue;

    const idMatch = row.id ? existingIds.get(row.id) : null;
    const slugMatch = row.slug ? existingSlugs.get(row.slug) : null;
    const batchTitleDateCity = row.city ? duplicateKey(row, "city") : null;

    if (idMatch) event.duplicateReasons.push(`id existente en "${idMatch.title}" (${formatExistingDate(idMatch)}, slug: ${idMatch.slug || idMatch.id}).`);
    if (slugMatch) event.duplicateReasons.push(`slug existente en "${slugMatch.title}" (${formatExistingDate(slugMatch)}, slug: ${slugMatch.slug || slugMatch.id}).`);
    if (row.slug && (batchSlugs.get(row.slug) || 0) > 1) event.duplicateReasons.push(`slug repetido en lote: ${row.slug}`);
    if (batchTitleDateCity && (batchTitleDateCities.get(batchTitleDateCity) || 0) > 1) {
      event.duplicateReasons.push("title + start_date + city repetido en lote.");
    }

    const titleDateCity = duplicateKey(row, "city");
    const titleDateProvince = duplicateKey(row, "province");

    const titleDateCityMatch = existingTitleDateCity.get(titleDateCity);
    const titleDateProvinceMatch = existingTitleDateProvince.get(titleDateProvince);

    if (row.city && titleDateCityMatch) {
      event.duplicateReasons.push(
        `title + start_date + city coincide con "${titleDateCityMatch.title}" (${formatExistingDate(titleDateCityMatch)}, slug: ${titleDateCityMatch.slug || titleDateCityMatch.id}).`,
      );
    }

    if (!event.duplicateReasons.length && row.province && titleDateProvinceMatch) {
      event.possibleDuplicateReasons.push(
        `title + start_date + province coincide con "${titleDateProvinceMatch.title}" (${formatExistingDate(titleDateProvinceMatch)}, slug: ${titleDateProvinceMatch.slug || titleDateProvinceMatch.id}).`,
      );
    }

    if (!event.duplicateReasons.length) {
      const fuzzyReason = existingRows
        .map((existing) => possibleDuplicateReason(row, existing))
        .find((reason): reason is string => Boolean(reason));

      if (fuzzyReason && !event.possibleDuplicateReasons.includes(fuzzyReason)) {
        event.possibleDuplicateReasons.push(fuzzyReason);
      }
    }

    const reviewStatus = duplicateReviewStatus(event.input);
    const reviewNote = optionalText(event.input, "duplicate_review_note");

    if (event.duplicateReasons.length) {
      event.classification = "duplicate";
      continue;
    }

    if (reviewStatus === "rejected_duplicate") {
      event.possibleDuplicateReasons.push(`revision manual rechazada: ${reviewNote}`);
      event.classification = "possible_duplicate";
      continue;
    }

    if (event.possibleDuplicateReasons.length) {
      if (reviewStatus === "approved_distinct") {
        event.possibleDuplicateReasons.push(`revision manual aprobada como evento distinto: ${reviewNote}`);
        event.classification = "reviewed_insertable";
      } else {
        event.classification = "possible_duplicate";
      }

      continue;
    }

    event.classification = "insertable";
  }
}

function summarize(events: ValidatedEvent[]) {
  return {
    total: events.length,
    validos: events.filter((event) => !event.errors.length).length,
    insertables: events.filter((event) => event.classification === "insertable" || event.classification === "reviewed_insertable").length,
    insertables_revisados: events.filter((event) => event.classification === "reviewed_insertable").length,
    duplicados_exactos: events.filter((event) => event.classification === "duplicate").length,
    posibles_duplicados: events.filter((event) => event.classification === "possible_duplicate").length,
    invalidos: events.filter((event) => event.classification === "invalid").length,
  };
}

function printReport(events: ValidatedEvent[], apply: boolean) {
  const summary = summarize(events);

  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log("Resumen:");
  console.log(`- total leidos: ${summary.total}`);
  console.log(`- validos: ${summary.validos}`);
  console.log(`- insertables: ${summary.insertables}`);
  console.log(`- insertables revisados: ${summary.insertables_revisados}`);
  console.log(`- duplicados exactos: ${summary.duplicados_exactos}`);
  console.log(`- posibles duplicados: ${summary.posibles_duplicados}`);
  console.log(`- invalidos: ${summary.invalidos}`);
  console.log("\nDetalle breve:");

  for (const event of events) {
    const title = event.row?.title || optionalText(event.input, "title") || `(evento ${event.index + 1})`;
    const date = event.row?.start_date || optionalText(event.input, "start_date") || "(sin fecha)";
    const city = event.row?.city || optionalText(event.input, "city") || "(sin ciudad)";
    const reasons = [...event.errors, ...event.duplicateReasons, ...event.possibleDuplicateReasons, ...event.warnings];
    const suffix = reasons.length ? ` - ${reasons.slice(0, 2).join(" | ")}` : "";

    console.log(`- [${event.classification}] ${title} | ${date} | ${city}${suffix}`);
  }
}

async function insertEvents(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, events: ValidatedEvent[]) {
  const insertable = events.filter((event): event is ValidatedEvent & { row: EventUpsert } => {
    return (event.classification === "insertable" || event.classification === "reviewed_insertable") && Boolean(event.row);
  });
  const inserted: string[] = [];

  for (const event of insertable) {
    const { data, error } = await supabase.from("events").insert(event.row).select("slug").single();

    if (error) {
      console.error(`Error insertando ${event.row.slug}: ${error.message}`);
      continue;
    }

    inserted.push(data?.slug || event.row.slug || event.row.id);
  }

  console.log("\nApply:");
  console.log(`- eventos insertados: ${inserted.length}`);

  for (const slug of inserted) {
    console.log(`  - ${slug}`);
  }
}

async function main() {
  const file = getArg("--file");
  const apply = hasFlag("--apply");

  if (!file) {
    throw new Error("Uso: npm run import:events-batch -- --file data/imports/lote-001-events.json [--apply]");
  }

  const inputEvents = await readBatch(file);
  const updatedAt = new Date().toISOString();
  const validated = inputEvents.map((event, index) => validateEvent(event, index, updatedAt));
  const supabase = await createSupabaseClient();
  const existingRows = await fetchExistingEvents(supabase);

  classifyDuplicates(validated, existingRows);
  printReport(validated, apply);

  if (!apply) {
    console.log("\nDry-run: no se ha insertado, actualizado ni borrado ningun evento.");
    return;
  }

  await insertEvents(supabase, validated);
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`\nImportacion por lotes fallida: ${message}`);
    process.exitCode = 1;
  });
}
