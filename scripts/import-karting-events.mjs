import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const JSON_PATH = path.join(process.cwd(), "data", "eventos-karting-espana-2026.json");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const VALID_CATEGORIES = new Set([
  "Karting",
  "Karting alquiler",
  "Endurance karting",
  "Campeonato de karting",
  "Carrera social",
  "Karting indoor",
  "Karting outdoor",
]);
const SIMILAR_TITLE_THRESHOLD = 0.88;

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "");
}

function createEventSlug(title, start) {
  return [slugify(title), slugify(start)].filter(Boolean).join("-");
}

function getString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeComparable(value) {
  return slugify(value || "");
}

function normalizeSourceUrl(value) {
  return getString(value).replace(/\/+$/, "").toLowerCase();
}

function normalizeTags(value, category, reasons) {
  const tags = [];

  if (value !== undefined) {
    if (!Array.isArray(value)) {
      reasons.push("tags debe ser array de strings cuando exista");
    } else {
      for (const tag of value) {
        if (typeof tag !== "string") {
          reasons.push("tags solo puede contener strings");
          continue;
        }

        const trimmed = tag.trim();
        if (trimmed) tags.push(trimmed);
      }
    }
  }

  const tagMap = new Map();

  for (const tag of [...tags, "karting", "Karting", category].filter(Boolean)) {
    const key = normalizeComparable(tag);
    if (key && !tagMap.has(key)) tagMap.set(key, tag.trim());
  }

  return [...tagMap.values()];
}

function eventStart(event) {
  return event.start ?? event.start_date;
}

function existingStart(event) {
  return event.start_date ?? event.start;
}

function titlePlaceKey(event) {
  return [
    normalizeComparable(event.title),
    eventStart(event),
    normalizeComparable(event.venue),
  ].join("|");
}

function sourceTitleDateKey(event) {
  return [
    normalizeSourceUrl(event.source_url ?? event.sourceUrl),
    normalizeComparable(event.title),
    eventStart(event),
  ].join("|");
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }

    for (let j = 0; j < previous.length; j += 1) previous[j] = current[j];
  }

  return previous[right.length];
}

function titleSimilarity(leftTitle, rightTitle) {
  const left = normalizeComparable(leftTitle);
  const right = normalizeComparable(rightTitle);
  const maxLength = Math.max(left.length, right.length);
  if (!maxLength) return 1;
  return 1 - levenshteinDistance(left, right) / maxLength;
}

function sameTitleDateVenue(left, right) {
  return titlePlaceKey(left) === titlePlaceKey({
    title: right.title,
    start: existingStart(right),
    venue: right.venue,
  });
}

function sameTitleDateSource(left, right) {
  return sourceTitleDateKey(left) === sourceTitleDateKey({
    title: right.title,
    start: existingStart(right),
    source_url: right.source_url ?? right.sourceUrl,
  });
}

function sameTitleStartVenueOrPlace(left, right) {
  const sameTitle = normalizeComparable(left.title) === normalizeComparable(right.title);
  const sameStart = left.start === existingStart(right);
  const sameVenue =
    normalizeComparable(left.venue) !== "" &&
    normalizeComparable(left.venue) === normalizeComparable(right.venue);
  const samePlace =
    normalizeComparable(left.city) === normalizeComparable(right.city) &&
    normalizeComparable(left.province) === normalizeComparable(right.province);

  return sameTitle && sameStart && (sameVenue || samePlace);
}

function similarSameDateProvince(left, right) {
  const sameStart = left.start === existingStart(right);
  const sameProvince = normalizeComparable(left.province) === normalizeComparable(right.province);
  const similarity = titleSimilarity(left.title, right.title);

  if (sameStart && sameProvince && similarity >= SIMILAR_TITLE_THRESHOLD) {
    return similarity;
  }

  return null;
}

