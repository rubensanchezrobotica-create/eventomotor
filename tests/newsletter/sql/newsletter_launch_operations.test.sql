begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_catalog;

select plan(50);

select has_table('public', 'newsletter_suppressions', 'suppression table exists');
select has_table('public', 'newsletter_webhook_receipts', 'webhook receipt table exists');
select ok(
  to_regprocedure('public.purge_stale_newsletter_pending(integer,timestamp with time zone)') is not null,
  'bounded pending purge exists'
);
select ok(
  to_regprocedure('public.check_newsletter_delivery_eligibility(uuid,text)') is not null,
  'delivery eligibility guard exists'
);
select ok(
  to_regprocedure('public.register_newsletter_outbound_delivery(uuid,text,text,timestamp with time zone)') is not null,
  'outbound provider message registration exists'
);
select ok(
  to_regprocedure('public.process_newsletter_resend_webhook(text,text,text,timestamp with time zone,text,boolean)') is not null,
  'transactional Resend webhook RPC exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.newsletter_suppressions'::regclass),
  'suppression table has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.newsletter_webhook_receipts'::regclass),
  'webhook receipt table has RLS'
);
select is(
  (select count(*)::integer from cron.job where jobname = 'newsletter-pending-retention-daily'),
  1,
  'the daily retention job has one stable name'
);
select is(
  (
    select schedule
    from cron.job
    where jobname = 'newsletter-pending-retention-daily'
  ),
  '17 3 * * *',
  'the retention job runs once per day'
);

select results_eq(
  $$
    select outcome, token_purpose
    from public.request_newsletter_subscription(
      'no-province-r5a2@example.invalid',
      'no-province-r5a2@example.invalid',
      repeat('1', 64),
      now() + interval '1 day',
      'r5a2_sql',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, 'subscribe'::text)$$,
  'a request without province is accepted'
);
select is(
  (
    select province_slug
    from public.newsletter_subscribers
    where email_normalized = 'no-province-r5a2@example.invalid'
  ),
  null,
  'a request without province persists province_slug NULL'
);
select is(
  (
    select region_slug
    from public.newsletter_subscribers
    where email_normalized = 'no-province-r5a2@example.invalid'
  ),
  null,
  'a request without province persists region_slug NULL'
);

select results_eq(
  $$
    select outcome
    from public.request_newsletter_subscription(
      'barcelona-r5a2@example.invalid',
      'barcelona-r5a2@example.invalid',
      repeat('2', 64),
      now() + interval '1 day',
      'r5a2_sql',
      '2026-07',
      '/newsletter',
      null,
      'es',
      'ES',
      'barcelona',
      'cataluna',
      null
    )
  $$,
  $$values ('confirmation_required'::text)$$,
  'a server-derived province and region request is accepted'
);
select is(
  (
    select province_slug
    from public.newsletter_subscribers
    where email_normalized = 'barcelona-r5a2@example.invalid'
  ),
  'barcelona',
  'the server-derived province is persisted'
);
select is(
  (
    select region_slug
    from public.newsletter_subscribers
    where email_normalized = 'barcelona-r5a2@example.invalid'
  ),
  'cataluna',
  'the server-derived region is persisted'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version,
  created_at, last_confirmation_requested_at, confirmed_at
) values
  (
    '51000000-0000-4000-8000-000000000001',
    'old-pending-r5a2@example.invalid',
    'old-pending-r5a2@example.invalid',
    'pending',
    'r5a2_sql',
    '2026-07',
    now() - interval '9 days',
    now() - interval '8 days',
    null
  ),
  (
    '51000000-0000-4000-8000-000000000002',
    'recent-pending-r5a2@example.invalid',
    'recent-pending-r5a2@example.invalid',
    'pending',
    'r5a2_sql',
    '2026-07',
    now() - interval '9 days',
    now() - interval '6 days',
    null
  ),
  (
    '51000000-0000-4000-8000-000000000003',
    'active-retention-r5a2@example.invalid',
    'active-retention-r5a2@example.invalid',
    'active',
    'r5a2_sql',
    '2026-07',
    now() - interval '20 days',
    now() - interval '10 days',
    now() - interval '10 days'
  );

insert into public.newsletter_consent_events (
  subscriber_id, action, consent_version, source, occurred_at
) values
  (
    '51000000-0000-4000-8000-000000000001',
    'subscribe_requested',
    '2026-07',
    'r5a2_sql',
    now() - interval '8 days'
  ),
  (
    '51000000-0000-4000-8000-000000000002',
    'subscribe_requested',
    '2026-07',
    'r5a2_sql',
    now() - interval '6 days'
  );

