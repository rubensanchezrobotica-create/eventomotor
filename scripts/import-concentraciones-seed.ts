import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getVehicleType } from "../lib/event-classification";
import { createEventSlug, slugify } from "../lib/slug";

type RawSeedEvent = Record<string, unknown>;

type ValidSeedEvent = {
  id: string;
  slug: string;
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
  visible: true;
  importMethod: "manual-web-research";
  dataQuality: "needs_review";
  vehicleType?: string;
  notes: string | null;
};

type InvalidSeedEvent = {
  index: number;
  id: string;
  title: string;
  reasons: string[];
};

type ExistingEvent = {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  city: string | null;
  province: string | null;
};

type EventInsert = {
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

type DuplicateCandidate = {
  event: ValidSeedEvent;
  matchedEvent: ExistingEvent | ValidSeedEvent;
  reason: string;
  similarity?: number;
};

const SEED_PATH = path.join(process.cwd(), "data", "eventomotor-concentraciones-2026-seed-92.json");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const REQUIRED_FIELDS = [
  "id",
  "title",
  "start",
  "end",
  "discipline",
  "city",
  "province",
  "source",
  "sourceUrl",
] as const;
const SIMILAR_TITLE_THRESHOLD = 0.88;

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

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeComparable(value: string | null | undefined) {
  return slugify(value || "");
}

function exactEventKey(event: Pick<ValidSeedEvent, "title" | "start" | "city" | "province">) {
  return [
    normalizeComparable(event.title),
    event.start,
    normalizeComparable(event.city),
    normalizeComparable(event.province),
  ].join("|");
}

function exactExistingKey(
  event: Pick<ExistingEvent, "title" | "start_date" | "city" | "province">,
) {
  return [
    normalizeComparable(event.title),
    event.start_date,
    normalizeComparable(event.city),
    normalizeComparable(event.province),
  ].join("|");
}

function sameDateAndCity(seedEvent: ValidSeedEvent, existingEvent: ExistingEvent | ValidSeedEvent) {
  const existingStart = "start_date" in existingEvent ? existingEvent.start_date : existingEvent.start;

  return (
    seedEvent.start === existingStart &&
    normalizeComparable(seedEvent.city) === normalizeComparable(existingEvent.city)
  );
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }

    for (let j = 0; j < previous.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function titleSimilarity(leftTitle: string, rightTitle: string) {
  const left = normalizeComparable(leftTitle);
  const right = normalizeComparable(rightTitle);
  const maxLength = Math.max(left.length, right.length);

  if (!maxLength) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}

function normalizeTags(value: unknown, discipline: string, reasons: string[]) {
  const tags: string[] = [];

  if (value !== undefined) {
    if (!Array.isArray(value)) {
      reasons.push("tags must be an array of strings when provided");
    } else {
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
    }
  }

  const tagMap = new Map<string, string>();

  for (const tag of [...tags, "concentracion", "motos", discipline]) {
    const key = normalizeComparable(tag);

    if (key && !tagMap.has(key)) {
      tagMap.set(key, tag.trim());
    }
  }

  return [...tagMap.values()];
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
    if (!getString(value[field])) {
      reasons.push(`missing required field "${field}"`);
    }
  }

  const id = getString(value.id);
  const title = getString(value.title);
  const start = getString(value.start);
  const end = getString(value.end);
  const discipline = getString(value.discipline);
  const city = getString(value.city);
  const province = getString(value.province);
  const source = getString(value.source);
  const sourceUrl = getString(value.sourceUrl);

  if (start && !isIsoDate(start)) {
    reasons.push("start must use YYYY-MM-DD format");
  }

  if (end && !isIsoDate(end)) {
    reasons.push("end must use YYYY-MM-DD format");
  }

  if (start && end && start > end) {
    reasons.push("end must be the same date or later than start");
  }

  const tags = normalizeTags(value.tags, discipline || "Concentracion", reasons);

  if (value.featured !== undefined && typeof value.featured !== "boolean") {
    reasons.push("featured must be boolean when provided");
  }

  if (value.visible !== undefined && typeof value.visible !== "boolean") {
    reasons.push("visible must be boolean when provided");
  }

  const slug = slugify(getString(value.slug) || createEventSlug(title, start));

  if (!slug) {
    reasons.push("slug could not be generated");
  }

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
    slug,
    title,
    championship: getString(value.championship) || "Concentraciones y eventos de motor",
    discipline,
    start,
    end,
    venue: getString(value.venue) || city,
    city,
    province,
    region: getString(value.region) || province,
    level: getString(value.level) || "Nacional",
    source,
    sourceUrl,
    ticketUrl: getString(value.ticketUrl),
    tags,
    featured: typeof value.featured === "boolean" ? value.featured : false,
    visible: true,
    importMethod: "manual-web-research",
    dataQuality: "needs_review",
    vehicleType: getString(value.vehicleType) || getString(value.vehicle_type) || undefined,
    notes: getString(value.notes) || null,
  };
}

