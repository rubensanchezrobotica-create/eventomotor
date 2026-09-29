begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(72);

insert into public.stories (
  id, slug, type, collection, title, dek, content_blocks, seo_title, seo_description
)
select
  ('a2000000-0000-4000-8000-' || pg_catalog.lpad(series::text, 12, '0'))::uuid,
  'historia-' || series,
  'CRONICA',
  'DESDE_DENTRO',
  'Historia ' || series,
  'Resumen editorial ' || series,
  '[{"type":"PARAGRAPH","text":"Cuerpo editorial"}]'::jsonb,
  'SEO historia ' || series,
  'Descripción SEO de historia ' || series
from pg_catalog.generate_series(1, 21) as series;

insert into public.story_media (
  id, story_id, bucket_id, object_path, width, height, mime_type,
  byte_size, alt_text, rights_type
)
select
  ('b2000000-0000-4000-8000-' || pg_catalog.lpad(series::text, 12, '0'))::uuid,
  ('a2000000-0000-4000-8000-' || pg_catalog.lpad(series::text, 12, '0'))::uuid,
  'stories',
  'publication/hero-' || series || '.webp',
  1200,
  800,
  'image/webp',
  150000,
  case when series = 10 then '' else 'Alt hero ' || series end,
  case when series = 11 then 'UNKNOWN' else 'LICENSED' end
from pg_catalog.generate_series(1, 21) as series;

update public.stories
set hero_media_id = ('b2000000-0000-4000-8000-' || pg_catalog.lpad(
  pg_catalog.substring(slug, '[0-9]+$'), 12, '0'
))::uuid
where id::text like 'a2000000-0000-4000-8000-%';

insert into public.story_media (
  id, story_id, bucket_id, object_path, width, height, mime_type,
  byte_size, alt_text, rights_type
) values
  (
    'd2000000-0000-4000-8000-000000000014',
    'a2000000-0000-4000-8000-000000000014',
    'stories', 'publication/body-alt-empty.webp', 1200, 800,
    'image/webp', 120000, '', 'LICENSED'
  ),
  (
    'd2000000-0000-4000-8000-000000000015',
    'a2000000-0000-4000-8000-000000000015',
    'stories', 'publication/body-rights-unknown.webp', 1200, 800,
    'image/webp', 120000, 'Body unknown rights', 'UNKNOWN'
  ),
  (
    'd2000000-0000-4000-8000-000000000017',
    'a2000000-0000-4000-8000-000000000017',
    'stories', 'publication/pair-second.webp', 1200, 800,
    'image/webp', 120000, 'Second pair image', 'OWN'
  ),
  (
    'd2000000-0000-4000-8000-000000000018',
    'a2000000-0000-4000-8000-000000000018',
    'stories', 'publication/gallery-second.webp', 1200, 800,
    'image/webp', 120000, 'Second gallery image', 'PRESS_PROVIDED'
  ),
  (
    'e2000000-0000-4000-8000-000000000020',
    'a2000000-0000-4000-8000-000000000020',
    'stories', 'publication/lowercase-image.webp', 1200, 800,
    'image/webp', 120000, 'Lowercase body image', 'OWN'
  ),
  (
    'e2000000-0000-4000-8000-000000000021',
    'a2000000-0000-4000-8000-000000000021',
    'stories', 'publication/uppercase-image.webp', 1200, 800,
    'image/webp', 120000, 'Uppercase body image', 'LICENSED'
  );

update public.stories
set status = 'READY'
where id::text like 'a2000000-0000-4000-8000-%';

select throws_ok(
  $$update public.stories set status = 'PUBLISHED' where id = 'a2000000-0000-4000-8000-000000000002'$$,
  '23514', null,
  'PUBLISHED without published_at fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp(), slug = '' where id = 'a2000000-0000-4000-8000-000000000003'$$,
  '23514', 'published story requires a slug',
  'PUBLISHED without slug fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp(), title = '' where id = 'a2000000-0000-4000-8000-000000000004'$$,
  '23514', 'published story requires a title',
  'PUBLISHED without title fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp(), dek = '' where id = 'a2000000-0000-4000-8000-000000000005'$$,
  '23514', 'published story requires a dek',
  'PUBLISHED without dek fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp(), seo_title = '', seo_description = '' where id = 'a2000000-0000-4000-8000-000000000006'$$,
  '23514', 'published story requires SEO metadata',
  'PUBLISHED without SEO fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp(), content_blocks = '[]'::jsonb where id = 'a2000000-0000-4000-8000-000000000007'$$,
  '23514', 'published story requires body content',
  'PUBLISHED with empty body fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp(), hero_media_id = null where id = 'a2000000-0000-4000-8000-000000000008'$$,
  '23514', 'published story requires hero media',
  'PUBLISHED without hero fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp(), hero_media_id = 'b2000000-0000-4000-8000-000000000001' where id = 'a2000000-0000-4000-8000-000000000009'$$,
  '23514', 'hero media must belong to the story',
  'a hero owned by another story fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp() where id = 'a2000000-0000-4000-8000-000000000010'$$,
  '23514', 'hero media requires alt text',
  'hero without alt text fails closed'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED', published_at = clock_timestamp() where id = 'a2000000-0000-4000-8000-000000000011'$$,
  '23514', 'hero media requires known rights',
  'hero with UNKNOWN rights fails closed'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED',
        published_at = clock_timestamp(),
        home_rank = 1,
        content_blocks = '[{"type":"IMAGE","mediaId":"b2000000-0000-4000-8000-000000000001"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000001'
  $$,
  'IMAGE with valid same-story media publishes'
);

