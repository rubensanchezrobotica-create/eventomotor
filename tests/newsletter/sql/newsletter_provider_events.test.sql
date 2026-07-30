begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(19);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '30000000-0000-4000-8000-000000000001',
  'provider-events@example.invalid',
  'provider-events@example.invalid',
  'active', 'sql_test', '2026-07', now()
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('30000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$select outcome from public.record_newsletter_provider_event('test-provider', 'provider-event-1', 'message-1', '30000000-0000-4000-8000-000000000001', 'sent', false, '2026-07-21T10:00:00Z')$$,
  $$values ('recorded'::text)$$,
  'a new provider event is recorded'
);
select ok(
  exists(select 1 from public.newsletter_email_events where provider = 'test-provider' and provider_event_id = 'provider-event-1'),
  'the provider event row is inserted'
);
select results_eq(
  $$select outcome from public.record_newsletter_provider_event('test-provider', 'provider-event-1', 'message-1', '30000000-0000-4000-8000-000000000001', 'sent', false, '2026-07-21T10:00:00Z')$$,
  $$values ('duplicate'::text)$$,
  'a duplicate provider event is not processed twice'
);
select is(
  (select count(*)::integer from public.newsletter_email_events where provider = 'test-provider' and provider_event_id = 'provider-event-1'),
  1,
  'provider event deduplication leaves one row'
);
select is(
  (select last_sent_at from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'),
  '2026-07-21T10:00:00Z'::timestamptz,
  'sent updates the aggregate timestamp'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-2', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'delivered', false, '2026-07-21T10:05:00Z'
);
select is(
  (select last_delivered_at from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'),
  '2026-07-21T10:05:00Z'::timestamptz,
  'delivered updates its aggregate timestamp'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-3', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'delivery_delayed', false, '2026-07-21T10:10:00Z'
);
select is(
  (select status from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'),
  'active',
  'delivery delayed does not change subscriber state'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-4', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'bounced', false, '2026-07-21T10:15:00Z'
);
select is(
  (select status from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'),
  'active',
  'a temporary bounce does not change subscriber state'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-5', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'bounced', true, '2026-07-21T10:20:00Z'
);
select is(
  (select status from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'),
  'bounced',
  'a permanent bounce blocks the subscriber'
);
select is(
  (select count(*)::integer from public.newsletter_preferences where subscriber_id = '30000000-0000-4000-8000-000000000001'),
  0,
  'a permanent bounce deletes delivery preferences'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-6', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'complained', false, '2026-07-21T10:30:00Z'
);
select is(
  (select status from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'),
  'complained',
  'a complaint changes the subscriber to complained'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-7', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'bounced', true, '2026-07-21T09:00:00Z'
);
select results_eq(
  $$select status, bounced_at from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('complained'::text, '2026-07-21T10:20:00Z'::timestamptz)$$,
  'an out-of-order bounce does not degrade complained or its latest bounce timestamp'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-8', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'suppressed', false, '2026-07-21T10:40:00Z'
);
select is(
  (select status from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'),
  'suppressed',
  'a suppression changes the subscriber to suppressed'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-9', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'bounced', true, '2026-07-21T10:10:00Z'
);
select results_eq(
  $$select status, bounced_at from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('suppressed'::text, '2026-07-21T10:20:00Z'::timestamptz)$$,
  'suppressed remains suppressed after a bounce and keeps its latest bounce timestamp'
);

select * from public.record_newsletter_provider_event(
  'test-provider', 'provider-event-10', 'message-1',
  '30000000-0000-4000-8000-000000000001', 'complained', false, '2026-07-21T10:25:00Z'
);
select results_eq(
  $$select status, complained_at from public.newsletter_subscribers where id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('suppressed'::text, '2026-07-21T10:30:00Z'::timestamptz)$$,
  'an out-of-order complaint does not degrade suppressed or its latest complaint timestamp'
);

select throws_ok(
  $$select * from public.record_newsletter_provider_event('test-provider', 'retryable-event', null, '30000000-0000-4000-8000-000000000099', 'delivered', false, now())$$,
  '23503',
  null,
  'an aggregate update failure aborts the provider RPC'
);
select is(
  (select count(*)::integer from public.newsletter_email_events where provider = 'test-provider' and provider_event_id = 'retryable-event'),
  0,
  'a failed aggregate update does not leave the event deduplicated'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '30000000-0000-4000-8000-000000000099',
  'provider-retry@example.invalid',
  'provider-retry@example.invalid',
  'active', 'sql_test', '2026-07', now()
);
select results_eq(
  $$select outcome from public.record_newsletter_provider_event('test-provider', 'retryable-event', null, '30000000-0000-4000-8000-000000000099', 'delivered', false, now())$$,
  $$values ('recorded'::text)$$,
  'a retry can process the event after the aggregate target is valid'
);
select is(
  (select count(*)::integer from public.newsletter_email_events where provider = 'test-provider' and provider_event_id = 'retryable-event'),
  1,
  'the successful retry leaves exactly one provider event'
);

select * from finish();
rollback;
