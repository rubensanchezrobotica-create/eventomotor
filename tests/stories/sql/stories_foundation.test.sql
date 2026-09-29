begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(60);

select set_eq(
  $$
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename in ('stories', 'story_media', 'editorial_people', 'story_credits', 'story_events')
  $$,
  array['stories', 'story_media', 'editorial_people', 'story_credits', 'story_events'],
  'stories foundation creates exactly the five approved tables'
);

select ok(
  (
    select count(*) = 17
    from information_schema.columns
    where table_schema = 'public'
      and (table_name, column_name, data_type) in (
        ('stories', 'id', 'uuid'),
        ('stories', 'slug', 'text'),
        ('stories', 'status', 'text'),
        ('stories', 'content_blocks', 'jsonb'),
        ('stories', 'hero_media_id', 'uuid'),
        ('stories', 'published_at', 'timestamp with time zone'),
        ('stories', 'home_rank', 'smallint'),
        ('story_media', 'story_id', 'uuid'),
        ('story_media', 'byte_size', 'bigint'),
        ('story_media', 'rights_type', 'text'),
        ('editorial_people', 'id', 'uuid'),
        ('editorial_people', 'active', 'boolean'),
        ('story_credits', 'story_id', 'uuid'),
        ('story_credits', 'person_id', 'uuid'),
        ('story_credits', 'role', 'text'),
        ('story_events', 'story_id', 'uuid'),
        ('story_events', 'event_id', 'text')
      )
  ),
  'critical stories columns use the approved PostgreSQL types'
);

select is(
  (
    select data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'story_events'
      and column_name = 'event_id'
  ),
  'text',
  'story_events.event_id matches public.events.id text type'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_constraint
    where contype = 'p'
      and conrelid in (
        'public.stories'::regclass,
        'public.story_media'::regclass,
        'public.editorial_people'::regclass,
        'public.story_credits'::regclass,
        'public.story_events'::regclass
      )
  ),
  5,
  'all five tables have primary keys'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_constraint
    where contype = 'f'
      and conname in (
        'stories_hero_media_id_fkey',
        'story_media_story_id_fkey',
        'story_credits_story_id_fkey',
        'story_credits_person_id_fkey',
        'story_events_story_id_fkey',
        'story_events_event_id_fkey'
      )
  ),
  6,
  'all approved ownership and relationship foreign keys exist'
);

select ok(
  (
    select count(*) = 22
    from pg_catalog.pg_constraint
    where contype = 'c'
      and conname in (
        'stories_slug_check', 'stories_status_check', 'stories_type_check',
        'stories_collection_check', 'stories_title_check', 'stories_dek_check',
        'stories_context_location_check', 'stories_content_blocks_check',
        'stories_schema_version_check', 'stories_seo_title_check',
        'stories_seo_description_check', 'stories_discipline_slugs_check',
        'stories_territory_ids_check', 'stories_published_at_check',
        'stories_home_rank_check', 'stories_timestamps_check',
        'story_media_bucket_id_check', 'story_media_object_path_check',
        'story_media_dimensions_check', 'story_media_mime_type_check',
        'story_media_byte_size_check', 'story_media_rights_type_check'
      )
  ),
  'the stable story and media checks are present'
);

select set_eq(
  $$
    select indexname
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname in (
        'stories_slug_key', 'stories_published_at_idx', 'stories_home_rank_key',
        'story_media_bucket_object_key', 'story_media_story_idx',
        'story_credits_story_sort_idx', 'story_events_one_primary_key',
        'story_events_event_idx'
      )
  $$,
  array[
    'stories_slug_key', 'stories_published_at_idx', 'stories_home_rank_key',
    'story_media_bucket_object_key', 'story_media_story_idx',
    'story_credits_story_sort_idx', 'story_events_one_primary_key',
    'story_events_event_idx'
  ],
  'the approved stories indexes exist'
);

