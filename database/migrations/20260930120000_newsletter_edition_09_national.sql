begin;

create or replace function public.preview_newsletter_campaign_edition_09(
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
  cataluna_count integer,
  comunidad_valenciana_count integer,
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
    raise exception 'invalid newsletter edition 09 campaign identity';
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
    raise exception 'newsletter edition 09 campaign content mismatch';
  end if;

  select pg_catalog.count(*)::integer into v_current_eligible
  from public.newsletter_subscribers as subscriber
  where public.newsletter_edition_02_subscriber_is_sendable(subscriber.id);

  select pg_catalog.count(*)::integer into v_current_invalid
  from public.newsletter_subscribers as subscriber
  where public.newsletter_campaign_subscriber_is_eligible(subscriber.id)
    and not public.newsletter_edition_02_subscriber_is_sendable(subscriber.id);

  select (
    pg_catalog.count(*) - v_current_eligible - v_current_invalid
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
    case when v_campaign.id is null then v_current_eligible
    else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'national'
    ), 0)::integer end,
    case when v_campaign.id is null then 0
    else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'madrid'
    ), 0)::integer end,
    case when v_campaign.id is null then 0
    else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'cataluna'
    ), 0)::integer end,
    case when v_campaign.id is null then 0
    else coalesce(pg_catalog.count(*) filter (
      where delivery.content_variant = 'comunidad-valenciana'
    ), 0)::integer end,
    v_current_excluded,
    v_current_duplicates,
    v_current_invalid
  from public.newsletter_campaign_deliveries as delivery
  where delivery.campaign_id = v_campaign.id;
end;
$$;

create or replace function public.prepare_newsletter_campaign_edition_09(
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
  cataluna_count integer,
  comunidad_valenciana_count integer,
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
    raise exception 'invalid newsletter edition 09 campaign identity';
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
    raise exception 'newsletter edition 09 campaign content mismatch';
  end if;

  if v_campaign.audience_frozen_at is null then
    insert into public.newsletter_campaign_deliveries (
      campaign_id, subscriber_id, content_variant,
      status, created_at, updated_at, prepared_at
    )
    select
      v_campaign.id,
      subscriber.id,
      'national',
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
  select * from public.preview_newsletter_campaign_edition_09(
    p_edition_key, p_subject, p_html_sha256, p_text_sha256,
    p_content_manifest_digest
  );
end;
$$;

revoke all on function public.preview_newsletter_campaign_edition_09(
  text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.prepare_newsletter_campaign_edition_09(
  text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.preview_newsletter_campaign_edition_09(
  text, text, text, text, text
) to service_role;
grant execute on function public.prepare_newsletter_campaign_edition_09(
  text, text, text, text, text
) to service_role;

comment on function public.preview_newsletter_campaign_edition_09(
  text, text, text, text, text
) is
  'Read-only Edition 09 campaign preview with an all-national effective render.';
comment on function public.prepare_newsletter_campaign_edition_09(
  text, text, text, text, text
) is
  'Atomically prepares the immutable all-national Edition 09 audience snapshot.';

commit;
