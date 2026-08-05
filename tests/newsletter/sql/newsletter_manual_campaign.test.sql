begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(42);

select has_table('public', 'newsletter_campaigns', 'campaign table exists');
select has_table('public', 'newsletter_campaign_deliveries', 'campaign delivery table exists');
select has_table(
  'public',
  'newsletter_campaign_unsubscribe_tokens',
  'campaign unsubscribe token table exists'
);
select col_is_unique(
  'public',
  'newsletter_campaign_deliveries',
  array['campaign_id', 'subscriber_id'],
  'one delivery is allowed per campaign and subscriber'
);
select ok(
  (
    select pg_catalog.bool_and(relrowsecurity)
    from pg_catalog.pg_class
    where oid in (
      'public.newsletter_campaigns'::regclass,
      'public.newsletter_campaign_deliveries'::regclass,
      'public.newsletter_campaign_unsubscribe_tokens'::regclass
    )
  ),
  'RLS is enabled on all campaign tables'
);
select ok(
  not has_table_privilege('service_role', 'public.newsletter_campaigns', 'SELECT')
  and not has_table_privilege('service_role', 'public.newsletter_campaign_deliveries', 'SELECT')
  and not has_table_privilege('service_role', 'public.newsletter_campaign_unsubscribe_tokens', 'SELECT'),
  'service role cannot bypass the campaign RPC boundary with direct reads'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_newsletter_campaign(text,text,text,text)'::regprocedure,
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.claim_newsletter_campaign_delivery(uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.record_newsletter_campaign_delivery_accepted(uuid,uuid,text,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'service role can execute the campaign write RPCs'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.prepare_newsletter_campaign(text,text,text,text)'::regprocedure,
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.prepare_newsletter_campaign(text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'public roles cannot prepare campaigns'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.newsletter_campaign_subscriber_is_eligible(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.newsletter_unsubscribe_by_token_legacy_internal(text,text,text,text,text)',
    'EXECUTE'
  ),
  'service role cannot execute campaign eligibility or legacy token helpers directly'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version,
  confirmed_at, unsubscribed_at, bounced_at, complained_at, suppressed_at
) values
  ('81000000-0000-4000-8000-000000000001', 'campaign-active@example.invalid', 'campaign-active@example.invalid', 'active', 'campaign_test', '2026-07', now(), null, null, null, null),
  ('81000000-0000-4000-8000-000000000002', 'campaign-pending@example.invalid', 'campaign-pending@example.invalid', 'pending', 'campaign_test', '2026-07', null, null, null, null, null),
  ('81000000-0000-4000-8000-000000000003', 'campaign-unsubscribed@example.invalid', 'campaign-unsubscribed@example.invalid', 'unsubscribed', 'campaign_test', '2026-07', now() - interval '2 days', now() - interval '1 day', null, null, null),
  ('81000000-0000-4000-8000-000000000004', 'campaign-bounced@example.invalid', 'campaign-bounced@example.invalid', 'bounced', 'campaign_test', '2026-07', now() - interval '2 days', null, now() - interval '1 day', null, null),
  ('81000000-0000-4000-8000-000000000005', 'campaign-complained@example.invalid', 'campaign-complained@example.invalid', 'complained', 'campaign_test', '2026-07', now() - interval '2 days', null, null, now() - interval '1 day', null),
  ('81000000-0000-4000-8000-000000000006', 'campaign-suppressed@example.invalid', 'campaign-suppressed@example.invalid', 'suppressed', 'campaign_test', '2026-07', now() - interval '2 days', null, null, null, now() - interval '1 day'),
  ('81000000-0000-4000-8000-000000000007', 'campaign-pref-off@example.invalid', 'campaign-pref-off@example.invalid', 'active', 'campaign_test', '2026-07', now(), null, null, null, null),
  ('81000000-0000-4000-8000-000000000008', 'campaign-hard-suppression@example.invalid', 'campaign-hard-suppression@example.invalid', 'active', 'campaign_test', '2026-07', now(), null, null, null, null);

insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
select id, id <> '81000000-0000-4000-8000-000000000007'::uuid
from public.newsletter_subscribers
where id between
  '81000000-0000-4000-8000-000000000001'::uuid
  and '81000000-0000-4000-8000-000000000008'::uuid;

insert into public.newsletter_consent_events (
  subscriber_id, action, consent_version, source, occurred_at
)
select id, 'confirmed', '2026-07', 'campaign_test', now()
from public.newsletter_subscribers
where id between
  '81000000-0000-4000-8000-000000000001'::uuid
  and '81000000-0000-4000-8000-000000000008'::uuid;

insert into public.newsletter_suppressions (
  subscriber_id, email_hash, reason, suppressed_at
) values (
  '81000000-0000-4000-8000-000000000008',
  public.newsletter_email_hash('campaign-hard-suppression@example.invalid'),
  'complaint',
  now()
);

insert into public.newsletter_unsubscribe_tokens (
  subscriber_id, token_hash
) values (
  '81000000-0000-4000-8000-000000000001',
  repeat('a', 64)
);

select results_eq(
  $$
    select eligible_count, campaign_status
    from public.preview_newsletter_campaign(
      'agenda_motor_2026_08_06',
      'La Bañeza, rally y 4 planes más para este fin de semana',
      repeat('1', 64),
      repeat('2', 64)
    )
  $$,
  $$values (1, 'not_created'::text)$$,
  'preview selects only active confirmed consent with weekly preference and no suppression'
);
select results_eq(
  $$
    select eligible_count, prepared_count, accepted_count
    from public.prepare_newsletter_campaign(
      'agenda_motor_2026_08_06',
      'La Bañeza, rally y 4 planes más para este fin de semana',
      repeat('1', 64),
      repeat('2', 64)
    )
  $$,
  $$values (1, 1, 0)$$,
  'preparation persists exactly the eligible audience'
);
select is(
  (select count(*)::integer from public.newsletter_campaigns),
  1,
  'one persistent campaign is registered'
);
select is(
  (select count(*)::integer from public.newsletter_campaign_deliveries),
  1,
  'one persistent delivery is registered'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_campaign_deliveries as delivery
    join public.newsletter_subscribers as subscriber
      on subscriber.id = delivery.subscriber_id
    where subscriber.status in ('pending', 'unsubscribed', 'bounced', 'complained', 'suppressed')
  ),
  0,
  'all non-sendable subscriber states are excluded'
);
select is(
  (
    select count(*)::integer
    from public.prepare_newsletter_campaign(
      'agenda_motor_2026_08_06',
      'La Bañeza, rally y 4 planes más para este fin de semana',
      repeat('1', 64),
      repeat('2', 64)
    )
  ),
  1,
  'repeated preparation returns one summary row'
);
select is(
  (select count(*)::integer from public.newsletter_campaign_deliveries),
  1,
  'repeated preparation does not duplicate deliveries'
);
select ok(
  (
    select invalidated_at is null
    from public.newsletter_unsubscribe_tokens
    where token_hash = repeat('a', 64)
  ),
  'campaign preparation does not invalidate a previous unsubscribe link'
);
select throws_ok(
  $$
    select * from public.prepare_newsletter_campaign(
      'agenda_motor_2026_08_06',
      'Changed subject',
      repeat('1', 64),
      repeat('2', 64)
    )
  $$,
  'P0001',
  'newsletter campaign content mismatch',
  'an edition key cannot be reused with different content'
);

create temporary table first_claim as
select * from public.claim_newsletter_campaign_delivery(
  (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_06'),
  repeat('b', 64),
  false
);

select results_eq(
  $$select recipient_email from first_claim$$,
  $$values ('campaign-active@example.invalid'::text)$$,
  'claim returns only the eligible recipient to the server-only runner'
);
select is(
  (select status from public.newsletter_campaign_deliveries),
  'sending',
  'claim atomically moves the delivery to sending'
);
select is(
  (select attempt_count from public.newsletter_campaign_deliveries),
  1,
  'first claim records attempt one'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_campaign_unsubscribe_tokens
    where token_hash = repeat('b', 64)
  ),
  1,
  'claim persists only the supplied campaign token hash'
);
select ok(
  (
    select pg_catalog.strpos(idempotency_key, pg_catalog.chr(64)) = 0
      and idempotency_key not like '%campaign-active%'
    from first_claim
  ),
  'provider idempotency identity contains no recipient PII'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '81000000-0000-4000-8000-000000000010',
  'campaign-sequential@example.invalid',
  'campaign-sequential@example.invalid',
  'active',
  'campaign_sequential_test',
  '2026-07',
  now()
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('81000000-0000-4000-8000-000000000010', true);
insert into public.newsletter_consent_events (
  subscriber_id, action, consent_version, source
) values (
  '81000000-0000-4000-8000-000000000010',
  'confirmed',
  '2026-07',
  'campaign_sequential_test'
);
create temporary table sequential_prepare as
select * from public.prepare_newsletter_campaign(
  'agenda_motor_2026_08_06',
  'La Bañeza, rally y 4 planes más para este fin de semana',
  repeat('1', 64),
  repeat('2', 64)
);
select is_empty(
  $$
    select * from public.claim_newsletter_campaign_delivery(
      (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_06'),
      repeat('c', 64),
      false
    )
  $$,
  'a current sending delivery blocks another prepared delivery in the same campaign'
);
delete from public.newsletter_campaign_deliveries
where subscriber_id = '81000000-0000-4000-8000-000000000010';
delete from public.newsletter_consent_events
where subscriber_id = '81000000-0000-4000-8000-000000000010';
delete from public.newsletter_preferences
where subscriber_id = '81000000-0000-4000-8000-000000000010';
delete from public.newsletter_subscribers
where id = '81000000-0000-4000-8000-000000000010';

select results_eq(
  $$
    select outcome from public.record_newsletter_campaign_delivery_failed(
      (select delivery_id from first_claim),
      (select claim_id from first_claim),
      'provider_http_429',
      true,
      now()
    )
  $$,
  $$values ('recorded'::text)$$,
  'definitive provider rejection is persisted as failed'
);
select results_eq(
  $$select status, retryable from public.newsletter_campaign_deliveries$$,
  $$values ('failed'::text, true)$$,
  'retryable failed state is explicit'
);
select is_empty(
  $$
    select * from public.claim_newsletter_campaign_delivery(
      (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_06'),
      repeat('c', 64),
      false
    )
  $$,
  'an ordinary second execution does not retry failed delivery'
);

create temporary table retry_claim as
select * from public.claim_newsletter_campaign_delivery(
  (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_06'),
  repeat('c', 64),
  true
);

select is((select attempt_count from retry_claim), 2, 'resume creates attempt two');
select is(
  (select count(*)::integer from public.newsletter_campaign_unsubscribe_tokens),
  2,
  'each delivery attempt receives a distinct token hash'
);
select results_eq(
  $$
    select outcome from public.record_newsletter_campaign_delivery_accepted(
      (select delivery_id from retry_claim),
      (select claim_id from retry_claim),
      'resend-campaign-message-1',
      now()
    )
  $$,
  $$values ('recorded'::text)$$,
  'accepted provider response is persisted'
);
select results_eq(
  $$select status, provider_message_id from public.newsletter_campaign_deliveries$$,
  $$values ('accepted'::text, 'resend-campaign-message-1'::text)$$,
  'accepted state retains the provider message ID'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_email_events
    where provider_message_id = 'resend-campaign-message-1'
      and event_type = 'sent'
  ),
  1,
  'acceptance registers the outbound message for webhook correlation'
);
select is_empty(
  $$
    select * from public.claim_newsletter_campaign_delivery(
      (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_06'),
      repeat('d', 64),
      true
    )
  $$,
  'accepted delivery is never claimed again'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '81000000-0000-4000-8000-000000000009',
  'campaign-late@example.invalid',
  'campaign-late@example.invalid',
  'active',
  'campaign_test',
  '2026-07',
  now()
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('81000000-0000-4000-8000-000000000009', true);
insert into public.newsletter_consent_events (
  subscriber_id, action, consent_version, source
) values (
  '81000000-0000-4000-8000-000000000009', 'confirmed', '2026-07', 'campaign_test'
);
select is(
  (
    select prepared_count
    from public.prepare_newsletter_campaign(
      'agenda_motor_2026_08_06',
      'La Bañeza, rally y 4 planes más para este fin de semana',
      repeat('1', 64),
      repeat('2', 64)
    )
  ),
  1,
  'a later preparation adds a newly eligible subscriber without duplicating accepted'
);

create temporary table unknown_claim as
select * from public.claim_newsletter_campaign_delivery(
  (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_06'),
  repeat('d', 64),
  true
);
select results_eq(
  $$
    select outcome from public.record_newsletter_campaign_delivery_unknown(
      (select delivery_id from unknown_claim),
      (select claim_id from unknown_claim),
      'provider_timeout',
      now()
    )
  $$,
  $$values ('recorded'::text)$$,
  'ambiguous provider result is persisted as unknown'
);
select results_eq(
  $$
    select status, retryable
    from public.newsletter_campaign_deliveries
    where id = (select delivery_id from unknown_claim)
  $$,
  $$values ('unknown'::text, false)$$,
  'unknown is explicitly non-retryable'
);
select is_empty(
  $$
    select * from public.claim_newsletter_campaign_delivery(
      (select id from public.newsletter_campaigns where edition_key = 'agenda_motor_2026_08_06'),
      repeat('e', 64),
      true
    )
  $$,
  'resume never auto-retries unknown'
);

select results_eq(
  $$
    select outcome from public.unsubscribe_newsletter_by_token(
      repeat('c', 64), '2026-07', 'campaign_test', '/newsletter/unsubscribe', null
    )
  $$,
  $$values ('unsubscribed'::text)$$,
  'a campaign token performs immediate unsubscribe'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '81000000-0000-4000-8000-000000000001'
  ),
  'unsubscribed',
  'campaign token updates the final subscriber state'
);
select results_eq(
  $$
    select outcome from public.unsubscribe_newsletter_by_token(
      repeat('c', 64), '2026-07', 'campaign_test', '/newsletter/unsubscribe', null
    )
  $$,
  $$values ('already_unsubscribed'::text)$$,
  'repeated campaign token unsubscribe stays idempotent'
);
select ok(
  (
    select first_used_at is not null and first_used_at >= created_at
    from public.newsletter_campaign_unsubscribe_tokens
    where token_hash = repeat('c', 64)
  ),
  'campaign token records its first use without persisting raw material'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_consent_events
    where subscriber_id = '81000000-0000-4000-8000-000000000001'
      and action = 'unsubscribed'
  ),
  1,
  'campaign token records one effective unsubscribe consent event'
);

select * from finish();
rollback;