select set_eq(
  $$
    select proname
    from pg_catalog.pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('set_stories_updated_at', 'stories_lifecycle_guard', 'story_media_integrity_guard')
  $$,
  array['set_stories_updated_at', 'stories_lifecycle_guard', 'story_media_integrity_guard'],
  'the three internal trigger functions exist'
);

select ok(
  (
    select bool_and(not prosecdef)
    from pg_catalog.pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('set_stories_updated_at', 'stories_lifecycle_guard', 'story_media_integrity_guard')
  ),
  'all internal functions are security invoker'
);

select ok(
  (
    select bool_and('search_path=""' = any(proconfig))
    from pg_catalog.pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('set_stories_updated_at', 'stories_lifecycle_guard', 'story_media_integrity_guard')
  ),
  'all internal functions use an empty search_path'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger
    where not tgisinternal
      and tgname in (
        'stories_10_lifecycle_guard', 'stories_90_set_updated_at',
        'story_media_10_integrity_guard', 'story_media_90_set_updated_at',
        'editorial_people_90_set_updated_at'
      )
  ),
  5,
  'five lifecycle and timestamp triggers exist'
);

select ok(
  (
    select bool_and(relrowsecurity)
    from pg_catalog.pg_class
    where oid in (
      'public.stories'::regclass, 'public.story_media'::regclass,
      'public.editorial_people'::regclass, 'public.story_credits'::regclass,
      'public.story_events'::regclass
    )
  ),
  'RLS is enabled on all five stories tables'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy
    where polrelid in (
      'public.stories'::regclass, 'public.story_media'::regclass,
      'public.editorial_people'::regclass, 'public.story_credits'::regclass,
      'public.story_events'::regclass
    )
  ),
  0,
  'no browser-facing RLS policies exist'
);

select ok(
  (
    select bool_and(not pg_catalog.has_table_privilege('anon', oid, 'SELECT,INSERT,UPDATE,DELETE'))
    from pg_catalog.pg_class
    where oid in (
      'public.stories'::regclass, 'public.story_media'::regclass,
      'public.editorial_people'::regclass, 'public.story_credits'::regclass,
      'public.story_events'::regclass
    )
  ),
  'anon has no direct CRUD privilege'
);

