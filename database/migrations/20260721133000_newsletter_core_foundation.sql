-- Newsletter reintegration R1: isolated core foundation.
-- Review and apply manually in a later checkpoint. This migration performs no provider calls.
create extension if not exists pgcrypto;

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  status text not null default 'pending',
  language_code text not null default 'es',
  country_code text not null default 'ES',
  province_slug text,
  region_slug text,
  source text not null,
  source_detail text,
  source_path text,
  consent_version text not null,
  last_confirmation_requested_at timestamptz,
  confirmation_request_window_started_at timestamptz,
  confirmation_request_count integer not null default 0,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  suppressed_at timestamptz,
  provider_contact_id text unique,
  last_sent_at timestamptz,
  last_delivered_at timestamptz,
  last_opened_at timestamptz,
  last_clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_normalized_key unique (email_normalized),
  constraint newsletter_subscribers_email_check check (
    char_length(email) between 3 and 254
    and email_normalized = lower(btrim(email))
    and email_normalized <> ''
  ),
  constraint newsletter_subscribers_status_check check (
    status in ('pending', 'active', 'unsubscribed', 'bounced', 'complained', 'suppressed')
  ),
  constraint newsletter_subscribers_language_check check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint newsletter_subscribers_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint newsletter_subscribers_source_check check (char_length(source) between 1 and 100),
  constraint newsletter_subscribers_source_detail_check check (source_detail is null or char_length(source_detail) <= 100),
  constraint newsletter_subscribers_source_path_check check (
    source_path is null or (char_length(source_path) <= 240 and left(source_path, 1) = '/')
  ),
  constraint newsletter_subscribers_province_check check (
    province_slug is null or (char_length(province_slug) <= 100 and province_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
  ),
  constraint newsletter_subscribers_region_check check (
    region_slug is null or (char_length(region_slug) <= 100 and region_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
  ),
  constraint newsletter_subscribers_consent_version_check check (char_length(consent_version) between 1 and 100),
  constraint newsletter_subscribers_provider_contact_check check (
    provider_contact_id is null or char_length(provider_contact_id) <= 200
  ),
  constraint newsletter_subscribers_request_count_check check (confirmation_request_count >= 0),
  constraint newsletter_subscribers_request_window_check check (
    (confirmation_request_count = 0 and confirmation_request_window_started_at is null)
    or (confirmation_request_count > 0 and confirmation_request_window_started_at is not null)
  ),
  constraint newsletter_subscribers_active_date_check check (status <> 'active' or confirmed_at is not null),
  constraint newsletter_subscribers_unsubscribed_date_check check (status <> 'unsubscribed' or unsubscribed_at is not null),
  constraint newsletter_subscribers_bounced_date_check check (status <> 'bounced' or bounced_at is not null),
  constraint newsletter_subscribers_complained_date_check check (status <> 'complained' or complained_at is not null),
  constraint newsletter_subscribers_suppressed_date_check check (status <> 'suppressed' or suppressed_at is not null)
);

comment on table public.newsletter_subscribers is
  'Canonical newsletter subscriber state. It is independent from auth.users and provider contacts.';
comment on column public.newsletter_subscribers.email_normalized is
  'Email normalized exclusively with trim and lowercase.';

create table public.newsletter_preferences (
  subscriber_id uuid primary key references public.newsletter_subscribers(id) on delete cascade,
  weekly_digest_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  token_hash text not null,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint newsletter_confirmation_tokens_hash_key unique (token_hash),
  constraint newsletter_confirmation_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint newsletter_confirmation_tokens_purpose_check check (purpose in ('subscribe', 'resubscribe')),
  constraint newsletter_confirmation_tokens_expiry_check check (expires_at > created_at),
  constraint newsletter_confirmation_tokens_usage_check check (
    used_at is null or invalidated_at is null
  )
);

comment on column public.newsletter_confirmation_tokens.token_hash is
  'SHA-256 hash only. Raw confirmation tokens must never be persisted or logged.';

create table public.newsletter_unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  invalidated_at timestamptz,
  first_used_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint newsletter_unsubscribe_tokens_hash_key unique (token_hash),
  constraint newsletter_unsubscribe_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint newsletter_unsubscribe_tokens_expiry_check check (
    expires_at is null or expires_at > created_at
  ),
  constraint newsletter_unsubscribe_tokens_invalidation_check check (
    invalidated_at is null or invalidated_at >= created_at
  ),
  constraint newsletter_unsubscribe_tokens_first_use_check check (
    first_used_at is null or first_used_at >= created_at
  ),
  constraint newsletter_unsubscribe_tokens_updated_check check (updated_at >= created_at)
);

