import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { FALLBACK_EVENTS } from "../lib/fallback-events";
import type { EventItem } from "../types/event";

type EventInsert = {
  id: string;
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
  updated_at: string;
};

loadEnvConfig(process.cwd());

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function toEventInsert(event: EventItem, updatedAt: string): EventInsert {
  return {
    id: event.id,
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
    featured: event.featured,
    updated_at: updatedAt,
  };
}

async function main() {
  console.log(`Eventos leidos: ${FALLBACK_EVENTS.length}`);

  if (!FALLBACK_EVENTS.length) {
    console.log("No hay eventos para insertar o actualizar.");
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
  const rows = FALLBACK_EVENTS.map((event) => toEventInsert(event, updatedAt));
  const { data, error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (error) {
    console.error("Error al sembrar eventos en Supabase:");
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

  console.error(`Seed de eventos fallido: ${message}`);
  process.exitCode = 1;
});