select ok(
  (
    select bool_and(not pg_catalog.has_table_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,DELETE'))
    from pg_catalog.pg_class
    where oid in (
      'public.stories'::regclass, 'public.story_media'::regclass,
      'public.editorial_people'::regclass, 'public.story_credits'::regclass,
      'public.story_events'::regclass
    )
  ),
  'authenticated has no direct CRUD privilege'
);

select ok(
  (
    select bool_and(
      pg_catalog.has_table_privilege('service_role', oid, 'SELECT')
      and pg_catalog.has_table_privilege('service_role', oid, 'INSERT')
      and pg_catalog.has_table_privilege('service_role', oid, 'UPDATE')
      and pg_catalog.has_table_privilege('service_role', oid, 'DELETE')
    )
    from pg_catalog.pg_class
    where oid in (
      'public.stories'::regclass, 'public.story_media'::regclass,
      'public.editorial_people'::regclass, 'public.story_credits'::regclass,
      'public.story_events'::regclass
    )
  ),
  'service_role has explicit CRUD privilege'
);

select ok(
  (
    select bool_and(
      not pg_catalog.has_function_privilege('anon', oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated', oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('service_role', oid, 'EXECUTE')
    )
    from pg_catalog.pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('set_stories_updated_at', 'stories_lifecycle_guard', 'story_media_integrity_guard')
  ),
  'internal trigger functions are not directly executable by application roles'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc where pronamespace = 'public'::regnamespace and proname = 'publish_story'),
  0,
  'A16A2 does not create a publication RPC'
);

select lives_ok(
  $$insert into public.stories (id, type, collection) values ('a1000000-0000-4000-8000-000000000001', 'CRONICA', 'DESDE_DENTRO')$$,
  'a minimal blank draft is valid'
);

select lives_ok(
  $$
    insert into public.stories (id, type, collection) values
      ('a1000000-0000-4000-8000-000000000002', 'REPORTAJE', 'HISTORIAS_DE_MOTOR'),
      ('a1000000-0000-4000-8000-000000000003', 'HISTORIA', 'CONVERSACIONES')
  $$,
  'multiple drafts may keep the empty slug'
);

select throws_ok(
  $$insert into public.stories (type, collection, slug) values ('CRONICA', 'DESDE_DENTRO', 'Slug Invalido')$$,
  '23514', null,
  'invalid public slug syntax is rejected'
);

insert into public.stories (id, type, collection, slug)
values ('a1000000-0000-4000-8000-000000000004', 'CRONICA', 'DESDE_DENTRO', 'slug-publico');

select throws_ok(
  $$insert into public.stories (type, collection, slug) values ('CRONICA', 'DESDE_DENTRO', 'slug-publico')$$,
  '23505', null,
  'non-empty story slugs are unique'
);

select lives_ok(
  $$update public.stories set slug = 'slug-editado' where id = 'a1000000-0000-4000-8000-000000000004'$$,
  'slug remains editable before publication'
);

select throws_ok(
  $$insert into public.stories (type, collection, status) values ('CRONICA', 'DESDE_DENTRO', 'UNKNOWN')$$,
  '23514', null,
  'unknown story status is rejected'
);

select throws_ok(
  $$insert into public.stories (type, collection) values ('NOT_A_TYPE', 'DESDE_DENTRO')$$,
  '23514', null,
  'unknown story type is rejected'
);

select throws_ok(
  $$insert into public.stories (type, collection) values ('CRONICA', 'NOT_A_COLLECTION')$$,
  '23514', null,
  'unknown story collection is rejected'
);

select throws_ok(
  $$
    insert into public.story_media (story_id, bucket_id, object_path, width, height, mime_type, byte_size, rights_type)
    values ('a1000000-0000-4000-8000-000000000001', 'stories', 'invalid-rights.webp', 1200, 800, 'image/webp', 1000, 'NOT_A_RIGHT')
  $$,
  '23514', null,
  'unknown media rights type is rejected'
);

insert into public.editorial_people (id, display_name) values
  ('c1000000-0000-4000-8000-000000000001', 'Fotógrafa Uno'),
  ('c1000000-0000-4000-8000-000000000002', 'Fotógrafo Dos');

select throws_ok(
  $$insert into public.story_credits (story_id, person_id, role) values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'EDITOR')$$,
  '23514', null,
  'unknown credit role is rejected'
);

select throws_ok(
  $$insert into public.story_events (story_id, event_id, relation_type) values ('a1000000-0000-4000-8000-000000000001', 'missing', 'SECONDARY')$$,
  '23514', null,
  'unknown event relation type is rejected before FK evaluation'
);

select lives_ok(
  $$
    insert into public.story_credits (story_id, person_id, role, sort_order) values
      ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'PHOTO', 0),
      ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'PHOTO', 1)
  $$,
  'multiple PHOTO credits are allowed'
);

select throws_ok(
  $$insert into public.story_credits (story_id, person_id, role) values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'PHOTO')$$,
  '23505', null,
  'an exact story/person/role credit cannot be duplicated'
);

select throws_ok(
  $$delete from public.editorial_people where id = 'c1000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  'credited editorial people are delete-restricted'
);

insert into public.events (id, title, start_date) values
  ('story-foundation-event-1', 'Evento relacionado uno', current_date),
  ('story-foundation-event-2', 'Evento relacionado dos', current_date),
  ('story-foundation-event-3', 'Evento relacionado tres', current_date);

select lives_ok(
  $$insert into public.story_events (story_id, event_id, relation_type) values ('a1000000-0000-4000-8000-000000000001', 'story-foundation-event-1', 'PRIMARY')$$,
  'story event accepts the real text event primary key'
);

select throws_ok(
  $$insert into public.story_events (story_id, event_id, relation_type) values ('a1000000-0000-4000-8000-000000000002', 'story-foundation-event-missing', 'RELATED')$$,
  '23503', null,
  'unknown event identifiers are rejected'
);

