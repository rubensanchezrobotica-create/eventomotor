import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const SLUG = "xxxvi-concentracion-lechazos-guardo-2026-06-26";
const OFFICIAL_URL = "http://motoclubguardo.com";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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
  const backupPath = path.join(BACKUP_DIR, `events-backup-before-lechazos-guardo-${formatTimestamp(new Date())}.json`);
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

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSimilarity(leftValue, rightValue) {
  const left = new Set(normalize(leftValue).split(/\s+/).filter(Boolean));
  const right = new Set(normalize(rightValue).split(/\s+/).filter(Boolean));
  if (!left.size || !right.size) return 0;

  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function sameDateCity(event, row) {
  return event.start_date === row.start_date && normalize(event.city) === normalize(row.city);
}

function duplicateReason(event, existingEvents) {
  const bySlug = existingEvents.find((row) => row.slug === event.slug);
  if (bySlug) return { reason: "slug", matched: bySlug };

  const byDateCity = existingEvents.find((row) => sameDateCity(event, row) && tokenSimilarity(event.title, row.title) >= 0.55);
  if (byDateCity) return { reason: "fecha + ciudad + título similar", matched: byDateCity };

  const bySimilarTitle = existingEvents.find((row) => tokenSimilarity(event.title, row.title) >= 0.82);
  if (bySimilarTitle) return { reason: "título similar", matched: bySimilarTitle };

  return null;
}

const event = {
  id: `manual-${SLUG}`,
  slug: SLUG,
  title: "XXXVI Concentración Lechazos 2026",
  championship: "Motoclub Villa de Guardo",
  discipline: "Concentraciones",
  start_date: "2026-06-26",
  end_date: "2026-06-28",
  venue: "Piscinas municipales",
  city: "Guardo",
  province: "Palencia",
  region: "Castilla y León",
  level: "Publicado",
  source: "Motoclub Villa de Guardo",
  source_url: OFFICIAL_URL,
  ticket_url: OFFICIAL_URL,
  tags: [
    "concentración motera",
    "motos",
    "Guardo",
    "Palencia",
    "Castilla y León",
    "lechazo",
    "rutas moteras",
    "stunt",
    "fin de semana motero",
    "concentraciones",
  ],
  vehicle_type: "moto",
  featured: false,
  visible: true,
  import_method: "manual-lechazos-guardo-2026",
  data_quality: "published",
  notes: [
    "Descripción: El Motoclub Villa de Guardo organiza la XXXVI Concentración Lechazos 2026 en Guardo, Palencia. Un fin de semana motero con rutas por la montaña palentina, rock, lechazo asado, buena comida, antorchas, stunt y ambiente motero.",
    "Precio: 30 € general / 25 € socios.",
    "Contacto: iriscamino@gmail.com; teléfono 676501988.",
    "Fuente oficial / inscripción: http://motoclubguardo.com.",
  ].join("\n"),
};

async function updateSubmissionStatus(supabase) {
  const { data, error } = await supabase
    .from("event_submissions")
    .select("id,event_name,status,source_url,created_at")
    .ilike("event_name", "%Lechazos%")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const candidates = data || [];
  const submission = candidates.find((row) => normalize(row.event_name).includes("lechazos")) || candidates[0];

  if (!submission) {
    return { updated: false, reason: "No se encontró solicitud coincidente en event_submissions." };
  }

  const { data: updated, error: updateError } = await supabase
    .from("event_submissions")
    .update({ status: "published" })
    .eq("id", submission.id)
    .select("id,event_name,status")
    .single();

  if (!updateError) {
    return { updated: true, submission: updated };
  }

  if (updateError.code !== "23514") throw updateError;

  const { data: fallbackUpdated, error: fallbackError } = await supabase
    .from("event_submissions")
    .update({ status: "imported" })
    .eq("id", submission.id)
    .select("id,event_name,status")
    .single();

  if (fallbackError) throw fallbackError;

  return {
    updated: true,
    requested_status: "published",
    applied_status: "imported",
    reason: "La constraint de event_submissions no acepta published; se ha usado imported.",
    submission: fallbackUpdated,
  };
}

async function main() {
  const shouldImport = process.argv.includes("--import");
  const supabase = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: currentEvents, error } = await supabase.from("events").select("*");
  if (error) throw error;

  const rows = currentEvents || [];
  const duplicate = duplicateReason(event, rows);

  console.log("Importación manual: XXXVI Concentración Lechazos 2026");
  console.log(`- eventos actuales en Supabase: ${rows.length}`);
  console.log(`- slug final: ${event.slug}`);
  console.log(`- fuente oficial: ${event.source_url}`);
  console.log(`- enlace inscripción: ${event.ticket_url}`);
  console.log(`- duplicado: ${duplicate ? `${duplicate.reason} (${duplicate.matched.slug})` : "no"}`);
  if (duplicate?.reason === "slug") {
    console.log("- evento existente:");
    console.log(
      JSON.stringify(
        {
          id: duplicate.matched.id,
          slug: duplicate.matched.slug,
          title: duplicate.matched.title,
          start_date: duplicate.matched.start_date,
          end_date: duplicate.matched.end_date,
          city: duplicate.matched.city,
          province: duplicate.matched.province,
          region: duplicate.matched.region,
          discipline: duplicate.matched.discipline,
          vehicle_type: duplicate.matched.vehicle_type,
          source_url: duplicate.matched.source_url,
          ticket_url: duplicate.matched.ticket_url,
          visible: duplicate.matched.visible,
          data_quality: duplicate.matched.data_quality,
        },
        null,
        2,
      ),
    );
  }

  if (duplicate) {
    console.log("No se importa nada porque ya existe un posible duplicado.");
    if (shouldImport && duplicate.reason === "slug") {
      const submissionResult = await updateSubmissionStatus(supabase);
      console.log("Solicitud:");
      console.log(JSON.stringify(submissionResult, null, 2));
    }
    return;
  }

  if (!shouldImport) {
    console.log("Dry-run completado. Ejecuta con --import para insertar y marcar la solicitud como published.");
    console.log(JSON.stringify(event, null, 2));
    return;
  }

  const backupPath = await writeBackup(rows);
  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert(event)
    .select("id,slug,title,source_url,ticket_url,visible,data_quality")
    .single();

  if (insertError) throw insertError;

  const submissionResult = await updateSubmissionStatus(supabase);

  console.log(`Backup creado: ${backupPath}`);
  console.log("Evento insertado:");
  console.log(JSON.stringify(inserted, null, 2));
  console.log("Solicitud:");
  console.log(JSON.stringify(submissionResult, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
