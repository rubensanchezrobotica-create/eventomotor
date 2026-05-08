import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getVehicleType } from "../lib/event-classification";
import { createEventSlug, slugify } from "../lib/slug";

type RawSeedEvent = Record<string, unknown>;

type ValidSeedEvent = {
  id: string;
  slug?: string;
  title: string;
  championship: string;
  discipline: string;
  start: string;
  end: string;
  venue: string;
  city: string;
  province: string;
  region: string;
  level: string;
  source: string;
  sourceUrl: string;
  ticketUrl: string;
  tags: string[];
  featured: boolean;
  visible: boolean;
  importMethod: string;
  dataQuality: string;
  vehicleType?: string;
  vehicle_type?: string;
  notes: string | null;
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
  vehicle_type: string;
  featured: boolean;
  visible: boolean;
  import_method: string;
  data_quality: string;
  notes: string | null;
  updated_at: string;
};

type InvalidSeedEvent = {
  index: number;
  id: string;
  title: string;
  reasons: string[];
};

const SEED_PATH = path.join(process.cwd(), "data", "eventomotor-events-2026-seed-84.json");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
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

function isRecord(value: unknown): value is RawSeedEvent {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequiredString(event: RawSeedEvent, field: (typeof REQUIRED_FIELDS)[number]) {
  return getString(event[field]);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTags(value: unknown, reasons: string[]) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    reasons.push("tags must be an array of strings when provided");
    return [];
  }

  const tags: string[] = [];

  for (const tag of value) {
    if (typeof tag !== "string") {
      reasons.push("tags must contain only strings");
      continue;
    }

    const trimmedTag = tag.trim();

    if (trimmedTag) {
      tags.push(trimmedTag);
    }
  }

  return [...new Set(tags)];
}

function getOptionalBoolean(
  value: unknown,
  field: "featured" | "visible",
  fallback: boolean,
  reasons: string[],
) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    reasons.push(`${field} must be boolean when provided`);
    return fallback;
  }

  return value;
}

function validateSeedEvent(value: unknown, index: number): ValidSeedEvent | InvalidSeedEvent {
  const reasons: string[] = [];

  if (!isRecord(value)) {
    return {
      index,
      id: "(sin id)",
      title: "(no es objeto)",
      reasons: ["event must be an object"],
    };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!getRequiredString(value, field)) {
      reasons.push(`missing required field "${field}"`);
    }
  }

  const id = getRequiredString(value, "id");
  const title = getRequiredString(value, "title");
  const discipline = getRequiredString(value, "discipline");
  const start = getRequiredString(value, "start");
  const end = getRequiredString(value, "end");
  const venue = getRequiredString(value, "venue");
  const city = getRequiredString(value, "city");
  const province = getRequiredString(value, "province");
  const sourceUrl = getRequiredString(value, "sourceUrl");

  if (start && !isIsoDate(start)) {
    reasons.push("start must use YYYY-MM-DD format");
  }

  if (end && !isIsoDate(end)) {
    reasons.push("end must use YYYY-MM-DD format");
  }

  const tags = normalizeTags(value.tags, reasons);
  const featured = getOptionalBoolean(value.featured, "featured", false, reasons);
  const visible = getOptionalBoolean(value.visible, "visible", true, reasons);

  if (reasons.length) {
    return {
      index,
      id: id || "(sin id)",
      title: title || "(sin titulo)",
      reasons,
    };
  }

  return {
    id,
    slug: getString(value.slug) || undefined,
    title,
    championship: getString(value.championship) || title,
    discipline,
    start,
    end,
    venue,
    city,
    province,
    region: getString(value.region) || province,
    level: getString(value.level) || "Nacional",
    source: getString(value.source) || "EventoMotor",
    sourceUrl,
    ticketUrl: getString(value.ticketUrl),
    tags,
    featured,
    visible,
    importMethod: getString(value.importMethod) || "seed-2026",
    dataQuality: getString(value.dataQuality) || "reviewed",
    vehicleType: getString(value.vehicleType) || getString(value.vehicle_type) || undefined,
    notes: getString(value.notes) || null,
  };
}

function splitValidEvents(parsedEvents: unknown[]) {
  const validEvents: ValidSeedEvent[] = [];
  const invalidEvents: InvalidSeedEvent[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();

  parsedEvents.forEach((event, index) => {
    const result = validateSeedEvent(event, index);

    if ("reasons" in result) {
      invalidEvents.push(result);
      return;
    }

    const normalizedSlug = slugify(result.slug || createEventSlug(result.title, result.start));

    if (seenIds.has(result.id)) {
      invalidEvents.push({
        index,
        id: result.id,
        title: result.title,
        reasons: [`duplicate id "${result.id}" in seed file`],
      });
      return;
    }

    if (!normalizedSlug) {
      invalidEvents.push({
        index,
        id: result.id,
        title: result.title,
        reasons: ["slug could not be generated"],
      });
      return;
    }

    if (seenSlugs.has(normalizedSlug)) {
      invalidEvents.push({
        index,
        id: result.id,
        title: result.title,
        reasons: [`duplicate slug "${normalizedSlug}" in seed file`],
      });
      return;
    }

    seenIds.add(result.id);
    seenSlugs.add(normalizedSlug);
    validEvents.push({ ...result, slug: normalizedSlug });
  });

  return { validEvents, invalidEvents };
}

async function readSeedFile() {
  const content = await readFile(SEED_PATH, "utf8");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Seed JSON must contain an array of events.");
  }

  return parsed;
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

async function writeBackup(events: unknown[]) {
  await mkdir(BACKUP_DIR, { recursive: true });

  const backupPath = path.join(BACKUP_DIR, `events-backup-${formatTimestamp(new Date())}.json`);
  const backupContent = JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      source: "public.events",
      count: events.length,
      events,
    },
    null,
    2,
  );

  await writeFile(backupPath, `${backupContent}\n`, "utf8");

  return backupPath;
}

