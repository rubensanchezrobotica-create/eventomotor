begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select ok(not has_function_privilege('anon', 'public.publish_story(uuid,timestamptz,uuid)', 'execute'), 'anon cannot publish');
select ok(not has_function_privilege('authenticated', 'public.publish_story(uuid,timestamptz,uuid)', 'execute'), 'authenticated cannot publish');
select ok(not has_function_privilege('anon', 'public.replace_story_credits(uuid,timestamptz,jsonb)', 'execute'), 'anon cannot replace credits');
select ok(not has_function_privilege('authenticated', 'public.replace_story_credits(uuid,timestamptz,jsonb)', 'execute'), 'authenticated cannot replace credits');
select ok(not has_function_privilege('anon', 'public.replace_story_events(uuid,timestamptz,jsonb)', 'execute'), 'anon cannot replace events');
select ok(not has_function_privilege('authenticated', 'public.replace_story_events(uuid,timestamptz,jsonb)', 'execute'), 'authenticated cannot replace events');
select ok(has_function_privilege('service_role', 'public.publish_story(uuid,timestamptz,uuid)', 'execute'), 'service_role may call publication RPC');
select ok(has_function_privilege('service_role', 'public.replace_story_credits(uuid,timestamptz,jsonb)', 'execute'), 'service_role may call credit RPC');
select ok(has_function_privilege('service_role', 'public.replace_story_events(uuid,timestamptz,jsonb)', 'execute'), 'service_role may call event RPC');
select ok(not has_function_privilege('service_role', 'public.lock_editable_story(uuid,timestamptz)', 'execute'), 'internal lock helper is not exposed');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('publish_story','replace_story_credits','replace_story_events')
  and p.prosecdef and p.proconfig = array['search_path=""']), 3, 'all RPCs are SECURITY DEFINER with empty search_path');
select ok((select relrowsecurity from pg_class where oid='public.story_publication_receipts'::regclass), 'receipt ledger has RLS');
select ok(not has_table_privilege('anon','public.story_publication_receipts','select'), 'receipt ledger is private');

select ok(not pg_catalog.has_table_privilege('service_role', ('public.' || name)::regclass, 'TRUNCATE'),
  'service_role has no effective TRUNCATE privilege on ' || name)
from (values ('stories'), ('story_media'), ('editorial_people'), ('story_credits'),
  ('story_events'), ('story_publication_receipts')) as protected(name);
set local role service_role;
select throws_ok(pg_catalog.format('truncate table public.%I', name), '42501', null,
  'service_role TRUNCATE execution denied on ' || name)
from (values ('stories'), ('story_media'), ('editorial_people'), ('story_credits'),
  ('story_events'), ('story_publication_receipts')) as protected(name);
reset role;

insert into public.stories(id, type, collection, title, slug, dek, seo_title, seo_description, content_blocks)
values ('e1000000-0000-4000-8000-000000000001','REPORTAJE','DESDE_DENTRO','Synthetic transaction story','synthetic-transaction-story','Synthetic dek','Synthetic SEO','Synthetic description',
 '[{"id":"text-1","type":"PARAGRAPH","content":[{"type":"TEXT","text":"Synthetic body."}]}]');
insert into public.story_media(id, story_id, bucket_id, object_path, width, height, mime_type, byte_size, alt_text, rights_type)
values ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','story-media',
 'e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000001/asset.webp',1200,800,'image/webp',1000,'Synthetic alt','OWN');
update public.stories set hero_media_id='e2000000-0000-4000-8000-000000000001' where id='e1000000-0000-4000-8000-000000000001';
insert into public.editorial_people(id,display_name) values ('e3000000-0000-4000-8000-000000000001','Synthetic transaction editor');
insert into public.events(id,slug,title,start_date) values ('story-tx-event','story-tx-event','Synthetic transaction event','2030-01-01');

