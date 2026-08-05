-- Newsletter edition 01 manual campaign sender.
-- Forward-only persistence, atomic claiming and campaign unsubscribe support.
-- This migration performs no provider or remote HTTP calls.

begin;

create table public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  edition_key text not null,
  subject text not null,
  html_sha256 text not null,
  text_sha256 text not null,
  status text not null default 'prepared',
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  prepared_at timestamptz not null default pg_catalog.clock_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint newsletter_campaigns_edition_key unique (edition_key),
  constraint newsletter_campaigns_edition_key_check check (
    edition_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    and char_length(edition_key) between 3 and 100
  ),
  constraint newsletter_campaigns_subject_check check (
    char_length(subject) between 1 and 200
    and subject = pg_catalog.btrim(subject)
    and subject not like '[PRUEBA]%'
  ),
  constraint newsletter_campaigns_html_sha256_check check (
    html_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint newsletter_campaigns_text_sha256_check check (
    text_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint newsletter_campaigns_status_check check (
    status in ('prepared', 'sending', 'completed', 'paused')
  ),
  constraint newsletter_campaigns_timestamps_check check (
    updated_at >= created_at
    and prepared_at >= created_at
    and (started_at is null or started_at >= created_at)
    and (completed_at is null or completed_at >= created_at)
  )
);

create table public.newsletter_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.newsletter_campaigns(id) on delete restrict,
  subscriber_id uuid not null
    references public.newsletter_subscribers(id) on delete restrict,
  status text not null default 'prepared',
  attempt_count integer not null default 0,
  retryable boolean not null default false,
  claim_id uuid,
  idempotency_key text,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  prepared_at timestamptz not null default pg_catalog.clock_timestamp(),
  last_attempt_at timestamptz,
  claimed_at timestamptz,
  accepted_at timestamptz,
  failed_at timestamptz,
  unknown_at timestamptz,
  constraint newsletter_campaign_deliveries_recipient_key
    unique (campaign_id, subscriber_id),
  constraint newsletter_campaign_deliveries_idempotency_key
    unique (idempotency_key),
  constraint newsletter_campaign_deliveries_provider_message_key
    unique (provider_message_id),
  constraint newsletter_campaign_deliveries_status_check check (
    status in ('prepared', 'sending', 'accepted', 'failed', 'unknown')
  ),
  constraint newsletter_campaign_deliveries_attempt_count_check check (
    attempt_count >= 0
  ),
  constraint newsletter_campaign_deliveries_idempotency_check check (
    idempotency_key is null
    or (
      char_length(idempotency_key) between 1 and 256
      and idempotency_key ~ '^[A-Za-z0-9_./:-]+$'
    )
  ),
  constraint newsletter_campaign_deliveries_provider_message_check check (
    provider_message_id is null
    or char_length(provider_message_id) between 1 and 200
  ),
  constraint newsletter_campaign_deliveries_error_code_check check (
    last_error_code is null
    or (
      char_length(last_error_code) between 1 and 80
      and last_error_code ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    )
  ),
  constraint newsletter_campaign_deliveries_state_check check (
    (status = 'prepared'
      and attempt_count = 0
      and claim_id is null
      and idempotency_key is null
      and provider_message_id is null
      and last_attempt_at is null
      and claimed_at is null
      and accepted_at is null
      and failed_at is null
      and unknown_at is null)
    or (status = 'sending'
      and attempt_count > 0
      and claim_id is not null
      and idempotency_key is not null
      and provider_message_id is null
      and last_attempt_at is not null
      and claimed_at is not null
      and accepted_at is null
      and failed_at is null
      and unknown_at is null)
    or (status = 'accepted'
      and attempt_count > 0
      and claim_id is null
      and idempotency_key is not null
      and provider_message_id is not null
      and accepted_at is not null
      and failed_at is null
      and unknown_at is null
      and not retryable)
    or (status = 'failed'
      and attempt_count > 0
      and claim_id is null
      and idempotency_key is not null
      and provider_message_id is null
      and failed_at is not null
      and accepted_at is null
      and unknown_at is null)
    or (status = 'unknown'
      and attempt_count > 0
      and claim_id is null
      and idempotency_key is not null
      and provider_message_id is null
      and unknown_at is not null
      and accepted_at is null
      and failed_at is null
      and not retryable)
  ),
  constraint newsletter_campaign_deliveries_timestamps_check check (
    updated_at >= created_at
    and prepared_at >= created_at
    and (last_attempt_at is null or last_attempt_at >= created_at)
    and (claimed_at is null or claimed_at >= created_at)
    and (accepted_at is null or accepted_at >= created_at)
    and (failed_at is null or failed_at >= created_at)
    and (unknown_at is null or unknown_at >= created_at)
  )
);

