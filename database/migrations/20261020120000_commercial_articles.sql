begin;
-- Additive C1 extension: no content, media or publication is created here.
-- Rollout (separately authorized): validate exact SQL/SHA in ephemeral Supabase,
-- apply this transaction, verify ACL/triggers/RPCs, then enable commercial code.
-- Independent public projections work both before and after this migration.
-- On deployment failure keep commercial editing closed; do not restore direct
-- child writes, unfreeze published snapshots, or destructively roll back SQL.
alter table public.stories add column commercial_metadata jsonb;
alter table public.stories drop constraint stories_type_check;
alter table public.stories add constraint stories_type_check check
  (type = any (array['CRONICA','REPORTAJE','HISTORIA','ENTREVISTA','ARTICULO']::text[]));
alter table public.stories drop constraint stories_collection_check;
alter table public.stories add constraint stories_collection_check check
  (collection = any (array['DESDE_DENTRO','HISTORIAS_DE_MOTOR','CONVERSACIONES','COLABORACIONES']::text[]));
alter table public.stories add constraint stories_commercial_kind_check check
  ((collection = 'COLABORACIONES') = (type = 'ARTICULO'));

create function public.story_commercial_metadata_valid(m jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_typeof(m) = 'object'
    and m ?& array['advertiserName','advertiserConfirmed','factsVerified','editorialApprovalRef','imageAuthorizationRef','commercialLinksChecked','disclosureLabel','approvedContentHash']
    and m - array['advertiserName','advertiserConfirmed','factsVerified','editorialApprovalRef','imageAuthorizationRef','commercialLinksChecked','disclosureLabel','approvedContentHash'] = '{}'::jsonb
    and pg_catalog.jsonb_typeof(m->'advertiserName') = 'string' and pg_catalog.length(m->>'advertiserName') <= 1000
    and pg_catalog.jsonb_typeof(m->'editorialApprovalRef') = 'string' and pg_catalog.length(m->>'editorialApprovalRef') <= 1000
    and pg_catalog.jsonb_typeof(m->'imageAuthorizationRef') = 'string' and pg_catalog.length(m->>'imageAuthorizationRef') <= 1000
    and pg_catalog.jsonb_typeof(m->'advertiserConfirmed') = 'boolean'
    and pg_catalog.jsonb_typeof(m->'factsVerified') = 'boolean'
    and pg_catalog.jsonb_typeof(m->'commercialLinksChecked') = 'boolean'
    and m->>'disclosureLabel' = 'Contenido patrocinado'
    and (m->'approvedContentHash' = 'null'::jsonb or
      (pg_catalog.jsonb_typeof(m->'approvedContentHash') = 'string' and m->>'approvedContentHash' ~ '^[a-f0-9]{64}$')), false);
$$;

-- All contract keys are ASCII. Explicit C ordering matches the JS canonicalizer.
create function public.story_canonical_json(v jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare result text;
begin
  case pg_catalog.jsonb_typeof(v)
    when 'object' then
      select '{' || coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(key)::text || ':' || public.story_canonical_json(value), ',' order by key collate "C"), '') || '}'
        into result from pg_catalog.jsonb_each(v);
    when 'array' then
      select '[' || coalesce(pg_catalog.string_agg(public.story_canonical_json(value), ',' order by ordinal), '') || ']'
        into result from pg_catalog.jsonb_array_elements(v) with ordinality as a(value, ordinal);
    else result := v::text;
  end case;
  return result;
end;
$$;

create function public.story_commercial_content_hash(s public.stories)
returns text language sql immutable set search_path = '' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(public.story_canonical_json(pg_catalog.jsonb_build_array(
    s.id::text, s.slug, s.type, s.collection, s.title, s.dek, s.context_location, s.content_blocks,
    s.schema_version, s.hero_media_id::text, s.seo_title, s.seo_description, s.discipline_slugs,
    s.territory_ids, s.commercial_metadata - 'approvedContentHash'
  )), 'UTF8')), 'hex');
$$;

