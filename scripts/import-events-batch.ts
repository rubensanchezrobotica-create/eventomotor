import { readFile } from "node:fs/promises";
import path from "node:path";
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
  city: string | null;
  province: string | null;
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
  classification: "insertable" | "duplicate" | "possible_duplicate" | "invalid";
};

const PAGE_SIZE = 1000;
const ALLOWED_EVENT_STATUSES = new Set(["confirmed", "tentative", "postponed", "cancelled"]);
const ALLOWED_SOURCE_TYPES = new Set([
  "official",
  "organizer",
  "federation",
  "circuit",
  "municipality",
  "media",
  "aggregator",
  "unknown",
]);

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

function validateEvent(input: BatchEventInput, index: number, updatedAt: string): ValidatedEvent {
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
  let selectFields = "id,slug,title,start_date,city,province,source_url,official_url";

  while (true) {
    const to = from + PAGE_SIZE - 1;
    let { data, error } = await supabase.from("events").select(selectFields).range(from, to);

    if (error && selectFields.includes("official_url")) {
      selectFields = "id,slug,title,start_date,city,province,source_url";
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

function classifyDuplicates(events: ValidatedEvent[], existingRows: ExistingEventRow[]) {
  const existingSlugs = mapExistingByText(existingRows, (row) => row.slug);
  const existingSourceUrls = mapExistingByText(existingRows, (row) => row.source_url);
  const existingOfficialUrls = mapExistingByText(existingRows, (row) => row.official_url);
  const existingTitleDateCity = mapExistingByDuplicateKey(existingRows, "city");
  const existingTitleDateProvince = mapExistingByDuplicateKey(existingRows, "province");
  const batchSlugs = new Map<string, number>();
  const batchSourceUrls = new Map<string, number>();

  for (const event of events) {
    const row = event.row;

    if (!row) continue;

    batchSlugs.set(row.slug || "", (batchSlugs.get(row.slug || "") || 0) + 1);
    if (row.source_url) batchSourceUrls.set(row.source_url, (batchSourceUrls.get(row.source_url) || 0) + 1);
  }

  for (const event of events) {
    const row = event.row;

    if (!row) continue;

    if (row.id && existingRows.some((existing) => existing.id === row.id)) event.duplicateReasons.push(`id existente: ${row.id}`);
    if (row.slug && existingSlugs.has(row.slug)) event.duplicateReasons.push(`slug existente: ${row.slug}`);
    if (row.slug && (batchSlugs.get(row.slug) || 0) > 1) event.duplicateReasons.push(`slug repetido en lote: ${row.slug}`);
    if (row.source_url && existingSourceUrls.has(row.source_url)) event.duplicateReasons.push("source_url existente.");
    if (row.source_url && (batchSourceUrls.get(row.source_url) || 0) > 1) event.duplicateReasons.push("source_url repetido en lote.");
    if (row.official_url && existingOfficialUrls.has(row.official_url)) event.duplicateReasons.push("official_url existente.");

    const titleDateCity = duplicateKey(row, "city");
    const titleDateProvince = duplicateKey(row, "province");

    if (row.city && existingTitleDateCity.has(titleDateCity)) {
      event.duplicateReasons.push("title + start_date + city coincide con evento existente.");
    }

    if (!event.duplicateReasons.length && row.province && existingTitleDateProvince.has(titleDateProvince)) {
      event.possibleDuplicateReasons.push("title + start_date + province coincide con evento existente.");
    }

    event.classification = event.duplicateReasons.length
      ? "duplicate"
      : event.possibleDuplicateReasons.length
        ? "possible_duplicate"
        : "insertable";
  }
}

function summarize(events: ValidatedEvent[]) {
  return {
    total: events.length,
    validos: events.filter((event) => !event.errors.length).length,
    insertables: events.filter((event) => event.classification === "insertable").length,
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
    return event.classification === "insertable" && Boolean(event.row);
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`\nImportacion por lotes fallida: ${message}`);
  process.exitCode = 1;
});