create function pg_temp.story_version() returns timestamptz language sql as
'select updated_at from public.stories where id = ''e1000000-0000-4000-8000-000000000001''';
create temporary table tx_snapshot(version timestamptz, body jsonb, lower_bound timestamptz);
insert into tx_snapshot select updated_at,content_blocks,clock_timestamp() from public.stories where id='e1000000-0000-4000-8000-000000000001';
grant select,update on tx_snapshot to service_role;

set local role service_role;
select throws_ok($$insert into public.story_credits(story_id,person_id,role) values ('e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','TEXT')$$,
 '42501', null, 'service_role direct credit INSERT is forbidden');
select throws_ok($$delete from public.story_credits where story_id='e1000000-0000-4000-8000-000000000001'$$,
 '42501', null, 'service_role direct credit DELETE is forbidden, even zero rows');
select throws_ok($$update public.story_credits set role='PHOTO' where story_id='e1000000-0000-4000-8000-000000000001'$$,
 '42501', null, 'service_role direct credit UPDATE is forbidden');
select throws_ok($$insert into public.story_events(story_id,event_id,relation_type) values ('e1000000-0000-4000-8000-000000000001','story-tx-event','PRIMARY')$$,
 '42501', null, 'service_role direct event INSERT is forbidden');
select throws_ok($$delete from public.story_events where story_id='e1000000-0000-4000-8000-000000000001'$$,
 '42501', null, 'service_role direct event DELETE is forbidden');
select throws_ok($$update public.story_events set sort_order=3 where story_id='e1000000-0000-4000-8000-000000000001'$$,
 '42501', null, 'service_role direct event UPDATE is forbidden');
select throws_ok($$insert into public.story_publication_receipts values ('e1000000-0000-4000-8000-000000000001',gen_random_uuid(),clock_timestamp(),clock_timestamp())$$,
 '42501', null, 'service_role cannot fabricate publication receipt');
