begin;

-- A16D: the Story row is the common lock and optimistic version fence.
-- No production content, buckets or objects are inserted by this migration.
create table public.story_publication_receipts (
  story_id uuid primary key references public.stories(id) on delete restrict,
  request_id uuid not null unique,
  expected_updated_at timestamptz not null,
  published_at timestamptz not null
);
alter table public.story_publication_receipts enable row level security;
revoke all on public.story_publication_receipts from public, anon, authenticated, service_role;
grant select on public.story_publication_receipts to service_role;

create function public.lock_editable_story(p_story_id uuid, p_expected_updated_at timestamptz)
returns public.stories language plpgsql security definer set search_path = ''
as $$
declare v_story public.stories;
begin
  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'story not found'; end if;
  if v_story.status not in ('DRAFT', 'READY') then
    raise exception using errcode = '55000', message = 'story is not editable';
  end if;
  if p_expected_updated_at is null or v_story.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'story version conflict';
  end if;
  return v_story;
end;
$$;

-- Strict monotonicity, also for multiple writes in the same transaction.
create or replace function public.set_stories_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.created_at is distinct from old.created_at then
    raise exception using errcode = '23514', message = 'created_at is immutable';
  end if;
  new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond', new.created_at);
  return new;
end;
$$;

create function public.story_children_transaction_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid; v_story public.stories;
begin
  v_id := case when tg_op = 'DELETE' then old.story_id else new.story_id end;
  if tg_op = 'UPDATE' and new.story_id is distinct from old.story_id then
    if tg_table_name = 'story_media' then
      raise exception using errcode = '23514', message = 'story media ownership is immutable';
    end if;
    raise exception using errcode = '23514', message = 'story child ownership is immutable';
  end if;
  -- Direct media UPDATE can own a child tuple first. NEVER wait for its
  -- parent in this inverted order: NOWAIT rejects/retries instead.
  -- RPC replacements already hold the parent, so this lock is reentrant.
  select * into v_story from public.stories where id = v_id for update nowait;
  if not found then
    if tg_op = 'DELETE' then return old; end if; -- parent DELETE CASCADE
    raise exception using errcode = '23503', message = 'story parent not found';
  end if;
  if v_story.status in ('PUBLISHED', 'ARCHIVED') and exists (
    select 1 from public.story_publication_receipts where story_id = v_id
  ) then
    raise exception using errcode = '55000', message = 'published story snapshot is immutable';
  end if;
  update public.stories set updated_at = updated_at where id = v_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger story_credits_05_transaction_guard before insert or update or delete on public.story_credits
for each row execute function public.story_children_transaction_guard();
create trigger story_events_05_transaction_guard before insert or update or delete on public.story_events
for each row execute function public.story_children_transaction_guard();
create trigger story_media_05_transaction_guard before insert or update or delete on public.story_media
for each row execute function public.story_children_transaction_guard();

create function public.story_publication_transaction_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.published_at is not null and exists (
    select 1 from public.story_publication_receipts where story_id = old.id
  ) and (pg_catalog.to_jsonb(new) - array['status', 'home_rank', 'updated_at'])
    is distinct from (pg_catalog.to_jsonb(old) - array['status', 'home_rank', 'updated_at']) then
    raise exception using errcode = '55000', message = 'published story snapshot is immutable';
  end if;
  -- No spoofable session GUC. Raw REST publication cannot bypass the RPC.
  if new.status = 'PUBLISHED' and old.status <> 'PUBLISHED' and current_user = 'service_role' then
    raise exception using errcode = '42501', message = 'publication requires publish_story RPC';
  end if;
  return new;
end;
$$;
create trigger stories_05_publication_transaction_guard before update on public.stories
for each row execute function public.story_publication_transaction_guard();

-- Retire nontransactional DELETE/INSERT HTTP batches, even for service_role.
revoke insert, update, delete on public.story_credits, public.story_events from service_role;