select throws_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE","mediaId":"d2000000-0000-4000-8000-000000000012"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000012'
  $$,
  '23514', 'IMAGE references invalid story media',
  'IMAGE with missing media fails closed'
);

select throws_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE","mediaId":"b2000000-0000-4000-8000-000000000001"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000013'
  $$,
  '23514', 'IMAGE references invalid story media',
  'IMAGE with media owned by another story fails closed'
);

select throws_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE","mediaId":"d2000000-0000-4000-8000-000000000014"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000014'
  $$,
  '23514', 'IMAGE references invalid story media',
  'IMAGE body media without alt text fails closed'
);

select throws_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE","mediaId":"d2000000-0000-4000-8000-000000000015"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000015'
  $$,
  '23514', 'IMAGE references invalid story media',
  'IMAGE body media with UNKNOWN rights fails closed'
);

select throws_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE","mediaId":"not-a-uuid"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000016'
  $$,
  '23514', 'IMAGE mediaId must be a UUID string',
  'malformed IMAGE mediaId fails closed'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(), home_rank = 2,
        content_blocks = '[{"type":"IMAGE_PAIR","mediaIds":["B2000000-0000-4000-8000-000000000017","D2000000-0000-4000-8000-000000000017"]}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000017'
  $$,
  'IMAGE_PAIR validates uppercase referenced media'
);

select throws_ok(
  $$
    update public.stories
    set content_blocks = '[{"type":"IMAGE_PAIR","mediaIds":["b2000000-0000-4000-8000-000000000017","d2000000-0000-4000-8000-000000000099"]}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000017'
  $$,
  '23514', 'body block references invalid story media',
  'IMAGE_PAIR fails when any referenced media is invalid'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(), home_rank = 3,
        content_blocks = '[{"type":"GALLERY","mediaIds":["B2000000-0000-4000-8000-000000000018","D2000000-0000-4000-8000-000000000018"]}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000018'
  $$,
  'GALLERY validates uppercase referenced media'
);

select throws_ok(
  $$
    update public.stories
    set content_blocks = '[{"type":"GALLERY","mediaIds":["b2000000-0000-4000-8000-000000000018","d2000000-0000-4000-8000-000000000099"]}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000018'
  $$,
  '23514', 'body block references invalid story media',
  'GALLERY fails when any referenced media is invalid'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"EVENT_REFERENCE","eventId":"not-validated-in-a16a2"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000019'
  $$,
  'EVENT_REFERENCE remains an application-layer relationship check'
);

select throws_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE_PAIR","mediaIds":"b2000000-0000-4000-8000-000000000012"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000012'
  $$,
  '23514', 'mediaIds must be a non-empty UUID array',
  'IMAGE_PAIR mediaIds must be an array'
);

select throws_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"GALLERY","mediaIds":["b2000000-0000-4000-8000-000000000013",null]}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000013'
  $$,
  '23514', 'mediaIds must contain UUID strings',
  'GALLERY mediaIds cannot contain JSON null'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE_PAIR","mediaIds":["b2000000-0000-4000-8000-000000000014"]}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000014'
  $$,
  'the database permits an IMAGE_PAIR with one valid media item'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"GALLERY","mediaIds":["b2000000-0000-4000-8000-000000000015","b2000000-0000-4000-8000-000000000015"]}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000015'
  $$,
  'the database permits duplicate valid media references'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE","mediaId":"e2000000-0000-4000-8000-000000000020"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000020'
  $$,
  'lowercase IMAGE UUID references publish'
);

select lives_ok(
  $$
    update public.stories
    set status = 'PUBLISHED', published_at = clock_timestamp(),
        content_blocks = '[{"type":"IMAGE","mediaId":"E2000000-0000-4000-8000-000000000021"}]'::jsonb
    where id = 'a2000000-0000-4000-8000-000000000021'
  $$,
  'uppercase IMAGE UUID references publish'
);

