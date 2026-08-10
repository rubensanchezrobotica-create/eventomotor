-- Newsletter edition 02 recipient personalization and immutable audience snapshot.
-- Additive to the edition 01 campaign API; performs no provider or remote HTTP calls.

begin;

alter table public.newsletter_campaigns
  add column audience_frozen_at timestamptz,
  add column content_manifest_digest text;

alter table public.newsletter_campaigns
  add constraint newsletter_campaigns_content_manifest_digest_check check (
    content_manifest_digest is null
    or content_manifest_digest ~ '^[0-9a-f]{64}$'
  ),
  add constraint newsletter_campaigns_audience_frozen_at_check check (
    audience_frozen_at is null
    or audience_frozen_at >= created_at
  );

alter table public.newsletter_campaign_deliveries
  add column content_variant text not null default 'national';

alter table public.newsletter_campaign_deliveries
  add constraint newsletter_campaign_deliveries_content_variant_check check (
    content_variant in ('national', 'madrid', 'a-coruna', 'barcelona')
  );

comment on column public.newsletter_campaigns.audience_frozen_at is
  'First effective v2 preparation time. Once set, no later subscriber is added to this campaign.';
comment on column public.newsletter_campaigns.content_manifest_digest is
  'SHA-256 of the edition variant map, territorial copy and complete asset manifest.';
comment on column public.newsletter_campaign_deliveries.content_variant is
  'Immutable rendering snapshot selected during campaign preparation; it is never recalculated during claim.';

create index newsletter_campaign_deliveries_variant_idx
  on public.newsletter_campaign_deliveries (campaign_id, content_variant);

create or replace function public.newsletter_campaign_delivery_freeze_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audience_frozen_at timestamptz;
begin
  select campaign.audience_frozen_at into v_audience_frozen_at
  from public.newsletter_campaigns as campaign
  where campaign.id = new.campaign_id
  for update;

  if not found then
    raise exception 'newsletter campaign unavailable';
  end if;

  if v_audience_frozen_at is not null then
    raise exception 'newsletter campaign audience is frozen';
  end if;

  return new;
end;
$$;

revoke all on function public.newsletter_campaign_delivery_freeze_guard()
from public, anon, authenticated, service_role;

create trigger newsletter_campaign_deliveries_freeze_guard
before insert on public.newsletter_campaign_deliveries
for each row execute function public.newsletter_campaign_delivery_freeze_guard();

