begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select no_plan();
select ok(not has_function_privilege('anon','public.story_commercial_gate(public.stories)','execute'), 'anon cannot inspect private commercial evidence');
select ok(not has_function_privilege('authenticated','public.story_commercial_content_hash(public.stories)','execute'), 'authenticated cannot inspect private approvals');
select ok(not has_table_privilege('anon','public.stories','select'), 'no new anonymous table access');
select ok(not has_table_privilege('service_role','public.stories','truncate'), 'TRUNCATE stays denied');
insert into public.stories(id,type,collection,title,slug,dek,seo_title,seo_description,content_blocks)
values ('c1000000-0000-4000-8000-000000000001','ARTICULO','COLABORACIONES','Synthetic commercial','synthetic-commercial','Synthetic summary','Synthetic SEO','Synthetic description',
  '[{"id":"p","type":"PARAGRAPH","content":[{"type":"LINK","href":"https://example.test/paid","sponsored":true,"children":[{"type":"TEXT","text":"Synthetic paid link"}]}]}]');
select is((select status from public.stories where id='c1000000-0000-4000-8000-000000000001'),'DRAFT','commercial content starts DRAFT');
select is((select commercial_metadata->>'advertiserName' from public.stories where id='c1000000-0000-4000-8000-000000000001'),'','advertiser is not inferred');
select throws_ok($$update public.stories set status='READY' where id='c1000000-0000-4000-8000-000000000001'$$,'23514','commercial publication gate failed','incomplete metadata blocks READY');
select throws_ok($$update public.stories set collection='DESDE_DENTRO',type='REPORTAJE' where id='c1000000-0000-4000-8000-000000000001'$$,'23514','editorial and commercial identity is immutable','cannot hide sponsorship by reclassification');
insert into public.editorial_people(id,display_name) values ('c3000000-0000-4000-8000-000000000001','Synthetic commercial author');
insert into public.story_credits(story_id,person_id,role) values ('c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','TEXT');
insert into public.story_media(id,story_id,bucket_id,object_path,width,height,mime_type,byte_size,alt_text,rights_type)
values ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','story-media-drafts',
 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/asset.webp',1200,800,'image/webp',1000,'Synthetic ALT','LICENSED');
update public.stories set hero_media_id='c2000000-0000-4000-8000-000000000001' where id='c1000000-0000-4000-8000-000000000001';
update public.stories set commercial_metadata = commercial_metadata || '{"advertiserName":"Synthetic advertiser","advertiserConfirmed":true,"factsVerified":true,"editorialApprovalRef":"SYNTHETIC_APPROVAL","imageAuthorizationRef":"SYNTHETIC_IMAGE_RIGHTS","commercialLinksChecked":true}'::jsonb
where id='c1000000-0000-4000-8000-000000000001';
select throws_ok($$update public.stories set status='READY' where id='c1000000-0000-4000-8000-000000000001'$$,'23514','commercial publication gate failed','references alone do not approve the current version');
update public.stories s set commercial_metadata = s.commercial_metadata || jsonb_build_object('approvedContentHash',public.story_commercial_content_hash(s))
where id='c1000000-0000-4000-8000-000000000001';
select lives_ok($$update public.stories set status='READY' where id='c1000000-0000-4000-8000-000000000001'$$,'exact approved version can become READY');
select throws_ok($$update public.stories set title='Unreviewed edit' where id='c1000000-0000-4000-8000-000000000001'$$,'23514','commercial publication gate failed','changed text cannot remain READY');
select throws_ok($$update public.stories set home_rank=1 where id='c1000000-0000-4000-8000-000000000001'$$,'23514','commercial content cannot occupy an editorial Home rank','no commercial editorial Home rank');
select throws_ok($$update public.stories set commercial_metadata=commercial_metadata || '{"factsVerified":false}'::jsonb where id='c1000000-0000-4000-8000-000000000001'$$,'23514','commercial publication gate failed','facts cannot be invalidated while READY');
update public.stories set status='DRAFT',title='Revised synthetic draft' where id='c1000000-0000-4000-8000-000000000001';
select ok('approved_version_mismatch'=any((select public.story_commercial_gate(s) from public.stories s where id='c1000000-0000-4000-8000-000000000001')), 'edited DRAFT needs fresh approval');
select is((select count(*)::integer from public.story_publication_receipts where story_id='c1000000-0000-4000-8000-000000000001'),0,'failed gates do not create receipts');

