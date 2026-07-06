create extension if not exists pgcrypto;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  country text,
  source_id uuid,
  query text,
  status text not null default 'created',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_found integer not null default 0,
  total_inserted integer not null default 0,
  total_duplicates integer not null default 0,
  total_errors integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_runs_status_check check (status in ('created', 'running', 'completed', 'failed', 'cancelled')),
  constraint agent_runs_run_type_check check (run_type in ('manual_import', 'url_extract', 'source_scan', 'dedupe_check', 'test'))
);

create table if not exists public.event_candidates (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  source_name text,
  source_url text not null,
  source_url_hash text,
  source_type text,
  source_country text,
  raw_title text,
  raw_text text,
  raw_payload jsonb,
  normalized_title text not null,
  slug_suggested text,
  description text,
  start_date date,
  end_date date,
  date_confidence numeric default 0,
  city text,
  province text,
  region text,
  country text not null default 'ES',
  location_name text,
  address text,
  location_confidence numeric default 0,
  category text,
  discipline text,
  vehicle_type text,
  organizer_name text,
  organizer_url text,
  contact_email text,
  contact_phone text,
  image_url text,
  price_text text,
  registration_url text,
  status text not null default 'pending_review',
  quality_score numeric default 0,
  duplicate_score numeric default 0,
  possible_duplicate_event_id uuid,
  duplicate_reason text,
  validation_errors jsonb not null default '[]'::jsonb,
  review_notes text,
  published_event_id uuid,
  reviewed_at timestamptz,
  reviewed_by text,
  created_by_agent text default 'eventomotor-agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_candidates_status_check check (status in ('pending_review', 'needs_info', 'approved', 'rejected', 'duplicate', 'published')),
  constraint event_candidates_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.event_candidate_checks (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.event_candidates(id) on delete cascade,
  check_type text not null,
  status text not null,
  message text,
  score numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint event_candidate_checks_status_check check (status in ('passed', 'warning', 'failed', 'skipped'))
);

create index if not exists agent_runs_status_idx on public.agent_runs (status);
create index if not exists agent_runs_created_at_idx on public.agent_runs (created_at desc);
create index if not exists event_candidates_source_url_hash_idx on public.event_candidates (source_url_hash);
create index if not exists event_candidates_source_url_idx on public.event_candidates (source_url);
create index if not exists event_candidates_status_idx on public.event_candidates (status);
create index if not exists event_candidates_start_date_idx on public.event_candidates (start_date);
create index if not exists event_candidates_country_idx on public.event_candidates (country);
create index if not exists event_candidates_city_idx on public.event_candidates (city);
create index if not exists event_candidates_normalized_title_idx on public.event_candidates (normalized_title);
create index if not exists event_candidates_created_at_idx on public.event_candidates (created_at desc);
create index if not exists event_candidate_checks_candidate_id_idx on public.event_candidate_checks (candidate_id);
create index if not exists event_candidate_checks_check_type_idx on public.event_candidate_checks (check_type);

create or replace function public.set_agent_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_agent_runs_updated_at on public.agent_runs;
create trigger set_agent_runs_updated_at
before update on public.agent_runs
for each row
execute function public.set_agent_runs_updated_at();

create or replace function public.set_event_candidates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_candidates_updated_at on public.event_candidates;
create trigger set_event_candidates_updated_at
before update on public.event_candidates
for each row
execute function public.set_event_candidates_updated_at();
