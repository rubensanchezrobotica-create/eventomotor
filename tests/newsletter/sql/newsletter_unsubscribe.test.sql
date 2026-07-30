begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(14);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '20000000-0000-4000-8000-000000000001',
  'unsubscribe-active@example.invalid',
  'unsubscribe-active@example.invalid',
  'active', 'sql_test', '2026-07', now()
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('20000000-0000-4000-8000-000000000001', true);
insert into public.newsletter_confirmation_tokens (subscriber_id, token_hash, purpose, expires_at)
values ('20000000-0000-4000-8000-000000000001', repeat('a', 64), 'subscribe', now() + interval '1 day');

select results_eq(
  $$select outcome from public.unsubscribe_newsletter_subscriber('20000000-0000-4000-8000-000000000001', '2026-07', 'sql_test')$$,
  $$values ('unsubscribed'::text)$$,
  'an active subscriber can unsubscribe'
);
select is(
  (select status from public.newsletter_subscribers where id = '20000000-0000-4000-8000-000000000001'),
  'unsubscribed',
  'unsubscribe changes active to unsubscribed'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_preferences
    where subscriber_id = '20000000-0000-4000-8000-000000000001'
  ),
  0,
  'unsubscribe removes newsletter preferences during minimization'
);
select ok(
  exists(
    select 1 from public.newsletter_consent_events
    where subscriber_id = '20000000-0000-4000-8000-000000000001' and action = 'unsubscribed'
  ),
  'unsubscribe records a consent event'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_confirmation_tokens
    where subscriber_id = '20000000-0000-4000-8000-000000000001'
  ),
  0,
  'unsubscribe removes unnecessary confirmation tokens during minimization'
);
select results_eq(
  $$
    select reason
    from public.newsletter_suppressions
    where subscriber_id = '20000000-0000-4000-8000-000000000001'
      and lifted_at is null
  $$,
  $$values ('voluntary'::text)$$,
  'unsubscribe preserves only an active minimized voluntary suppression'
);
select results_eq(
  $$
    select outcome
    from public.check_newsletter_delivery_eligibility(
      '20000000-0000-4000-8000-000000000001',
      'welcome'
    )
  $$,
  $$values ('blocked'::text)$$,
  'a minimized unsubscribe cannot receive welcome delivery'
);

select results_eq(
  $$select outcome from public.unsubscribe_newsletter_subscriber('20000000-0000-4000-8000-000000000001', '2026-07', 'sql_test')$$,
  $$values ('already_unsubscribed'::text)$$,
  'a repeated unsubscribe is idempotent'
);
select is(
  (
    select count(*)::integer from public.newsletter_consent_events
    where subscriber_id = '20000000-0000-4000-8000-000000000001' and action = 'unsubscribed'
  ),
  1,
  'a repeated unsubscribe does not duplicate consent evidence'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, bounced_at, complained_at, suppressed_at
) values
  ('20000000-0000-4000-8000-000000000002', 'unsubscribe-pending@example.invalid', 'unsubscribe-pending@example.invalid', 'pending', 'sql_test', '2026-07', null, null, null),
  ('20000000-0000-4000-8000-000000000003', 'unsubscribe-bounced@example.invalid', 'unsubscribe-bounced@example.invalid', 'bounced', 'sql_test', '2026-07', now(), null, null),
  ('20000000-0000-4000-8000-000000000004', 'unsubscribe-complained@example.invalid', 'unsubscribe-complained@example.invalid', 'complained', 'sql_test', '2026-07', null, now(), null),
  ('20000000-0000-4000-8000-000000000005', 'unsubscribe-suppressed@example.invalid', 'unsubscribe-suppressed@example.invalid', 'suppressed', 'sql_test', '2026-07', null, null, now());

create temporary table pending_unsubscribe_result on commit drop as
select outcome
from public.unsubscribe_newsletter_subscriber(
  '20000000-0000-4000-8000-000000000002',
  '2026-07',
  'sql_test'
);

select results_eq(
  $$
    select result.outcome, subscriber.status
    from pg_temp.pending_unsubscribe_result as result
    cross join public.newsletter_subscribers as subscriber
    where subscriber.id = '20000000-0000-4000-8000-000000000002'
  $$,
  $$values ('unsubscribed'::text, 'unsubscribed'::text)$$,
  'a pending subscriber follows the R1 unsubscribe policy'
);
select results_eq(
  $$
    with result as (
      select outcome from public.unsubscribe_newsletter_subscriber('20000000-0000-4000-8000-000000000003', '2026-07', 'sql_test')
    )
    select outcome, (select status from public.newsletter_subscribers where id = '20000000-0000-4000-8000-000000000003') from result
  $$,
  $$values ('already_not_sendable'::text, 'bounced'::text)$$,
  'unsubscribe preserves bounced'
);
select results_eq(
  $$
    with result as (
      select outcome from public.unsubscribe_newsletter_subscriber('20000000-0000-4000-8000-000000000004', '2026-07', 'sql_test')
    )
    select outcome, (select status from public.newsletter_subscribers where id = '20000000-0000-4000-8000-000000000004') from result
  $$,
  $$values ('already_not_sendable'::text, 'complained'::text)$$,
  'unsubscribe preserves complained'
);
select results_eq(
  $$
    with result as (
      select outcome from public.unsubscribe_newsletter_subscriber('20000000-0000-4000-8000-000000000005', '2026-07', 'sql_test')
    )
    select outcome, (select status from public.newsletter_subscribers where id = '20000000-0000-4000-8000-000000000005') from result
  $$,
  $$values ('already_not_sendable'::text, 'suppressed'::text)$$,
  'unsubscribe preserves suppressed'
);

select is(
  (
    select count(*)::integer
    from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'unsubscribe_newsletter_subscriber_%'
      and parameter_mode = 'OUT'
  ),
  1,
  'unsubscribe returns only the outcome field without PII'
);

select * from finish();
rollback;
