-- Newsletter R5A.3: repair legacy voluntary unsubscribes and keep future
-- resubscription requests inside the suppression invariant.
-- Forward-only, server-only and without provider or remote HTTP calls.

begin;

create or replace function public.repair_legacy_newsletter_unsubscribe(
  p_subscriber_id uuid,
  p_repaired_at timestamptz default pg_catalog.clock_timestamp()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscriber public.newsletter_subscribers%rowtype;
  v_email_hash text;
  v_anonymous_email text;
  v_inserted boolean := false;
begin
  if p_subscriber_id is null or p_repaired_at is null then
    raise exception 'invalid newsletter legacy repair context';
  end if;

  select * into v_subscriber
  from public.newsletter_subscribers as ns
  where ns.id = p_subscriber_id
  for update;

  if not found or v_subscriber.status <> 'unsubscribed' then
    return false;
  end if;

  if exists (
    select 1
    from public.newsletter_suppressions as nsp
    where nsp.subscriber_id = v_subscriber.id
      and nsp.lifted_at is null
  ) then
    return false;
  end if;

  v_email_hash := public.newsletter_email_hash(v_subscriber.email_normalized);

  -- An active hash owned by another aggregate is authoritative. Never replace,
  -- lift or downgrade an existing hard or voluntary suppression.
  if exists (
    select 1
    from public.newsletter_suppressions as nsp
    where nsp.email_hash = v_email_hash
      and nsp.lifted_at is null
  ) then
    return false;
  end if;

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
    'voluntary',
    v_subscriber.unsubscribed_at,
    null,
    null,
    greatest(
      pg_catalog.clock_timestamp(),
      p_repaired_at,
      v_subscriber.unsubscribed_at
    )
  )
  on conflict on constraint newsletter_suppressions_subscriber_key do update
  set email_hash = excluded.email_hash,
      suppressed_at = least(
        public.newsletter_suppressions.suppressed_at,
        excluded.suppressed_at
      ),
      lifted_at = null,
      provider_message_id = null,
      updated_at = greatest(
        pg_catalog.clock_timestamp(),
        public.newsletter_suppressions.updated_at
      )
  where public.newsletter_suppressions.reason = 'voluntary'
    and public.newsletter_suppressions.lifted_at is not null
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    return false;
  end if;

  -- Active resubscribe hashes created while the mandatory suppression was
  -- absent could never pass the delivery guard. Preserve the rows as evidence,
  -- but make those undelivered raw tokens unusable.
  update public.newsletter_confirmation_tokens as nct
  set invalidated_at = greatest(p_repaired_at, nct.created_at)
  where nct.subscriber_id = v_subscriber.id
    and nct.purpose = 'resubscribe'
    and nct.used_at is null
    and nct.invalidated_at is null;

  delete from public.newsletter_preferences as np
  where np.subscriber_id = v_subscriber.id;

  v_anonymous_email :=
    'suppressed+' || pg_catalog.replace(v_subscriber.id::text, '-', '')
    || '@invalid.eventomotor.local';

  update public.newsletter_subscribers as ns
  set email = v_anonymous_email,
      email_normalized = v_anonymous_email,
      province_slug = null,
      region_slug = null,
      source_detail = null,
      source_path = null,
      last_confirmation_requested_at = null,
      confirmation_request_window_started_at = null,
      confirmation_request_count = 0,
      provider_contact_id = null,
      last_sent_at = null,
      last_delivered_at = null
  where ns.id = v_subscriber.id;

  return true;
end;
$$;

revoke all on function public.repair_legacy_newsletter_unsubscribe(
  uuid, timestamptz
) from public, anon, authenticated, service_role;

-- Repair only the legacy invariant violation. The helper locks and rechecks
-- every candidate, so reruns and concurrent requests remain idempotent.
do $newsletter_legacy_backfill$
declare
  v_subscriber_id uuid;
begin
  for v_subscriber_id in
    select ns.id
    from public.newsletter_subscribers as ns
    where ns.status = 'unsubscribed'
      and not exists (
        select 1
        from public.newsletter_suppressions as nsp
        where nsp.subscriber_id = ns.id
          and nsp.lifted_at is null
      )
    order by ns.id
  loop
    perform public.repair_legacy_newsletter_unsubscribe(
      v_subscriber_id,
      pg_catalog.clock_timestamp()
    );
  end loop;
end;
$newsletter_legacy_backfill$;

-- Keep the reviewed R5A.2 implementation as an owner-only internal function.
-- The public signature becomes a narrow validation and repair wrapper.
do $newsletter_preserve_r5a2_request$
begin
  if to_regprocedure(
    'public.request_newsletter_subscription_r5a2(text,text,text,timestamp with time zone,text,text,text,text,text,text,text,text,text)'
  ) is null then
    alter function public.request_newsletter_subscription(
      text, text, text, timestamptz, text, text, text, text,
      text, text, text, text, text
    ) rename to request_newsletter_subscription_r5a2;
  end if;
end;
$newsletter_preserve_r5a2_request$;

revoke all on function public.request_newsletter_subscription_r5a2(
  text, text, text, timestamptz, text, text, text, text,
  text, text, text, text, text
) from public, anon, authenticated, service_role;

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
  v_subscriber_id uuid;
  v_now timestamptz := now();
begin
  -- Validate before any repair, keeping malformed calls side-effect free and
  -- equivalent to the underlying R5A.2 contract.
  if p_email is null or p_email_normalized is null
    or p_email_normalized <> pg_catalog.lower(pg_catalog.btrim(p_email))
    or char_length(p_email) not between 3 and 254 then
    raise exception 'invalid newsletter email';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid newsletter token hash';
  end if;
  if p_token_expires_at <= v_now
    or p_token_expires_at > v_now + interval '48 hours' then
    raise exception 'invalid newsletter token expiry';
  end if;
  if p_source is null or char_length(p_source) not between 1 and 100
    or p_consent_version is null
    or char_length(p_consent_version) not between 1 and 100 then
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

  select ns.id into v_subscriber_id
  from public.newsletter_subscribers as ns
  where ns.email_normalized = p_email_normalized
  for update;

  if found then
    perform public.repair_legacy_newsletter_unsubscribe(
      v_subscriber_id,
      v_now
    );
  end if;

  return query
  select request_result.outcome,
         request_result.subscriber_id,
         request_result.token_purpose
  from public.request_newsletter_subscription_r5a2(
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
  ) as request_result;
end;
$$;

revoke all on function public.request_newsletter_subscription(
  text, text, text, timestamptz, text, text, text, text,
  text, text, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.request_newsletter_subscription(
  text, text, text, timestamptz, text, text, text, text,
  text, text, text, text, text
) to service_role;

commit;
