-- Newsletter R5A.2: launch lifecycle, retention, suppression and webhook operations.
-- This migration is server-only. It performs no provider or remote HTTP calls.

create extension if not exists pg_cron with schema extensions;

create table if not exists public.newsletter_suppressions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null
    references public.newsletter_subscribers(id) on delete cascade,
  email_hash text not null,
  reason text not null,
  suppressed_at timestamptz not null,
  lifted_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_suppressions_subscriber_key unique (subscriber_id),
  constraint newsletter_suppressions_email_hash_check
    check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint newsletter_suppressions_reason_check
    check (reason in ('voluntary', 'permanent_bounce', 'complaint', 'provider_suppression')),
  constraint newsletter_suppressions_lift_check
    check (
      lifted_at is null
      or (reason = 'voluntary' and lifted_at >= suppressed_at)
    ),
  constraint newsletter_suppressions_provider_message_check
    check (provider_message_id is null or char_length(provider_message_id) between 1 and 200),
  constraint newsletter_suppressions_updated_check
    check (updated_at >= created_at)
);

create unique index if not exists newsletter_suppressions_active_email_key
  on public.newsletter_suppressions (email_hash)
  where lifted_at is null;

create index if not exists newsletter_suppressions_active_subscriber_idx
  on public.newsletter_suppressions (subscriber_id, reason)
  where lifted_at is null;

comment on table public.newsletter_suppressions is
  'Minimized server-only suppression state. email_hash is SHA-256 of trim+lowercase email.';

create table if not exists public.newsletter_webhook_receipts (
  svix_id text primary key,
  event_type text not null,
  provider_message_id text,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  provider_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  outcome text not null,
  constraint newsletter_webhook_receipts_svix_id_check
    check (char_length(svix_id) between 1 and 200),
  constraint newsletter_webhook_receipts_type_check
    check (
      char_length(event_type) between 1 and 100
      and event_type ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    ),
  constraint newsletter_webhook_receipts_message_check
    check (provider_message_id is null or char_length(provider_message_id) between 1 and 200),
  constraint newsletter_webhook_receipts_outcome_check
    check (outcome in ('processed', 'ignored', 'unmatched'))
);

create index if not exists newsletter_webhook_receipts_message_idx
  on public.newsletter_webhook_receipts (provider_message_id)
  where provider_message_id is not null;

comment on table public.newsletter_webhook_receipts is
  'Minimal Resend webhook receipt used for Svix replay protection; raw bodies and recipients are never stored.';

alter table public.newsletter_suppressions enable row level security;
alter table public.newsletter_webhook_receipts enable row level security;

revoke all on table
  public.newsletter_suppressions,
  public.newsletter_webhook_receipts
from public, anon, authenticated;

grant select on table
  public.newsletter_suppressions,
  public.newsletter_webhook_receipts
to service_role;

-- R5A.2 does not retain individual open/click behavior.
delete from public.newsletter_email_events as nee
where nee.event_type in ('opened', 'clicked');

alter table public.newsletter_subscribers
  drop column if exists last_opened_at,
  drop column if exists last_clicked_at;

alter table public.newsletter_email_events
  drop constraint if exists newsletter_email_events_type_check;

alter table public.newsletter_email_events
  add constraint newsletter_email_events_type_check
  check (
    event_type in (
      'sent', 'delivered', 'delivery_delayed', 'failed',
      'bounced', 'complained', 'suppressed'
    )
  );

create unique index if not exists newsletter_email_events_resend_outbound_message_key
  on public.newsletter_email_events (provider, provider_message_id)
  where provider = 'resend'
    and provider_message_id is not null
    and event_type = 'sent';

create or replace function public.newsletter_email_hash(p_email_normalized text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(p_email_normalized)), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public.newsletter_email_hash(text)
from public, anon, authenticated, service_role;