create function public.replace_story_credits(p_story_id uuid, p_expected_updated_at timestamptz, p_credits jsonb)
returns public.stories language plpgsql security definer set search_path = ''
as $$
declare v_story public.stories;
begin
  v_story := public.lock_editable_story(p_story_id, p_expected_updated_at);
  if p_credits is null or pg_catalog.jsonb_typeof(p_credits) <> 'array'
    or pg_catalog.jsonb_array_length(p_credits) > 100 then
    raise exception using errcode = '23514', message = 'invalid story credits';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_credits) c
    where pg_catalog.jsonb_typeof(c) <> 'object'
      or not (c ?& array['person_id', 'role', 'sort_order'])
      or (c - array['person_id', 'role', 'sort_order']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(c->'person_id') <> 'string'
      or pg_catalog.jsonb_typeof(c->'role') <> 'string'
      or pg_catalog.jsonb_typeof(c->'sort_order') <> 'number'
  ) then raise exception using errcode = '23514', message = 'invalid story credits'; end if;
  if exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_credits) as c(person_id uuid, role text, sort_order integer)
    group by person_id, role having count(*) > 1
  ) then raise exception using errcode = '23505', message = 'duplicate person and role'; end if;
  -- Parent first, then people in UUID order. No reverse person->Story lock.
  perform 1 from public.editorial_people p
    where p.id in (select c.person_id from pg_catalog.jsonb_to_recordset(p_credits) as c(person_id uuid))
    order by p.id for share;
  if exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_credits) as c(person_id uuid, role text, sort_order integer)
    left join public.editorial_people p on p.id = c.person_id
    where p.id is null or not p.active or c.person_id is null
      or c.role is null or c.role not in ('TEXT', 'PHOTO', 'VIDEO', 'CONTRIBUTOR')
      or c.sort_order is null or c.sort_order < 0
  ) then raise exception using errcode = '23514', message = 'invalid story credits'; end if;
  delete from public.story_credits where story_id = p_story_id;
  insert into public.story_credits(story_id, person_id, role, sort_order)
    select p_story_id, c.person_id, c.role, c.sort_order
    from pg_catalog.jsonb_to_recordset(p_credits) as c(person_id uuid, role text, sort_order integer);
  update public.stories set updated_at = updated_at where id = p_story_id returning * into v_story;
  return v_story;
end;
$$;

create function public.replace_story_events(p_story_id uuid, p_expected_updated_at timestamptz, p_relations jsonb)
returns public.stories language plpgsql security definer set search_path = ''
as $$
declare v_story public.stories;
begin
  v_story := public.lock_editable_story(p_story_id, p_expected_updated_at);
  if p_relations is null or pg_catalog.jsonb_typeof(p_relations) <> 'array'
    or pg_catalog.jsonb_array_length(p_relations) > 100 then
    raise exception using errcode = '23514', message = 'invalid story events';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_relations) r
    where pg_catalog.jsonb_typeof(r) <> 'object'
      or not (r ?& array['event_id', 'relation_type', 'sort_order'])
      or (r - array['event_id', 'relation_type', 'sort_order']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(r->'event_id') <> 'string'
      or pg_catalog.jsonb_typeof(r->'relation_type') <> 'string'
      or pg_catalog.jsonb_typeof(r->'sort_order') <> 'number'
  ) then raise exception using errcode = '23514', message = 'invalid story events'; end if;
  if exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_relations) as r(event_id text, relation_type text, sort_order integer)
    group by event_id having count(*) > 1
  ) then raise exception using errcode = '23505', message = 'duplicate story event'; end if;
  if (select count(*) from pg_catalog.jsonb_to_recordset(p_relations) as r(relation_type text)
      where relation_type = 'PRIMARY') > 1 then
    raise exception using errcode = '23514', message = 'multiple primary events';
  end if;
  perform 1 from public.events e
    where e.id in (select r.event_id from pg_catalog.jsonb_to_recordset(p_relations) as r(event_id text))
    order by e.id for key share;
  if exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_relations) as r(event_id text, relation_type text, sort_order integer)
    left join public.events e on e.id = r.event_id
    where e.id is null or r.event_id is null or pg_catalog.btrim(r.event_id) = ''
      or r.relation_type is null or r.relation_type not in ('PRIMARY', 'RELATED')
      or r.sort_order is null or r.sort_order < 0
  ) then raise exception using errcode = '23514', message = 'invalid story events'; end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_story.content_blocks) b
    where b->>'type' = 'EVENT_REFERENCE' and not exists (
      select 1 from pg_catalog.jsonb_to_recordset(p_relations) as r(event_id text)
      where r.event_id = b->>'eventId'
    )
  ) then raise exception using errcode = '23514', message = 'orphan body event reference'; end if;
  delete from public.story_events where story_id = p_story_id;
  insert into public.story_events(story_id, event_id, relation_type, sort_order)
    select p_story_id, r.event_id, r.relation_type, r.sort_order
    from pg_catalog.jsonb_to_recordset(p_relations) as r(event_id text, relation_type text, sort_order integer);
  update public.stories set updated_at = updated_at where id = p_story_id returning * into v_story;
  return v_story;
end;
$$;