create table public.newsletter_campaign_unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null
    references public.newsletter_campaign_deliveries(id) on delete restrict,
  subscriber_id uuid not null
    references public.newsletter_subscribers(id) on delete restrict,
  attempt_number integer not null,
  token_hash text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  first_used_at timestamptz,
  invalidated_at timestamptz,
  constraint newsletter_campaign_unsubscribe_tokens_hash_key unique (token_hash),
  constraint newsletter_campaign_unsubscribe_tokens_attempt_key
    unique (delivery_id, attempt_number),
  constraint newsletter_campaign_unsubscribe_tokens_attempt_check check (
    attempt_number > 0
  ),
  constraint newsletter_campaign_unsubscribe_tokens_hash_check check (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint newsletter_campaign_unsubscribe_tokens_timestamps_check check (
    updated_at >= created_at
    and (first_used_at is null or first_used_at >= created_at)
    and (invalidated_at is null or invalidated_at >= created_at)
  )
);

comment on table public.newsletter_campaigns is
  'Persistent immutable identity and content digests for a manual newsletter edition.';
comment on table public.newsletter_campaign_deliveries is
  'One resumable delivery state per campaign and subscriber. Accepted and unknown are never auto-claimed.';
comment on column public.newsletter_campaign_deliveries.idempotency_key is
  'Provider idempotency key derived from campaign, delivery and attempt; it contains no subscriber PII.';
comment on table public.newsletter_campaign_unsubscribe_tokens is
  'Campaign unsubscribe hashes. Raw tokens exist only in the sender process memory and prior campaign links are not rotated.';

create index newsletter_campaign_deliveries_claim_idx
  on public.newsletter_campaign_deliveries (campaign_id, status, retryable, created_at, id);
create index newsletter_campaign_deliveries_subscriber_idx
  on public.newsletter_campaign_deliveries (subscriber_id, created_at desc);
create index newsletter_campaign_unsubscribe_tokens_subscriber_idx
  on public.newsletter_campaign_unsubscribe_tokens (subscriber_id, created_at desc);

alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_campaign_deliveries enable row level security;
alter table public.newsletter_campaign_unsubscribe_tokens enable row level security;

revoke all on table
  public.newsletter_campaigns,
  public.newsletter_campaign_deliveries,
  public.newsletter_campaign_unsubscribe_tokens
from public, anon, authenticated, service_role;

create or replace function public.newsletter_campaign_subscriber_is_eligible(
  p_subscriber_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.newsletter_subscribers as subscriber
    join public.newsletter_preferences as preference
      on preference.subscriber_id = subscriber.id
     and preference.weekly_digest_enabled
    where subscriber.id = p_subscriber_id
      and subscriber.status = 'active'
      and subscriber.confirmed_at is not null
      and subscriber.unsubscribed_at is null
      and subscriber.bounced_at is null
      and subscriber.complained_at is null
      and subscriber.suppressed_at is null
      and exists (
        select 1
        from public.newsletter_consent_events as consent
        where consent.subscriber_id = subscriber.id
          and consent.action = 'confirmed'
      )
      and not exists (
        select 1
        from public.newsletter_suppressions as suppression
        where suppression.subscriber_id = subscriber.id
          and suppression.lifted_at is null
      )
  );
$$;

revoke all on function public.newsletter_campaign_subscriber_is_eligible(uuid)
from public, anon, authenticated, service_role;

create or replace function public.preview_newsletter_campaign(
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

  select * into v_campaign
  from public.newsletter_campaigns as campaign
  where campaign.edition_key = p_edition_key;

  if found and (
    v_campaign.subject <> p_subject
    or v_campaign.html_sha256 <> p_html_sha256
    or v_campaign.text_sha256 <> p_text_sha256
  ) then
    raise exception 'newsletter campaign content mismatch';
  end if;

  return query
  select
    v_campaign.id,
    coalesce(v_campaign.status, 'not_created'),
    (
      select pg_catalog.count(*)::integer
      from public.newsletter_subscribers as subscriber
      where public.newsletter_campaign_subscriber_is_eligible(subscriber.id)
    ),
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'prepared'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'sending'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'accepted'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'failed'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (where delivery.status = 'unknown'), 0)::integer,
    coalesce(pg_catalog.count(*) filter (
      where delivery.status = 'failed' and delivery.retryable
    ), 0)::integer
  from public.newsletter_campaign_deliveries as delivery
  where delivery.campaign_id = v_campaign.id;
end;
$$;

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

  perform 1
  from public.newsletter_campaigns as campaign
  where campaign.id = p_campaign_id
  for update;
  if not found then
    raise exception 'newsletter campaign unavailable';
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