function validateEvent(value, index) {
  const reasons = [];

  if (!isRecord(value)) {
    return {
      index,
      title: "(no es objeto)",
      id: "(sin id)",
      reasons: ["el evento debe ser un objeto"],
    };
  }

  const title = getString(value.title);
  const providedSlug = getString(value.slug);
  const start = getString(value.start_date) || getString(value.start);
  const end = getString(value.end_date) || getString(value.end) || start;
  const sourceUrl = getString(value.source_url) || getString(value.sourceUrl);
  const city = getString(value.city);
  const province = getString(value.province);
  const category = getString(value.category) || "Karting";
  const discipline = getString(value.discipline) || "Karting";
  const vehicleType = getString(value.vehicle_type) || getString(value.vehicleType) || "karting";

  if (!title) reasons.push("title obligatorio");
  if (!providedSlug && !title) reasons.push("slug obligatorio o generable desde title");
  if (!start) reasons.push("start_date/start obligatorio");
  if (!sourceUrl) reasons.push("source_url/sourceUrl obligatorio");
  if (!city) reasons.push("city obligatorio");
  if (!province) reasons.push("province obligatorio");

  if (start && !isIsoDate(start)) reasons.push("start_date/start debe usar YYYY-MM-DD");
  if (end && !isIsoDate(end)) reasons.push("end_date/end debe usar YYYY-MM-DD");
  if (start && end && end < start) reasons.push("end no puede ser anterior a start");

  if (discipline.toLowerCase() !== "karting") reasons.push('discipline debe ser "Karting"');
  if (vehicleType.toLowerCase() !== "karting") reasons.push('vehicle_type debe ser "karting"');
  if (!VALID_CATEGORIES.has(category)) reasons.push(`category no reconocida: ${category}`);

  const searchableText = [
    title,
    discipline,
    category,
    vehicleType,
    getString(value.championship),
    Array.isArray(value.tags) ? value.tags.join(" ") : "",
  ].join(" ").toLowerCase();

  if (!searchableText.includes("kart")) {
    reasons.push("el evento no parece realmente de karting");
  }

  if (value.featured !== undefined && typeof value.featured !== "boolean") {
    reasons.push("featured debe ser boolean si existe");
  }

  const slug = slugify(providedSlug || createEventSlug(title, start));

  if (!slug) reasons.push("slug no se pudo generar");

  if (reasons.length) {
    return {
      index,
      id: getString(value.id) || `(karting-${slug || index + 1})`,
      title: title || "(sin titulo)",
      reasons,
    };
  }

  const id = getString(value.id) || `karting-${slug}`;
  const notes = getString(value.description);

  return {
    id,
    slug,
    title,
    championship: getString(value.championship) || category,
    discipline: "Karting",
    category,
    vehicle_type: "karting",
    start,
    end,
    venue: getString(value.venue) || city,
    city,
    province,
    region: getString(value.region) || getString(value.zone) || province,
    level: getString(value.level) || "Nacional",
    source: getString(value.source) || getString(value.organizer) || "Fuente oficial",
    source_url: sourceUrl,
    ticket_url: getString(value.ticket_url) || getString(value.ticketUrl),
    tags: normalizeTags(value.tags, category, reasons),
    featured: typeof value.featured === "boolean" ? value.featured : false,
    visible: getString(value.status).toLowerCase() !== "cancelled",
    import_method: "karting-json",
    data_quality: "reviewed",
    notes: notes || null,
  };
}

function splitValidEvents(parsedEvents) {
  const validEvents = [];
  const invalidEvents = [];
  const duplicatesInJson = [];
  const acceptedById = new Map();
  const acceptedBySlug = new Map();

  parsedEvents.forEach((event, index) => {
    const result = validateEvent(event, index);

    if ("reasons" in result) {
      invalidEvents.push(result);
      return;
    }

    const duplicateById = acceptedById.get(result.id);
    const duplicateBySlug = acceptedBySlug.get(result.slug);
    const duplicateByTitleDateVenue = validEvents.find((validEvent) => sameTitleDateVenue(result, validEvent));
    const duplicateByTitleDateSource = validEvents.find((validEvent) => sameTitleDateSource(result, validEvent));
    const similarEvent = validEvents.find((validEvent) => similarSameDateProvince(result, validEvent) !== null);

    if (duplicateById) {
      duplicatesInJson.push({ event: result, matchedEvent: duplicateById, reason: "mismo id en JSON" });
      return;
    }

    if (duplicateBySlug) {
      duplicatesInJson.push({ event: result, matchedEvent: duplicateBySlug, reason: "mismo slug en JSON" });
      return;
    }

    if (duplicateByTitleDateVenue) {
      duplicatesInJson.push({ event: result, matchedEvent: duplicateByTitleDateVenue, reason: "mismo title + fecha + venue en JSON" });
      return;
    }

    if (duplicateByTitleDateSource) {
      duplicatesInJson.push({ event: result, matchedEvent: duplicateByTitleDateSource, reason: "mismo source_url + title + fecha en JSON" });
      return;
    }

    if (similarEvent) {
      duplicatesInJson.push({
        event: result,
        matchedEvent: similarEvent,
        reason: "title muy parecido + misma fecha + provincia en JSON",
        similarity: similarSameDateProvince(result, similarEvent),
      });
      return;
    }

    acceptedById.set(result.id, result);
    acceptedBySlug.set(result.slug, result);
    validEvents.push(result);
  });

  return { validEvents, invalidEvents, duplicatesInJson };
}