function splitValidEvents(parsedEvents: unknown[]) {
  const validEvents: ValidSeedEvent[] = [];
  const invalidEvents: InvalidSeedEvent[] = [];
  const duplicatesInSeed: DuplicateCandidate[] = [];
  const acceptedById = new Map<string, ValidSeedEvent>();
  const acceptedByExactKey = new Map<string, ValidSeedEvent>();
  const acceptedBySlug = new Map<string, ValidSeedEvent>();

  parsedEvents.forEach((event, index) => {
    const result = validateSeedEvent(event, index);

    if ("reasons" in result) {
      invalidEvents.push(result);
      return;
    }

    const existingById = acceptedById.get(result.id);

    if (existingById) {
      duplicatesInSeed.push({ event: result, matchedEvent: existingById, reason: "mismo id en JSON" });
      return;
    }

    const existingBySlug = acceptedBySlug.get(result.slug);

    if (existingBySlug) {
      duplicatesInSeed.push({
        event: result,
        matchedEvent: existingBySlug,
        reason: "mismo slug generado en JSON",
      });
      return;
    }

    const key = exactEventKey(result);
    const existingByExactKey = acceptedByExactKey.get(key);

    if (existingByExactKey) {
      duplicatesInSeed.push({
        event: result,
        matchedEvent: existingByExactKey,
        reason: "mismo title normalizado + fecha + ciudad/provincia en JSON",
      });
      return;
    }

    const similarEvent = validEvents.find((validEvent) => {
      return (
        sameDateAndCity(result, validEvent) &&
        titleSimilarity(result.title, validEvent.title) >= SIMILAR_TITLE_THRESHOLD
      );
    });

    if (similarEvent) {
      duplicatesInSeed.push({
        event: result,
        matchedEvent: similarEvent,
        reason: "title muy parecido + misma fecha + misma ciudad en JSON",
        similarity: titleSimilarity(result.title, similarEvent.title),
      });
      return;
    }

    acceptedById.set(result.id, result);
    acceptedBySlug.set(result.slug, result);
    acceptedByExactKey.set(key, result);
    validEvents.push(result);
  });

  return { validEvents, invalidEvents, duplicatesInSeed };
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

  const backupPath = path.join(
    BACKUP_DIR,
    `events-backup-before-concentraciones-${formatTimestamp(new Date())}.json`,
  );
  const backupContent = JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      source: "public.events",
      reason: "backup before non-destructive concentraciones import",
      count: events.length,
      events,
    },
    null,
    2,
  );

  await writeFile(backupPath, `${backupContent}\n`, "utf8");

  return backupPath;
}

function findDuplicateAgainstExisting(
  event: ValidSeedEvent,
  existingEvents: ExistingEvent[],
): DuplicateCandidate | null {
  const exactKey = exactEventKey(event);

  for (const existingEvent of existingEvents) {
    if (event.id === existingEvent.id) {
      return { event, matchedEvent: existingEvent, reason: "mismo id" };
    }

    if (event.slug && existingEvent.slug && event.slug === existingEvent.slug) {
      return { event, matchedEvent: existingEvent, reason: "mismo slug" };
    }

    if (exactKey === exactExistingKey(existingEvent)) {
      return {
        event,
        matchedEvent: existingEvent,
        reason: "mismo title normalizado + start_date + city/province",
      };
    }
  }

  for (const existingEvent of existingEvents) {
    if (!sameDateAndCity(event, existingEvent)) {
      continue;
    }

    const similarity = titleSimilarity(event.title, existingEvent.title);

    if (similarity >= SIMILAR_TITLE_THRESHOLD) {
      return {
        event,
        matchedEvent: existingEvent,
        reason: "title muy parecido + misma fecha + misma ciudad",
        similarity,
      };
    }
  }

  return null;
}