comment on table public.newsletter_unsubscribe_tokens is
  'Server-only, rotatable unsubscribe actions. One non-invalidated token is allowed per subscriber.';
comment on column public.newsletter_unsubscribe_tokens.token_hash is
  'SHA-256 hash only. Raw unsubscribe tokens must never be persisted or logged.';
comment on column public.newsletter_unsubscribe_tokens.expires_at is
  'Nullable by policy: unsubscribe links do not expire ordinarily while the subscription exists.';

create table public.newsletter_consent_events (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete restrict,
  action text not null,
  consent_version text not null,
  source text not null,
  source_path text,
  ip_hash text,
  occurred_at timestamptz not null default now(),
  constraint newsletter_consent_events_action_check check (
    action in (
      'subscribe_requested', 'confirmation_issued', 'confirmed', 'resubscribe_requested',
      'unsubscribed', 'bounced', 'complained', 'suppressed'
    )
  ),
  constraint newsletter_consent_events_version_check check (char_length(consent_version) between 1 and 100),
  constraint newsletter_consent_events_source_check check (char_length(source) between 1 and 100),
  constraint newsletter_consent_events_source_path_check check (
    source_path is null or (char_length(source_path) <= 240 and left(source_path, 1) = '/')
  ),
  constraint newsletter_consent_events_ip_hash_check check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$')
);

create table public.newsletter_email_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  event_type text not null,
  is_permanent boolean not null default false,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint newsletter_email_events_provider_check check (char_length(provider) between 1 and 60),
  constraint newsletter_email_events_provider_event_id_check check (char_length(provider_event_id) between 1 and 200),
  constraint newsletter_email_events_provider_message_id_check check (
    provider_message_id is null or char_length(provider_message_id) <= 200
  ),
  constraint newsletter_email_events_provider_event_key unique (provider, provider_event_id),
  constraint newsletter_email_events_type_check check (
    event_type in ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened', 'clicked', 'suppressed')
  ),
  constraint newsletter_email_events_permanent_check check (not is_permanent or event_type = 'bounced')
);

create index newsletter_subscribers_status_idx on public.newsletter_subscribers (status);
create index newsletter_subscribers_province_idx on public.newsletter_subscribers (province_slug);
create index newsletter_confirmation_tokens_subscriber_idx
  on public.newsletter_confirmation_tokens (subscriber_id, created_at desc);
create index newsletter_confirmation_tokens_expiry_idx
  on public.newsletter_confirmation_tokens (expires_at)
  where used_at is null and invalidated_at is null;
create index newsletter_unsubscribe_tokens_subscriber_idx
  on public.newsletter_unsubscribe_tokens (subscriber_id, created_at desc);
create unique index newsletter_unsubscribe_tokens_active_key
  on public.newsletter_unsubscribe_tokens (subscriber_id)
  where invalidated_at is null;
create index newsletter_consent_events_subscriber_idx
  on public.newsletter_consent_events (subscriber_id, occurred_at desc);
create index newsletter_email_events_subscriber_idx
  on public.newsletter_email_events (subscriber_id, occurred_at desc);
create index newsletter_email_events_message_idx
  on public.newsletter_email_events (provider, provider_message_id);

create or replace function public.set_newsletter_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'newsletter_unsubscribe_tokens' then
    new.updated_at = greatest(clock_timestamp(), new.updated_at, old.updated_at);
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create trigger set_newsletter_subscribers_updated_at
before update on public.newsletter_subscribers
for each row execute function public.set_newsletter_updated_at();

create trigger set_newsletter_preferences_updated_at
before update on public.newsletter_preferences
for each row execute function public.set_newsletter_updated_at();

create trigger set_newsletter_unsubscribe_tokens_updated_at
before update on public.newsletter_unsubscribe_tokens
for each row execute function public.set_newsletter_updated_at();