select throws_ok($$select public.publish_story('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),'e4000000-0000-4000-8000-000000000001')$$,
 '55000','only READY stories can be published','DRAFT cannot publish');

select lives_ok($$select public.replace_story_credits('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),
 '[{"person_id":"e3000000-0000-4000-8000-000000000001","role":"TEXT","sort_order":0},{"person_id":"e3000000-0000-4000-8000-000000000001","role":"PHOTO","sort_order":1}]')$$,'one atomic RPC stores two roles');
select is((select count(*)::integer from public.story_credits where story_id='e1000000-0000-4000-8000-000000000001'),2,'same person has exactly two credits');
select is((select count(*)::integer from public.editorial_people where id='e3000000-0000-4000-8000-000000000001'),1,'no second person created');
update tx_snapshot set version=pg_temp.story_version();
select throws_ok($$select public.replace_story_credits('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),
 '[{"person_id":"e3000000-0000-4000-8000-000000000001","role":"TEXT","sort_order":0},{"person_id":"e3000000-0000-4000-8000-000000000001","role":"TEXT","sort_order":1}]')$$,
 '23505','duplicate person and role','exact duplicate rejected before DELETE');
select is(pg_temp.story_version(),(select version from tx_snapshot),'duplicate rejection leaves version intact');
select is((select count(*)::integer from public.story_credits where story_id='e1000000-0000-4000-8000-000000000001'),2,'duplicate rejection leaves old credits intact');
select throws_ok($$select public.replace_story_credits('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),
 '[{"person_id":"e3000000-0000-4000-8000-000000000099","role":"PHOTO","sort_order":0}]')$$,
 '23514','invalid story credits','invalid person fails before delete');
select is(pg_temp.story_version(),(select version from tx_snapshot),'invalid person leaves version intact');

select lives_ok($$select public.replace_story_events('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),
 '[{"event_id":"story-tx-event","relation_type":"PRIMARY","sort_order":0}]')$$,'event replacement is atomic');
select throws_ok($$select public.replace_story_credits('e1000000-0000-4000-8000-000000000001',(select version from tx_snapshot),'[]')$$,
 '40001','story version conflict','event replacement invalidates stale credit version');
update public.stories set status='READY' where id='e1000000-0000-4000-8000-000000000001';
select throws_ok($$update public.stories set status='PUBLISHED',published_at=clock_timestamp() where id='e1000000-0000-4000-8000-000000000001'$$,
 '42501','publication requires publish_story RPC','direct REST publication is blocked');
select throws_ok($$select public.publish_story('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),'e4000000-0000-4000-8000-000000000001')$$,
 '23514','publication requires verified public media rows and objects','missing object fails closed');
select is((select count(*)::integer from public.story_publication_receipts),0,'failed gate has no durable receipt');
update tx_snapshot set version=pg_temp.story_version();
update public.story_media set caption='Synthetic updated caption' where id='e2000000-0000-4000-8000-000000000001';
select ok(pg_temp.story_version() > (select version from tx_snapshot),'media metadata consumes common Story version');
select throws_ok($$select public.publish_story('e1000000-0000-4000-8000-000000000001',(select version from tx_snapshot),'e4000000-0000-4000-8000-000000000001')$$,
 '40001','story version conflict','old reviewed version cannot publish after media update');
reset role;
insert into storage.objects(bucket_id,name) values ('story-media','e1000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000001/asset.webp');
set local role service_role;
update tx_snapshot set version=pg_temp.story_version();
select lives_ok($$select public.publish_story('e1000000-0000-4000-8000-000000000001',(select version from tx_snapshot),'e4000000-0000-4000-8000-000000000001')$$,'valid publication commits');
select is((select status from public.stories where id='e1000000-0000-4000-8000-000000000001'),'PUBLISHED','publication changed status exactly once');
select is((select count(*)::integer from public.story_publication_receipts),1,'publication records one receipt');
select ok((select published_at >= (select lower_bound from tx_snapshot) and published_at <= clock_timestamp()
 from public.stories where id='e1000000-0000-4000-8000-000000000001'),'publication uses real server timestamp');
create temporary table published_version as select updated_at,published_at from public.stories where id='e1000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_story('e1000000-0000-4000-8000-000000000001',(select version from tx_snapshot),'e4000000-0000-4000-8000-000000000001')$$,'exact publication retry is idempotent');
select is((select updated_at from public.stories where id='e1000000-0000-4000-8000-000000000001'),(select updated_at from published_version),'retry preserves updated_at');
select is((select published_at from public.stories where id='e1000000-0000-4000-8000-000000000001'),(select published_at from published_version),'retry preserves published_at');
select throws_ok($$select public.publish_story('e1000000-0000-4000-8000-000000000001',(select version from tx_snapshot),'e4000000-0000-4000-8000-000000000002')$$,
 '40001','publication request conflict','different request cannot republish');
select throws_ok($$select public.replace_story_credits('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),'[]')$$,
 '55000','story is not editable','published credits cannot change');
select throws_ok($$select public.replace_story_events('e1000000-0000-4000-8000-000000000001',pg_temp.story_version(),'[]')$$,
 '55000','story is not editable','published relations cannot change');
select throws_ok($$update public.story_media set rights_type='UNKNOWN' where id='e2000000-0000-4000-8000-000000000001'$$,
 '55000','published story snapshot is immutable','published media cannot be invalidated');
select throws_ok($$update public.story_media set caption='Unreviewed edit' where id='e2000000-0000-4000-8000-000000000001'$$,
 '55000','published story snapshot is immutable','published media snapshot is frozen');
select throws_ok($$update public.stories set title='Unreviewed title' where id='e1000000-0000-4000-8000-000000000001'$$,
 '55000','published story snapshot is immutable','published body metadata is frozen');
select is((select content_blocks from public.stories where id='e1000000-0000-4000-8000-000000000001'),(select body from tx_snapshot),'body content preserved byte-for-byte as JSONB');
reset role;
select * from finish();
rollback;
