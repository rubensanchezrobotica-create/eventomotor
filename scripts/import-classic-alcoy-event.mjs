import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const IMAGE_PATH = path.join(process.cwd(), "public", "event-images", "xiv-concentracion-classic-alcoy-2026.png");
const IMAGE_URL = "/event-images/xiv-concentracion-classic-alcoy-2026.png";
const SLUG = "xiv-concentracion-automoviles-motocicletas-clasicas-alcoy-2026-06-21";

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
  const backupPath = path.join(BACKUP_DIR, `events-backup-before-classic-alcoy-${formatTimestamp(new Date())}.json`);
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

function sameTitleDateVenue(event, row) {
  return (
    normalize(event.title) === normalize(row.title) &&
    event.start_date === row.start_date &&
    normalize(event.venue) === normalize(row.venue)
  );
}

const event = {
  id: `manual-${SLUG}`,
  slug: SLUG,
  title: "XIV Concentración de Automóviles y Motocicletas Clásicas",
  championship: "Club Motor Classic Alcoy",
  discipline: "Clásicos",
  start_date: "2026-06-21",
  end_date: "2026-06-21",
  venue: "Parque de la Glorieta, Plaça Ramon y Cajal, s/n, 03801 Alcoy, Alicante",
  city: "Alcoy / Alcoi",
  province: "Alicante",
  region: "Comunidad Valenciana",
  level: "Publicado",
  source: "Club Motor Classic Alcoy / cartel oficial",
  source_url: "http://bit.ly/3Qz0n7Z",
  ticket_url: "http://bit.ly/3Qz0n7Z",
  tags: [
    "clásicos",
    "concentración",
    "concentraciones",
    "coches clásicos",
    "motos clásicas",
    "Alicante",
    "Comunidad Valenciana",
    "Alcoy",
  ],
  vehicle_type: "mixto",
  featured: false,
  visible: true,
  import_method: "manual-classic-alcoy-2026",
  data_quality: "reviewed",
  notes: [
    "Descripción: El Club Motor Classic Alcoy organiza la XIV Concentración Anual de Automóviles y Motocicletas Clásicas en el Parque de la Glorieta de Alcoy. Una jornada dedicada a los vehículos de época con recepción, almuerzo, salida urbana, entrega de premios y aperitivo.",
    "Programa: 09:00 h - Recepción y estacionamiento; 10:00 h - Almuerzo; 12:30 h - Salida urbana con vehículos; 13:30 h - Entrega de premios y aperitivo.",
    "Precio: 10 € por persona. Incluye almuerzo, bebida, aperitivo y obsequio. Gratuita para socios al corriente de cuota.",
    "Fecha límite de inscripción: 19 de junio de 2026.",
    "Contacto: alcoymotorclassic@gmail.com.",
    "Redes: Instagram: alcoymotorclassic; Facebook: Club Motor Classic Alcoi.",
  ].join("\n"),
};

async function main() {
  const shouldImport = process.argv.includes("--import");
  const shouldUpdate = process.argv.includes("--update");
  const supabase = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await access(IMAGE_PATH);

  const { data: currentEvents, error } = await supabase.from("events").select("*");
  if (error) throw error;

  const rows = currentEvents || [];
  const duplicateBySlug = rows.find((row) => row.slug === event.slug);
  const duplicateByTitleDateVenue = rows.find((row) => sameTitleDateVenue(event, row));

  console.log("Importación manual: XIV Concentración Classic Alcoy 2026");
  console.log(`- imagen encontrada: ${IMAGE_URL}`);
  console.log("- imagen asociada en lib/event-images.ts por slug");
  console.log(`- eventos actuales en Supabase: ${rows.length}`);
  console.log(`- duplicado por slug: ${duplicateBySlug ? duplicateBySlug.title : "no"}`);
  console.log(`- duplicado por title + fecha + venue: ${duplicateByTitleDateVenue ? duplicateByTitleDateVenue.slug : "no"}`);

  if (shouldUpdate) {
    if (!duplicateBySlug) {
      console.log("No se actualiza nada porque no existe el evento por slug.");
      return;
    }

    const backupPath = await writeBackup(rows);
    const { id: _id, ...eventUpdate } = event;
    const { data: updated, error: updateError } = await supabase
      .from("events")
      .update(eventUpdate)
      .eq("slug", SLUG)
      .select("id, slug, title, discipline, vehicle_type, ticket_url")
      .single();

    if (updateError) throw updateError;

    console.log(`Backup creado: ${backupPath}`);
    console.log("Evento actualizado:");
    console.log(JSON.stringify(updated, null, 2));
    return;
  }

  if (duplicateBySlug || duplicateByTitleDateVenue) {
    console.log("No se importa nada porque ya existe un posible duplicado.");
    return;
  }

  if (!shouldImport) {
    console.log("Dry-run completado. Ejecuta con --import para insertar.");
    console.log(JSON.stringify(event, null, 2));
    return;
  }

  const backupPath = await writeBackup(rows);
  const { data: inserted, error: insertError } = await supabase.from("events").insert(event).select("id, slug").single();

  if (insertError) throw insertError;

  console.log(`Backup creado: ${backupPath}`);
  console.log(`Evento insertado: ${inserted.slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