create or replace function public.newsletter_edition_02_content_variant(
  p_province_slug text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_province_slug
    when 'madrid' then 'madrid'
    when 'a-coruna' then 'a-coruna'
    when 'barcelona' then 'barcelona'
    else 'national'
  end;
$$;

create or replace function public.newsletter_edition_02_subscriber_is_sendable(
  p_subscriber_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.newsletter_campaign_subscriber_is_eligible(p_subscriber_id)
    and exists (
      select 1
      from public.newsletter_subscribers as subscriber
      where subscriber.id = p_subscriber_id
        and subscriber.email_normalized = pg_catalog.btrim(subscriber.email_normalized)
        and char_length(subscriber.email_normalized) between 3 and 320
        and subscriber.email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );
$$;

revoke all on function public.newsletter_edition_02_content_variant(text)
from public, anon, authenticated, service_role;
revoke all on function public.newsletter_edition_02_subscriber_is_sendable(uuid)
from public, anon, authenticated, service_role;

-- Keep the published v1 signatures intact, but fail closed when a caller tries
-- to route a v2 campaign through the legacy preparation or claim boundary.
create or replace function public.prepare_newsletter_campaign(
  p_edition_key text,
  p_subject text,
  p_html_sha256 text,
  p_text_sha256 text
)
returns table (
  campaign_id uuid,
  campaign_status text,
  eligible_count integer,
  prepared_count integer,
  sending_count integer,
  accepted_count integer,
  failed_count integer,
  unknown_count integer,
  retryable_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.newsletter_campaigns%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_edition_key is null
    or p_edition_key !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    or char_length(p_edition_key) not between 3 and 100
    or p_subject is null
    or char_length(p_subject) not between 1 and 200
    or p_subject <> pg_catalog.btrim(p_subject)
    or p_subject like '[PRUEBA]%'
    or p_html_sha256 is null or p_html_sha256 !~ '^[0-9a-f]{64}$'
    or p_text_sha256 is null or p_text_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter campaign identity';
  end if;

  insert into public.newsletter_campaigns (
    edition_key, subject, html_sha256, text_sha256,
    status, created_at, updated_at, prepared_at
  ) values (
    p_edition_key, p_subject, p_html_sha256, p_text_sha256,
    'prepared', v_now, v_now, v_now
  )
  on conflict on constraint newsletter_campaigns_edition_key do nothing;

  select * into strict v_campaign
  from public.newsletter_campaigns as campaign
  where campaign.edition_key = p_edition_key
  for update;

  if v_campaign.content_manifest_digest is not null then
    raise exception 'newsletter campaign v2 requires prepare v2';
  end if;

  if v_campaign.subject <> p_subject
    or v_campaign.html_sha256 <> p_html_sha256
    or v_campaign.text_sha256 <> p_text_sha256 then
    raise exception 'newsletter campaign content mismatch';
  end if;

  insert into public.newsletter_campaign_deliveries (
    campaign_id, subscriber_id, status, created_at, updated_at, prepared_at
  )
  select v_campaign.id, subscriber.id, 'prepared', v_now, v_now, v_now
  from public.newsletter_subscribers as subscriber
  where public.newsletter_campaign_subscriber_is_eligible(subscriber.id)
  on conflict on constraint newsletter_campaign_deliveries_recipient_key do nothing;

  update public.newsletter_campaigns as campaign
  set status = case
        when exists (
          select 1
          from public.newsletter_campaign_deliveries as delivery
          where delivery.campaign_id = campaign.id
            and delivery.status = 'unknown'
        ) then 'paused'
        when exists (
          select 1
          from public.newsletter_campaign_deliveries as delivery
          where delivery.campaign_id = campaign.id
            and delivery.status <> 'accepted'
        ) then 'prepared'
        else campaign.status
      end,
      updated_at = greatest(v_now, campaign.updated_at),
      prepared_at = greatest(v_now, campaign.prepared_at)
  where campaign.id = v_campaign.id
  returning * into v_campaign;

  return query
  select * from public.preview_newsletter_campaign(
    p_edition_key, p_subject, p_html_sha256, p_text_sha256
  );
end;
$$;

create or replace function public.claim_newsletter_campaign_delivery(
  p_campaign_id uuid,
  p_token_hash text,
  p_allow_retry boolean default false
)
returns table (
  delivery_id uuid,
  campaign_id uuid,
  subscriber_id uuid,
  recipient_email text,
  claim_id uuid,
  attempt_count integer,
  idempotency_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.newsletter_campaigns%rowtype;
  v_delivery public.newsletter_campaign_deliveries%rowtype;
  v_subscriber public.newsletter_subscribers%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_claim_id uuid;
  v_attempt integer;
  v_idempotency_key text;
begin
  if p_campaign_id is null
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_allow_retry is null then
    raise exception 'invalid newsletter campaign claim';
  end if;

  select * into v_campaign
  from public.newsletter_campaigns as campaign
  where campaign.id = p_campaign_id
  for update;
  if not found then
    raise exception 'newsletter campaign unavailable';
  end if;

  if v_campaign.content_manifest_digest is not null then
    raise exception 'newsletter campaign v2 requires claim v2';
  end if;

  -- A process may have stopped after the provider accepted the request. Once
  -- its short lease is stale, fail closed as unknown and never auto-retry it.
  update public.newsletter_campaign_deliveries as stale
  set status = 'unknown',
      retryable = false,
      claim_id = null,
      last_error_code = 'stale_claim_unknown',
      unknown_at = greatest(v_now, stale.created_at),
      updated_at = greatest(v_now, stale.updated_at)
  where stale.campaign_id = p_campaign_id
    and stale.status = 'sending'
    and stale.claimed_at < v_now - interval '15 minutes';

  -- The campaign row lock above serializes claim attempts for this campaign.
  -- Once a worker owns a current lease, no other delivery may be claimed.
  if exists (
    select 1
    from public.newsletter_campaign_deliveries as active
    where active.campaign_id = p_campaign_id
      and active.status = 'sending'
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.newsletter_campaign_deliveries as delivery
    where delivery.campaign_id = p_campaign_id
      and delivery.status = 'unknown'
  ) then
    update public.newsletter_campaigns as campaign
    set status = 'paused',
        updated_at = greatest(v_now, campaign.updated_at)
    where campaign.id = p_campaign_id;
  end if;

  loop
    select * into v_delivery
    from public.newsletter_campaign_deliveries as delivery
    where delivery.campaign_id = p_campaign_id
      and (
        delivery.status = 'prepared'
        or (
          p_allow_retry
          and delivery.status = 'failed'
          and delivery.retryable
        )
      )
    order by delivery.created_at, delivery.id
    for update skip locked
    limit 1;

    if not found then
      return;
    end if;

    select * into v_subscriber
    from public.newsletter_subscribers as subscriber
    where subscriber.id = v_delivery.subscriber_id
    for update;

    if not found
      or not public.newsletter_campaign_subscriber_is_eligible(v_delivery.subscriber_id) then
      update public.newsletter_campaign_deliveries as delivery
      set status = 'failed',
          retryable = false,
          claim_id = null,
          last_error_code = 'subscriber_ineligible',
          failed_at = greatest(v_now, delivery.created_at),
          updated_at = greatest(v_now, delivery.updated_at)
      where delivery.id = v_delivery.id;
      continue;
    end if;

    v_claim_id := gen_random_uuid();
    v_attempt := v_delivery.attempt_count + 1;
    v_idempotency_key :=
      'newsletter/' || p_campaign_id::text || '/' || v_delivery.id::text || '/' || v_attempt::text;

    insert into public.newsletter_campaign_unsubscribe_tokens (
      delivery_id, subscriber_id, attempt_number, token_hash,
      created_at, updated_at
    ) values (
      v_delivery.id, v_delivery.subscriber_id, v_attempt, p_token_hash,
      v_now, v_now
    );

    update public.newsletter_campaign_deliveries as delivery
    set status = 'sending',
        attempt_count = v_attempt,
        retryable = false,
        claim_id = v_claim_id,
        idempotency_key = v_idempotency_key,
        provider_message_id = null,
        last_error_code = null,
        last_attempt_at = v_now,
        claimed_at = v_now,
        accepted_at = null,
        failed_at = null,
        unknown_at = null,
        updated_at = greatest(v_now, delivery.updated_at)
    where delivery.id = v_delivery.id;

    update public.newsletter_campaigns as campaign
    set status = 'sending',
        started_at = coalesce(campaign.started_at, v_now),
        updated_at = greatest(v_now, campaign.updated_at)
    where campaign.id = p_campaign_id;

    return query select
      v_delivery.id,
      p_campaign_id,
      v_delivery.subscriber_id,
      v_subscriber.email_normalized,
      v_claim_id,
      v_attempt,
      v_idempotency_key;
    return;
  end loop;
end;
$$;

create or replace function public.preview_newsletter_campaign_v2(
  p_edition_key text,
  p_subject text,
  p_html_sha256 text,
  p_text_sha256 text,
  p_content_manifest_digest text
)
returns table (
  campaign_id uuid,
  campaign_status text,
  audience_frozen_at timestamptz,
  eligible_count integer,
  prepared_count integer,
  sending_count integer,
  accepted_count integer,
  failed_count integer,
  unknown_count integer,
  retryable_count integer,
  national_count integer,
  madrid_count integer,
  a_coruna_count integer,
  barcelona_count integer,
  excluded_count integer,
  duplicate_count integer,
  invalid_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.newsletter_campaigns%rowtype;
  v_current_eligible integer;
  v_current_invalid integer;
  v_current_excluded integer;
  v_current_duplicates integer;
begin
  if p_edition_key is null
    or p_edition_key !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    or char_length(p_edition_key) not between 3 and 100
    or p_subject is null
    or char_length(p_subject) not between 1 and 200
    or p_subject <> pg_catalog.btrim(p_subject)
    or p_subject like '[PRUEBA]%'
    or p_html_sha256 is null or p_html_sha256 !~ '^[0-9a-f]{64}$'
    or p_text_sha256 is null or p_text_sha256 !~ '^[0-9a-f]{64}$'
    or p_content_manifest_digest is null
    or p_content_manifest_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter campaign v2 identity';
  end if;

  select * into v_campaign
  from public.newsletter_campaigns as campaign
  where campaign.edition_key = p_edition_key;

  if found and (
    v_campaign.subject <> p_subject
    or v_campaign.html_sha256 <> p_html_sha256
    or v_campaign.text_sha256 <> p_text_sha256
    or v_campaign.content_manifest_digest is distinct from p_content_manifest_digest
  ) then
    raise exception 'newsletter campaign v2 content mismatch';
  end if;

  select pg_catalog.count(*)::integer into v_current_eligible
  from public.newsletter_subscribers as subscriber
  where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id);

  select pg_catalog.count(*)::integer into v_current_invalid
  from public.newsletter_subscribers as subscriber
  where public.newsletter_campaign_subscriber_is_eligible(subscriber.id)
    and not public.newsletter_edition_02_subscriber_is_sendable(subscriber.id);

  select (
    pg_catalog.count(*)
    - v_current_eligible
    - v_current_invalid
  )::integer into v_current_excluded
  from public.newsletter_subscribers;

  select coalesce(pg_catalog.sum(duplicates), 0)::integer into v_current_duplicates
  from (
    select greatest(pg_catalog.count(*) - 1, 0) as duplicates
    from public.newsletter_subscribers as subscriber
    where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id)
    group by subscriber.email_normalized
  ) as duplicate_groups;

  return query
  select
    v_campaign.id,
    coalesce(v_campaign.status, 'not_created'),
    v_campaign.audience_frozen_at,
    case
      when v_campaign.id is null then v_current_eligible
      else pg_catalog.count(delivery.id)::integer
    end,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'prepared'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'sending'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'accepted'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'failed'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'unknown'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (
      where delivery.status = 'failed' and delivery.retryable
    ), 0)::integer,
    case when v_campaign.id is null then (
      select pg_catalog.count(*)::integer
      from public.newsletter_subscribers as subscriber
      where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id)
        and public.newsletter_edition_02_content_variant(subscriber.province_slug) = 'national'
    ) else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'national'
    ), 0)::integer end,
    case when v_campaign.id is null then (
      select pg_catalog.count(*)::integer
      from public.newsletter_subscribers as subscriber
      where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id)
        and public.newsletter_edition_02_content_variant(subscriber.province_slug) = 'madrid'
    ) else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'madrid'
    ), 0)::integer end,
    case when v_campaign.id is null then (
      select pg_catalog.count(*)::integer
      from public.newsletter_subscribers as subscriber
      where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id)
        and public.newsletter_edition_02_content_variant(subscriber.province_slug) = 'a-coruna'
    ) else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'a-coruna'
    ), 0)::integer end,
    case when v_campaign.id is null then (
      select pg_catalog.count(*)::integer
      from public.newsletter_subscribers as subscriber
      where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id)
        and public.newsletter_edition_02_content_variant(subscriber.province_slug) = 'barcelona'
    ) else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'barcelona'
    ), 0)::integer end,
    v_current_excluded,
    v_current_duplicates,
    v_current_invalid
  from public.newsletter_campaign_deliveries as delivery
  where delivery.campaign_id = v_campaign.id;
