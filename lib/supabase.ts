import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getVehicleType } from "@/lib/event-classification";
import { createEventSlug } from "@/lib/slug";
import { resolveFeaturedStatus } from "@/lib/temporary-featured-events";
import type {
  AgentRun,
  AgentRunInput,
  EventCandidate,
  EventCandidateCheck,
  EventCandidateCheckInsert,
  EventCandidateInput,
} from "@/lib/event-candidates/types";
import type { EventDataQuality, EventItem } from "@/types/event";

export type EventRow = {
  id: string;
  slug: string | null;
  title: string;
  championship: string | null;
  discipline: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  country?: string | null;
  level: string | null;
  source: string | null;
  source_url: string | null;
  ticket_url: string | null;
  official_url?: string | null;
  registration_url?: string | null;
  image_url?: string | null;
  image_source_url?: string | null;
  event_status?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  schedule_text?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  organizer_name?: string | null;
  organizer_url?: string | null;
  verified_at?: string | null;
  source_type?: string | null;
  confidence_score?: number | null;
  needs_review?: boolean | null;
  tags: string[] | null;
  vehicle_type: string | null;
  featured: boolean | null;
  visible: boolean | null;
  import_method: string | null;
  data_quality: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventUpsert = {
  id: string;
  slug?: string | null;
  title: string;
  championship?: string | null;
  discipline?: string | null;
  start_date: string;
  end_date?: string | null;
  venue?: string | null;
  city?: string | null;
  province?: string | null;
  region?: string | null;
  country?: string | null;
  level?: string | null;
  source?: string | null;
  source_url?: string | null;
  ticket_url?: string | null;
  official_url?: string | null;
  registration_url?: string | null;
  image_url?: string | null;
  image_source_url?: string | null;
  event_status?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  schedule_text?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  organizer_name?: string | null;
  organizer_url?: string | null;
  verified_at?: string | null;
  source_type?: string | null;
  confidence_score?: number | null;
  needs_review?: boolean | null;
  tags?: string[] | null;
  vehicle_type?: string | null;
  featured?: boolean | null;
  visible?: boolean | null;
  import_method?: string | null;
  data_quality?: string | null;
  notes?: string | null;
  source_id?: string | null;
  updated_at?: string;
};

export type EventSubmissionRow = {
  id: string;
  event_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  province: string | null;
  venue: string | null;
  discipline: string | null;
  vehicle_type: string | null;
  source_url: string;
  ticket_url: string | null;
  description: string | null;
  organizer_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  poster_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EventSubmissionInsert = {
  event_name: string;
  start_date?: string | null;
  end_date?: string | null;
  city?: string | null;
  province?: string | null;
  venue?: string | null;
  discipline?: string | null;
  vehicle_type?: string | null;
  source_url: string;
  ticket_url?: string | null;
  description?: string | null;
  organizer_name?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  poster_url?: string | null;
  status?: string;
};

type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRow;
        Insert: EventUpsert;
        Update: Partial<EventUpsert>;
        Relationships: [];
      };
      event_submissions: {
        Row: EventSubmissionRow;
        Insert: EventSubmissionInsert;
        Update: Partial<EventSubmissionInsert>;
        Relationships: [];
      };
      agent_runs: {
        Row: AgentRun;
        Insert: AgentRunInput;
        Update: Partial<AgentRun>;
        Relationships: [];
      };
      event_candidates: {
        Row: EventCandidate;
        Insert: EventCandidateInput;
        Update: Partial<EventCandidate>;
        Relationships: [];
      };
      event_candidate_checks: {
        Row: EventCandidateCheck;
        Insert: EventCandidateCheckInsert;
        Update: Partial<EventCandidateCheck>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
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
  const vehicleType = getVehicleType({
    title: row.title,
    championship: row.championship || undefined,
    discipline: row.discipline || undefined,
    tags: row.tags || undefined,
    source: row.source || undefined,
    vehicle_type: row.vehicle_type,
  });

  const sourceUrl = row.source_url || "";
  const ticketUrl = row.ticket_url || "";
  const dataQuality: EventDataQuality =
    row.data_quality === "needs_review" ||
    row.data_quality === "draft" ||
    row.data_quality === "reviewed" ||
    row.data_quality === "published" ||
    row.data_quality === "cancelled" ||
    row.data_quality === "pending_date"
      ? row.data_quality
      : "reviewed";

  // Event v2 fields are optional until the manual Supabase migration is applied.
  return {
    id: row.id,
    slug: row.slug || createEventSlug(row.title, row.start_date),
    title: row.title,
    championship: row.championship || row.discipline || "Motociclismo",
    discipline: row.discipline || "Motociclismo",
    start: row.start_date,
    end: row.end_date || row.start_date,
    venue: row.venue || "Por confirmar",
    city: row.city || "Por confirmar",
    province: row.province || "Por confirmar",
    region: row.region || row.province || "Por confirmar",
    country: row.country || "ES",
    level: row.level || "Publicado",
    source: row.source || "Supabase",
    sourceUrl,
    officialUrl: row.official_url || sourceUrl,
    ticketUrl,
    registrationUrl: row.registration_url || "",
    imageUrl: row.image_url || "",
    image_url: row.image_url || "",
    imageSourceUrl: row.image_source_url || "",
    eventStatus: row.event_status || "",
    shortDescription: row.short_description || "",
    longDescription: row.long_description || "",
    scheduleText: row.schedule_text || "",
    address: row.address || "",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    organizerName: row.organizer_name || "",
    organizerUrl: row.organizer_url || "",
    verifiedAt: row.verified_at || "",
    sourceType: row.source_type || "",
    confidenceScore: row.confidence_score ?? null,
    needsReview: row.needs_review ?? row.data_quality === "needs_review",
    tags: row.tags?.length ? row.tags : [row.discipline || "Motociclismo"],
    vehicleType,
    vehicle_type: vehicleType,
    featured: resolveFeaturedStatus(row.slug, row.featured),
    visible: row.visible !== false,
    importMethod: row.import_method || "",
    dataQuality,
    notes: row.notes || "",
  };
}