create function public.story_commercial_gate(s public.stories)
returns text[] language plpgsql immutable set search_path = '' as $$
declare errors text[] := '{}'::text[]; m jsonb := s.commercial_metadata;
begin
  if s.collection <> 'COLABORACIONES' then return errors; end if;
  if not public.story_commercial_metadata_valid(m) then return array['commercial_metadata_invalid']; end if;
  if pg_catalog.btrim(m->>'advertiserName') = '' or m->>'advertiserConfirmed' <> 'true' then errors := errors || 'advertiser_unconfirmed'::text; end if;
  if m->>'factsVerified' <> 'true' then errors := errors || 'facts_unverified'::text; end if;
  if pg_catalog.btrim(m->>'editorialApprovalRef') = '' then errors := errors || 'editorial_approval_missing'::text; end if;
  if pg_catalog.btrim(m->>'imageAuthorizationRef') = '' then errors := errors || 'image_authorization_missing'::text; end if;
  if m->>'commercialLinksChecked' <> 'true' then errors := errors || 'commercial_links_unchecked'::text; end if;
  if (m->>'approvedContentHash') is distinct from public.story_commercial_content_hash(s) then errors := errors || 'approved_version_mismatch'::text; end if;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(s.content_blocks) b,
      lateral pg_catalog.jsonb_array_elements(case when b->>'type' = 'PARAGRAPH' and pg_catalog.jsonb_typeof(b->'content') = 'array' then b->'content' else '[]'::jsonb end) n
    where n->>'type' = 'LINK' and n->'sponsored' = 'true'::jsonb
  ) then errors := errors || 'sponsored_link_missing'::text; end if;
  return errors;
end;
$$;

create function public.stories_commercial_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare errors text[];
begin
  if tg_op = 'UPDATE' and (old.collection = 'COLABORACIONES') <> (new.collection = 'COLABORACIONES') then
    raise exception using errcode = '23514', message = 'editorial and commercial identity is immutable';
  end if;
  if new.collection = 'COLABORACIONES' then
    if new.commercial_metadata is null then
      new.commercial_metadata := '{"advertiserName":"","advertiserConfirmed":false,"factsVerified":false,"editorialApprovalRef":"","imageAuthorizationRef":"","commercialLinksChecked":false,"disclosureLabel":"Contenido patrocinado","approvedContentHash":null}'::jsonb;
    end if;
    if not public.story_commercial_metadata_valid(new.commercial_metadata) then
      raise exception using errcode = '23514', message = 'commercial_metadata_invalid';
    end if;
    if new.status = 'DRAFT' and new.commercial_metadata->>'approvedContentHash' is not null
      and new.commercial_metadata->>'approvedContentHash' is distinct from public.story_commercial_content_hash(new) then
      new.commercial_metadata := pg_catalog.jsonb_set(new.commercial_metadata, '{approvedContentHash}', 'null'::jsonb);
    end if;
    if new.home_rank is not null then raise exception using errcode = '23514', message = 'commercial content cannot occupy an editorial Home rank'; end if;
    if new.status in ('READY','PUBLISHED') then
      errors := public.story_commercial_gate(new);
      if pg_catalog.cardinality(errors) > 0 then
        raise exception using errcode = '23514', message = 'commercial publication gate failed', detail = pg_catalog.array_to_string(errors, ',');
      end if;
    end if;
  elsif new.commercial_metadata is not null then
    raise exception using errcode = '23514', message = 'independent stories cannot contain sponsorship metadata';
  end if;
  return new;
end;
$$;
-- The existing parent row lock/version fence covers this trigger and publish_story.
create trigger stories_06_commercial_guard before insert or update on public.stories
for each row execute function public.stories_commercial_guard();

-- A16D's *_05 guard has already acquired the common Story lock. A semantic
-- child edit consumes approval in the SAME transaction. Promotion changes only
-- bucket/path/format/dimensions/bytes/timestamps and must leave approval intact.
create function public.story_commercial_children_invalidation()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare s public.stories; story_id uuid;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'story_media' then
      if row(new.alt_text,new.caption,new.credit,new.rights_type,new.rights_notes)
        is not distinct from row(old.alt_text,old.caption,old.credit,old.rights_type,old.rights_notes) then return new; end if;
    elsif tg_table_name = 'story_credits' then
      if row(new.person_id,new.role,new.sort_order) is not distinct from row(old.person_id,old.role,old.sort_order) then return new; end if;
    elsif tg_table_name = 'story_events' then
      if row(new.event_id,new.relation_type,new.sort_order) is not distinct from row(old.event_id,old.relation_type,old.sort_order) then return new; end if;
    end if;
  end if;
  story_id := case when tg_op = 'DELETE' then old.story_id else new.story_id end;
  select * into s from public.stories where id = story_id for update nowait;
  if found and s.collection = 'COLABORACIONES' then
    if s.status in ('PUBLISHED','ARCHIVED') then
      raise exception using errcode = '55000', message = 'published commercial snapshot is immutable';
    end if;
    if s.status = 'READY' or s.commercial_metadata->>'approvedContentHash' is not null then
      update public.stories set status = 'DRAFT', commercial_metadata =
        pg_catalog.jsonb_set(commercial_metadata, '{approvedContentHash}', 'null'::jsonb) where id = s.id;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger story_media_06_commercial_invalidation before insert or update or delete on public.story_media
