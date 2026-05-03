alter table if exists public.events
  add column if not exists slug text;

update public.events
set slug = lower(
  trim(
    both '-' from regexp_replace(title || '-' || start_date::text, '[^a-zA-Z0-9]+', '-', 'g')
  )
)
where slug is null;

create unique index if not exists events_slug_key on public.events (slug);