select is(
  (
    select purged_count
    from public.purge_stale_newsletter_pending(
      20,
      now() - interval '7 days'
    )
  ),
  1,
  'one pending request older than seven days is purged'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_subscribers
    where id = '51000000-0000-4000-8000-000000000001'
  ),
  0,
  'the stale pending subscriber and personal data are deleted'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_subscribers
    where id = '51000000-0000-4000-8000-000000000002'
  ),
  1,
  'a pending request newer than seven days remains'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_subscribers
    where id = '51000000-0000-4000-8000-000000000003'
  ),
  1,
  'an active subscriber is never purged'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '52000000-0000-4000-8000-000000000001',
  'lifecycle-r5a2@example.invalid',
  'lifecycle-r5a2@example.invalid',
  'active',
  'r5a2_sql',
  '2026-07',
  now() - interval '1 day'
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('52000000-0000-4000-8000-000000000001', true);
insert into public.newsletter_confirmation_tokens (
  subscriber_id, token_hash, purpose, expires_at
) values (
  '52000000-0000-4000-8000-000000000001',
  repeat('3', 64),
  'subscribe',
  now() + interval '1 day'
);

select results_eq(
  $$
    select outcome
    from public.unsubscribe_newsletter_subscriber(
      '52000000-0000-4000-8000-000000000001',
      '2026-07',
      'r5a2_sql'
    )
  $$,
  $$values ('unsubscribed'::text)$$,
  'the first voluntary unsubscribe succeeds'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_preferences
    where subscriber_id = '52000000-0000-4000-8000-000000000001'
  ),
  0,
  'voluntary unsubscribe deletes territorial delivery preferences'
);
select ok(
  (
    select bool_and(source_path is null and ip_hash is null)
    from public.newsletter_consent_events
    where subscriber_id = '52000000-0000-4000-8000-000000000001'
  ),
  'minimization removes path and IP metadata from retained consent evidence'
);
select is(
  (
    select reason
    from public.newsletter_suppressions
    where subscriber_id = '52000000-0000-4000-8000-000000000001'
      and lifted_at is null
  ),
  'voluntary',
  'voluntary unsubscribe creates a minimized active suppression'
);
select matches(
  (
    select email_normalized
    from public.newsletter_subscribers
    where id = '52000000-0000-4000-8000-000000000001'
  ),
  '^suppressed\+[0-9a-f]+',
  'voluntary unsubscribe removes the clear recipient address'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_confirmation_tokens
    where subscriber_id = '52000000-0000-4000-8000-000000000001'
  ),
  0,
  'voluntary unsubscribe deletes unnecessary confirmation tokens'
);
select results_eq(
  $$
    select outcome
    from public.unsubscribe_newsletter_subscriber(
      '52000000-0000-4000-8000-000000000001',
      '2026-07',
      'r5a2_sql'
    )
  $$,
  $$values ('already_unsubscribed'::text)$$,
  'a repeated voluntary unsubscribe is idempotent'
);

select results_eq(
  $$
    select outcome, token_purpose
    from public.request_newsletter_subscription(
      'lifecycle-r5a2@example.invalid',
      'lifecycle-r5a2@example.invalid',
      repeat('4', 64),
      now() + interval '1 day',
      'r5a2_sql',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, 'resubscribe'::text)$$,
  'a voluntary suppression can only start a new double opt-in'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '52000000-0000-4000-8000-000000000001'
  ),
  'unsubscribed',
  'a resubscription request does not activate the subscriber'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '52000000-0000-4000-8000-000000000001'
      and reason = 'voluntary'
      and lifted_at is null
  ),
  1,
  'voluntary suppression remains active before confirmation'
);
select results_eq(
  $$
    select outcome
    from public.check_newsletter_delivery_eligibility(
      '52000000-0000-4000-8000-000000000001',
      'confirmation'
    )
  $$,
  $$values ('allowed'::text)$$,
  'the resubscribe confirmation is the only delivery allowed while voluntarily suppressed'
);
select results_eq(
  $$
    select outcome
    from public.confirm_newsletter_subscription(repeat('4', 64))
  $$,
  $$values ('confirmed'::text)$$,
  'the new resubscribe token confirms successfully'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '52000000-0000-4000-8000-000000000001'
  ),
  'active',
  'only confirmation reactivates a voluntary unsubscribe'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '52000000-0000-4000-8000-000000000001'
      and lifted_at is not null
  ),
  1,
  'confirmation lifts but preserves voluntary suppression evidence'
);
select is(
  (
    select weekly_digest_enabled
    from public.newsletter_preferences
    where subscriber_id = '52000000-0000-4000-8000-000000000001'
  ),
  true,
  'confirmation recreates the weekly preference'
);