select lives_ok(
  $$
    insert into public.story_events (story_id, event_id, relation_type, sort_order) values
      ('a1000000-0000-4000-8000-000000000001', 'story-foundation-event-2', 'RELATED', 1),
      ('a1000000-0000-4000-8000-000000000001', 'story-foundation-event-3', 'RELATED', 2)
  $$,
  'a story may have multiple related events alongside one primary'
);

select throws_ok(
  $$update public.story_events set relation_type = 'PRIMARY' where story_id = 'a1000000-0000-4000-8000-000000000001' and event_id = 'story-foundation-event-2'$$,
  '23505', null,
  'a story cannot have two primary events'
);

select lives_ok(
  $$insert into public.story_events (story_id, event_id, relation_type) values ('a1000000-0000-4000-8000-000000000002', 'story-foundation-event-1', 'RELATED')$$,
  'the same event may relate to multiple stories'
);

select throws_ok(
  $$delete from public.events where id = 'story-foundation-event-1'$$,
  '23503', null,
  'events referenced by stories are delete-restricted'
);

select throws_ok(
  $$insert into public.stories (type, collection, title) values ('CRONICA', 'DESDE_DENTRO', repeat('x', 241))$$,
  '23514', null,
  'story title cannot exceed 240 characters'
);

select throws_ok(
  $$insert into public.stories (type, collection, dek) values ('CRONICA', 'DESDE_DENTRO', repeat('x', 1001))$$,
  '23514', null,
  'story dek cannot exceed 1000 characters'
);

select throws_ok(
  $$insert into public.stories (type, collection, discipline_slugs) values ('CRONICA', 'DESDE_DENTRO', array_fill('rallyes'::text, array[33]))$$,
  '23514', null,
  'story discipline list cannot exceed 32 entries'
);

select throws_ok(
  $$insert into public.stories (type, collection, territory_ids) values ('CRONICA', 'DESDE_DENTRO', array_fill('madrid'::text, array[33]))$$,
  '23514', null,
  'story territory list cannot exceed 32 entries'
);

select throws_ok(
  $$
    insert into public.story_media (story_id, bucket_id, object_path, width, height, mime_type, byte_size)
    values ('a1000000-0000-4000-8000-000000000001', 'stories', 'invalid-width.webp', 0, 800, 'image/webp', 1000)
  $$,
  '23514', null,
  'story media width must be positive'
);

select throws_ok(
  $$
    insert into public.story_media (story_id, bucket_id, object_path, width, height, mime_type, byte_size)
    values ('a1000000-0000-4000-8000-000000000001', 'stories', 'invalid-height.webp', 1200, 0, 'image/webp', 1000)
  $$,
  '23514', null,
  'story media height must be positive'
);

select throws_ok(
  $$
    insert into public.story_media (story_id, bucket_id, object_path, width, height, mime_type, byte_size)
    values ('a1000000-0000-4000-8000-000000000001', 'stories', 'invalid-byte-size.webp', 1200, 800, 'image/webp', 0)
  $$,
  '23514', null,
  'story media byte size must be positive'
);

select throws_ok(
  $$
    insert into public.story_media (story_id, bucket_id, object_path, width, height, mime_type, byte_size)
    values ('a1000000-0000-4000-8000-000000000001', 'stories', 'invalid-mime.avif', 1200, 800, 'image/avif', 1000)
  $$,
  '23514', null,
  'story media MIME type must be in the approved image allowlist'
);

select throws_ok(
  $$insert into public.story_credits (story_id, person_id, role, sort_order) values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'TEXT', -1)$$,
  '23514', null,
  'story credit sort order cannot be negative'
);

select throws_ok(
  $$insert into public.story_events (story_id, event_id, relation_type, sort_order) values ('a1000000-0000-4000-8000-000000000004', 'story-foundation-event-2', 'RELATED', -1)$$,
  '23514', null,
  'story event sort order cannot be negative'
);

insert into public.stories (id, type, collection)
values ('a1000000-0000-4000-8000-000000000005', 'CRONICA', 'DESDE_DENTRO');