async function readJsonFile() {
  const content = await readFile(JSON_PATH, "utf8");
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error("El JSON debe contener un array de eventos.");
  }

  return parsed;
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

async function writeBackup(events) {
  await mkdir(BACKUP_DIR, { recursive: true });

  const backupPath = path.join(
    BACKUP_DIR,
    `events-backup-before-karting-${formatTimestamp(new Date())}.json`,
  );
  const backupContent = JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      source: "public.events",
      reason: "backup before non-destructive karting import",
      count: events.length,
      events,
    },
    null,
    2,
  );

  await writeFile(backupPath, `${backupContent}\n`, "utf8");

  return backupPath;
}

function findDuplicateAgainstExisting(event, existingEvents) {
  for (const existingEvent of existingEvents) {
    if (event.id === existingEvent.id) {
      return { event, matchedEvent: existingEvent, reason: "mismo id" };
    }

    if (event.slug && existingEvent.slug && event.slug === existingEvent.slug) {
      return { event, matchedEvent: existingEvent, reason: "mismo slug" };
    }

    if (sameTitleStartVenueOrPlace(event, existingEvent)) {
      return { event, matchedEvent: existingEvent, reason: "mismo title + start_date + venue/city/province" };
    }

    if (sameTitleDateSource(event, existingEvent)) {
      return { event, matchedEvent: existingEvent, reason: "mismo source_url + title + fecha" };
    }
  }

  for (const existingEvent of existingEvents) {
    const similarity = similarSameDateProvince(event, existingEvent);

    if (similarity !== null) {
      return {
        event,
        matchedEvent: existingEvent,
        reason: "title muy parecido + misma fecha + provincia",
        similarity,
      };
    }
  }

  return null;
}

function toEventInsert(event, updatedAt) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    championship: event.championship,
    discipline: "Karting",
    start_date: event.start,
    end_date: event.end,
    venue: event.venue,
    city: event.city,
    province: event.province,
    region: event.region,
    level: event.level,
    source: event.source,
    source_url: event.source_url,
    ticket_url: event.ticket_url,
    tags: event.tags,
    vehicle_type: "karting",
    featured: event.featured,
    visible: event.visible,
    import_method: event.import_method,
    data_quality: event.data_quality,
    notes: event.notes,
    updated_at: updatedAt,
  };
}

function printInvalidEvents(invalidEvents) {
  if (!invalidEvents.length) return;

  console.warn("\nEventos descartados por errores de campo:");
  for (const invalidEvent of invalidEvents) {
    console.warn(`- #${invalidEvent.index + 1} ${invalidEvent.id} | ${invalidEvent.title}: ${invalidEvent.reasons.join("; ")}`);
  }
}

function printDuplicates(title, duplicates) {
  if (!duplicates.length) return;

  console.warn(`\n${title}:`);
  for (const duplicate of duplicates) {
    const similarity =
      duplicate.similarity === undefined || duplicate.similarity === null
        ? ""
        : ` | similitud ${(duplicate.similarity * 100).toFixed(1)}%`;
    console.warn(`- NO importar: ${duplicate.event.id} | ${duplicate.event.title} | ${duplicate.event.start} | ${duplicate.event.venue}`);
    console.warn(`  Coincide por ${duplicate.reason}${similarity} con: ${duplicate.matchedEvent.id} | ${duplicate.matchedEvent.title}`);
  }
}

