alter table if exists public.events
  add column if not exists visible boolean not null default true,
  add column if not exists import_method text,
  add column if not exists data_quality text not null default 'reviewed',
  add column if not exists notes text;