insert into public.story_media (
  id, story_id, bucket_id, object_path, width, height, mime_type, byte_size
)
values (
  'b1000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000005',
  'stories', 'ready-hero-delete.webp', 1200, 800, 'image/webp', 1000
);

update public.stories
set hero_media_id = 'b1000000-0000-4000-8000-000000000005', status = 'READY'
where id = 'a1000000-0000-4000-8000-000000000005';

select lives_ok(
  $$delete from public.story_media where id = 'b1000000-0000-4000-8000-000000000005'$$,
  'draft or ready hero media may be deleted'
);

select is(
  (select hero_media_id from public.stories where id = 'a1000000-0000-4000-8000-000000000005'),
  null,
  'deleting draft or ready hero media clears the hero foreign key'
);

set local role service_role;

insert into public.stories (id, type, collection)
values ('a1000000-0000-4000-8000-000000000090', 'CRONICA', 'DESDE_DENTRO');

insert into public.story_media (
  id, story_id, bucket_id, object_path, width, height, mime_type, byte_size
)
values (
  'b1000000-0000-4000-8000-000000000090',
  'a1000000-0000-4000-8000-000000000090',
  'stories', 'service-role.webp', 1200, 800, 'image/webp', 1000
);

insert into public.editorial_people (id, display_name)
values ('c1000000-0000-4000-8000-000000000090', 'Service Role Fixture');

insert into public.story_credits (story_id, person_id, role)
values (
  'a1000000-0000-4000-8000-000000000090',
  'c1000000-0000-4000-8000-000000000090',
  'TEXT'
);

insert into public.story_events (story_id, event_id, relation_type)
values (
  'a1000000-0000-4000-8000-000000000090',
  'story-foundation-event-2',
  'RELATED'
);

update public.stories
set title = 'Service role update'
where id = 'a1000000-0000-4000-8000-000000000090';

delete from public.stories
where id = 'a1000000-0000-4000-8000-000000000090';

delete from public.editorial_people
where id = 'c1000000-0000-4000-8000-000000000090';

reset role;

select pass('service_role can perform foundation-table DML through RLS without direct trigger execution grants');

insert into public.story_media (id, story_id, bucket_id, object_path, width, height, mime_type, byte_size)
values ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'stories', 'draft-delete.webp', 1200, 800, 'image/webp', 1000);
insert into public.story_credits (story_id, person_id, role)
values ('a1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'TEXT');

select lives_ok(
  $$delete from public.stories where id = 'a1000000-0000-4000-8000-000000000002'$$,
  'draft stories may be deleted'
);

update public.stories set status = 'READY'
where id = 'a1000000-0000-4000-8000-000000000003';

select lives_ok(
  $$delete from public.stories where id = 'a1000000-0000-4000-8000-000000000003'$$,
  'ready stories may be deleted'
);

select is(
  (select count(*)::integer from public.story_media where story_id = 'a1000000-0000-4000-8000-000000000002'),
  0,
  'draft story media cascades on delete'
);

select is(
  (select count(*)::integer from public.story_credits where story_id = 'a1000000-0000-4000-8000-000000000002'),
  0,
  'draft story credits cascade on delete'
);

select is(
  (select count(*)::integer from public.story_events where story_id = 'a1000000-0000-4000-8000-000000000002'),
  0,
  'draft story event relations cascade on delete'
);

select throws_ok(
  $$update public.stories set created_at = created_at - interval '1 day' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '23514', 'created_at is immutable',
  'story created_at is immutable'
);

select lives_ok(
  $$update public.stories set title = 'Borrador actualizado' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  'ordinary draft updates remain available'
);

select ok(
  (select updated_at >= created_at from public.stories where id = 'a1000000-0000-4000-8000-000000000001'),
  'updated_at remains coherent after a mutable update'
);

select throws_ok(
  $$insert into public.stories (type, collection, home_rank) values ('CRONICA', 'DESDE_DENTRO', 1)$$,
  '23514', null,
  'home rank cannot be assigned to a non-published story'
);

select * from finish();
rollback;