function printPreview(events) {
  console.log("\nPreview de 5 eventos normalizados:");
  for (const event of events.slice(0, 5)) {
    console.log(
      JSON.stringify(
        {
          id: event.id,
          slug: event.slug,
          title: event.title,
          discipline: event.discipline,
          vehicle_type: event.vehicle_type,
          category: event.category,
          start_date: event.start,
          end_date: event.end,
          venue: event.venue,
          city: event.city,
          province: event.province,
          source_url: event.source_url,
          tags: event.tags,
        },
        null,
        2,
      ),
    );
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const shouldImport = process.argv.includes("--import");

  if (!dryRun && !shouldImport) {
    throw new Error("Debes indicar --dry-run o --import. Sin flag explicito no se importa nada.");
  }

  if (dryRun && shouldImport) {
    throw new Error("Usa solo una opcion: --dry-run o --import.");
  }

  console.log("Importacion segura de eventos de karting 2026");
  console.log(`Archivo: ${JSON_PATH}`);
  console.log(`Modo: ${dryRun ? "dry-run, no inserta" : "import real, solo inserta eventos nuevos"}\n`);

  const rawEvents = await readJsonFile();
  const { validEvents, invalidEvents, duplicatesInJson } = splitValidEvents(rawEvents);

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: currentEvents, error: currentEventsError } = await supabase.from("events").select("*");

  if (currentEventsError) {
    throw new Error(`No se pudieron leer eventos actuales: ${currentEventsError.message}`);
  }

  const existingEvents = currentEvents ?? [];
  const backupPath = await writeBackup(existingEvents);
  const duplicatesAgainstSupabase = [];
  const readyToImport = [];

  for (const event of validEvents) {
    const duplicate = findDuplicateAgainstExisting(event, existingEvents);

    if (duplicate) {
      duplicatesAgainstSupabase.push(duplicate);
      continue;
    }

    readyToImport.push(event);
  }

  printInvalidEvents(invalidEvents);
  printDuplicates("Duplicados dentro del JSON", duplicatesInJson);
  printDuplicates("Duplicados contra Supabase", duplicatesAgainstSupabase);
  printPreview(readyToImport);

  console.log("\nResumen de validacion:");
  console.log(`- total eventos en JSON: ${rawEvents.length}`);
  console.log(`- eventos validos: ${validEvents.length}`);
  console.log(`- eventos descartados: ${invalidEvents.length + duplicatesInJson.length + duplicatesAgainstSupabase.length}`);
  console.log(`- errores por campo: ${invalidEvents.length}`);
  console.log(`- duplicados dentro del JSON: ${duplicatesInJson.length}`);
  console.log(`- duplicados contra Supabase: ${duplicatesAgainstSupabase.length}`);
  console.log(`- eventos listos para importar: ${readyToImport.length}`);
  console.log(`- eventos actuales en Supabase: ${existingEvents.length}`);
  console.log(`- backup local creado: ${backupPath}`);

  if (dryRun) {
    console.log("\nDry-run completado. No se ha insertado nada.");
    return;
  }

  if (!readyToImport.length) {
    console.log("\nNo hay eventos nuevos que insertar.");
    return;
  }

  const updatedAt = new Date().toISOString();
  const rows = readyToImport.map((event) => toEventInsert(event, updatedAt));
  const { data: insertedEvents, error: insertError } = await supabase.from("events").insert(rows).select("id, slug");

  if (insertError) {
    console.error("\nError de Supabase al insertar eventos de karting:");
    console.error(insertError.message);
    if (insertError.details) console.error(insertError.details);
    if (insertError.hint) console.error(insertError.hint);
    throw insertError;
  }

  console.log("\nImportacion completada:");
  console.log(`- eventos insertados: ${insertedEvents?.length ?? 0}`);
  console.log("- eventos borrados: 0");
  console.log("- eventos actualizados: 0");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nImportacion de karting fallida: ${message}`);
  process.exitCode = 1;
});