create or replace function public.record_newsletter_campaign_delivery_accepted(
  p_delivery_id uuid,
  p_claim_id uuid,
  p_provider_message_id text,
  p_occurred_at timestamptz
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.newsletter_campaign_deliveries%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_delivery_id is null or p_claim_id is null
    or p_provider_message_id is null
    or char_length(p_provider_message_id) not between 1 and 200
    or p_occurred_at is null then
    raise exception 'invalid newsletter campaign acceptance';
  end if;

  select * into v_delivery
  from public.newsletter_campaign_deliveries as delivery
  where delivery.id = p_delivery_id
  for update;

  if not found or v_delivery.status <> 'sending' or v_delivery.claim_id <> p_claim_id then
    raise exception 'newsletter campaign claim unavailable';
  end if;

  update public.newsletter_campaign_deliveries as delivery
  set status = 'accepted',
      retryable = false,
      claim_id = null,
      provider_message_id = p_provider_message_id,
      last_error_code = null,
      accepted_at = greatest(p_occurred_at, delivery.created_at),
      updated_at = greatest(v_now, p_occurred_at, delivery.updated_at)
  where delivery.id = v_delivery.id;

  insert into public.newsletter_email_events (
    provider, provider_event_id, provider_message_id, subscriber_id,
    event_type, is_permanent, occurred_at
  ) values (
    'resend',
    'outbound:campaign:' || v_delivery.id::text,
    p_provider_message_id,
    v_delivery.subscriber_id,
    'sent',
    false,
    p_occurred_at
  ) on conflict do nothing;

  update public.newsletter_subscribers as subscriber
  set last_sent_at = greatest(coalesce(subscriber.last_sent_at, p_occurred_at), p_occurred_at)
  where subscriber.id = v_delivery.subscriber_id
    and subscriber.status = 'active';

  if not exists (
    select 1
    from public.newsletter_campaign_deliveries as remaining
    where remaining.campaign_id = v_delivery.campaign_id
      and remaining.status <> 'accepted'
  ) then
    update public.newsletter_campaigns as campaign
    set status = 'completed',
        completed_at = greatest(p_occurred_at, campaign.created_at),
        updated_at = greatest(v_now, p_occurred_at, campaign.updated_at)
    where campaign.id = v_delivery.campaign_id;
  end if;

  return query select 'recorded';
end;
$$;

create or replace function public.record_newsletter_campaign_delivery_failed(
  p_delivery_id uuid,
  p_claim_id uuid,
  p_error_code text,
  p_retryable boolean,
  p_occurred_at timestamptz
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.newsletter_campaign_deliveries%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_delivery_id is null or p_claim_id is null
    or p_error_code is null
    or char_length(p_error_code) not between 1 and 80
    or p_error_code !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    or p_retryable is null
    or p_occurred_at is null then
    raise exception 'invalid newsletter campaign failure';
  end if;

  select * into v_delivery
  from public.newsletter_campaign_deliveries as delivery
  where delivery.id = p_delivery_id
  for update;
  if not found or v_delivery.status <> 'sending' or v_delivery.claim_id <> p_claim_id then
    raise exception 'newsletter campaign claim unavailable';
  end if;

  update public.newsletter_campaign_deliveries as delivery
  set status = 'failed',
      retryable = p_retryable,
      claim_id = null,
      provider_message_id = null,
      last_error_code = p_error_code,
      failed_at = greatest(p_occurred_at, delivery.created_at),
      updated_at = greatest(v_now, p_occurred_at, delivery.updated_at)
  where delivery.id = v_delivery.id;

  return query select 'recorded';
end;
$$;

create or replace function public.record_newsletter_campaign_delivery_unknown(
  p_delivery_id uuid,
  p_claim_id uuid,
  p_error_code text,
  p_occurred_at timestamptz
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.newsletter_campaign_deliveries%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_delivery_id is null or p_claim_id is null
    or p_error_code is null
    or char_length(p_error_code) not between 1 and 80
    or p_error_code !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    or p_occurred_at is null then
    raise exception 'invalid newsletter campaign unknown result';
  end if;

  select * into v_delivery
  from public.newsletter_campaign_deliveries as delivery
  where delivery.id = p_delivery_id
  for update;
  if not found or v_delivery.status <> 'sending' or v_delivery.claim_id <> p_claim_id then
    raise exception 'newsletter campaign claim unavailable';
  end if;

  update public.newsletter_campaign_deliveries as delivery
  set status = 'unknown',
      retryable = false,
      claim_id = null,
      provider_message_id = null,
      last_error_code = p_error_code,
      unknown_at = greatest(p_occurred_at, delivery.created_at),
      updated_at = greatest(v_now, p_occurred_at, delivery.updated_at)
  where delivery.id = v_delivery.id;

  update public.newsletter_campaigns as campaign
  set status = 'paused',
      updated_at = greatest(v_now, campaign.updated_at)
  where campaign.id = v_delivery.campaign_id;

  return query select 'recorded';
end;
$$;

-- Preserve the reviewed legacy token implementation unchanged behind an
-- owner-only helper, then add campaign-token lookup to the stable public RPC.
do $newsletter_preserve_legacy_unsubscribe$
begin
  if to_regprocedure(
    'public.newsletter_unsubscribe_by_token_legacy_internal(text,text,text,text,text)'
  ) is null then
    alter function public.unsubscribe_newsletter_by_token(
      text, text, text, text, text
    ) rename to newsletter_unsubscribe_by_token_legacy_internal;
  end if;
end;
$newsletter_preserve_legacy_unsubscribe$;

revoke all on function public.newsletter_unsubscribe_by_token_legacy_internal(
  text, text, text, text, text
) from public, anon, authenticated, service_role;

create or replace function public.unsubscribe_newsletter_by_token(
  p_token_hash text,
  p_consent_version text,
  p_source text,
  p_source_path text default null,
  p_ip_hash text default null
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.newsletter_campaign_unsubscribe_tokens%rowtype;
  v_subscriber public.newsletter_subscribers%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_or_expired';
    return;
  end if;
  if p_consent_version is null or char_length(p_consent_version) not between 1 and 100
    or p_source is null or char_length(p_source) not between 1 and 100 then
    raise exception 'invalid newsletter unsubscribe context';
  end if;
  if p_source_path is not null
    and (char_length(p_source_path) > 240 or left(p_source_path, 1) <> '/') then
    raise exception 'invalid newsletter source path';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter ip hash';
  end if;

  select * into v_token
  from public.newsletter_campaign_unsubscribe_tokens as token
  where token.token_hash = p_token_hash
  for update;

  if not found then
    return query
    select legacy.outcome
    from public.newsletter_unsubscribe_by_token_legacy_internal(
      p_token_hash, p_consent_version, p_source, p_source_path, p_ip_hash
    ) as legacy;
    return;
  end if;

  if v_token.invalidated_at is not null then
    return query select 'invalid_or_expired';
    return;
  end if;

  select * into v_subscriber
  from public.newsletter_subscribers as subscriber
  where subscriber.id = v_token.subscriber_id
  for update;
  if not found then
    return query select 'invalid_or_expired';
    return;
  end if;

  if v_subscriber.status in ('unsubscribed', 'bounced', 'complained', 'suppressed') then
    update public.newsletter_campaign_unsubscribe_tokens as token
    set first_used_at = coalesce(token.first_used_at, greatest(v_now, token.created_at)),
        updated_at = greatest(v_now, token.updated_at, token.created_at)
    where token.id = v_token.id;
    return query select 'already_unsubscribed';
    return;
  end if;

  if v_subscriber.status <> 'active' then
    return query select 'invalid_or_expired';
    return;
  end if;

  insert into public.newsletter_consent_events (
    subscriber_id, action, consent_version, source, source_path, ip_hash, occurred_at
  ) values (
    v_subscriber.id, 'unsubscribed', p_consent_version,
    p_source, p_source_path, p_ip_hash, v_now
  );

  perform public.minimize_newsletter_subscriber(
    v_subscriber.id, 'voluntary', v_now, null, null
  );

  update public.newsletter_campaign_unsubscribe_tokens as token
  set first_used_at = coalesce(token.first_used_at, greatest(v_now, token.created_at)),
      updated_at = greatest(v_now, token.updated_at, token.created_at)
  where token.id = v_token.id;

  return query select 'unsubscribed';
end;
$$;

revoke all on function public.preview_newsletter_campaign(text, text, text, text)
from public, anon, authenticated;
revoke all on function public.prepare_newsletter_campaign(text, text, text, text)
from public, anon, authenticated;
revoke all on function public.claim_newsletter_campaign_delivery(uuid, text, boolean)
from public, anon, authenticated;
revoke all on function public.record_newsletter_campaign_delivery_accepted(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.record_newsletter_campaign_delivery_failed(
  uuid, uuid, text, boolean, timestamptz
) from public, anon, authenticated;
revoke all on function public.record_newsletter_campaign_delivery_unknown(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.unsubscribe_newsletter_by_token(text, text, text, text, text)
from public, anon, authenticated;

grant execute on function public.preview_newsletter_campaign(text, text, text, text)
to service_role;
grant execute on function public.prepare_newsletter_campaign(text, text, text, text)
to service_role;
grant execute on function public.claim_newsletter_campaign_delivery(uuid, text, boolean)
to service_role;
grant execute on function public.record_newsletter_campaign_delivery_accepted(
  uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.record_newsletter_campaign_delivery_failed(
  uuid, uuid, text, boolean, timestamptz
) to service_role;
grant execute on function public.record_newsletter_campaign_delivery_unknown(
  uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.unsubscribe_newsletter_by_token(text, text, text, text, text)
to service_role;

commit;