select lives_ok(
  $$update public.stories set title = 'Título corregido' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  'published title correction is allowed'
);

select lives_ok(
  $$update public.stories set dek = 'Resumen corregido' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  'published dek correction is allowed'
);

select lives_ok(
  $$update public.stories set content_blocks = '[{"type":"PARAGRAPH","text":"Cuerpo corregido"}]'::jsonb where id = 'a2000000-0000-4000-8000-000000000001'$$,
  'valid published body correction is allowed'
);

select lives_ok(
  $$update public.stories set seo_title = 'SEO corregido', seo_description = 'Descripción corregida' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  'published SEO correction is allowed'
);

select throws_ok(
  $$update public.stories set slug = 'historia-publicada-renombrada' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '23514', 'slug is immutable after first publication',
  'slug is immutable after first publication'
);

select throws_ok(
  $$update public.stories set published_at = published_at + interval '1 second' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '23514', 'published_at is immutable after first publication',
  'published_at is immutable after first publication'
);

select throws_ok(
  $$update public.stories set content_blocks = '[{"type":"IMAGE","mediaId":"d2000000-0000-4000-8000-000000000099"}]'::jsonb where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '23514', 'IMAGE references invalid story media',
  'published body correction cannot introduce invalid media'
);

insert into public.story_media (
  id, story_id, bucket_id, object_path, width, height, mime_type,
  byte_size, alt_text, rights_type
) values
  (
    'f2000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'stories', 'publication/unused-public.webp', 1200, 800,
    'image/webp', 120000, 'Unused public media', 'OWN'
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000001',
    'stories', 'publication/unused-archived.webp', 1200, 800,
    'image/webp', 120000, 'Unused archived media', 'OWN'
  );

select lives_ok(
  $$update public.story_media set object_path = 'publication/unused-public-moved.webp' where id = 'f2000000-0000-4000-8000-000000000001'$$,
  'unused media in a published story may change storage path'
);

select lives_ok(
  $$delete from public.story_media where id = 'f2000000-0000-4000-8000-000000000001'$$,
  'unused media in a published story may be deleted'
);

select throws_ok(
  $$update public.story_media set object_path = 'publication/lowercase-image-moved.webp' where id = 'e2000000-0000-4000-8000-000000000020'$$,
  '23514', 'storage identity of used published media is immutable',
  'lowercase IMAGE body media storage identity is protected'
);

select throws_ok(
  $$delete from public.story_media where id = 'e2000000-0000-4000-8000-000000000020'$$,
  '23514', 'media used by a published or archived story cannot be deleted',
  'lowercase IMAGE body media cannot be deleted'
);

select throws_ok(
  $$update public.story_media set object_path = 'publication/uppercase-image-moved.webp' where id = 'e2000000-0000-4000-8000-000000000021'$$,
  '23514', 'storage identity of used published media is immutable',
  'uppercase IMAGE body media storage identity is protected'
);

select throws_ok(
  $$delete from public.story_media where id = 'e2000000-0000-4000-8000-000000000021'$$,
  '23514', 'media used by a published or archived story cannot be deleted',
  'uppercase IMAGE body media cannot be deleted'
);

select lives_ok(
  $$update public.story_media set caption = 'Uppercase reference caption correction' where id = 'e2000000-0000-4000-8000-000000000021'$$,
  'safe metadata edits remain available for uppercase IMAGE references'
);

select throws_ok(
  $$update public.story_media set object_path = 'publication/pair-second-moved.webp' where id = 'd2000000-0000-4000-8000-000000000017'$$,
  '23514', 'storage identity of used published media is immutable',
  'uppercase IMAGE_PAIR body media storage identity is protected'
);

select throws_ok(
  $$update public.story_media set object_path = 'publication/gallery-second-moved.webp' where id = 'd2000000-0000-4000-8000-000000000018'$$,
  '23514', 'storage identity of used published media is immutable',
  'uppercase GALLERY body media storage identity is protected'
);

select throws_ok(
  $$delete from public.story_media where id = 'd2000000-0000-4000-8000-000000000018'$$,
  '23514', 'media used by a published or archived story cannot be deleted',
  'uppercase GALLERY body media cannot be deleted'
);

select lives_ok(
  $$update public.story_media set alt_text = 'Ferrari 296 GT3 entrando en boxes' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'alt text can be improved on used published media'
);

select lives_ok(
  $$update public.story_media set caption = 'Pie corregido' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'caption can be corrected on used published media'
);

select lives_ok(
  $$update public.story_media set credit = 'EventoMotor' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'credit can be corrected on used published media'
);