create function public.publish_story(p_story_id uuid, p_expected_updated_at timestamptz, p_request_id uuid)
returns public.stories language plpgsql security definer set search_path = ''
as $$
declare
  v_story public.stories; v_receipt public.story_publication_receipts;
  v_media public.story_media; v_media_id uuid; v_ids uuid[]; v_published_at timestamptz;
begin
  if p_request_id is null or p_expected_updated_at is null then
    raise exception using errcode = '23514', message = 'publication request and version required';
  end if;
  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'story not found'; end if;
  select * into v_receipt from public.story_publication_receipts where story_id = p_story_id;
  if found then
    if v_receipt.request_id = p_request_id and v_receipt.expected_updated_at = p_expected_updated_at
      and v_story.status = 'PUBLISHED' and v_story.published_at = v_receipt.published_at then
      return v_story; -- exact retry, no new timestamp, version or receipt
    end if;
    raise exception using errcode = '40001', message = 'publication request conflict';
  end if;
  if v_story.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'story version conflict';
  end if;
  if v_story.status <> 'READY' or v_story.published_at is not null then
    raise exception using errcode = '55000', message = 'only READY stories can be published';
  end if;
  -- Existing lifecycle trigger still validates metadata, hero, ALT, rights
  -- and IMAGE/PAIR/GALLERY. Here also fence referenced rows and Storage.
  v_ids := array[v_story.hero_media_id];
  select v_ids || coalesce(array_agg(distinct ids.media_id), '{}'::uuid[]) into v_ids
  from (
    select (b->>'mediaId')::uuid as media_id
    from pg_catalog.jsonb_array_elements(v_story.content_blocks) b where b->>'type' = 'IMAGE'
    union
    select (m #>> '{}')::uuid
    from pg_catalog.jsonb_array_elements(v_story.content_blocks) b,
      lateral pg_catalog.jsonb_array_elements(b->'mediaIds') m
    where b->>'type' in ('IMAGE_PAIR', 'GALLERY')
  ) ids;
  -- Parent -> Storage catalog locks. No child media row lock is acquired.
  -- Storage catalog writers do not acquire a Story lock.
  perform 1 from storage.buckets
    where id in ('story-media', 'story-media-drafts') order by id for share;
  if not exists (select 1 from storage.buckets where id = 'story-media' and public)
    or not exists (select 1 from storage.buckets where id = 'story-media-drafts' and not public) then
    raise exception using errcode = '23514', message = 'story buckets are not safely configured';
  end if;
  foreach v_media_id in array v_ids loop
    select * into v_media from public.story_media where id = v_media_id and story_id = p_story_id;
    if not found or v_media.bucket_id <> 'story-media'
      or v_media.object_path <> (p_story_id::text || '/' || v_media_id::text || '/asset.' ||
        case v_media.mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else '' end)
      or greatest(v_media.width, v_media.height) > 2400
      or not exists (select 1 from storage.objects where bucket_id = 'story-media' and name = v_media.object_path) then
      raise exception using errcode = '23514', message = 'publication requires verified public media rows and objects';
    end if;
    perform 1 from storage.objects where bucket_id = 'story-media' and name = v_media.object_path for share;
    if not found then
      raise exception using errcode = '23514', message = 'publication public object disappeared';
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_story.content_blocks) b
    where b->>'type' = 'EVENT_REFERENCE' and not exists (
      select 1 from public.story_events r where r.story_id = p_story_id and r.event_id = b->>'eventId'
    )
  ) then raise exception using errcode = '23514', message = 'orphan body event reference'; end if;
  v_published_at := pg_catalog.clock_timestamp();
  insert into public.story_publication_receipts(story_id, request_id, expected_updated_at, published_at)
    values (p_story_id, p_request_id, p_expected_updated_at, v_published_at);
  update public.stories set status = 'PUBLISHED', published_at = v_published_at
    where id = p_story_id returning * into v_story;
  return v_story;
end;
$$;

revoke all on function public.lock_editable_story(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.story_children_transaction_guard() from public, anon, authenticated, service_role;
revoke all on function public.story_publication_transaction_guard() from public, anon, authenticated, service_role;
revoke all on function public.replace_story_credits(uuid, timestamptz, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.replace_story_events(uuid, timestamptz, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.publish_story(uuid, timestamptz, uuid) from public, anon, authenticated, service_role;
grant execute on function public.replace_story_credits(uuid, timestamptz, jsonb) to service_role;
grant execute on function public.replace_story_events(uuid, timestamptz, jsonb) to service_role;
grant execute on function public.publish_story(uuid, timestamptz, uuid) to service_role;

commit;