end;
$$;

create or replace function public.prepare_newsletter_campaign_v2(
  p_edition_key text,
  p_subject text,
  p_html_sha256 text,
  p_text_sha256 text,
  p_content_manifest_digest text
)
returns table (
  campaign_id uuid,
  campaign_status text,
  audience_frozen_at timestamptz,
  eligible_count integer,
  prepared_count integer,
  sending_count integer,
  accepted_count integer,
  failed_count integer,
  unknown_count integer,
  retryable_count integer,
  national_count integer,
  madrid_count integer,
  a_coruna_count integer,
  barcelona_count integer,
  excluded_count integer,
  duplicate_count integer,
  invalid_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.newsletter_campaigns%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_edition_key is null
    or p_edition_key !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    or char_length(p_edition_key) not between 3 and 100
    or p_subject is null
    or char_length(p_subject) not between 1 and 200
    or p_subject <> pg_catalog.btrim(p_subject)
    or p_subject like '[PRUEBA]%'
    or p_html_sha256 is null or p_html_sha256 !~ '^[0-9a-f]{64}$'
    or p_text_sha256 is null or p_text_sha256 !~ '^[0-9a-f]{64}$'
    or p_content_manifest_digest is null
    or p_content_manifest_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter campaign v2 identity';
  end if;

  insert into public.newsletter_campaigns (
    edition_key, subject, html_sha256, text_sha256, content_manifest_digest,
    status, created_at, updated_at, prepared_at
  ) values (
    p_edition_key, p_subject, p_html_sha256, p_text_sha256,
    p_content_manifest_digest, 'prepared', v_now, v_now, v_now
  )
  on conflict on constraint newsletter_campaigns_edition_key do nothing;

  select * into strict v_campaign
  from public.newsletter_campaigns as campaign
  where campaign.edition_key = p_edition_key
  for update;

  if v_campaign.subject <> p_subject
    or v_campaign.html_sha256 <> p_html_sha256
    or v_campaign.text_sha256 <> p_text_sha256
    or v_campaign.content_manifest_digest is distinct from p_content_manifest_digest then
    raise exception 'newsletter campaign v2 content mismatch';
  end if;

  if v_campaign.audience_frozen_at is null then
    insert into public.newsletter_campaign_deliveries (
      campaign_id, subscriber_id, content_variant,
      status, created_at, updated_at, prepared_at
    )
    select
      v_campaign.id,
      subscriber.id,
      public.newsletter_edition_02_content_variant(subscriber.province_slug),
      'prepared', v_now, v_now, v_now
    from public.newsletter_subscribers as subscriber
    where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id)
    on conflict on constraint newsletter_campaign_deliveries_recipient_key do nothing;

    update public.newsletter_campaigns as campaign
    set audience_frozen_at = greatest(v_now, campaign.created_at),
        updated_at = greatest(v_now, campaign.updated_at),
        prepared_at = greatest(v_now, campaign.prepared_at)
    where campaign.id = v_campaign.id
    returning * into v_campaign;
  end if;

  update public.newsletter_campaigns as campaign
  set status = case
        when exists (
          select 1 from public.newsletter_campaign_deliveries as delivery
          where delivery.campaign_id = campaign.id and delivery.status = 'unknown'
        ) then 'paused'
        when exists (
          select 1 from public.newsletter_campaign_deliveries as delivery
          where delivery.campaign_id = campaign.id and delivery.status <> 'accepted'
        ) then 'prepared'
        else campaign.status
      end,
      updated_at = greatest(v_now, campaign.updated_at)
  where campaign.id = v_campaign.id;

  return query
  select * from public.preview_newsletter_campaign_v2(
    p_edition_key, p_subject, p_html_sha256, p_text_sha256,
    p_content_manifest_digest
  );
