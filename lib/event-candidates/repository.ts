import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  EVENT_CANDIDATE_STATUSES,
  type AgentRun,
  type AgentRunInput,
  type EventCandidate,
  type EventCandidateCheck,
  type EventCandidateCheckInput,
  type EventCandidateFilters,
  type EventCandidateInput,
  type EventCandidateStatus,
} from "@/lib/event-candidates/types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const REVIEWED_STATUSES = new Set<EventCandidateStatus>(["approved", "rejected", "duplicate", "needs_info"]);

function requireSupabase() {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return supabase;
}

function clampLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function textOrNull(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function sourceUrlHash(sourceUrl: string) {
  return createHash("sha256").update(sourceUrl.trim().toLowerCase()).digest("hex");
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

export function isEventCandidateStatus(value: string): value is EventCandidateStatus {
  return EVENT_CANDIDATE_STATUSES.includes(value as EventCandidateStatus);
}

export async function listEventCandidates(filters: EventCandidateFilters = {}) {
  const supabase = requireSupabase();
  const limit = clampLimit(filters.limit);
  let query = supabase
    .from("event_candidates")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.country?.trim()) {
    query = query.eq("country", filters.country.trim().toUpperCase());
  }

  if (filters.q?.trim()) {
    const value = escapeLike(filters.q.trim());
    query = query.or(
      `normalized_title.ilike.%${value}%,source_url.ilike.%${value}%,city.ilike.%${value}%,province.ilike.%${value}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EventCandidate[];
}

export async function getEventCandidateById(id: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("event_candidates").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as EventCandidate | null;
}

export async function createEventCandidate(input: EventCandidateInput) {
  const supabase = requireSupabase();
  const sourceUrl = input.source_url.trim();
  const payload = {
    ...input,
    source_url: sourceUrl,
    source_url_hash: input.source_url_hash || sourceUrlHash(sourceUrl),
    normalized_title: input.normalized_title.trim(),
    country: input.country.trim().toUpperCase(),
    source_name: textOrNull(input.source_name),
    source_type: textOrNull(input.source_type),
    source_country: textOrNull(input.source_country)?.toUpperCase() || null,
    raw_title: textOrNull(input.raw_title),
    raw_text: textOrNull(input.raw_text),
    slug_suggested: textOrNull(input.slug_suggested),
    description: textOrNull(input.description),
    city: textOrNull(input.city),
    province: textOrNull(input.province),
    region: textOrNull(input.region),
    location_name: textOrNull(input.location_name),
    address: textOrNull(input.address),
    category: textOrNull(input.category),
    discipline: textOrNull(input.discipline),
    vehicle_type: textOrNull(input.vehicle_type),
    organizer_name: textOrNull(input.organizer_name),
    organizer_url: textOrNull(input.organizer_url),
    contact_email: textOrNull(input.contact_email),
    contact_phone: textOrNull(input.contact_phone),
    image_url: textOrNull(input.image_url),
    price_text: textOrNull(input.price_text),
    registration_url: textOrNull(input.registration_url),
    duplicate_reason: textOrNull(input.duplicate_reason),
    review_notes: textOrNull(input.review_notes),
    created_by_agent: textOrNull(input.created_by_agent) || "eventomotor-agent",
  };
  const { data, error } = await supabase.from("event_candidates").insert(payload).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  return data as EventCandidate;
}

export async function updateEventCandidateStatus(
  id: string,
  status: EventCandidateStatus,
  reviewNotes?: string | null,
) {
  const supabase = requireSupabase();
  const update = {
    status,
    review_notes: reviewNotes === undefined ? undefined : textOrNull(reviewNotes),
    reviewed_at: REVIEWED_STATUSES.has(status) ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from("event_candidates")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as EventCandidate;
}

export async function addEventCandidateCheck(candidateId: string, check: EventCandidateCheckInput) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("event_candidate_checks")
    .insert({
      candidate_id: candidateId,
      check_type: check.check_type,
      status: check.status,
      message: textOrNull(check.message),
      score: check.score ?? null,
      metadata: check.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as EventCandidateCheck;
}

export async function createAgentRun(input: AgentRunInput) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      run_type: input.run_type,
      country: textOrNull(input.country)?.toUpperCase() || null,
      source_id: input.source_id ?? null,
      query: textOrNull(input.query),
      status: input.status ?? "created",
      started_at: input.started_at,
      finished_at: input.finished_at,
      total_found: input.total_found ?? 0,
      total_inserted: input.total_inserted ?? 0,
      total_duplicates: input.total_duplicates ?? 0,
      total_errors: input.total_errors ?? 0,
      notes: textOrNull(input.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AgentRun;
}
