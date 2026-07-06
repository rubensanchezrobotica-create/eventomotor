export const EVENT_CANDIDATE_STATUSES = [
  "pending_review",
  "needs_info",
  "approved",
  "rejected",
  "duplicate",
  "published",
] as const;

export const AGENT_RUN_STATUSES = ["created", "running", "completed", "failed", "cancelled"] as const;

export const AGENT_RUN_TYPES = ["manual_import", "url_extract", "source_scan", "dedupe_check", "test"] as const;

export const EVENT_CANDIDATE_CHECK_STATUSES = ["passed", "warning", "failed", "skipped"] as const;

export type EventCandidateStatus = (typeof EVENT_CANDIDATE_STATUSES)[number];
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];
export type AgentRunType = (typeof AGENT_RUN_TYPES)[number];
export type EventCandidateCheckStatus = (typeof EVENT_CANDIDATE_CHECK_STATUSES)[number];

export type JsonObject = Record<string, unknown>;

export type AgentRun = {
  id: string;
  run_type: AgentRunType;
  country: string | null;
  source_id: string | null;
  query: string | null;
  status: AgentRunStatus;
  started_at: string;
  finished_at: string | null;
  total_found: number;
  total_inserted: number;
  total_duplicates: number;
  total_errors: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRunInput = {
  run_type: AgentRunType;
  country?: string | null;
  source_id?: string | null;
  query?: string | null;
  status?: AgentRunStatus;
  started_at?: string;
  finished_at?: string | null;
  total_found?: number;
  total_inserted?: number;
  total_duplicates?: number;
  total_errors?: number;
  notes?: string | null;
};

export type EventCandidate = {
  id: string;
  agent_run_id: string | null;
  source_name: string | null;
  source_url: string;
  source_url_hash: string | null;
  source_type: string | null;
  source_country: string | null;
  raw_title: string | null;
  raw_text: string | null;
  raw_payload: JsonObject | null;
  normalized_title: string;
  slug_suggested: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  date_confidence: number | null;
  city: string | null;
  province: string | null;
  region: string | null;
  country: string;
  location_name: string | null;
  address: string | null;
  location_confidence: number | null;
  category: string | null;
  discipline: string | null;
  vehicle_type: string | null;
  organizer_name: string | null;
  organizer_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  image_url: string | null;
  price_text: string | null;
  registration_url: string | null;
  status: EventCandidateStatus;
  quality_score: number | null;
  duplicate_score: number | null;
  possible_duplicate_event_id: string | null;
  duplicate_reason: string | null;
  validation_errors: unknown[];
  review_notes: string | null;
  published_event_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_by_agent: string | null;
  created_at: string;
  updated_at: string;
};

export type EventCandidateInput = {
  agent_run_id?: string | null;
  source_name?: string | null;
  source_url: string;
  source_url_hash?: string | null;
  source_type?: string | null;
  source_country?: string | null;
  raw_title?: string | null;
  raw_text?: string | null;
  raw_payload?: JsonObject | null;
  normalized_title: string;
  slug_suggested?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  date_confidence?: number | null;
  city?: string | null;
  province?: string | null;
  region?: string | null;
  country: string;
  location_name?: string | null;
  address?: string | null;
  location_confidence?: number | null;
  category?: string | null;
  discipline?: string | null;
  vehicle_type?: string | null;
  organizer_name?: string | null;
  organizer_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  image_url?: string | null;
  price_text?: string | null;
  registration_url?: string | null;
  status?: EventCandidateStatus;
  quality_score?: number | null;
  duplicate_score?: number | null;
  possible_duplicate_event_id?: string | null;
  duplicate_reason?: string | null;
  validation_errors?: unknown[];
  review_notes?: string | null;
  published_event_id?: string | null;
  reviewed_by?: string | null;
  created_by_agent?: string | null;
};

export type EventCandidateCheck = {
  id: string;
  candidate_id: string;
  check_type: string;
  status: EventCandidateCheckStatus;
  message: string | null;
  score: number | null;
  metadata: JsonObject;
  created_at: string;
};

export type EventCandidateCheckInput = {
  check_type: string;
  status: EventCandidateCheckStatus;
  message?: string | null;
  score?: number | null;
  metadata?: JsonObject;
};

export type EventCandidateCheckInsert = EventCandidateCheckInput & {
  candidate_id: string;
};

export type EventCandidateFilters = {
  status?: EventCandidateStatus | "all";
  country?: string;
  q?: string;
  limit?: number;
};
