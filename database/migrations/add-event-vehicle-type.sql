alter table if exists public.events
add column if not exists vehicle_type text;