select results_eq(
  $$
    select outcome
    from public.register_newsletter_outbound_delivery(
      '52000000-0000-4000-8000-000000000001',
      'resend-message-r5a2',
      'welcome',
      now()
    )
  $$,
  $$values ('recorded'::text)$$,
  'an accepted outbound message is mapped to its subscriber'
);
select results_eq(
  $$
    select outcome
    from public.process_newsletter_resend_webhook(
      'svix-r5a2-complaint',
      'email.complained',
      'resend-message-r5a2',
      now(),
      'lifecycle-r5a2@example.invalid',
      false
    )
  $$,
  $$values ('processed'::text)$$,
  'a complaint webhook is processed transactionally'
);
select results_eq(
  $$
    select status, email_normalized like concat(
      'suppressed+%',
      chr(64),
      'invalid.eventomotor.local'
    )
    from public.newsletter_subscribers
    where id = '52000000-0000-4000-8000-000000000001'
  $$,
  $$values ('complained'::text, true)$$,
  'a complaint suppresses and removes the clear address'
);
select results_eq(
  $$
    select outcome
    from public.process_newsletter_resend_webhook(
      'svix-r5a2-complaint',
      'email.complained',
      'resend-message-r5a2',
      now(),
      'lifecycle-r5a2@example.invalid',
      false
    )
  $$,
  $$values ('duplicate'::text)$$,
  'the same svix-id is acknowledged without reprocessing'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_webhook_receipts
    where svix_id = 'svix-r5a2-complaint'
  ),
  1,
  'a duplicate webhook leaves one receipt'
);
select results_eq(
  $$
    select outcome
    from public.request_newsletter_subscription(
      'lifecycle-r5a2@example.invalid',
      'lifecycle-r5a2@example.invalid',
      repeat('5', 64),
      now() + interval '1 day',
      'r5a2_sql',
      '2026-07'
    )
  $$,
  $$values ('blocked'::text)$$,
  'a complaint cannot be reactivated by a public request'
);
select results_eq(
  $$
    select outcome
    from public.process_newsletter_resend_webhook(
      'svix-r5a2-delayed',
      'email.delivery_delayed',
      'resend-message-r5a2',
      now() - interval '1 hour',
      'lifecycle-r5a2@example.invalid',
      false
    )
  $$,
  $$values ('processed'::text)$$,
  'an out-of-order delivery delay is recorded'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '52000000-0000-4000-8000-000000000001'
  ),
  'complained',
  'an out-of-order non-suppressing event cannot reactivate a complaint'
);
select results_eq(
  $$
    select outcome
    from public.process_newsletter_resend_webhook(
      'svix-r5a2-opened',
      'email.opened',
      null,
      now(),
      null,
      false
    )
  $$,
  $$values ('ignored'::text)$$,
  'an opened event is ignored'
);
select results_eq(
  $$
    select subscriber_id, provider_message_id
    from public.newsletter_webhook_receipts
    where svix_id = 'svix-r5a2-opened'
  $$,
  $$values (null::uuid, null::text)$$,
  'ignored individual tracking stores no subscriber or provider message'
);
select results_eq(
  $$
    select outcome
    from public.check_newsletter_delivery_eligibility(
      '52000000-0000-4000-8000-000000000001',
      'welcome'
    )
  $$,
  $$values ('blocked'::text)$$,
  'a complained subscriber is blocked before transport'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '53000000-0000-4000-8000-000000000001',
  'bounce-r5a2@example.invalid',
  'bounce-r5a2@example.invalid',
  'active',
  'r5a2_sql',
  '2026-07',
  now() - interval '1 day'
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('53000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$
    select outcome
    from public.record_newsletter_provider_event(
      'resend',
      'bounce-r5a2-event',
      'bounce-r5a2-message',
      '53000000-0000-4000-8000-000000000001',
      'bounced',
      true,
      now()
    )
  $$,
  $$values ('recorded'::text)$$,
  'a permanent bounce is recorded'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '53000000-0000-4000-8000-000000000001'
  ),
  'bounced',
  'a permanent bounce creates a non-voluntary suppression'
);
select results_eq(
  $$
    select outcome
    from public.request_newsletter_subscription(
      'bounce-r5a2@example.invalid',
      'bounce-r5a2@example.invalid',
      repeat('6', 64),
      now() + interval '1 day',
      'r5a2_sql',
      '2026-07'
    )
  $$,
  $$values ('blocked'::text)$$,
  'a permanent bounce cannot be reactivated by a new request'
);
select results_eq(
  $$
    select outcome
    from public.check_newsletter_delivery_eligibility(
      '53000000-0000-4000-8000-000000000001',
      'welcome'
    )
  $$,
  $$values ('blocked'::text)$$,
  'a permanently bounced subscriber is blocked before transport'
);

select * from finish();
rollback;