for each row execute function public.story_commercial_children_invalidation();
create trigger story_credits_06_commercial_invalidation before insert or update or delete on public.story_credits
for each row execute function public.story_commercial_children_invalidation();
create trigger story_events_06_commercial_invalidation before insert or update or delete on public.story_events
for each row execute function public.story_commercial_children_invalidation();

-- Person edits are another permitted backend path. Person-first writers never
-- wait for a parent lock (publication uses parent -> people SHARE locks).
create function public.story_commercial_person_invalidation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.stories;
begin
  if row(new.display_name,new.active) is not distinct from row(old.display_name,old.active) then return new; end if;
  for s in select st.* from public.stories st where st.collection = 'COLABORACIONES'
    and exists (select 1 from public.story_credits c where c.story_id = st.id and c.person_id = old.id)
    order by st.id for update nowait
  loop
    if s.status in ('PUBLISHED','ARCHIVED') then
      raise exception using errcode = '55000', message = 'published commercial attribution is immutable';
    end if;
    update public.stories set status = 'DRAFT', commercial_metadata =
      pg_catalog.jsonb_set(commercial_metadata, '{approvedContentHash}', 'null'::jsonb) where id = s.id;
  end loop;
  return new;
end;
$$;
create trigger editorial_people_05_commercial_invalidation before update on public.editorial_people
for each row execute function public.story_commercial_person_invalidation();

-- The RPC inserts its receipt and updates status in one transaction. A failed
-- attribution check rolls both back. Existing pre-A16D legacy snapshots without
-- receipts retain their lifecycle semantics; no public content is rewritten.
create function public.story_publication_attribution_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.collection = 'COLABORACIONES' and new.status = 'READY')
    or (new.status = 'PUBLISHED' and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED')
      and (new.collection = 'COLABORACIONES' or exists (select 1 from public.story_publication_receipts r where r.story_id = new.id))) then
    perform 1 from public.editorial_people p where exists
      (select 1 from public.story_credits c where c.story_id = new.id and c.person_id = p.id)
      order by p.id for share;
    if not exists (select 1 from public.story_credits c join public.editorial_people p on p.id = c.person_id
        where c.story_id = new.id and c.role = 'TEXT' and p.active and pg_catalog.btrim(p.display_name) <> '')
      or exists (select 1 from public.story_credits c left join public.editorial_people p on p.id = c.person_id
        where c.story_id = new.id and (p.id is null or not p.active or pg_catalog.btrim(p.display_name) = '')) then
      raise exception using errcode = '23514', message = 'publication requires valid editorial attribution';
    end if;
  end if;
  return new;
end;
$$;
create trigger stories_20_publication_attribution_guard before insert or update on public.stories
for each row execute function public.story_publication_attribution_guard();
revoke all on function public.story_commercial_metadata_valid(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_canonical_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_commercial_content_hash(public.stories) from public, anon, authenticated, service_role;
revoke all on function public.story_commercial_gate(public.stories) from public, anon, authenticated, service_role;
revoke all on function public.stories_commercial_guard() from public, anon, authenticated, service_role;
revoke all on function public.story_commercial_children_invalidation() from public, anon, authenticated, service_role;
revoke all on function public.story_commercial_person_invalidation() from public, anon, authenticated, service_role;
revoke all on function public.story_publication_attribution_guard() from public, anon, authenticated, service_role;
-- Needed by invoker triggers; table access and publication EXECUTE remain unchanged.
grant execute on function public.story_commercial_metadata_valid(jsonb), public.story_canonical_json(jsonb),
  public.story_commercial_content_hash(public.stories), public.story_commercial_gate(public.stories) to service_role;
commit;