function toEventInsert(event: ValidSeedEvent, updatedAt: string): EventInsert {
  return {
    id: event.id,
    slug: event.slug,
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
    visible: true,
    import_method: "manual-web-research",
    data_quality: "needs_review",
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

function printDuplicates(title: string, duplicates: DuplicateCandidate[]) {
  if (!duplicates.length) {
    return;
  }

  console.warn(`\n${title}:`);

  for (const duplicate of duplicates) {
    const similarity =
      duplicate.similarity === undefined ? "" : ` | similitud ${(duplicate.similarity * 100).toFixed(1)}%`;

    console.warn(
      `- NO insertar: ${duplicate.event.id} | ${duplicate.event.title} | ${duplicate.event.start} | ${duplicate.event.city}, ${duplicate.event.province}`,
    );
    console.warn(
      `  Coincide por ${duplicate.reason}${similarity} con: ${duplicate.matchedEvent.id} | ${duplicate.matchedEvent.title}`,
    );
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("Importacion segura de concentraciones 2026");
  console.log(`Modo: ${dryRun ? "dry-run, no inserta" : "insertar solo eventos nuevos"}\n`);

  const seedEvents = await readSeedFile();
  const { validEvents, invalidEvents, duplicatesInSeed } = splitValidEvents(seedEvents);

  console.log(`Eventos leidos del JSON: ${seedEvents.length}`);
  console.log(`Eventos validos: ${validEvents.length}`);
  console.log(`Eventos invalidos: ${invalidEvents.length}`);
  printInvalidEvents(invalidEvents);
  printDuplicates("Posibles duplicados dentro del JSON que NO se importaran", duplicatesInSeed);

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

  const existingEvents = (currentEvents ?? []) as ExistingEvent[];

  console.log(`\nEventos actuales en public.events: ${existingEvents.length}`);

  const backupPath = await writeBackup(existingEvents);

  console.log(`Backup local creado: ${backupPath}`);

  const duplicatesAgainstExisting: DuplicateCandidate[] = [];
  const newEvents: ValidSeedEvent[] = [];

  for (const event of validEvents) {
    const duplicate = findDuplicateAgainstExisting(event, existingEvents);

    if (duplicate) {
      duplicatesAgainstExisting.push(duplicate);
      continue;
    }

    newEvents.push(event);
  }

  printDuplicates("Posibles duplicados contra public.events que NO se importaran", duplicatesAgainstExisting);

  console.log("\nResumen:");
  console.log(`- eventos leidos del JSON: ${seedEvents.length}`);
  console.log(`- eventos validos: ${validEvents.length}`);
  console.log(`- duplicados internos: ${duplicatesInSeed.length}`);
  console.log(`- posibles duplicados contra public.events: ${duplicatesAgainstExisting.length}`);
  console.log(`- eventos nuevos a insertar: ${newEvents.length}`);

  if (dryRun) {
    console.log("\nDry-run completado. No se ha insertado nada.");
    return;
  }

  if (!newEvents.length) {
    console.log("\nNo hay eventos nuevos que insertar.");
    return;
  }

  const updatedAt = new Date().toISOString();
  const rows = newEvents.map((event) => toEventInsert(event, updatedAt));
  const { data: insertedEvents, error: insertError } = await supabase
    .from("events")
    .insert(rows)
    .select("id");

  if (insertError) {
    console.error("\nError de Supabase al insertar eventos nuevos:");
    console.error(insertError.message);

    if (insertError.details) {
      console.error(insertError.details);
    }

    if (insertError.hint) {
      console.error(insertError.hint);
    }

    throw insertError;
  }

  console.log(`\nEventos insertados: ${insertedEvents?.length ?? 0}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`\nImportacion de concentraciones fallida: ${message}`);
  process.exitCode = 1;
});
