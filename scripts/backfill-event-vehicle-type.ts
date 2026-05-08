import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getVehicleType, VEHICLE_TYPE_OPTIONS, type VehicleType } from "../lib/event-classification";

type ExistingEvent = {
  id: string;
  title: string;
  championship: string | null;
  discipline: string | null;
  source: string | null;
  tags: string[] | null;
  vehicle_type: string | null;
};

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");

loadEnvConfig(process.cwd());

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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

async function writeBackup(events: ExistingEvent[]) {
  await mkdir(BACKUP_DIR, { recursive: true });

  const backupPath = path.join(BACKUP_DIR, `events-backup-before-vehicle-type-${formatTimestamp(new Date())}.json`);
  const backupContent = JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      source: "public.events",
      reason: "backup before non-destructive vehicle_type backfill",
      count: events.length,
      events,
    },
    null,
    2,
  );

  await writeFile(backupPath, `${backupContent}\n`, "utf8");

  return backupPath;
}

async function main() {
  console.log("Backfill seguro de public.events.vehicle_type");
  console.log("Solo actualiza vehicle_type. No borra eventos ni modifica otros campos.\n");

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("events")
    .select("id,title,championship,discipline,source,tags,vehicle_type");

  if (error) {
    throw new Error(`No se pudieron leer los eventos actuales: ${error.message}`);
  }

  const events = (data ?? []) as ExistingEvent[];
  const backupPath = await writeBackup(events);
  const summary: Record<VehicleType, number> = {
    moto: 0,
    coche: 0,
    mixto: 0,
    karting: 0,
    otros: 0,
  };
  const errors: Array<{ id: string; message: string }> = [];
  const examples: Record<"mixto" | "otros", ExistingEvent[]> = {
    mixto: [],
    otros: [],
  };
  let updatedCount = 0;

  console.log(`Eventos leidos: ${events.length}`);
  console.log(`Backup local creado: ${backupPath}\n`);

  for (const event of events) {
    const vehicleType = getVehicleType({
      title: event.title,
      championship: event.championship,
      discipline: event.discipline,
      source: event.source,
      tags: event.tags,
    });

    summary[vehicleType] += 1;

    if ((vehicleType === "mixto" || vehicleType === "otros") && examples[vehicleType].length < 10) {
      examples[vehicleType].push(event);
    }

    const { error: updateError } = await supabase
      .from("events")
      .update({ vehicle_type: vehicleType })
      .eq("id", event.id);

    if (updateError) {
      errors.push({ id: event.id, message: updateError.message });
    } else {
      updatedCount += 1;
    }
  }

  console.log("Resumen final:");
  console.log(`- total eventos: ${events.length}`);
  console.log(`- filas recalculadas: ${updatedCount}`);

  for (const option of VEHICLE_TYPE_OPTIONS) {
    console.log(`- ${option}: ${summary[option]}`);
  }

  console.log(`- errores: ${errors.length}`);
  console.log("\nEjemplos mixtos:");
  if (examples.mixto.length) {
    for (const event of examples.mixto) {
      console.log(`- ${event.id} | ${event.title} | source=${event.source || ""} | tags=${event.tags?.join(", ") || ""}`);
    }
  } else {
    console.log("- ninguno");
  }

  console.log("\nEjemplos otros:");
  if (examples.otros.length) {
    for (const event of examples.otros) {
      console.log(`- ${event.id} | ${event.title} | source=${event.source || ""} | tags=${event.tags?.join(", ") || ""}`);
    }
  } else {
    console.log("- ninguno");
  }

  if (errors.length) {
    console.log("\nErrores:");
    for (const item of errors) {
      console.log(`- ${item.id}: ${item.message}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error("\nBackfill de vehicle_type fallido:");
  console.error(message);
  process.exitCode = 1;
});
