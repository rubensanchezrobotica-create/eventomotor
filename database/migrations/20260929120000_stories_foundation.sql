begin;

create table public.stories (
  id uuid default gen_random_uuid() not null,
  slug text default ''::text not null,
  status text default 'DRAFT'::text not null,
  type text not null,
  collection text not null,
  title text default ''::text not null,
  dek text default ''::text not null,
  context_location text,
  content_blocks jsonb default '[]'::jsonb not null,
  schema_version integer default 1 not null,
  hero_media_id uuid,
  seo_title text default ''::text not null,
  seo_description text default ''::text not null,
  discipline_slugs text[] default '{}'::text[] not null,
  territory_ids text[] default '{}'::text[] not null,
  published_at timestamp with time zone,
  home_rank smallint,
  created_at timestamp with time zone default pg_catalog.clock_timestamp() not null,
  updated_at timestamp with time zone default pg_catalog.clock_timestamp() not null,
  constraint stories_pkey primary key (id),
  constraint stories_slug_check check (
    pg_catalog.char_length(slug) <= 180
    and (slug = '' or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
  ),
  constraint stories_status_check check (
    status = any (array['DRAFT'::text, 'READY'::text, 'PUBLISHED'::text, 'ARCHIVED'::text])
  ),
  constraint stories_type_check check (
    type = any (array['CRONICA'::text, 'REPORTAJE'::text, 'HISTORIA'::text, 'ENTREVISTA'::text])
  ),
  constraint stories_collection_check check (
    collection = any (array['DESDE_DENTRO'::text, 'HISTORIAS_DE_MOTOR'::text, 'CONVERSACIONES'::text])
  ),
  constraint stories_title_check check (pg_catalog.char_length(title) <= 240),
  constraint stories_dek_check check (pg_catalog.char_length(dek) <= 1000),
  constraint stories_context_location_check check (
    context_location is null or pg_catalog.char_length(context_location) <= 240
  ),
  constraint stories_content_blocks_check check (pg_catalog.jsonb_typeof(content_blocks) = 'array'),
  constraint stories_schema_version_check check (schema_version = 1),
  constraint stories_seo_title_check check (pg_catalog.char_length(seo_title) <= 240),
  constraint stories_seo_description_check check (pg_catalog.char_length(seo_description) <= 600),
  constraint stories_discipline_slugs_check check (pg_catalog.cardinality(discipline_slugs) <= 32),
  constraint stories_territory_ids_check check (pg_catalog.cardinality(territory_ids) <= 32),
  constraint stories_published_at_check check (
    (status in ('DRAFT', 'READY') and published_at is null)
    or (status in ('PUBLISHED', 'ARCHIVED') and published_at is not null)
  ),
  constraint stories_home_rank_check check (
    home_rank is null or (status = 'PUBLISHED' and home_rank between 1 and 3)
  ),
  constraint stories_timestamps_check check (
    updated_at >= created_at
    and (published_at is null or published_at >= created_at)
  )
);

create table public.story_media (
  id uuid default gen_random_uuid() not null,
  story_id uuid not null,
  bucket_id text not null,
  object_path text not null,
  width integer not null,
  height integer not null,
  mime_type text not null,
  byte_size bigint not null,
  alt_text text default ''::text not null,
  caption text,
  credit text,
  rights_type text default 'UNKNOWN'::text not null,
  rights_notes text,
  created_at timestamp with time zone default pg_catalog.clock_timestamp() not null,
  updated_at timestamp with time zone default pg_catalog.clock_timestamp() not null,
  constraint story_media_pkey primary key (id),
  constraint story_media_story_id_fkey foreign key (story_id)
    references public.stories(id) on delete cascade,
  constraint story_media_bucket_id_check check (
    bucket_id = pg_catalog.btrim(bucket_id) and bucket_id <> ''
  ),
  constraint story_media_object_path_check check (
    object_path = pg_catalog.btrim(object_path)
    and object_path <> ''
    and pg_catalog.char_length(object_path) <= 1024
  ),
  constraint story_media_dimensions_check check (width > 0 and height > 0),
  constraint story_media_mime_type_check check (
    mime_type = any (array['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])
  ),
  constraint story_media_byte_size_check check (byte_size > 0),
  constraint story_media_rights_type_check check (
    rights_type = any (
      array[
        'OWN'::text,
        'EVENTOMOTOR_COLLABORATOR'::text,
        'PRESS_PROVIDED'::text,
        'LICENSED'::text,
        'PUBLIC_DOMAIN'::text,
        'UNKNOWN'::text
      ]
    )
  ),
  constraint story_media_timestamps_check check (updated_at >= created_at),
  constraint story_media_bucket_object_key unique (bucket_id, object_path)
);

alter table public.stories
  add constraint stories_hero_media_id_fkey
  foreign key (hero_media_id)
  references public.story_media(id)
  on delete set null;

create table public.editorial_people (
  id uuid default gen_random_uuid() not null,
  display_name text not null,
  active boolean default true not null,
  created_at timestamp with time zone default pg_catalog.clock_timestamp() not null,
  updated_at timestamp with time zone default pg_catalog.clock_timestamp() not null,
  constraint editorial_people_pkey primary key (id),
  constraint editorial_people_display_name_check check (
    display_name = pg_catalog.btrim(display_name) and display_name <> ''
  ),
  constraint editorial_people_timestamps_check check (updated_at >= created_at)
);

create table public.story_credits (
  story_id uuid not null,
  person_id uuid not null,
  role text not null,
  sort_order integer default 0 not null,
  constraint story_credits_pkey primary key (story_id, person_id, role),
  constraint story_credits_story_id_fkey foreign key (story_id)
    references public.stories(id) on delete cascade,
  constraint story_credits_person_id_fkey foreign key (person_id)
    references public.editorial_people(id) on delete restrict,
  constraint story_credits_role_check check (
    role = any (array['TEXT'::text, 'PHOTO'::text, 'VIDEO'::text, 'CONTRIBUTOR'::text])
  ),
  constraint story_credits_sort_order_check check (sort_order >= 0)
);

create table public.story_events (
  story_id uuid not null,
  event_id text not null,
  relation_type text not null,
  sort_order integer default 0 not null,
  constraint story_events_pkey primary key (story_id, event_id),
  constraint story_events_story_id_fkey foreign key (story_id)
    references public.stories(id) on delete cascade,
  constraint story_events_event_id_fkey foreign key (event_id)
    references public.events(id) on delete restrict,
  constraint story_events_relation_type_check check (
    relation_type = any (array['PRIMARY'::text, 'RELATED'::text])
  ),
  constraint story_events_sort_order_check check (sort_order >= 0)
);

create unique index stories_slug_key
  on public.stories (slug)
  where slug <> '';

create index stories_published_at_idx
  on public.stories (published_at desc)
  where status = 'PUBLISHED';

create unique index stories_home_rank_key
  on public.stories (home_rank)
  where home_rank is not null;

create index story_media_story_idx
  on public.story_media (story_id);

create index story_credits_story_sort_idx
  on public.story_credits (story_id, sort_order, person_id);

create unique index story_events_one_primary_key
  on public.story_events (story_id)
  where relation_type = 'PRIMARY';

create index story_events_event_idx
  on public.story_events (event_id);

create function public.set_stories_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      message = 'created_at is immutable';
  end if;

  new.updated_at := greatest(
    pg_catalog.clock_timestamp(),
    old.updated_at,
    new.created_at
  );

  return new;
end;
$$;

create function public.stories_lifecycle_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  block_value jsonb;
  media_value jsonb;
  media_id_text text;
  parsed_media_id uuid;
  hero public.story_media%rowtype;
begin
  if tg_op = 'DELETE' then
    if old.status in ('PUBLISHED', 'ARCHIVED') then
      raise exception using
        errcode = '23514',
        message = 'published or archived stories cannot be deleted';
    end if;

    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then
      raise exception using
        errcode = '23514',
        message = 'new stories must start as DRAFT';
    end if;
  else
    if new.created_at is distinct from old.created_at then
      raise exception using
        errcode = '23514',
        message = 'created_at is immutable';
    end if;

    if old.published_at is not null then
      if new.slug is distinct from old.slug then
        raise exception using
          errcode = '23514',
          message = 'slug is immutable after first publication';
      end if;

      if new.published_at is distinct from old.published_at then
        raise exception using
          errcode = '23514',
          message = 'published_at is immutable after first publication';
      end if;
    end if;

    if not (
      (old.status = 'DRAFT' and new.status in ('DRAFT', 'READY'))
      or (old.status = 'READY' and new.status in ('DRAFT', 'READY', 'PUBLISHED'))
      or (old.status = 'PUBLISHED' and new.status in ('PUBLISHED', 'ARCHIVED'))
      or (old.status = 'ARCHIVED' and new.status in ('ARCHIVED', 'PUBLISHED'))
    ) then
      raise exception using
        errcode = '23514',
        message = 'invalid story status transition';
    end if;

    if old.status = 'PUBLISHED' and new.status = 'ARCHIVED' then
      new.home_rank := null;
    end if;
  end if;

  if new.status = 'PUBLISHED' then
    if new.slug = '' then
      raise exception using errcode = '23514', message = 'published story requires a slug';
    end if;
    if pg_catalog.btrim(new.title) = '' then
      raise exception using errcode = '23514', message = 'published story requires a title';
    end if;
    if pg_catalog.btrim(new.dek) = '' then
      raise exception using errcode = '23514', message = 'published story requires a dek';
    end if;
    if pg_catalog.btrim(new.seo_title) = '' or pg_catalog.btrim(new.seo_description) = '' then
      raise exception using errcode = '23514', message = 'published story requires SEO metadata';
    end if;
    if pg_catalog.jsonb_typeof(new.content_blocks) <> 'array'
      or pg_catalog.jsonb_array_length(new.content_blocks) = 0 then
      raise exception using errcode = '23514', message = 'published story requires body content';
    end if;
    if new.hero_media_id is null then
      raise exception using errcode = '23514', message = 'published story requires hero media';
    end if;

    select media.*
      into hero
      from public.story_media as media
      where media.id = new.hero_media_id
        and media.story_id = new.id;

    if not found then
      raise exception using errcode = '23514', message = 'hero media must belong to the story';
    end if;
    if pg_catalog.btrim(hero.alt_text) = '' then
      raise exception using errcode = '23514', message = 'hero media requires alt text';
    end if;
    if hero.rights_type = 'UNKNOWN' then
      raise exception using errcode = '23514', message = 'hero media requires known rights';
    end if;
    if pg_catalog.btrim(hero.bucket_id) = '' or pg_catalog.btrim(hero.object_path) = '' then
      raise exception using errcode = '23514', message = 'hero media requires a storage locator';
    end if;

    for block_value in
      select block_item.value
      from pg_catalog.jsonb_array_elements(new.content_blocks) as block_item(value)
    loop
      if block_value ->> 'type' = 'IMAGE' then
        if pg_catalog.jsonb_typeof(block_value -> 'mediaId') is distinct from 'string' then
          raise exception using errcode = '23514', message = 'IMAGE mediaId must be a UUID string';
        end if;

        media_id_text := block_value ->> 'mediaId';
        if media_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          raise exception using errcode = '23514', message = 'IMAGE mediaId must be a UUID string';
        end if;
        parsed_media_id := media_id_text::uuid;

        perform 1
        from public.story_media as media
        where media.id = parsed_media_id
          and media.story_id = new.id
          and pg_catalog.btrim(media.alt_text) <> ''
          and media.rights_type <> 'UNKNOWN'
          and pg_catalog.btrim(media.bucket_id) <> ''
          and pg_catalog.btrim(media.object_path) <> '';

        if not found then
          raise exception using errcode = '23514', message = 'IMAGE references invalid story media';
        end if;
      elsif block_value ->> 'type' in ('IMAGE_PAIR', 'GALLERY') then
        if pg_catalog.jsonb_typeof(block_value -> 'mediaIds') is distinct from 'array'
          or pg_catalog.jsonb_array_length(block_value -> 'mediaIds') = 0 then
          raise exception using errcode = '23514', message = 'mediaIds must be a non-empty UUID array';
        end if;

        for media_value in
          select media_item.value
          from pg_catalog.jsonb_array_elements(block_value -> 'mediaIds') as media_item(value)
        loop
          if pg_catalog.jsonb_typeof(media_value) is distinct from 'string' then
            raise exception using errcode = '23514', message = 'mediaIds must contain UUID strings';
          end if;

          media_id_text := media_value #>> '{}';
          if media_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
            raise exception using errcode = '23514', message = 'mediaIds must contain UUID strings';
          end if;
          parsed_media_id := media_id_text::uuid;

          perform 1
          from public.story_media as media
          where media.id = parsed_media_id
            and media.story_id = new.id
            and pg_catalog.btrim(media.alt_text) <> ''
            and media.rights_type <> 'UNKNOWN'
            and pg_catalog.btrim(media.bucket_id) <> ''
            and pg_catalog.btrim(media.object_path) <> '';

          if not found then
            raise exception using errcode = '23514', message = 'body block references invalid story media';
          end if;
        end loop;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create function public.story_media_integrity_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_used_by_public_story boolean;
begin
  select pg_catalog.coalesce(pg_catalog.bool_or(
    story.hero_media_id = old.id
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(story.content_blocks) as block_item(value)
      where (
        block_item.value ->> 'type' = 'IMAGE'
        and pg_catalog.jsonb_typeof(block_item.value -> 'mediaId') = 'string'
        and pg_catalog.lower(block_item.value ->> 'mediaId') = old.id::text
      ) or (
        block_item.value ->> 'type' in ('IMAGE_PAIR', 'GALLERY')
        and pg_catalog.jsonb_typeof(block_item.value -> 'mediaIds') = 'array'
        and exists (
          select 1
          from pg_catalog.jsonb_array_elements(block_item.value -> 'mediaIds') as media_item(value)
          where pg_catalog.jsonb_typeof(media_item.value) = 'string'
            and pg_catalog.lower(media_item.value #>> '{}') = old.id::text
        )
      )
    )
  ), false)
  into is_used_by_public_story
  from public.stories as story
  where story.id = old.story_id
    and story.status in ('PUBLISHED', 'ARCHIVED');

  if tg_op = 'DELETE' then
    if is_used_by_public_story then
      raise exception using
        errcode = '23514',
        message = 'media used by a published or archived story cannot be deleted';
    end if;

    return old;
  end if;

  if new.id is distinct from old.id then
    raise exception using errcode = '23514', message = 'story media id is immutable';
  end if;
  if new.story_id is distinct from old.story_id then
    raise exception using errcode = '23514', message = 'story media ownership is immutable';
  end if;

  if is_used_by_public_story then
    if new.bucket_id is distinct from old.bucket_id
      or new.object_path is distinct from old.object_path
      or new.width is distinct from old.width
      or new.height is distinct from old.height
      or new.mime_type is distinct from old.mime_type
      or new.byte_size is distinct from old.byte_size then
      raise exception using
        errcode = '23514',
        message = 'storage identity of used published media is immutable';
    end if;

    if pg_catalog.btrim(new.alt_text) = '' then
      raise exception using errcode = '23514', message = 'used published media requires alt text';
    end if;
    if new.rights_type = 'UNKNOWN' then
      raise exception using errcode = '23514', message = 'used published media requires known rights';
    end if;
  end if;

  return new;
end;
$$;

create trigger stories_10_lifecycle_guard
before insert or update or delete on public.stories
for each row execute function public.stories_lifecycle_guard();

create trigger stories_90_set_updated_at
before update on public.stories
for each row execute function public.set_stories_updated_at();

create trigger story_media_10_integrity_guard
before update or delete on public.story_media
for each row execute function public.story_media_integrity_guard();

create trigger story_media_90_set_updated_at
before update on public.story_media
for each row execute function public.set_stories_updated_at();

create trigger editorial_people_90_set_updated_at
before update on public.editorial_people
for each row execute function public.set_stories_updated_at();

alter table public.stories enable row level security;
alter table public.story_media enable row level security;
alter table public.editorial_people enable row level security;
alter table public.story_credits enable row level security;
alter table public.story_events enable row level security;

revoke all on table
  public.stories,
  public.story_media,
  public.editorial_people,
  public.story_credits,
  public.story_events
from public, anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.stories,
  public.story_media,
  public.editorial_people,
  public.story_credits,
  public.story_events
to service_role;

revoke all on function public.set_stories_updated_at()
from public, anon, authenticated, service_role;

revoke all on function public.stories_lifecycle_guard()
from public, anon, authenticated, service_role;

revoke all on function public.story_media_integrity_guard()
from public, anon, authenticated, service_role;

commit;
