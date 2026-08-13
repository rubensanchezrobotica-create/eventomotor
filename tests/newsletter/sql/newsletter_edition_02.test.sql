begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(42);

select has_column(
  'public', 'newsletter_campaigns', 'audience_frozen_at',
  'campaigns persist the audience freeze timestamp'
);
select has_column(
  'public', 'newsletter_campaigns', 'content_manifest_digest',
  'campaigns persist the content manifest digest'
);
select has_column(
  'public', 'newsletter_campaign_deliveries', 'content_variant',
  'deliveries persist a content variant snapshot'
);
select is(
  (
    select pg_catalog.pg_get_expr(attribute.adbin, attribute.adrelid)
    from pg_catalog.pg_attrdef as attribute
    join pg_catalog.pg_attribute as column_definition
      on column_definition.attrelid = attribute.adrelid
     and column_definition.attnum = attribute.adnum
    where attribute.adrelid = 'public.newsletter_campaign_deliveries'::regclass
      and column_definition.attname = 'content_variant'
  ),
  '''national''::text',
  'existing and legacy deliveries default safely to national'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.newsletter_campaigns'::regclass
      and conname = 'newsletter_campaigns_content_manifest_digest_check'
      and contype = 'c'
  ),
  'campaign content manifest digests are constrained to SHA-256'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.newsletter_campaigns'::regclass
      and conname = 'newsletter_campaigns_audience_frozen_at_check'
      and contype = 'c'
  ),
  'audience freeze timestamps cannot predate campaign creation'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.newsletter_campaign_deliveries'::regclass
      and conname = 'newsletter_campaign_deliveries_content_variant_check'
      and contype = 'c'
  ),
  'delivery content variants use the reviewed allowlist'
);
select has_function(
  'public', 'preview_newsletter_campaign_v2',
  array['text', 'text', 'text', 'text', 'text'],
  'v2 preview RPC exists'
);
select has_function(
  'public', 'prepare_newsletter_campaign_v2',
  array['text', 'text', 'text', 'text', 'text'],
  'v2 prepare RPC exists'
);
select has_function(
  'public', 'claim_newsletter_campaign_delivery_v2',
  array['uuid', 'text', 'boolean'],
  'v2 claim RPC exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.preview_newsletter_campaign_v2(text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.prepare_newsletter_campaign_v2(text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.claim_newsletter_campaign_delivery_v2(uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'service role can use the v2 RPC boundary'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.prepare_newsletter_campaign_v2(text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.prepare_newsletter_campaign_v2(text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'public roles cannot prepare a v2 campaign'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.newsletter_edition_02_content_variant(text)'::regprocedure,
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.newsletter_edition_02_subscriber_is_sendable(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'edition 02 helpers remain owner-only'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version,
  confirmed_at, province_slug, region_slug
) values
  ('82000000-0000-4000-8000-000000000001', 'edition02-national@example.invalid', 'edition02-national@example.invalid', 'active', 'edition02_test', '2026-08', now(), null, null),
  ('82000000-0000-4000-8000-000000000002', 'edition02-madrid@example.invalid', 'edition02-madrid@example.invalid', 'active', 'edition02_test', '2026-08', now(), 'madrid', 'comunidad-de-madrid'),
  ('82000000-0000-4000-8000-000000000003', 'edition02-coruna@example.invalid', 'edition02-coruna@example.invalid', 'active', 'edition02_test', '2026-08', now(), 'a-coruna', 'galicia'),
  ('82000000-0000-4000-8000-000000000004', 'edition02-barcelona@example.invalid', 'edition02-barcelona@example.invalid', 'active', 'edition02_test', '2026-08', now(), 'barcelona', 'cataluna'),
  ('82000000-0000-4000-8000-000000000005', 'edition02-pending@example.invalid', 'edition02-pending@example.invalid', 'pending', 'edition02_test', '2026-08', null, 'madrid', 'comunidad-de-madrid');

insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
select id, true
from public.newsletter_subscribers
where id between
  '82000000-0000-4000-8000-000000000001'::uuid
  and '82000000-0000-4000-8000-000000000005'::uuid;

insert into public.newsletter_consent_events (
  subscriber_id, action, consent_version, source, occurred_at
)
select id, 'confirmed', '2026-08', 'edition02_test', now()
from public.newsletter_subscribers
where id between
  '82000000-0000-4000-8000-000000000001'::uuid
  and '82000000-0000-4000-8000-000000000005'::uuid;

insert into public.newsletter_unsubscribe_tokens (subscriber_id, token_hash)
values ('82000000-0000-4000-8000-000000000002', repeat('8', 64));

select results_eq(
  $$
    select eligible_count, national_count, madrid_count, a_coruna_count,
      barcelona_count, excluded_count, duplicate_count, invalid_count
    from public.preview_newsletter_campaign_v2(
      'agenda_motor_2026_08_13',
      'Drift nocturno, rally y 4 planes más para este fin de semana',
      repeat('1', 64), repeat('2', 64), repeat('3', 64)
    )
  $$,
  $$values (4, 1, 1, 1, 1, 1, 0, 0)$$,
  'v2 preview reports the eligible audience and territorial variants only'
);
select is(
  (
    select audience_frozen_at
    from public.preview_newsletter_campaign_v2(
      'agenda_motor_2026_08_13',
      'Drift nocturno, rally y 4 planes más para este fin de semana',
      repeat('1', 64), repeat('2', 64), repeat('3', 64)
    )
  ),
  null,
  'pure preview does not create or freeze a campaign'
);

create temporary table edition02_prepare as
select * from public.prepare_newsletter_campaign_v2(
  'agenda_motor_2026_08_13',
  'Drift nocturno, rally y 4 planes más para este fin de semana',
  repeat('1', 64), repeat('2', 64), repeat('3', 64)
);

select results_eq(
  $$
    select eligible_count, prepared_count, national_count, madrid_count,
      a_coruna_count, barcelona_count
    from edition02_prepare
  $$,
  $$values (4, 4, 1, 1, 1, 1)$$,
  'first preparation freezes exactly the four eligible recipients'
);
select ok(
  (select audience_frozen_at is not null from edition02_prepare),
  'first preparation records audience_frozen_at'
);
select results_eq(
  $$
    select content_variant, count(*)::integer
    from public.newsletter_campaign_deliveries as delivery
    join public.newsletter_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.edition_key = 'agenda_motor_2026_08_13'
    group by content_variant
    order by content_variant
  $$,
  $$values
    ('a-coruna'::text, 1),
    ('barcelona'::text, 1),
    ('madrid'::text, 1),
    ('national'::text, 1)
  $$,
  'prepare snapshots the four reviewed variants'
);
select is(
  (
    select content_manifest_digest
    from public.newsletter_campaigns
    where edition_key = 'agenda_motor_2026_08_13'
  ),
  repeat('3', 64),
  'campaign identity persists the manifest digest'
);
select ok(
  (
    select invalidated_at is null
    from public.newsletter_unsubscribe_tokens
    where token_hash = repeat('8', 64)
  ),
  'preparing Edition 02 preserves previous unsubscribe links'
);

update public.newsletter_subscribers
set province_slug = 'barcelona', region_slug = 'cataluna'
where id = '82000000-0000-4000-8000-000000000002';

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version,
  confirmed_at, province_slug, region_slug
) values (
  '82000000-0000-4000-8000-000000000006',
  'edition02-late@example.invalid',
  'edition02-late@example.invalid',
  'active', 'edition02_test', '2026-08', now(), 'madrid', 'comunidad-de-madrid'
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('82000000-0000-4000-8000-000000000006', true);
insert into public.newsletter_consent_events (
  subscriber_id, action, consent_version, source
) values (
  '82000000-0000-4000-8000-000000000006',
  'confirmed', '2026-08', 'edition02_test'
);

select is(
  (
    select eligible_count
    from public.prepare_newsletter_campaign_v2(
      'agenda_motor_2026_08_13',
      'Drift nocturno, rally y 4 planes más para este fin de semana',
      repeat('1', 64), repeat('2', 64), repeat('3', 64)
    )
  ),
  4,
  'preparing again returns the frozen audience instead of adding a late subscriber'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_campaign_deliveries
    where subscriber_id = '82000000-0000-4000-8000-000000000006'
  ),
  0,
  'a subscriber created after the freeze is not added'
);
select is(
  (
    select delivery.content_variant
    from public.newsletter_campaign_deliveries as delivery
    join public.newsletter_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.edition_key = 'agenda_motor_2026_08_13'
      and delivery.subscriber_id = '82000000-0000-4000-8000-000000000002'
  ),
  'madrid',
  'changing province_slug after prepare does not change the delivery snapshot'
);
select throws_ok(
  $$
    select * from public.prepare_newsletter_campaign(
      'agenda_motor_2026_08_13',
      'Drift nocturno, rally y 4 planes mÃ¡s para este fin de semana',
      repeat('1', 64), repeat('2', 64)
    )
  $$,
  'P0001',
  'newsletter campaign v2 requires prepare v2',
  'v1 prepare fails closed for a frozen v2 campaign'
);
select throws_ok(
  $$
    insert into public.newsletter_campaign_deliveries (campaign_id, subscriber_id)
    values (
      (
        select id from public.newsletter_campaigns
        where edition_key = 'agenda_motor_2026_08_13'
      ),
      '82000000-0000-4000-8000-000000000006'
    )
  $$,
  'P0001',
  'newsletter campaign audience is frozen',
  'the database guard rejects a direct post-freeze delivery insert'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_campaign_deliveries as delivery
    join public.newsletter_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.edition_key = 'agenda_motor_2026_08_13'
  ),
  4,
  'neither v1 prepare nor a direct insert can enlarge the frozen audience'
);
select throws_ok(
  $$
    select * from public.claim_newsletter_campaign_delivery(
      (
        select id from public.newsletter_campaigns
        where edition_key = 'agenda_motor_2026_08_13'
      ),
      repeat('9', 64),
      false
    )
  $$,
  'P0001',
  'newsletter campaign v2 requires claim v2',
  'v1 claim fails closed for a v2 campaign'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_campaign_deliveries as delivery
    join public.newsletter_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.edition_key = 'agenda_motor_2026_08_13'
      and delivery.status = 'sending'
  ),
  0,
  'a rejected v1 claim does not move a v2 delivery to sending'
);
select throws_ok(
  $$
    select * from public.prepare_newsletter_campaign_v2(
      'agenda_motor_2026_08_13',
      'Drift nocturno, rally y 4 planes más para este fin de semana',
      repeat('1', 64), repeat('2', 64), repeat('4', 64)
    )
  $$,
  'P0001',
  'newsletter campaign v2 content mismatch',
  'an Edition 02 campaign key cannot be reused with another manifest'
);

select is(
  (
    select count(*)::integer
    from public.prepare_newsletter_campaign(
      'agenda_motor_legacy_regression',
      'Legacy campaign remains compatible',
      repeat('5', 64), repeat('6', 64)
    )
  ),
  1,
  'the Edition 01 prepare RPC remains callable'
);
select results_eq(
  $$
    select audience_frozen_at, content_manifest_digest
    from public.newsletter_campaigns
    where edition_key = 'agenda_motor_legacy_regression'
  $$,
  $$values (null::timestamptz, null::text)$$,
  'legacy campaigns remain valid without v2 identity fields'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_campaign_deliveries as delivery
    join public.newsletter_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.edition_key = 'agenda_motor_legacy_regression'
      and delivery.content_variant <> 'national'
  ),
  0,
  'legacy deliveries receive only the safe national default'
);

create temporary table edition02_legacy_claim as
select * from public.claim_newsletter_campaign_delivery(
  (
    select id from public.newsletter_campaigns
    where edition_key = 'agenda_motor_legacy_regression'
  ),
  repeat('9', 64),
  false
);

select results_eq(
  $$
    select count(*)::integer, pg_catalog.bool_and(delivery.content_variant = 'national')
    from edition02_legacy_claim as legacy_claim
    join public.newsletter_campaign_deliveries as delivery
      on delivery.id = legacy_claim.delivery_id
  $$,
  $$values (1, true)$$,
  'the v1 claim remains functional and preserves the legacy national default'
);

create temporary table edition02_precreated_v1 as
select * from public.prepare_newsletter_campaign(
  'agenda_motor_precreated_v1',
  'Legacy identity cannot become v2',
  repeat('a', 64), repeat('b', 64)
);

select throws_ok(
  $$
    select * from public.prepare_newsletter_campaign_v2(
      'agenda_motor_precreated_v1',
      'Legacy identity cannot become v2',
      repeat('a', 64), repeat('b', 64), repeat('c', 64)
    )
  $$,
  'P0001',
  'newsletter campaign v2 content mismatch',
  'v2 preparation never adopts an identity previously created through v1'
);
select is(
  (
    select content_manifest_digest
    from public.newsletter_campaigns
    where edition_key = 'agenda_motor_precreated_v1'
  ),
  null,
  'a failed v2 adoption leaves the legacy campaign identity unchanged'
);

update public.newsletter_subscribers
set status = 'suppressed', suppressed_at = now()
where id in (
  '82000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000003',
  '82000000-0000-4000-8000-000000000004'
);

create temporary table edition02_claim as
select * from public.claim_newsletter_campaign_delivery_v2(
  (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_13'),
  repeat('7', 64),
  false
);

select results_eq(
  $$select content_variant, recipient_email from edition02_claim$$,
  $$values ('madrid'::text, 'edition02-madrid@example.invalid'::text)$$,
  'claim returns only the frozen variant and the still eligible recipient'
);

create temporary table edition02_acceptance as
select outcome from public.record_newsletter_campaign_delivery_accepted(
  (select delivery_id from edition02_claim),
  (select claim_id from edition02_claim),
  'resend-edition02-message-1',
  now()
);

create temporary table edition02_post_freeze_claim as
select * from public.claim_newsletter_campaign_delivery_v2(
  (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_13'),
  repeat('6', 64),
  false
);

select results_eq(
  $$
    select
      delivery.status,
      delivery.last_error_code,
      delivery.content_variant,
      (select count(*)::integer from edition02_post_freeze_claim),
      (
        select count(*)::integer
        from public.newsletter_campaign_unsubscribe_tokens
        where token_hash = repeat('6', 64)
      ),
      (
        select count(*)::integer
        from public.newsletter_email_events
        where subscriber_id = delivery.subscriber_id
      )
    from public.newsletter_campaign_deliveries as delivery
    where delivery.subscriber_id = '82000000-0000-4000-8000-000000000001'
      and delivery.campaign_id = (
        select id from public.newsletter_campaigns
        where edition_key = 'agenda_motor_2026_08_13'
      )
  $$,
  $$values (
    'failed'::text,
    'subscriber_ineligible'::text,
    'national'::text,
    0,
    0,
    0
  )$$,
  'claim revalidates eligibility after the audience freeze'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_campaign_unsubscribe_tokens
    where token_hash = repeat('7', 64)
  ),
  1,
  'v2 claim persists only the supplied unsubscribe token hash'
);
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'newsletter_campaign_unsubscribe_tokens'
      and column_name in ('raw_token', 'token_raw', 'unsubscribe_url')
  ),
  0,
  'the database has no field for raw campaign token material'
);
select results_eq(
  $$select outcome from edition02_acceptance$$,
  $$values ('recorded'::text)$$,
  'the existing acceptance RPC records an Edition 02 delivery'
);
select results_eq(
  $$
    select status, provider_message_id
    from public.newsletter_campaign_deliveries
    where id = (select delivery_id from edition02_claim)
  $$,
  $$values ('accepted'::text, 'resend-edition02-message-1'::text)$$,
  'accepted Edition 02 delivery keeps its provider message ID'
);
select results_eq(
  $$
    select parameter_name::text collate "C",
           data_type::text collate "C"
    from information_schema.parameters
    where specific_schema::text collate "C" = 'public'::text collate "C"
      and specific_name::text collate "C"
        like 'claim_newsletter_campaign_delivery_v2_%'::text collate "C"
      and parameter_mode::text collate "C" = 'OUT'::text collate "C"
    order by ordinal_position
  $$,
  $$values
    ('delivery_id'::text collate "C", 'uuid'::text collate "C"),
    ('campaign_id'::text collate "C", 'uuid'::text collate "C"),
    ('subscriber_id'::text collate "C", 'uuid'::text collate "C"),
    ('recipient_email'::text collate "C", 'text'::text collate "C"),
    ('claim_id'::text collate "C", 'uuid'::text collate "C"),
    ('attempt_count'::text collate "C", 'integer'::text collate "C"),
    ('idempotency_key'::text collate "C", 'text'::text collate "C"),
    ('content_variant'::text collate "C", 'text'::text collate "C")
  $$,
  'v2 claim exposes the variant snapshot without province_slug or region_slug'
);

select * from finish();
rollback;
