import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EventItem } from "@/types/event";

export type EventRow = {
  id: string;
  title: string;
  championship: string | null;
  discipline: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  level: string | null;
  source: string | null;
  source_url: string | null;
  ticket_url: string | null;
  tags: string[] | null;
  featured: boolean | null;
  created_at: string;
  updated_at: string;
};

type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRow;
      };
    };
  };
};

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseServerClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function mapEventRowToEventItem(row: EventRow): EventItem {
  return {
    id: row.id,
    title: row.title,
    championship: row.championship || row.discipline || "Motociclismo",
    discipline: row.discipline || "Motociclismo",
    start: row.start_date,
    end: row.end_date || row.start_date,
    venue: row.venue || "Por confirmar",
    city: row.city || "Por confirmar",
    province: row.province || "Por confirmar",
    region: row.region || row.province || "Por confirmar",
    level: row.level || "Publicado",
    source: row.source || "Supabase",
    sourceUrl: row.source_url || "",
    ticketUrl: row.ticket_url || "",
    tags: row.tags?.length ? row.tags : [row.discipline || "Motociclismo"],
    featured: Boolean(row.featured),
  };
}