create or replace function public.minimize_newsletter_subscriber(
  p_subscriber_id uuid,
  p_reason text,
  p_occurred_at timestamptz,
  p_provider_message_id text default null,
  p_preserve_unsubscribe_token_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscriber public.newsletter_subscribers%rowtype;
  v_suppression public.newsletter_suppressions%rowtype;
  v_email_hash text;
  v_effective_reason text;
  v_status text;
  v_anonymous_email text;
begin
  if p_subscriber_id is null
    or p_reason not in ('voluntary', 'permanent_bounce', 'complaint', 'provider_suppression')
    or p_occurred_at is null
    or (p_provider_message_id is not null and char_length(p_provider_message_id) not between 1 and 200) then
    raise exception 'invalid newsletter suppression context';
  end if;

  select * into strict v_subscriber
  from public.newsletter_subscribers as ns
  where ns.id = p_subscriber_id
  for update;

  select * into v_suppression
  from public.newsletter_suppressions as nsp
  where nsp.subscriber_id = v_subscriber.id
    and nsp.lifted_at is null
  for update;

  v_email_hash := case
    when found then v_suppression.email_hash
    else public.newsletter_email_hash(v_subscriber.email_normalized)
  end;

  v_effective_reason := case
    when coalesce(v_suppression.reason, p_reason) = 'provider_suppression'
      or p_reason = 'provider_suppression' then 'provider_suppression'
    when coalesce(v_suppression.reason, p_reason) = 'complaint'
      or p_reason = 'complaint' then 'complaint'
    when coalesce(v_suppression.reason, p_reason) = 'permanent_bounce'
      or p_reason = 'permanent_bounce' then 'permanent_bounce'
    else 'voluntary'
  end;

  v_status := case v_effective_reason
    when 'provider_suppression' then 'suppressed'
    when 'complaint' then 'complained'
    when 'permanent_bounce' then 'bounced'
    else 'unsubscribed'
  end;

  insert into public.newsletter_suppressions (
    subscriber_id,
    email_hash,
    reason,
    suppressed_at,
    lifted_at,
    provider_message_id,
    updated_at
  ) values (
    v_subscriber.id,
    v_email_hash,
    v_effective_reason,
    p_occurred_at,
    null,
    p_provider_message_id,
    pg_catalog.clock_timestamp()
  )
  on conflict on constraint newsletter_suppressions_subscriber_key do update
  set email_hash = excluded.email_hash,
      reason = excluded.reason,
      suppressed_at = least(
        public.newsletter_suppressions.suppressed_at,
        excluded.suppressed_at
      ),
      lifted_at = null,
      provider_message_id = coalesce(
        excluded.provider_message_id,
        public.newsletter_suppressions.provider_message_id
      ),
      updated_at = greatest(
        pg_catalog.clock_timestamp(),
        public.newsletter_suppressions.updated_at
      );

  delete from public.newsletter_preferences as np
  where np.subscriber_id = v_subscriber.id;

  update public.newsletter_consent_events as nce
  set source_path = null,
      ip_hash = null
  where nce.subscriber_id = v_subscriber.id;

  delete from public.newsletter_confirmation_tokens as nct
  where nct.subscriber_id = v_subscriber.id;

  delete from public.newsletter_unsubscribe_tokens as nut
  where nut.subscriber_id = v_subscriber.id
    and (
      p_preserve_unsubscribe_token_id is null
      or nut.id <> p_preserve_unsubscribe_token_id
    );

  if p_preserve_unsubscribe_token_id is not null then
    update public.newsletter_unsubscribe_tokens as nut
    set first_used_at = coalesce(
          nut.first_used_at,
          greatest(pg_catalog.clock_timestamp(), nut.created_at)
        ),
        updated_at = greatest(
          pg_catalog.clock_timestamp(),
          nut.created_at,
          nut.updated_at
        )
    where nut.id = p_preserve_unsubscribe_token_id
      and nut.subscriber_id = v_subscriber.id;
  end if;

  v_anonymous_email :=
    'suppressed+' || pg_catalog.replace(v_subscriber.id::text, '-', '')
    || '@invalid.eventomotor.local';

  update public.newsletter_subscribers as ns
  set email = v_anonymous_email,
      email_normalized = v_anonymous_email,
      status = v_status,
      province_slug = null,
      region_slug = null,
      source = 'minimized',
      source_detail = null,
      source_path = null,
      last_confirmation_requested_at = null,
      confirmation_request_window_started_at = null,
      confirmation_request_count = 0,
      provider_contact_id = null,
      last_sent_at = null,
      last_delivered_at = null,
      unsubscribed_at = case
        when v_effective_reason = 'voluntary'
          then greatest(coalesce(ns.unsubscribed_at, p_occurred_at), p_occurred_at)
        else ns.unsubscribed_at
      end,
      bounced_at = case
        when v_effective_reason = 'permanent_bounce'
          then greatest(coalesce(ns.bounced_at, p_occurred_at), p_occurred_at)
        else ns.bounced_at
      end,
      complained_at = case
        when v_effective_reason = 'complaint'
          then greatest(coalesce(ns.complained_at, p_occurred_at), p_occurred_at)
        else ns.complained_at
      end,
      suppressed_at = case
        when v_effective_reason = 'provider_suppression'
          then greatest(coalesce(ns.suppressed_at, p_occurred_at), p_occurred_at)
        else ns.suppressed_at
      end
  where ns.id = v_subscriber.id;

  return v_effective_reason;
end;
$$;

revoke all on function public.minimize_newsletter_subscriber(
  uuid, text, timestamptz, text, uuid
) from public, anon, authenticated, service_role;

-- Subscription requests first consult the minimized suppression hash. A voluntary
-- suppression may issue a resubscribe token; provider suppressions remain blocked.
create or replace function public.request_newsletter_subscription(
  p_email text,
  p_email_normalized text,
  p_token_hash text,
  p_token_expires_at timestamptz,
  p_source text,
  p_consent_version text,
  p_source_path text default null,
  p_source_detail text default null,
  p_language_code text default 'es',
  p_country_code text default 'ES',
  p_province_slug text default null,
  p_region_slug text default null,
  p_ip_hash text default null
)
returns table (
  outcome text,
  subscriber_id uuid,
  token_purpose text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscriber public.newsletter_subscribers%rowtype;
  v_suppression public.newsletter_suppressions%rowtype;
  v_suppressed_subscriber_id uuid;
  v_now timestamptz := now();
  v_created boolean := false;
  v_action text;
  v_purpose text;
  v_window_start timestamptz;
  v_request_count integer;
  v_email_hash text;
begin
  if p_email is null or p_email_normalized is null
    or p_email_normalized <> lower(btrim(p_email))
    or char_length(p_email) not between 3 and 254 then
    raise exception 'invalid newsletter email';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter token hash';
  end if;
  if p_token_expires_at <= v_now or p_token_expires_at > v_now + interval '48 hours' then
    raise exception 'invalid newsletter token expiry';
  end if;
  if p_source is null or char_length(p_source) not between 1 and 100
    or p_consent_version is null or char_length(p_consent_version) not between 1 and 100 then
    raise exception 'invalid newsletter consent context';
  end if;
  if p_source_path is not null
    and (char_length(p_source_path) > 240 or left(p_source_path, 1) <> '/') then
    raise exception 'invalid newsletter source path';
  end if;
  if p_source_detail is not null and char_length(p_source_detail) > 100 then
    raise exception 'invalid newsletter source detail';
  end if;
  if p_language_code !~ '^[a-z]{2}(-[A-Z]{2})?$'
    or p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'invalid newsletter locale';
  end if;
  if (
    p_province_slug is not null
    and (
      char_length(p_province_slug) > 100
      or p_province_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  ) or (
    p_region_slug is not null
    and (
      char_length(p_region_slug) > 100
      or p_region_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  ) then
    raise exception 'invalid newsletter location';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter ip hash';
  end if;

  v_email_hash := public.newsletter_email_hash(p_email_normalized);

  select suppression.subscriber_id
  into v_suppressed_subscriber_id
  from public.newsletter_suppressions as suppression
  where suppression.email_hash = v_email_hash
    and suppression.lifted_at is null;

  if v_suppressed_subscriber_id is not null then
    select * into strict v_subscriber
    from public.newsletter_subscribers as ns
    where ns.id = v_suppressed_subscriber_id
    for update;

    select * into strict v_suppression
    from public.newsletter_suppressions as nsp
    where nsp.subscriber_id = v_subscriber.id
      and nsp.email_hash = v_email_hash
      and nsp.lifted_at is null
    for update;

    if v_suppression.reason <> 'voluntary' then
      return query select 'blocked', null::uuid, null::text;
      return;
    end if;

    insert into public.newsletter_consent_events (
      subscriber_id, action, consent_version, source, source_path, ip_hash, occurred_at
    ) values (
      v_subscriber.id, 'resubscribe_requested', p_consent_version,
      p_source, p_source_path, p_ip_hash, v_now
    );

    update public.newsletter_subscribers as ns
    set email = p_email,
        email_normalized = p_email_normalized,
        status = 'unsubscribed',
        language_code = p_language_code,
        country_code = p_country_code,
        province_slug = p_province_slug,
        region_slug = p_region_slug,
        source = p_source,
        source_detail = p_source_detail,
        source_path = p_source_path,
        consent_version = p_consent_version
    where ns.id = v_subscriber.id
    returning * into v_subscriber;
  else
    insert into public.newsletter_subscribers (
      email, email_normalized, status, language_code, country_code, province_slug, region_slug,
      source, source_detail, source_path, consent_version
    ) values (
      p_email, p_email_normalized, 'pending', p_language_code, p_country_code, p_province_slug,
      p_region_slug, p_source, p_source_detail, p_source_path, p_consent_version
    )
    on conflict (email_normalized) do nothing
    returning true into v_created;

    select * into v_subscriber
    from public.newsletter_subscribers as ns
    where ns.email_normalized = p_email_normalized
    for update;

    -- The row can be minimized or purged between the conflict check and the
    -- lock. Re-enter the lookup in the same transaction so the newly created
    -- suppression (or the now-free email key) becomes authoritative.
    if not found then
      return query
      select retry.outcome, retry.subscriber_id, retry.token_purpose
      from public.request_newsletter_subscription(
        p_email,
        p_email_normalized,
        p_token_hash,
        p_token_expires_at,
        p_source,
        p_consent_version,
        p_source_path,
        p_source_detail,
        p_language_code,
        p_country_code,
        p_province_slug,
        p_region_slug,
        p_ip_hash
      ) as retry;
      return;
    end if;

    v_action := case
      when v_subscriber.status in ('pending', 'active') then 'subscribe_requested'
      else 'resubscribe_requested'
    end;

    insert into public.newsletter_consent_events (
      subscriber_id, action, consent_version, source, source_path, ip_hash, occurred_at
    ) values (
      v_subscriber.id, v_action, p_consent_version, p_source, p_source_path, p_ip_hash, v_now
    );

    if v_subscriber.status in ('bounced', 'complained', 'suppressed') then
      return query select 'blocked', null::uuid, null::text;
      return;
    end if;
    if v_subscriber.status = 'active' then
      return query select 'already_active', null::uuid, null::text;
      return;
    end if;
  end if;

  if not coalesce(v_created, false)
    and v_subscriber.last_confirmation_requested_at is not null
    and v_subscriber.last_confirmation_requested_at > v_now - interval '15 minutes' then
    return query select 'cooldown', null::uuid, null::text;
    return;
  end if;

  if v_subscriber.confirmation_request_window_started_at is null
    or v_subscriber.confirmation_request_window_started_at <= v_now - interval '24 hours' then
    v_window_start := v_now;
    v_request_count := 1;
  else
    v_window_start := v_subscriber.confirmation_request_window_started_at;
    v_request_count := v_subscriber.confirmation_request_count + 1;
  end if;

  if v_request_count > 3 then
    return query select 'daily_limit', null::uuid, null::text;
    return;
  end if;

  v_purpose := case
    when v_subscriber.status = 'pending' then 'subscribe'
    else 'resubscribe'
  end;

  update public.newsletter_confirmation_tokens as nct
  set invalidated_at = v_now
  where nct.subscriber_id = v_subscriber.id
    and nct.used_at is null
    and nct.invalidated_at is null;

  insert into public.newsletter_confirmation_tokens (
    subscriber_id, token_hash, purpose, expires_at
  ) values (
    v_subscriber.id, p_token_hash, v_purpose, p_token_expires_at
  );

  update public.newsletter_subscribers as ns
  set email = p_email,
      language_code = p_language_code,
      country_code = p_country_code,
      province_slug = p_province_slug,
      region_slug = p_region_slug,
      source = p_source,
      source_detail = p_source_detail,
      source_path = p_source_path,
      consent_version = p_consent_version,
      last_confirmation_requested_at = v_now,
      confirmation_request_window_started_at = v_window_start,
      confirmation_request_count = v_request_count
  where ns.id = v_subscriber.id
  returning * into v_subscriber;

  insert into public.newsletter_consent_events (
    subscriber_id, action, consent_version, source, source_path, ip_hash, occurred_at
  ) values (
    v_subscriber.id, 'confirmation_issued', p_consent_version,
    p_source, p_source_path, p_ip_hash, v_now
  );

  return query select 'confirmation_required', v_subscriber.id, v_purpose;
end;
$$;

create or replace function public.confirm_newsletter_subscription(p_token_hash text)
returns table (
  outcome text,
  subscriber_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscriber_id uuid;
  v_token public.newsletter_confirmation_tokens%rowtype;
  v_subscriber public.newsletter_subscribers%rowtype;
  v_suppression public.newsletter_suppressions%rowtype;
  v_now timestamptz := now();
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_token', null::uuid;
    return;
  end if;

  select token.subscriber_id into v_subscriber_id
  from public.newsletter_confirmation_tokens as token
  where token.token_hash = p_token_hash;

  if not found then
    return query select 'invalid_token', null::uuid;
    return;
  end if;

  select * into strict v_subscriber
  from public.newsletter_subscribers as ns
  where ns.id = v_subscriber_id
  for update;

  select * into v_token
  from public.newsletter_confirmation_tokens as nct
  where nct.token_hash = p_token_hash
    and nct.subscriber_id = v_subscriber.id
  for update;

  if not found or v_token.invalidated_at is not null then
    return query select 'invalid_token', null::uuid;
    return;
  end if;
  if v_token.used_at is not null then
    return query select 'used_token', null::uuid;
    return;
  end if;
  if v_token.expires_at <= v_now then
    return query select 'expired_token', null::uuid;
    return;
  end if;

  select * into v_suppression
  from public.newsletter_suppressions as nsp
  where nsp.subscriber_id = v_subscriber.id
    and nsp.lifted_at is null
  for update;

  if v_token.purpose = 'resubscribe' then
    if not found or v_suppression.reason <> 'voluntary'
      or v_subscriber.status <> 'unsubscribed' then
      update public.newsletter_confirmation_tokens as nct
      set invalidated_at = v_now
      where nct.id = v_token.id;
      return query select 'blocked', null::uuid;
      return;
    end if;
  elsif v_token.purpose <> 'subscribe'
    or v_subscriber.status <> 'pending'
    or found then
    update public.newsletter_confirmation_tokens as nct
    set invalidated_at = v_now
    where nct.id = v_token.id;
    return query select 'invalid_token', null::uuid;
    return;
  end if;

  if v_token.purpose = 'resubscribe' then
    update public.newsletter_suppressions as nsp
    set lifted_at = v_now,
        updated_at = greatest(v_now, nsp.updated_at)
    where nsp.id = v_suppression.id;
  end if;

  update public.newsletter_subscribers as ns
  set status = 'active',
      confirmed_at = v_now,
      unsubscribed_at = null,
      bounced_at = null,
      complained_at = null,
      suppressed_at = null
  where ns.id = v_subscriber.id
  returning * into v_subscriber;

  update public.newsletter_confirmation_tokens as nct
  set used_at = v_now
  where nct.id = v_token.id;

  insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
  values (v_subscriber.id, true)
  on conflict on constraint newsletter_preferences_pkey do update
    set weekly_digest_enabled = true;

  insert into public.newsletter_consent_events (
    subscriber_id, action, consent_version, source, source_path, occurred_at
  ) values (
    v_subscriber.id, 'confirmed', v_subscriber.consent_version,
    v_subscriber.source, v_subscriber.source_path, v_now
  );

  return query select 'confirmed', v_subscriber.id;
end;
$$;

create or replace function public.unsubscribe_newsletter_subscriber(
  p_subscriber_id uuid,
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
  v_subscriber public.newsletter_subscribers%rowtype;
  v_now timestamptz := now();
begin
  if p_subscriber_id is null
    or p_consent_version is null or char_length(p_consent_version) not between 1 and 100
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

  select * into v_subscriber
  from public.newsletter_subscribers as ns
  where ns.id = p_subscriber_id
  for update;

  if not found then
    return query select 'not_found';
    return;
  end if;
  if v_subscriber.status = 'unsubscribed' then
    return query select 'already_unsubscribed';
    return;
  end if;
  if v_subscriber.status in ('bounced', 'complained', 'suppressed') then
    return query select 'already_not_sendable';
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

  return query select 'unsubscribed';
end;
$$;

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
  v_subscriber_id uuid;
  v_subscriber public.newsletter_subscribers%rowtype;
  v_token public.newsletter_unsubscribe_tokens%rowtype;
  v_now timestamptz;
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

  select token.subscriber_id into v_subscriber_id
  from public.newsletter_unsubscribe_tokens as token
  where token.token_hash = p_token_hash;

  if not found then
    return query select 'invalid_or_expired';
    return;
  end if;

  select * into v_subscriber
  from public.newsletter_subscribers as ns
  where ns.id = v_subscriber_id
  for update;

  if not found then
    return query select 'invalid_or_expired';
    return;
  end if;

  select * into v_token
  from public.newsletter_unsubscribe_tokens as nut
  where nut.token_hash = p_token_hash
    and nut.subscriber_id = v_subscriber.id
  for update;

  if not found then
    return query select 'invalid_or_expired';
    return;
  end if;

  v_now := clock_timestamp();

  if v_token.invalidated_at is not null
    or (v_token.expires_at is not null and v_token.expires_at <= v_now) then
    return query select 'invalid_or_expired';
    return;
  end if;

  if v_subscriber.status = 'unsubscribed' then
    update public.newsletter_unsubscribe_tokens as nut
    set first_used_at = coalesce(
          nut.first_used_at,
          greatest(v_now, nut.created_at)
        ),
        updated_at = greatest(v_now, nut.created_at, nut.updated_at)
    where nut.id = v_token.id;
    return query select 'already_unsubscribed';
    return;
  end if;
  if v_subscriber.status in ('bounced', 'complained', 'suppressed') then
    return query select 'already_unsubscribed';
    return;
  end if;

  insert into public.newsletter_consent_events (
    subscriber_id, action, consent_version, source, source_path, ip_hash, occurred_at
  ) values (
    v_subscriber.id, 'unsubscribed', p_consent_version,
    p_source, p_source_path, p_ip_hash, v_now
  );

  perform public.minimize_newsletter_subscriber(
    v_subscriber.id, 'voluntary', v_now, null, v_token.id
  );

  return query select 'unsubscribed';
end;
$$;

create or replace function public.purge_stale_newsletter_pending(
  p_batch_size integer default 500,
  p_cutoff timestamptz default (clock_timestamp() - interval '7 days')
)
returns table (purged_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer := 0;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 1000
    or p_cutoff is null or p_cutoff > clock_timestamp() then
    raise exception 'invalid newsletter purge context';
  end if;

  select array_agg(candidate.id)
  into v_ids
  from (
    select subscriber.id
    from public.newsletter_subscribers as subscriber
    where subscriber.status = 'pending'
      and subscriber.confirmed_at is null
      and coalesce(
        subscriber.last_confirmation_requested_at,
        subscriber.created_at
      ) < p_cutoff
      and not exists (
        select 1
        from public.newsletter_suppressions as suppression
        where suppression.subscriber_id = subscriber.id
          and suppression.lifted_at is null
      )
    order by coalesce(
      subscriber.last_confirmation_requested_at,
      subscriber.created_at
    ), subscriber.id
    for update of subscriber skip locked
    limit p_batch_size
  ) as candidate;

  if v_ids is null then
    return query select 0;
    return;
  end if;

  delete from public.newsletter_consent_events as nce
  where nce.subscriber_id = any(v_ids);

  delete from public.newsletter_subscribers as ns
  where ns.id = any(v_ids)
    and ns.status = 'pending'
    and ns.confirmed_at is null;

  get diagnostics v_count = row_count;
  return query select v_count;
end;
$$;

revoke all on function public.purge_stale_newsletter_pending(integer, timestamptz)
from public, anon, authenticated;
grant execute on function public.purge_stale_newsletter_pending(integer, timestamptz)
to service_role;

create or replace function public.check_newsletter_delivery_eligibility(
  p_subscriber_id uuid,
  p_delivery_kind text
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscriber public.newsletter_subscribers%rowtype;
  v_suppression public.newsletter_suppressions%rowtype;
  v_has_suppression boolean := false;
begin
  if p_subscriber_id is null
    or p_delivery_kind not in ('confirmation', 'welcome') then
    raise exception 'invalid newsletter delivery context';
  end if;

  select * into v_subscriber
  from public.newsletter_subscribers as ns
  where ns.id = p_subscriber_id
  for update;

  if not found then
    return query select 'blocked';
    return;
  end if;

  select * into v_suppression
  from public.newsletter_suppressions as nsp
  where nsp.subscriber_id = v_subscriber.id
    and nsp.lifted_at is null
  for update;
  v_has_suppression := found;

  if p_delivery_kind = 'confirmation' then
    if v_subscriber.status = 'pending' and not v_has_suppression then
      return query select 'allowed';
      return;
    end if;
    if v_subscriber.status = 'unsubscribed'
      and v_has_suppression
      and v_suppression.reason = 'voluntary'
      and exists (
        select 1
        from public.newsletter_confirmation_tokens as nct
        where nct.subscriber_id = v_subscriber.id
          and nct.purpose = 'resubscribe'
          and nct.used_at is null
          and nct.invalidated_at is null
          and nct.expires_at > clock_timestamp()
      ) then
      return query select 'allowed';
      return;
    end if;
  elsif v_subscriber.status = 'active'
    and not v_has_suppression
    and exists (
      select 1
      from public.newsletter_preferences as np
      where np.subscriber_id = v_subscriber.id
        and np.weekly_digest_enabled
    ) then
    return query select 'allowed';
    return;
  end if;

  return query select 'blocked';
end;
$$;

revoke all on function public.check_newsletter_delivery_eligibility(uuid, text)
from public, anon, authenticated;
grant execute on function public.check_newsletter_delivery_eligibility(uuid, text)
to service_role;

create or replace function public.register_newsletter_outbound_delivery(
  p_subscriber_id uuid,
  p_provider_message_id text,
  p_delivery_kind text,
  p_occurred_at timestamptz
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if p_subscriber_id is null
    or p_provider_message_id is null
    or char_length(p_provider_message_id) not between 1 and 200
    or p_delivery_kind not in ('confirmation', 'welcome')
    or p_occurred_at is null then
    raise exception 'invalid newsletter outbound delivery';
  end if;

  perform 1
  from public.newsletter_subscribers as ns
  where ns.id = p_subscriber_id
  for update;

  if not found then
    raise exception 'newsletter outbound subscriber unavailable';
  end if;

  insert into public.newsletter_email_events (
    provider,
    provider_event_id,
    provider_message_id,
    subscriber_id,
    event_type,
    is_permanent,
    occurred_at
  ) values (
    'resend',
    'outbound:' || p_delivery_kind || ':' || p_provider_message_id,
    p_provider_message_id,
    p_subscriber_id,
    'sent',
    false,
    p_occurred_at
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query select 'duplicate';
  else
    return query select 'recorded';
  end if;
end;
$$;

revoke all on function public.register_newsletter_outbound_delivery(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.register_newsletter_outbound_delivery(
  uuid, text, text, timestamptz
) to service_role;

create or replace function public.record_newsletter_provider_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_message_id text,
  p_subscriber_id uuid,
  p_event_type text,
  p_is_permanent boolean,
  p_occurred_at timestamptz
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_subscriber public.newsletter_subscribers%rowtype;
  v_reason text;
begin
  if p_provider is null or char_length(p_provider) not between 1 and 60
    or p_provider_event_id is null or char_length(p_provider_event_id) not between 1 and 200
    or p_event_type not in (
      'sent', 'delivered', 'delivery_delayed', 'failed',
      'bounced', 'complained', 'suppressed'
    )
    or p_occurred_at is null
    or (p_is_permanent and p_event_type <> 'bounced') then
    raise exception 'invalid newsletter provider event';
  end if;

  if p_subscriber_id is not null then
    select * into v_subscriber
    from public.newsletter_subscribers as ns
    where ns.id = p_subscriber_id
    for update;
  end if;

  insert into public.newsletter_email_events (
    provider, provider_event_id, provider_message_id, subscriber_id,
    event_type, is_permanent, occurred_at
  ) values (
    p_provider, p_provider_event_id, p_provider_message_id, p_subscriber_id,
    p_event_type, p_is_permanent, p_occurred_at
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query select 'duplicate';
    return;
  end if;

  if p_subscriber_id is null then
    return query select 'recorded';
    return;
  end if;

  if (p_event_type = 'bounced' and p_is_permanent)
    or p_event_type in ('complained', 'suppressed') then
    insert into public.newsletter_consent_events (
      subscriber_id, action, consent_version, source, source_path, occurred_at
    ) values (
      v_subscriber.id,
      case
        when p_event_type = 'bounced' then 'bounced'
        else p_event_type
      end,
      v_subscriber.consent_version,
      'provider_event',
      null,
      p_occurred_at
    );

    v_reason := case p_event_type
      when 'bounced' then 'permanent_bounce'
      when 'complained' then 'complaint'
      else 'provider_suppression'
    end;

    perform public.minimize_newsletter_subscriber(
      v_subscriber.id,
      v_reason,
      p_occurred_at,
      p_provider_message_id,
      null
    );
  else
    update public.newsletter_subscribers as ns
    set last_sent_at = case
          when p_event_type = 'sent'
            then greatest(coalesce(ns.last_sent_at, p_occurred_at), p_occurred_at)
          else ns.last_sent_at
        end,
        last_delivered_at = case
          when p_event_type = 'delivered'
            then greatest(coalesce(ns.last_delivered_at, p_occurred_at), p_occurred_at)
          else ns.last_delivered_at
        end
    where ns.id = v_subscriber.id
      and ns.status not in ('bounced', 'complained', 'suppressed');
  end if;

  return query select 'recorded';
end;
$$;

create or replace function public.process_newsletter_resend_webhook(
  p_svix_id text,
  p_event_type text,
  p_provider_message_id text,
  p_occurred_at timestamptz,
  p_recipient_email_normalized text default null,
  p_is_permanent boolean default false
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscriber_id uuid;
  v_email_hash text;
  v_receipt_id text;
  v_provider_event_type text;
  v_record_outcome text;
  v_ignored boolean := false;
begin
  if p_svix_id is null or char_length(p_svix_id) not between 1 and 200
    or p_event_type is null or char_length(p_event_type) not between 1 and 100
    or p_event_type !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or p_occurred_at is null
    or (p_provider_message_id is not null and char_length(p_provider_message_id) not between 1 and 200)
    or (
      p_recipient_email_normalized is not null
      and (
        char_length(p_recipient_email_normalized) not between 3 and 254
        or p_recipient_email_normalized <> lower(btrim(p_recipient_email_normalized))
      )
    ) then
    raise exception 'invalid newsletter webhook event';
  end if;

  v_provider_event_type := case p_event_type
    when 'email.sent' then 'sent'
    when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delivery_delayed'
    when 'email.failed' then 'failed'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.suppressed' then 'suppressed'
    else null
  end;

  v_ignored := v_provider_event_type is null
    or p_event_type in ('email.opened', 'email.clicked');

  if not v_ignored and p_provider_message_id is not null then
    select event.subscriber_id
    into v_subscriber_id
    from public.newsletter_email_events as event
    where event.provider = 'resend'
      and event.provider_message_id = p_provider_message_id
      and event.subscriber_id is not null
    order by event.received_at desc
    limit 1;
  end if;

  if not v_ignored
    and v_subscriber_id is null
    and p_recipient_email_normalized is not null then
    select subscriber.id
    into v_subscriber_id
    from public.newsletter_subscribers as subscriber
    where subscriber.email_normalized = p_recipient_email_normalized;

    if v_subscriber_id is null then
      v_email_hash := public.newsletter_email_hash(p_recipient_email_normalized);
      select suppression.subscriber_id
      into v_subscriber_id
      from public.newsletter_suppressions as suppression
      where suppression.email_hash = v_email_hash
      order by suppression.updated_at desc
      limit 1;
    end if;
  end if;

  if v_subscriber_id is not null then
    perform 1
    from public.newsletter_subscribers as ns
    where ns.id = v_subscriber_id
    for update;
    if not found then
      v_subscriber_id := null;
    end if;
  end if;

  insert into public.newsletter_webhook_receipts (
    svix_id,
    event_type,
    provider_message_id,
    subscriber_id,
    provider_created_at,
    outcome
  ) values (
    p_svix_id,
    p_event_type,
    case when v_ignored then null else p_provider_message_id end,
    case when v_ignored then null else v_subscriber_id end,
    p_occurred_at,
    case
      when v_ignored then 'ignored'
      when v_subscriber_id is null then 'unmatched'
      else 'processed'
    end
  )
  on conflict (svix_id) do nothing
  returning svix_id into v_receipt_id;

  if v_receipt_id is null then
    return query select 'duplicate';
    return;
  end if;

  if v_ignored then
    return query select 'ignored';
    return;
  end if;

  if v_subscriber_id is null then
    return query select 'unmatched';
    return;
  end if;

  select provider_result.outcome
  into strict v_record_outcome
  from public.record_newsletter_provider_event(
    'resend',
    p_svix_id,
    p_provider_message_id,
    v_subscriber_id,
    v_provider_event_type,
    case
      when v_provider_event_type = 'bounced' then p_is_permanent
      else false
    end,
    p_occurred_at
  ) as provider_result;

  if v_record_outcome not in ('recorded', 'duplicate') then
    raise exception 'newsletter webhook persistence failed';
  end if;

  return query select 'processed';
end;
$$;

revoke all on function public.process_newsletter_resend_webhook(
  text, text, text, timestamptz, text, boolean
) from public, anon, authenticated;
grant execute on function public.process_newsletter_resend_webhook(
  text, text, text, timestamptz, text, boolean
) to service_role;

-- The existing server-only RPC signatures remain service_role-only after replacement.
revoke all on function public.request_newsletter_subscription(
  text, text, text, timestamptz, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.confirm_newsletter_subscription(text)
from public, anon, authenticated;
revoke all on function public.unsubscribe_newsletter_subscriber(uuid, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.unsubscribe_newsletter_by_token(text, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.record_newsletter_provider_event(
  text, text, text, uuid, text, boolean, timestamptz
) from public, anon, authenticated;

grant execute on function public.request_newsletter_subscription(
  text, text, text, timestamptz, text, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.confirm_newsletter_subscription(text)
to service_role;
grant execute on function public.unsubscribe_newsletter_subscriber(uuid, text, text, text, text)
to service_role;
grant execute on function public.unsubscribe_newsletter_by_token(text, text, text, text, text)
to service_role;
grant execute on function public.record_newsletter_provider_event(
  text, text, text, uuid, text, boolean, timestamptz
) to service_role;

-- Stable daily UTC job. pg_cron replaces an existing job with the same name,
-- preventing duplicate schedules. CI validates the definition but does not wait
-- for the daily execution.
select cron.schedule(
  'newsletter-pending-retention-daily',
  '17 3 * * *',
  $$select public.purge_stale_newsletter_pending(500);$$
);
