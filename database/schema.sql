create table if not exists public.event_sources (
  id text primary key,
  name text not null,
  url text not null,
  type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  title text not null,
  championship text,
  discipline text,
  start_date date not null,
  end_date date,
  venue text,
  city text,
  province text,
  region text,
  level text,
  source text,
  source_url text,
  ticket_url text,
  tags text[] not null default '{}',
  featured boolean not null default false,
  source_id text references public.event_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_start_date_idx on public.events (start_date);
create index if not exists events_region_idx on public.events (region);
create index if not exists events_discipline_idx on public.events (discipline);
create index if not exists events_source_id_idx on public.events (source_id);