end;
$$;

create or replace function public.claim_newsletter_campaign_delivery_v2(
  p_campaign_id uuid,
  p_token_hash text,
  p_allow_retry boolean default false
)
returns table (
  delivery_id uuid,
  campaign_id uuid,
  subscriber_id uuid,
  recipient_email text,
  claim_id uuid,
  attempt_count integer,
  idempotency_key text,
  content_variant text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.newsletter_campaigns%rowtype;
  v_delivery public.newsletter_campaign_deliveries%rowtype;
  v_subscriber public.newsletter_subscribers%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_claim_id uuid;
  v_attempt integer;
  v_idempotency_key text;
begin
  if p_campaign_id is null
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_allow_retry is null then
    raise exception 'invalid newsletter campaign v2 claim';
  end if;

  select * into v_campaign
  from public.newsletter_campaigns as campaign
  where campaign.id = p_campaign_id
  for update;
  if not found
    or v_campaign.audience_frozen_at is null
    or v_campaign.content_manifest_digest is null then
    raise exception 'newsletter campaign v2 unavailable';
  end if;

  update public.newsletter_campaign_deliveries as stale
  set status = 'unknown',
      retryable = false,
      claim_id = null,
      last_error_code = 'stale_claim_unknown',
      unknown_at = greatest(v_now, stale.created_at),
      updated_at = greatest(v_now, stale.updated_at)
  where stale.campaign_id = p_campaign_id
    and stale.status = 'sending'
    and stale.claimed_at < v_now - interval '15 minutes';

  if exists (
    select 1
    from public.newsletter_campaign_deliveries as active
    where active.campaign_id = p_campaign_id
      and active.status = 'sending'
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.newsletter_campaign_deliveries as delivery
    where delivery.campaign_id = p_campaign_id
      and delivery.status = 'unknown'
  ) then
    update public.newsletter_campaigns as campaign
    set status = 'paused', updated_at = greatest(v_now, campaign.updated_at)
    where campaign.id = p_campaign_id;
  end if;

  loop
    select * into v_delivery
    from public.newsletter_campaign_deliveries as delivery
    where delivery.campaign_id = p_campaign_id
      and (
        delivery.status = 'prepared'
        or (p_allow_retry and delivery.status = 'failed' and delivery.retryable)
      )
    order by delivery.created_at, delivery.id
    for update skip locked
    limit 1;

    if not found then return; end if;

    select * into v_subscriber
    from public.newsletter_subscribers as subscriber
    where subscriber.id = v_delivery.subscriber_id
    for update;

    if not found
      or not public.newsletter_edition_02_subscriber_is_sendable(v_delivery.subscriber_id) then
      update public.newsletter_campaign_deliveries as delivery
      set status = 'failed',
          retryable = false,
          claim_id = null,
          last_error_code = 'subscriber_ineligible',
          failed_at = greatest(v_now, delivery.created_at),
          updated_at = greatest(v_now, delivery.updated_at)
      where delivery.id = v_delivery.id;
      continue;
    end if;

    v_claim_id := gen_random_uuid();
    v_attempt := v_delivery.attempt_count + 1;
    v_idempotency_key :=
      'newsletter/' || p_campaign_id::text || '/' || v_delivery.id::text || '/' || v_attempt::text;

    insert into public.newsletter_campaign_unsubscribe_tokens (
      delivery_id, subscriber_id, attempt_number, token_hash,
      created_at, updated_at
    ) values (
      v_delivery.id, v_delivery.subscriber_id, v_attempt, p_token_hash,
      v_now, v_now
    );

    update public.newsletter_campaign_deliveries as delivery
    set status = 'sending',
        attempt_count = v_attempt,
        retryable = false,
        claim_id = v_claim_id,
        idempotency_key = v_idempotency_key,
        provider_message_id = null,
        last_error_code = null,
        last_attempt_at = v_now,
        claimed_at = v_now,
        accepted_at = null,
        failed_at = null,
        unknown_at = null,
        updated_at = greatest(v_now, delivery.updated_at)
    where delivery.id = v_delivery.id;

    update public.newsletter_campaigns as campaign
    set status = 'sending',
        started_at = coalesce(campaign.started_at, v_now),
        updated_at = greatest(v_now, campaign.updated_at)
    where campaign.id = p_campaign_id;

    return query select
      v_delivery.id,
      p_campaign_id,
      v_delivery.subscriber_id,
      v_subscriber.email_normalized,
      v_claim_id,
      v_attempt,
      v_idempotency_key,
      v_delivery.content_variant;
    return;
  end loop;
end;
$$;

revoke all on function public.preview_newsletter_campaign_v2(
  text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.prepare_newsletter_campaign_v2(
  text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.claim_newsletter_campaign_delivery_v2(
  uuid, text, boolean
) from public, anon, authenticated;

grant execute on function public.preview_newsletter_campaign_v2(
  text, text, text, text, text
) to service_role;
grant execute on function public.prepare_newsletter_campaign_v2(
  text, text, text, text, text
) to service_role;
grant execute on function public.claim_newsletter_campaign_delivery_v2(
  uuid, text, boolean
) to service_role;

commit;
