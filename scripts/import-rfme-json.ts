import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createEventSlug } from "../lib/slug";

type ManualRfmeEvent = {
  id: string;
  slug?: string;
  title: string;
  championship?: string;
  discipline: string;
  start: string;
  end: string;
  venue: string;
  city: string;
  province: string;
  region?: string;
  level?: string;
  source?: string;
  sourceUrl: string;
  ticketUrl?: string;
  tags?: string[];
  featured?: boolean;
  visible?: boolean;
  importMethod?: string;
  dataQuality?: string;
  notes?: string;
};

type EventUpsert = {
  id: string;
  slug: string;
  title: string;
  championship: string;
  discipline: string;
  start_date: string;
  end_date: string;
  venue: string;
  city: string;
  province: string;
  region: string;
  level: string;
  source: string;
  source_url: string;
  ticket_url: string;
  tags: string[];
  featured: boolean;
  visible: boolean;
  import_method: string;
  data_quality: string;
  notes: string | null;
  updated_at: string;
};

const JSON_PATH = path.join(process.cwd(), "data", "rfme-events.json");
const REQUIRED_FIELDS = [
  "id",
  "title",
  "discipline",
  "start",
  "end",
  "venue",
  "city",
  "province",
  "sourceUrl",
] as const;

loadEnvConfig(process.cwd());

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateIsoDate(value: string, field: string, index: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Event ${index + 1}: ${field} must use YYYY-MM-DD format.`);
  }
}

function validateManualEvent(value: unknown, index: number): ManualRfmeEvent {
  if (!isRecord(value)) {
    throw new Error(`Event ${index + 1}: expected an object.`);
  }

  for (const field of REQUIRED_FIELDS) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      throw new Error(`Event ${index + 1}: missing required field "${field}".`);
    }
  }

  validateIsoDate(value.start as string, "start", index);
  validateIsoDate(value.end as string, "end", index);

  if (value.tags !== undefined && !Array.isArray(value.tags)) {
    throw new Error(`Event ${index + 1}: tags must be an array when provided.`);
  }

  return {
    id: (value.id as string).trim(),
    slug: typeof value.slug === "string" && value.slug.trim() ? value.slug.trim() : undefined,
    title: (value.title as string).trim(),
    championship:
      typeof value.championship === "string" && value.championship.trim()
        ? value.championship.trim()
        : (value.title as string).trim(),
    discipline: (value.discipline as string).trim(),
    start: (value.start as string).trim(),
    end: (value.end as string).trim(),
    venue: (value.venue as string).trim(),
    city: (value.city as string).trim(),
    province: (value.province as string).trim(),
    region:
      typeof value.region === "string" && value.region.trim()
        ? value.region.trim()
        : (value.province as string).trim(),
    level:
      typeof value.level === "string" && value.level.trim() ? value.level.trim() : "Nacional",
    source:
      typeof value.source === "string" && value.source.trim() ? value.source.trim() : "RFME JSON",
    sourceUrl: (value.sourceUrl as string).trim(),
    ticketUrl: typeof value.ticketUrl === "string" ? value.ticketUrl.trim() : "",
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()))
      : ["RFME", (value.discipline as string).trim()],
    featured: typeof value.featured === "boolean" ? value.featured : false,
    visible: typeof value.visible === "boolean" ? value.visible : true,
    importMethod:
      typeof value.importMethod === "string" && value.importMethod.trim()
        ? value.importMethod.trim()
        : "rfme-json",
    dataQuality:
      typeof value.dataQuality === "string" && value.dataQuality.trim()
        ? value.dataQuality.trim()
        : "reviewed",
    notes: typeof value.notes === "string" && value.notes.trim() ? value.notes.trim() : undefined,
  };
}

function withImportTags(tags: string[] | undefined, discipline: string) {
  const normalizedTags = tags?.length ? tags : ["RFME", discipline];
  const tagMap = new Map<string, string>();

  for (const tag of [...normalizedTags, "import-manual", "rfme-json"]) {
    const trimmed = tag.trim();

    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();

    if (!tagMap.has(key)) {
      tagMap.set(key, trimmed);
    }
  }

  return [...tagMap.values()];
}

async function readEvents() {
  const content = await readFile(JSON_PATH, "utf8");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("data/rfme-events.json must contain an array.");
  }

  return parsed.map(validateManualEvent);
}

function toEventUpsert(event: ManualRfmeEvent, updatedAt: string): EventUpsert {
  return {
    id: event.id,
    slug: event.slug || createEventSlug(event.title, event.start),
    title: event.title,
    championship: event.championship || event.title,
    discipline: event.discipline,
    start_date: event.start,
    end_date: event.end,
    venue: event.venue,
    city: event.city,
    province: event.province,
    region: event.region || event.province,
    level: event.level || "Nacional",
    source: event.source || "RFME JSON",
    source_url: event.sourceUrl,
    ticket_url: event.ticketUrl || "",
    tags: withImportTags(event.tags, event.discipline),
    featured: Boolean(event.featured),
    visible: event.visible !== false,
    import_method: event.importMethod || "rfme-json",
    data_quality: event.dataQuality || "reviewed",
    notes: event.notes || null,
    updated_at: updatedAt,
  };
}

async function main() {
  const events = await readEvents();

  console.log(`Eventos leidos desde JSON: ${events.length}`);

  if (!events.length) {
    console.log("No hay eventos RFME para importar.");
    return;
  }

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const updatedAt = new Date().toISOString();
  const rows = events.map((event) => toEventUpsert(event, updatedAt));
  const { data, error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (error) {
    console.error("Error al importar eventos RFME desde JSON:");
    console.error(error.message);

    if (error.details) {
      console.error(error.details);
    }

    throw error;
  }

  console.log(`Eventos insertados/actualizados: ${data?.length ?? 0}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Importacion RFME JSON fallida: ${message}`);
  process.exitCode = 1;
});
