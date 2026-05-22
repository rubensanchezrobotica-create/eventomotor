create extension if not exists pgcrypto;

create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  start_date date,
  end_date date,
  city text,
  province text,
  venue text,
  discipline text,
  vehicle_type text,
  source_url text not null,
  ticket_url text,
  description text,
  organizer_name text,
  contact_email text not null,
  contact_phone text,
  poster_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_submissions_status_check check (status in ('pending', 'reviewed', 'rejected', 'imported', 'spam')),
  constraint event_submissions_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists event_submissions_status_idx on public.event_submissions (status);
create index if not exists event_submissions_created_at_idx on public.event_submissions (created_at desc);
create index if not exists event_submissions_contact_email_idx on public.event_submissions (contact_email);

create or replace function public.set_event_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_submissions_updated_at on public.event_submissions;
create trigger set_event_submissions_updated_at
before update on public.event_submissions
for each row
execute function public.set_event_submissions_updated_at();

alter table public.event_submissions enable row level security;