select lives_ok(
  $$update public.story_media set rights_notes = 'Licencia revisada' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'rights notes can be corrected on used published media'
);

select lives_ok(
  $$update public.story_media set rights_type = 'OWN' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'known rights can be corrected to another known value'
);

select throws_ok(
  $$update public.story_media set rights_type = 'UNKNOWN' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'used published media requires known rights',
  'used media rights cannot regress to UNKNOWN'
);

select throws_ok(
  $$update public.story_media set alt_text = '' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'used published media requires alt text',
  'used media alt text cannot become empty'
);

select throws_ok(
  $$update public.story_media set object_path = 'publication/replaced.webp' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'storage identity of used published media is immutable',
  'used media object path cannot be replaced'
);

select throws_ok(
  $$update public.story_media set story_id = 'a2000000-0000-4000-8000-000000000002' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'story media ownership is immutable',
  'story media ownership cannot change'
);

select throws_ok(
  $$update public.story_media set id = 'e2000000-0000-4000-8000-000000000001' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'story media id is immutable',
  'story media identity cannot change'
);

select throws_ok(
  $$delete from public.story_media where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'media used by a published or archived story cannot be deleted',
  'published hero media cannot be deleted'
);

select throws_ok(
  $$delete from public.story_media where id = 'd2000000-0000-4000-8000-000000000017'$$,
  '23514', 'media used by a published or archived story cannot be deleted',
  'uppercase IMAGE_PAIR body media cannot be deleted'
);

select is(
  (select count(*)::integer from public.stories where home_rank in (1, 2, 3)),
  3,
  'home ranks 1, 2, and 3 can be occupied once each'
);

select throws_ok(
  $$update public.stories set home_rank = 1 where id = 'a2000000-0000-4000-8000-000000000019'$$,
  '23505', null,
  'duplicate home rank fails closed'
);

select throws_ok(
  $$delete from public.stories where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '23514', 'published or archived stories cannot be deleted',
  'published stories cannot be deleted'
);

create temporary table published_story_snapshot as
select id, published_at
from public.stories
where id = 'a2000000-0000-4000-8000-000000000001';

select lives_ok(
  $$update public.stories set status = 'ARCHIVED' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  'PUBLISHED can transition to ARCHIVED'
);

select is(
  (select published_at from public.stories where id = 'a2000000-0000-4000-8000-000000000001'),
  (select published_at from published_story_snapshot where id = 'a2000000-0000-4000-8000-000000000001'),
  'archive preserves published_at'
);

select is(
  (select home_rank from public.stories where id = 'a2000000-0000-4000-8000-000000000001'),
  null,
  'archive clears home_rank'
);

select lives_ok(
  $$update public.story_media set alt_text = 'Alt corregido tras archivo' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  'safe media metadata edits remain available after archive'
);

select throws_ok(
  $$delete from public.story_media where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'media used by a published or archived story cannot be deleted',
  'used archived media cannot be deleted'
);

select lives_ok(
  $$update public.stories set content_blocks = '[{"type":"IMAGE","mediaId":"not-a-uuid"}]'::jsonb where id = 'a2000000-0000-4000-8000-000000000001'$$,
  'an archived story may temporarily hold invalid editorial content'
);

select throws_ok(
  $$update public.stories set status = 'PUBLISHED' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '23514', 'IMAGE mediaId must be a UUID string',
  'an invalid archived story cannot be republished'
);

select lives_ok(
  $$update public.story_media set object_path = 'publication/unused-archived-moved.webp' where id = 'f2000000-0000-4000-8000-000000000002'$$,
  'unused media in an archived story may change storage path even while archived content is malformed'
);

select lives_ok(
  $$delete from public.story_media where id = 'f2000000-0000-4000-8000-000000000002'$$,
  'unused media in an archived story may be deleted even while archived content is malformed'
);

update public.stories
set content_blocks = '[{"type":"PARAGRAPH","text":"Cuerpo corregido"}]'::jsonb
where id = 'a2000000-0000-4000-8000-000000000001';

select throws_ok(
  $$delete from public.stories where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '23514', 'published or archived stories cannot be deleted',
  'archived stories cannot be deleted'
);

select lives_ok(
  $$update public.stories set status = 'PUBLISHED' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  'an archived story may be republished when critical invariants still pass'
);

select is(
  (select home_rank from public.stories where id = 'a2000000-0000-4000-8000-000000000001'),
  null,
  'republishing does not restore a former home rank'
);

select throws_ok(
  $$update public.story_media set created_at = created_at - interval '1 day' where id = 'b2000000-0000-4000-8000-000000000001'$$,
  '23514', 'created_at is immutable',
  'story media created_at is immutable'
);

select * from finish();
rollback;