function toEventUpsert(event: ValidSeedEvent, updatedAt: string): EventUpsert {
  return {
    id: event.id,
    slug: event.slug || createEventSlug(event.title, event.start),
    title: event.title,
    championship: event.championship,
    discipline: event.discipline,
    start_date: event.start,
    end_date: event.end,
    venue: event.venue,
    city: event.city,
    province: event.province,
    region: event.region,
    level: event.level,
    source: event.source,
    source_url: event.sourceUrl,
    ticket_url: event.ticketUrl,
    tags: event.tags,
    vehicle_type: getVehicleType(event),
    featured: event.featured,
    visible: event.visible,
    import_method: event.importMethod,
    data_quality: event.dataQuality,
    notes: event.notes,
    updated_at: updatedAt,
  };
}

function printInvalidEvents(invalidEvents: InvalidSeedEvent[]) {
  if (!invalidEvents.length) {
    return;
  }

  console.warn("\nEventos invalidos que NO se importaran:");

  for (const invalidEvent of invalidEvents) {
    console.warn(
      `- #${invalidEvent.index + 1} ${invalidEvent.id} | ${invalidEvent.title}: ${invalidEvent.reasons.join("; ")}`,
    );
  }
}

async function main() {
  console.warn("============================================================");
  console.warn("REEMPLAZO DE EVENTOS EVENTOMOTOR");
  console.warn("Este comando es DESTRUCTIVO: hace backup, borra public.events e importa el seed.");
  console.warn("No toca otras tablas, event_sources, APIs, admin, sitemap, robots ni .env.local.");
  console.warn("============================================================\n");

  const seedEvents = await readSeedFile();
  const { validEvents, invalidEvents } = splitValidEvents(seedEvents);

  console.log(`Eventos leidos del JSON: ${seedEvents.length}`);
  console.log(`Eventos validos: ${validEvents.length}`);
  console.log(`Eventos invalidos: ${invalidEvents.length}`);
  printInvalidEvents(invalidEvents);

  if (!validEvents.length) {
    throw new Error("No hay eventos validos para importar. No se borrara nada.");
  }

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: currentEvents, error: currentEventsError } = await supabase
    .from("events")
    .select("*");

  if (currentEventsError) {
    throw new Error(`No se pudieron leer los eventos actuales: ${currentEventsError.message}`);
  }

  const existingEvents = currentEvents ?? [];

  console.log(`\nEventos actuales encontrados antes del backup: ${existingEvents.length}`);

  let backupPath = "";

  try {
    backupPath = await writeBackup(existingEvents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Backup fallido. No se borrara nada. Motivo: ${message}`);
  }

  console.log(`Backup creado: ${backupPath}`);

  const { data: deletedEvents, error: deleteError } = await supabase
    .from("events")
    .delete()
    .neq("id", "__eventomotor_never_matches__")
    .select("id");

  if (deleteError) {
    throw new Error(`Error al borrar eventos actuales: ${deleteError.message}`);
  }

  const deletedCount = deletedEvents?.length ?? 0;

  console.log(`Eventos borrados: ${deletedCount}`);

  const updatedAt = new Date().toISOString();
  const rows = validEvents.map((event) => toEventUpsert(event, updatedAt));
  const { data: upsertedEvents, error: upsertError } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (upsertError) {
    console.error("\nError de Supabase al insertar/actualizar eventos:");
    console.error(upsertError.message);

    if (upsertError.details) {
      console.error(upsertError.details);
    }

    if (upsertError.hint) {
      console.error(upsertError.hint);
    }

    throw upsertError;
  }

  const upsertedCount = upsertedEvents?.length ?? 0;

  console.log("\nResumen final:");
  console.log(`- eventos actuales encontrados antes del backup: ${existingEvents.length}`);
  console.log(`- ruta del backup creado: ${backupPath}`);
  console.log(`- eventos leidos del JSON: ${seedEvents.length}`);
  console.log(`- eventos validos: ${validEvents.length}`);
  console.log(`- eventos invalidos: ${invalidEvents.length}`);
  console.log(`- eventos borrados: ${deletedCount}`);
  console.log(`- eventos insertados/actualizados: ${upsertedCount}`);
  console.log("- errores: ninguno");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error("\nResumen final con errores:");
  console.error(`- error: ${message}`);
  process.exitCode = 1;
});
