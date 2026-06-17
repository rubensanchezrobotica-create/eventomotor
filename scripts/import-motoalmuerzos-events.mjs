import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const JSON_PATH = path.join(process.cwd(), "data", "eventos-motoalmuerzos-proximos-espana-2026-v4-publicados.json");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const TODAY = new Date("2026-06-17T00:00:00");
const VALID_CATEGORIES = new Set(["Motoalmuerzo", "Matinal motera"]);

nextEnv.loadEnvConfig(process.cwd());

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value) {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function eventEndDate(value) {
  return new Date(`${value}T23:59:59`);
}

function similarity(a, b) {
  const left = new Set(slugify(a).split("-").filter(Boolean));
  const right = new Set(slugify(b).split("-").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function sameDateCity(event, row) {
  return event.start_date === row.start_date && slugify(event.city) === slugify(row.city);
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
  const backupPath = path.join(BACKUP_DIR, `events-backup-before-motoalmuerzos-${formatTimestamp(new Date())}.json`);
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        source: "public.events",
        created_at: new Date().toISOString(),
        count: events.length,
        events,
      },
      null,
      2,
    ),
    "utf8",
  );
  return backupPath;
}

function createEventSlug(title, start) {
  return [slugify(title), slugify(start)].filter(Boolean).join("-");
}

function validateAndNormalize(raw, index) {
  const errors = [];
  const warnings = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: [`Fila ${index + 1}: no es un objeto`], warnings, event: null };
  }

  const title = getString(raw.title);
  const slug = getString(raw.slug) || createEventSlug(title, getString(raw.start_date || raw.start));
  const start = getString(raw.start_date || raw.start);
  const end = getString(raw.end_date || raw.end) || start;
  const city = getString(raw.city);
  const province = getString(raw.province);
  const sourceUrl = getString(raw.source_url || raw.sourceUrl);
  const discipline = getString(raw.discipline);
  const category = getString(raw.category);
  const vehicleType = getString(raw.vehicle_type || raw.vehicleType).toLowerCase();
  const status = getString(raw.status);

  if (!title) errors.push("title obligatorio");
  if (!slug) errors.push("slug obligatorio o generable");
  if (!isIsoDate(start)) errors.push("start_date obligatorio y válido");
  if (!isIsoDate(end)) errors.push("end_date válido obligatorio");
  if (isIsoDate(start) && isIsoDate(end) && end < start) errors.push("end_date anterior a start_date");
  if (isIsoDate(end) && eventEndDate(end).getTime() < TODAY.getTime()) errors.push("fecha no futura");
  if (!sourceUrl) errors.push("source_url obligatorio");
  if (!city) errors.push("city obligatorio");
  if (!province) errors.push("province obligatorio");
  if (discipline !== "Concentraciones") errors.push('discipline debe ser "Concentraciones"');
  if (!VALID_CATEGORIES.has(category)) errors.push('category debe ser "Motoalmuerzo" o "Matinal motera"');
  if (vehicleType !== "moto") errors.push('vehicle_type debe ser "moto"');
  if (status !== "published") errors.push('status debe ser "published"');

  const searchable = normalizeText([title, category, raw.description, ...(Array.isArray(raw.tags) ? raw.tags : [])].join(" "));
  if (!searchable.includes("motoalmuerzo") && !searchable.includes("almuerzo motero") && !searchable.includes("matinal")) {
    warnings.push("No contiene señal fuerte de motoalmuerzo/matinal en title/category/tags/description");
  }

  const tags = Array.isArray(raw.tags) ? raw.tags.map(getString).filter(Boolean) : [];
  const normalizedTags = Array.from(new Set([...tags, category, "motoalmuerzo", "moto"].filter(Boolean)));
  const notes = [
    getString(raw.description) ? `Descripción: ${getString(raw.description)}` : "",
    category ? `Categoría: ${category}` : "",
    getString(raw.organizer) ? `Organizador: ${getString(raw.organizer)}` : "",
    getString(raw.zone) ? `Zona: ${getString(raw.zone)}` : "",
  ].filter(Boolean).join("\n");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    event: {
      id: getString(raw.id) || `motoalmuerzos-${slug}`,
      slug,
      title,
      championship: getString(raw.organizer) || getString(raw.source) || "Motoalmuerzos 2026",
      discipline: "Concentraciones",
      start_date: start,
      end_date: end,
      venue: getString(raw.venue) || city,
      city,
      province,
      region: getString(raw.region) || province,
      level: getString(raw.level) || "Local",
      source: getString(raw.source) || getString(raw.organizer) || "Fuente oficial",
      source_url: sourceUrl,
      ticket_url: getString(raw.ticket_url || raw.ticketUrl) || null,
      tags: normalizedTags,
      vehicle_type: "moto",
      featured: Boolean(raw.featured),
      visible: true,
      import_method: "motoalmuerzos-proximos-2026",
      data_quality: "reviewed",
      notes,
    },
  };
}