create function pg_temp.reapprove_commercial() returns void language sql as $$
 update public.stories s set commercial_metadata = jsonb_set(commercial_metadata,'{approvedContentHash}',to_jsonb(public.story_commercial_content_hash(s))),status='READY'
 where id='c1000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.commercial_is_invalidated() returns boolean language sql as $$
 select status='DRAFT' and commercial_metadata->>'approvedContentHash' is null from public.stories where id='c1000000-0000-4000-8000-000000000001';
$$;
select pg_temp.reapprove_commercial();
update public.story_media set caption='Revised caption' where id='c2000000-0000-4000-8000-000000000001';
select ok(pg_temp.commercial_is_invalidated(),'caption invalidates approval and READY atomically'); select pg_temp.reapprove_commercial();
update public.story_media set alt_text='Revised ALT' where id='c2000000-0000-4000-8000-000000000001';
select ok(pg_temp.commercial_is_invalidated(),'ALT invalidates approval'); select pg_temp.reapprove_commercial();
update public.story_media set credit='Revised photo credit' where id='c2000000-0000-4000-8000-000000000001';
select ok(pg_temp.commercial_is_invalidated(),'photo credit invalidates approval'); select pg_temp.reapprove_commercial();
update public.story_media set rights_type='OWN' where id='c2000000-0000-4000-8000-000000000001';
select ok(pg_temp.commercial_is_invalidated(),'rights type invalidates approval'); select pg_temp.reapprove_commercial();
update public.story_media set rights_notes='Revised authorization evidence' where id='c2000000-0000-4000-8000-000000000001';
select ok(pg_temp.commercial_is_invalidated(),'rights evidence invalidates approval'); select pg_temp.reapprove_commercial();
update public.story_media set bucket_id='story-media',width=1199,height=799,byte_size=900 where id='c2000000-0000-4000-8000-000000000001';
select is((select status from public.stories where id='c1000000-0000-4000-8000-000000000001'),'READY','technical derivative changes preserve READY');
select is(cardinality((select public.story_commercial_gate(s) from public.stories s where id='c1000000-0000-4000-8000-000000000001')),0,'technical changes preserve valid approval');
update public.stories set status='DRAFT',commercial_metadata=commercial_metadata || '{"imageAuthorizationRef":"REVISED_REF"}'::jsonb where id='c1000000-0000-4000-8000-000000000001';
select ok(pg_temp.commercial_is_invalidated(),'image authorization reference requires fresh approval'); select pg_temp.reapprove_commercial();
update public.editorial_people set display_name='Revised synthetic author' where id='c3000000-0000-4000-8000-000000000001';
select ok(pg_temp.commercial_is_invalidated(),'author backend edits invalidate approval'); select pg_temp.reapprove_commercial();
select public.replace_story_credits('c1000000-0000-4000-8000-000000000001',
 (select updated_at from public.stories where id='c1000000-0000-4000-8000-000000000001'),
 '[{"person_id":"c3000000-0000-4000-8000-000000000001","role":"PHOTO","sort_order":0}]');
select ok(pg_temp.commercial_is_invalidated(),'credit RPC invalidates approval');
select throws_ok($$select pg_temp.reapprove_commercial()$$,'23514','publication requires valid editorial attribution','approval cannot substitute for a TEXT author');
select is((select count(*)::integer from public.story_publication_receipts where story_id='c1000000-0000-4000-8000-000000000001'),0,'invalid attribution cannot manufacture a receipt');
select ok(not has_function_privilege('service_role','public.story_commercial_person_invalidation()','execute'),'invalidation definer is not an exposed RPC');
select * from finish();
rollback;
