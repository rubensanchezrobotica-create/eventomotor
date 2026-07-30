begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(21);

create function pg_temp.fail_newsletter_consent_for_test()
returns trigger
language plpgsql
as $$
begin
  if new.action = current_setting('newsletter_test.fail_action', true) then
    raise exception 'forced newsletter consent failure';
  end if;
  return new;
end;
$$;

create trigger force_newsletter_consent_failure
before insert on public.newsletter_consent_events
for each row execute function pg_temp.fail_newsletter_consent_for_test();

select set_config('newsletter_test.fail_action', 'confirmation_issued', true);
select throws_ok(
  $$
    select * from public.request_newsletter_subscription(
      'rollback-request@example.invalid', 'rollback-request@example.invalid', repeat('a', 64),
      now() + interval '1 day', 'sql_test', '2026-07'
    )
  $$,
  'P0001',
  'forced newsletter consent failure',
  'a forced late request failure aborts the RPC'
);
select is(
  (select count(*)::integer from public.newsletter_subscribers where email_normalized = 'rollback-request@example.invalid'),
  0,
  'a failed request leaves no subscriber'
);
select is(
  (select count(*)::integer from public.newsletter_confirmation_tokens where token_hash = repeat('a', 64)),
  0,
  'a failed request leaves no token hash'
);
select is(
  (
    select count(*)::integer from public.newsletter_consent_events c
    join public.newsletter_subscribers s on s.id = c.subscriber_id
    where s.email_normalized = 'rollback-request@example.invalid'
  ),
  0,
  'a failed request leaves no partial consent event'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, unsubscribed_at
) values (
  '40000000-0000-4000-8000-000000000001',
  'rollback-confirm@example.invalid',
  'rollback-confirm@example.invalid',
  'unsubscribed', 'sql_test', '2026-07', now()
);
insert into public.newsletter_confirmation_tokens (subscriber_id, token_hash, purpose, expires_at)
values ('40000000-0000-4000-8000-000000000001', repeat('b', 64), 'resubscribe', now() + interval '1 day');
insert into public.newsletter_suppressions (
  subscriber_id, email_hash, reason, suppressed_at
) values (
  '40000000-0000-4000-8000-000000000001',
  public.newsletter_email_hash('rollback-confirm@example.invalid'),
  'voluntary',
  now()
);

select set_config('newsletter_test.fail_action', 'confirmed', true);
select throws_ok(
  $$select * from public.confirm_newsletter_subscription(repeat('b', 64))$$,
  'P0001',
  'forced newsletter consent failure',
  'a forced late confirmation failure aborts the RPC'
);
select is(
  (select status from public.newsletter_subscribers where id = '40000000-0000-4000-8000-000000000001'),
  'unsubscribed',
  'failed resubscription does not activate the subscriber'
);
select ok(
  (select used_at is null from public.newsletter_confirmation_tokens where token_hash = repeat('b', 64)),
  'failed confirmation does not consume the token'
);
select ok(
  (
    select lifted_at is null
    from public.newsletter_suppressions
    where subscriber_id = '40000000-0000-4000-8000-000000000001'
  ),
  'failed resubscription does not lift voluntary suppression'
);
select is(
  (
    select count(*)::integer from public.newsletter_consent_events
    where subscriber_id = '40000000-0000-4000-8000-000000000001' and action = 'confirmed'
  ),
  0,
  'failed confirmation leaves no isolated consent event'
);

select throws_ok(
  $$select * from public.record_newsletter_provider_event('rollback-provider', 'rollback-event', null, '40000000-0000-4000-8000-000000000099', 'delivered', false, now())$$,
  '23503',
  null,
  'a missing aggregate target aborts provider event processing'
);
select is(
  (select count(*)::integer from public.newsletter_email_events where provider = 'rollback-provider' and provider_event_id = 'rollback-event'),
  0,
  'failed provider processing leaves no event marked as processed'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '40000000-0000-4000-8000-000000000002',
  'rollback-unsubscribe@example.invalid',
  'rollback-unsubscribe@example.invalid',
  'active', 'sql_test', '2026-07', now()
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('40000000-0000-4000-8000-000000000002', true);
insert into public.newsletter_confirmation_tokens (subscriber_id, token_hash, purpose, expires_at)
values ('40000000-0000-4000-8000-000000000002', repeat('c', 64), 'subscribe', now() + interval '1 day');

select set_config('newsletter_test.fail_action', 'unsubscribed', true);
select throws_ok(
  $$select * from public.unsubscribe_newsletter_subscriber('40000000-0000-4000-8000-000000000002', '2026-07', 'sql_test')$$,
  'P0001',
  'forced newsletter consent failure',
  'a forced late unsubscribe failure aborts the RPC'
);
select is(
  (select status from public.newsletter_subscribers where id = '40000000-0000-4000-8000-000000000002'),
  'active',
  'failed unsubscribe preserves subscriber state'
);
select is(
  (select weekly_digest_enabled from public.newsletter_preferences where subscriber_id = '40000000-0000-4000-8000-000000000002'),
  true,
  'failed unsubscribe preserves the weekly preference'
);
select ok(
  (select invalidated_at is null from public.newsletter_confirmation_tokens where token_hash = repeat('c', 64)),
  'failed unsubscribe does not invalidate tokens'
);
select is(
  (
    select count(*)::integer from public.newsletter_consent_events
    where subscriber_id = '40000000-0000-4000-8000-000000000002' and action = 'unsubscribed'
  ),
  0,
  'failed unsubscribe leaves no partial consent event'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '40000000-0000-4000-8000-000000000003',
  'rollback-webhook@example.invalid',
  'rollback-webhook@example.invalid',
  'active', 'sql_test', '2026-07', now()
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('40000000-0000-4000-8000-000000000003', true);
select *
from public.register_newsletter_outbound_delivery(
  '40000000-0000-4000-8000-000000000003',
  'rollback-message',
  'welcome',
  now()
);

select set_config('newsletter_test.fail_action', 'complained', true);
select throws_ok(
  $$
    select *
    from public.process_newsletter_resend_webhook(
      'rollback-svix',
      'email.complained',
      'rollback-message',
      now(),
      'rollback-webhook@example.invalid',
      false
    )
  $$,
  'P0001',
  'forced newsletter consent failure',
  'a forced webhook suppression failure aborts the whole operation'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_webhook_receipts
    where svix_id = 'rollback-svix'
  ),
  0,
  'failed webhook processing leaves no replay receipt'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_email_events
    where provider = 'resend'
      and provider_event_id = 'rollback-svix'
  ),
  0,
  'failed webhook processing leaves no provider event'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '40000000-0000-4000-8000-000000000003'
  ),
  0,
  'failed webhook processing leaves no partial suppression'
);
select results_eq(
  $$
    select subscriber.status, preference.weekly_digest_enabled
    from public.newsletter_subscribers as subscriber
    join public.newsletter_preferences as preference
      on preference.subscriber_id = subscriber.id
    where subscriber.id = '40000000-0000-4000-8000-000000000003'
  $$,
  $$values ('active'::text, true)$$,
  'failed webhook processing preserves the active sendable aggregate'
);

select * from finish();
rollback;