function duplicateReason(event, existingEvents) {
  const bySlug = existingEvents.find((row) => row.slug === event.slug);
  if (bySlug) return { reason: "slug", matched: bySlug };

  const byDateCity = existingEvents.find((row) => sameDateCity(event, row) && similarity(event.title, row.title) >= 0.55);
  if (byDateCity) return { reason: "fecha + ciudad + título similar", matched: byDateCity };

  const bySimilarTitle = existingEvents.find((row) => similarity(event.title, row.title) >= 0.82);
  if (bySimilarTitle) return { reason: "título similar", matched: bySimilarTitle };

  return null;
}

async function main() {
  const shouldImport = process.argv.includes("--import");
  const supabase = createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rawEvents = JSON.parse(await readFile(JSON_PATH, "utf8"));
  if (!Array.isArray(rawEvents)) throw new Error("El JSON debe ser un array de eventos.");

  const normalizedResults = rawEvents.map(validateAndNormalize);
  const validResults = normalizedResults.filter((result) => result.ok && result.event);
  const invalidResults = normalizedResults.filter((result) => !result.ok);
  const warnings = normalizedResults.flatMap((result, index) => result.warnings.map((warning) => ({ index: index + 1, warning })));

  const acceptedBySlug = new Map();
  const duplicatesInJson = [];
  const candidates = [];

  for (const result of validResults) {
    const event = result.event;
    if (acceptedBySlug.has(event.slug)) {
      duplicatesInJson.push({ event, matched: acceptedBySlug.get(event.slug), reason: "slug duplicado en JSON" });
    } else {
      acceptedBySlug.set(event.slug, event);
      candidates.push(event);
    }
  }

  const { data: currentEvents, error } = await supabase.from("events").select("*");
  if (error) throw error;

  const currentRows = currentEvents || [];
  const duplicateAgainstSupabase = [];
  const readyToImport = [];

  for (const event of candidates) {
    const duplicate = duplicateReason(event, currentRows);
    if (duplicate) {
      duplicateAgainstSupabase.push({ event, ...duplicate });
    } else {
      readyToImport.push(event);
    }
  }

  const summary = {
    file: path.relative(process.cwd(), JSON_PATH),
    total_json: rawEvents.length,
    validos: validResults.length,
    descartados_invalidos: invalidResults.length,
    duplicados_en_json: duplicatesInJson.length,
    duplicados_con_supabase: duplicateAgainstSupabase.length,
    listos_para_importar: readyToImport.length,
    import_mode: shouldImport,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (invalidResults.length) {
    console.log("Errores por campo:");
    console.log(JSON.stringify(invalidResults.map((result, index) => ({ index: index + 1, errors: result.errors })), null, 2));
  }

  if (warnings.length) {
    console.log("Advertencias:");
    console.log(JSON.stringify(warnings, null, 2));
  }

  if (duplicatesInJson.length || duplicateAgainstSupabase.length) {
    console.log("Duplicados detectados:");
    console.log(JSON.stringify({
      json: duplicatesInJson.map((item) => ({ title: item.event.title, slug: item.event.slug, reason: item.reason })),
      supabase: duplicateAgainstSupabase.map((item) => ({
        title: item.event.title,
        slug: item.event.slug,
        reason: item.reason,
        matched_slug: item.matched.slug,
        matched_title: item.matched.title,
      })),
    }, null, 2));
  }

  console.log("Preview normalizado:");
  console.log(JSON.stringify(readyToImport.slice(0, 5), null, 2));

  if (!shouldImport) {
    console.log("Dry-run completado. Ejecuta con --import para insertar solo los listos.");
    return;
  }

  if (!readyToImport.length) {
    console.log("No hay eventos nuevos para importar.");
    return;
  }

  const backupPath = await writeBackup(currentRows);
  const { data: insertedEvents, error: insertError } = await supabase.from("events").insert(readyToImport).select("id, slug, title");

  if (insertError) throw insertError;

  console.log(`Backup creado: ${backupPath}`);
  console.log("Eventos importados:");
  console.log(JSON.stringify(insertedEvents, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