-- Server-only RPC. Atomically applies request policy and stores only a token hash.
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
  v_now timestamptz := now();
  v_created boolean := false;
  v_action text;
  v_purpose text;
  v_window_start timestamptz;
  v_request_count integer;
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
  if p_source_path is not null and (char_length(p_source_path) > 240 or left(p_source_path, 1) <> '/') then
    raise exception 'invalid newsletter source path';
  end if;
  if p_source_detail is not null and char_length(p_source_detail) > 100 then
    raise exception 'invalid newsletter source detail';
  end if;
  if p_language_code !~ '^[a-z]{2}(-[A-Z]{2})?$' or p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'invalid newsletter locale';
  end if;
  if p_province_slug is not null
      and (char_length(p_province_slug) > 100 or p_province_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    or p_region_slug is not null
      and (char_length(p_region_slug) > 100 or p_region_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$') then
    raise exception 'invalid newsletter location';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter ip hash';
  end if;

  insert into public.newsletter_subscribers (
    email, email_normalized, status, language_code, country_code, province_slug, region_slug,
    source, source_detail, source_path, consent_version
  ) values (
    p_email, p_email_normalized, 'pending', p_language_code, p_country_code, p_province_slug,
    p_region_slug, p_source, p_source_detail, p_source_path, p_consent_version
  )
  on conflict (email_normalized) do nothing
  returning true into v_created;

  select * into strict v_subscriber
  from public.newsletter_subscribers
  where email_normalized = p_email_normalized
  for update;

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

  v_purpose := case when v_subscriber.status = 'pending' then 'subscribe' else 'resubscribe' end;

  update public.newsletter_confirmation_tokens as confirmation_token
  set invalidated_at = v_now
  where confirmation_token.subscriber_id = v_subscriber.id
    and confirmation_token.purpose = v_purpose
    and confirmation_token.used_at is null
    and confirmation_token.invalidated_at is null;

  insert into public.newsletter_confirmation_tokens (
    subscriber_id, token_hash, purpose, expires_at
  ) values (
    v_subscriber.id, p_token_hash, v_purpose, p_token_expires_at
  );

  update public.newsletter_subscribers
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
  where id = v_subscriber.id
  returning * into v_subscriber;

  insert into public.newsletter_consent_events (
    subscriber_id, action, consent_version, source, source_path, ip_hash, occurred_at
  ) values (
    v_subscriber.id, 'confirmation_issued', p_consent_version, p_source, p_source_path, p_ip_hash, v_now
  );

  return query select 'confirmation_required', v_subscriber.id, v_purpose;
end;
$$;

-- Server-only RPC. Token consumption, activation and consent are one transaction.
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
  v_token public.newsletter_confirmation_tokens%rowtype;
  v_subscriber public.newsletter_subscribers%rowtype;
  v_now timestamptz := now();
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_token', null::uuid;
    return;
  end if;

  select * into v_token
  from public.newsletter_confirmation_tokens
  where token_hash = p_token_hash
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

  select * into strict v_subscriber
  from public.newsletter_subscribers
  where id = v_token.subscriber_id
  for update;

  if v_subscriber.status in ('bounced', 'complained', 'suppressed') then
    update public.newsletter_confirmation_tokens set invalidated_at = v_now where id = v_token.id;
    return query select 'blocked', null::uuid;
    return;
  end if;

  if not (
    (v_subscriber.status = 'pending' and v_token.purpose = 'subscribe')
    or (v_subscriber.status = 'unsubscribed' and v_token.purpose = 'resubscribe')
  ) then
    update public.newsletter_confirmation_tokens set invalidated_at = v_now where id = v_token.id;
    return query select 'invalid_token', null::uuid;
    return;
  end if;

  update public.newsletter_subscribers
  set status = 'active',
      confirmed_at = v_now,
      unsubscribed_at = null,
      bounced_at = null,
      complained_at = null,
      suppressed_at = null
  where id = v_subscriber.id
  returning * into v_subscriber;

  update public.newsletter_confirmation_tokens
  set used_at = v_now
  where id = v_token.id;

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

-- Server-only RPC. Subscriber lock precedes token locks so concurrent rotation is serialized.
create or replace function public.prepare_newsletter_welcome_delivery(
  p_subscriber_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default null
)
returns table (
  subscriber_id uuid,
  recipient_email text,
  preferred_province text,
  preferred_region text,
  locale text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscriber public.newsletter_subscribers%rowtype;
  v_now timestamptz;
begin
  if p_subscriber_id is null
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter welcome context';
  end if;

  select * into v_subscriber
  from public.newsletter_subscribers
  where id = p_subscriber_id
  for update;

  if not found
    or v_subscriber.status <> 'active'
    or v_subscriber.email is null
    or btrim(v_subscriber.email) = ''
    or v_subscriber.language_code is null
    or btrim(v_subscriber.language_code) = '' then
    raise exception 'newsletter welcome delivery unavailable';
  end if;

  v_now := clock_timestamp();

  if p_expires_at is not null and p_expires_at <= v_now then
    raise exception 'invalid newsletter welcome context';
  end if;

  update public.newsletter_unsubscribe_tokens
  set
    invalidated_at = greatest(v_now, created_at),
    updated_at = greatest(v_now, created_at)
  where newsletter_unsubscribe_tokens.subscriber_id = v_subscriber.id
    and newsletter_unsubscribe_tokens.invalidated_at is null;

  insert into public.newsletter_unsubscribe_tokens (
    subscriber_id, token_hash, expires_at, created_at, updated_at
  ) values (
    v_subscriber.id, p_token_hash, p_expires_at, v_now, v_now
  );

  return query
  select
    v_subscriber.id,
    v_subscriber.email,
    v_subscriber.province_slug,
    v_subscriber.region_slug,
    v_subscriber.language_code;
end;
$$;

-- Server-only RPC. Repeated requests do not create duplicate state transitions or consent events.
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
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter ip hash';
  end if;

  select * into v_subscriber
  from public.newsletter_subscribers
  where id = p_subscriber_id
  for update;

  if not found then
    return query select 'not_found';
    return;
  end if;

  insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
  values (v_subscriber.id, false)
  on conflict (subscriber_id) do update
    set weekly_digest_enabled = false;

  if v_subscriber.status = 'unsubscribed' then
    return query select 'already_unsubscribed';
    return;
  end if;
  if v_subscriber.status in ('bounced', 'complained', 'suppressed') then
    return query select 'already_not_sendable';
    return;
  end if;

  update public.newsletter_subscribers
  set status = 'unsubscribed', unsubscribed_at = v_now
  where id = v_subscriber.id
  returning * into v_subscriber;

  update public.newsletter_confirmation_tokens
  set invalidated_at = v_now
  where subscriber_id = v_subscriber.id
    and used_at is null
    and invalidated_at is null;

  insert into public.newsletter_consent_events (
    subscriber_id, action, consent_version, source, source_path, ip_hash, occurred_at
  ) values (
    v_subscriber.id, 'unsubscribed', p_consent_version, p_source, p_source_path, p_ip_hash, v_now
  );

  return query select 'unsubscribed';
end;
$$;

-- Server-only RPC. Subscriber lock precedes token lock, matching welcome token rotation.
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
  v_unsubscribe_outcome text;
  v_now timestamptz := now();
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

  select unsubscribe_token.subscriber_id into v_subscriber_id
  from public.newsletter_unsubscribe_tokens as unsubscribe_token
  where unsubscribe_token.token_hash = p_token_hash;

  if not found then
    return query select 'invalid_or_expired';
    return;
  end if;

  select * into v_subscriber
  from public.newsletter_subscribers
  where id = v_subscriber_id
  for update;

  if not found then
    return query select 'invalid_or_expired';
    return;
  end if;

  select * into v_token
  from public.newsletter_unsubscribe_tokens
  where token_hash = p_token_hash
    and subscriber_id = v_subscriber.id
  for update;

  if not found
    or v_token.invalidated_at is not null
    or (v_token.expires_at is not null and v_token.expires_at <= v_now) then
    return query select 'invalid_or_expired';
    return;
  end if;

  select unsubscribe_result.outcome into strict v_unsubscribe_outcome
  from public.unsubscribe_newsletter_subscriber(
    v_subscriber.id,
    p_consent_version,
    p_source,
    p_source_path,
    p_ip_hash
  ) as unsubscribe_result;

  update public.newsletter_unsubscribe_tokens
  set first_used_at = coalesce(first_used_at, v_now)
  where id = v_token.id;

  return query
  select case
    when v_unsubscribe_outcome = 'unsubscribed' then 'unsubscribed'
    else 'already_unsubscribed'
  end;
end;
$$;

-- Server-only RPC for a future provider adapter. Insert and aggregate update are atomic.
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
begin
  if p_provider is null or char_length(p_provider) not between 1 and 60
    or p_provider_event_id is null or char_length(p_provider_event_id) not between 1 and 200
    or p_event_type not in ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened', 'clicked', 'suppressed')
    or p_occurred_at is null
    or (p_is_permanent and p_event_type <> 'bounced') then
    raise exception 'invalid newsletter provider event';
  end if;

  insert into public.newsletter_email_events (
    provider, provider_event_id, provider_message_id, subscriber_id,
    event_type, is_permanent, occurred_at
  ) values (
    p_provider, p_provider_event_id, p_provider_message_id, p_subscriber_id,
    p_event_type, p_is_permanent, p_occurred_at
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query select 'duplicate';
    return;
  end if;

  if p_subscriber_id is null then
    return query select 'recorded';
    return;
  end if;

  select * into strict v_subscriber
  from public.newsletter_subscribers
  where id = p_subscriber_id
  for update;

  update public.newsletter_subscribers
  -- Provider suppression states are monotonic: bounced < complained < suppressed.
  -- Aggregate timestamps represent the latest observed event of each type.
  set status = case
        when status = 'suppressed' then 'suppressed'
        when p_event_type = 'suppressed' then 'suppressed'
        when status = 'complained' then 'complained'
        when p_event_type = 'complained' then 'complained'
        when status = 'bounced' then 'bounced'
        when p_event_type = 'bounced' and p_is_permanent then 'bounced'
        else status
      end,
      bounced_at = case
        when p_event_type = 'bounced' and p_is_permanent
          then greatest(coalesce(bounced_at, p_occurred_at), p_occurred_at)
        else bounced_at
      end,
      complained_at = case
        when p_event_type = 'complained'
          then greatest(coalesce(complained_at, p_occurred_at), p_occurred_at)
        else complained_at
      end,
      suppressed_at = case
        when p_event_type = 'suppressed'
          then greatest(coalesce(suppressed_at, p_occurred_at), p_occurred_at)
        else suppressed_at
      end,
      last_sent_at = case
        when p_event_type = 'sent'
          then greatest(coalesce(last_sent_at, p_occurred_at), p_occurred_at)
        else last_sent_at
      end,
      last_delivered_at = case
        when p_event_type = 'delivered'
          then greatest(coalesce(last_delivered_at, p_occurred_at), p_occurred_at)
        else last_delivered_at
      end,
      last_opened_at = case
        when p_event_type = 'opened'
          then greatest(coalesce(last_opened_at, p_occurred_at), p_occurred_at)
        else last_opened_at
      end,
      last_clicked_at = case
        when p_event_type = 'clicked'
          then greatest(coalesce(last_clicked_at, p_occurred_at), p_occurred_at)
        else last_clicked_at
      end
  where id = v_subscriber.id
  returning * into v_subscriber;

  if (p_event_type = 'bounced' and p_is_permanent)
    or p_event_type in ('complained', 'suppressed') then
    insert into public.newsletter_consent_events (
      subscriber_id, action, consent_version, source, source_path, occurred_at
    ) values (
      v_subscriber.id,
      case when p_event_type = 'bounced' then 'bounced' else p_event_type end,
      v_subscriber.consent_version,
      'provider_event',
      null,
      p_occurred_at
    );

    insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
    values (v_subscriber.id, false)
    on conflict (subscriber_id) do update
      set weekly_digest_enabled = false;
  end if;

  return query select 'recorded';
end;
$$;

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_preferences enable row level security;
alter table public.newsletter_confirmation_tokens enable row level security;
alter table public.newsletter_unsubscribe_tokens enable row level security;
alter table public.newsletter_consent_events enable row level security;
alter table public.newsletter_email_events enable row level security;

revoke all on table
  public.newsletter_subscribers,
  public.newsletter_preferences,
  public.newsletter_confirmation_tokens,
  public.newsletter_unsubscribe_tokens,
  public.newsletter_consent_events,
  public.newsletter_email_events
from public, anon, authenticated;

grant select on table
  public.newsletter_subscribers,
  public.newsletter_preferences,
  public.newsletter_confirmation_tokens,
  public.newsletter_unsubscribe_tokens,
  public.newsletter_consent_events,
  public.newsletter_email_events
to service_role;

revoke all on function public.set_newsletter_updated_at() from public, anon, authenticated;
revoke all on function public.request_newsletter_subscription(
  text, text, text, timestamptz, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.confirm_newsletter_subscription(text) from public, anon, authenticated;
revoke all on function public.prepare_newsletter_welcome_delivery(uuid, text, timestamptz)
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
grant execute on function public.confirm_newsletter_subscription(text) to service_role;
grant execute on function public.prepare_newsletter_welcome_delivery(uuid, text, timestamptz)
  to service_role;
grant execute on function public.unsubscribe_newsletter_subscriber(uuid, text, text, text, text)
  to service_role;
grant execute on function public.unsubscribe_newsletter_by_token(text, text, text, text, text)
  to service_role;
grant execute on function public.record_newsletter_provider_event(
  text, text, text, uuid, text, boolean, timestamptz
) to service_role;
