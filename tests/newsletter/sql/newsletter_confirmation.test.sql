begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(16);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version
) values (
  '10000000-0000-4000-8000-000000000001',
  'confirm-subscribe@example.invalid',
  'confirm-subscribe@example.invalid',
  'pending', 'sql_test', '2026-07'
);
insert into public.newsletter_confirmation_tokens (
  subscriber_id, token_hash, purpose, expires_at
) values (
  '10000000-0000-4000-8000-000000000001', repeat('a', 64), 'subscribe', now() + interval '1 day'
);

select results_eq(
  $$select outcome, subscriber_id from public.confirm_newsletter_subscription(repeat('a', 64))$$,
  $$values ('confirmed'::text, '10000000-0000-4000-8000-000000000001'::uuid)$$,
  'a valid subscribe token confirms its subscriber'
);
select is(
  (select status from public.newsletter_subscribers where id = '10000000-0000-4000-8000-000000000001'),
  'active',
  'subscribe confirmation activates the subscriber'
);
select ok(
  (select used_at is not null from public.newsletter_confirmation_tokens where token_hash = repeat('a', 64)),
  'successful confirmation consumes the token'
);
select ok(
  (select weekly_digest_enabled from public.newsletter_preferences where subscriber_id = '10000000-0000-4000-8000-000000000001'),
  'successful confirmation enables the weekly digest'
);
select ok(
  exists(
    select 1 from public.newsletter_consent_events
    where subscriber_id = '10000000-0000-4000-8000-000000000001' and action = 'confirmed'
  ),
  'successful confirmation records consent'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, unsubscribed_at
) values (
  '10000000-0000-4000-8000-000000000002',
  'confirm-resubscribe@example.invalid',
  'confirm-resubscribe@example.invalid',
  'unsubscribed', 'sql_test', '2026-07', now()
);
insert into public.newsletter_confirmation_tokens (
  subscriber_id, token_hash, purpose, expires_at
) values (
  '10000000-0000-4000-8000-000000000002', repeat('b', 64), 'resubscribe', now() + interval '1 day'
);
insert into public.newsletter_suppressions (
  subscriber_id, email_hash, reason, suppressed_at
) values (
  '10000000-0000-4000-8000-000000000002',
  public.newsletter_email_hash('confirm-resubscribe@example.invalid'),
  'voluntary',
  now()
);
select results_eq(
  $$select outcome, subscriber_id from public.confirm_newsletter_subscription(repeat('b', 64))$$,
  $$values ('confirmed'::text, '10000000-0000-4000-8000-000000000002'::uuid)$$,
  'a valid resubscribe token confirms an unsubscribed subscriber'
);
select is(
  (select status from public.newsletter_subscribers where id = '10000000-0000-4000-8000-000000000002'),
  'active',
  'resubscription activates the subscriber'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version
) values
  ('10000000-0000-4000-8000-000000000003', 'expired@example.invalid', 'expired@example.invalid', 'pending', 'sql_test', '2026-07'),
  ('10000000-0000-4000-8000-000000000004', 'used@example.invalid', 'used@example.invalid', 'pending', 'sql_test', '2026-07'),
  ('10000000-0000-4000-8000-000000000005', 'invalidated@example.invalid', 'invalidated@example.invalid', 'pending', 'sql_test', '2026-07'),
  ('10000000-0000-4000-8000-000000000006', 'wrong-purpose@example.invalid', 'wrong-purpose@example.invalid', 'pending', 'sql_test', '2026-07');

insert into public.newsletter_confirmation_tokens (
  subscriber_id, token_hash, purpose, created_at, expires_at, used_at, invalidated_at
) values
  ('10000000-0000-4000-8000-000000000003', repeat('c', 64), 'subscribe', now() - interval '2 days', now() - interval '1 day', null, null),
  ('10000000-0000-4000-8000-000000000004', repeat('d', 64), 'subscribe', now() - interval '1 hour', now() + interval '1 day', now(), null),
  ('10000000-0000-4000-8000-000000000005', repeat('e', 64), 'subscribe', now() - interval '1 hour', now() + interval '1 day', null, now()),
  ('10000000-0000-4000-8000-000000000006', repeat('f', 64), 'resubscribe', now() - interval '1 hour', now() + interval '1 day', null, null);

select results_eq(
  $$select outcome, subscriber_id from public.confirm_newsletter_subscription(repeat('c', 64))$$,
  $$values ('expired_token'::text, null::uuid)$$,
  'an expired token is rejected'
);
select results_eq(
  $$select outcome, subscriber_id from public.confirm_newsletter_subscription(repeat('d', 64))$$,
  $$values ('used_token'::text, null::uuid)$$,
  'an already used token is rejected'
);
select results_eq(
  $$select outcome, subscriber_id from public.confirm_newsletter_subscription(repeat('e', 64))$$,
  $$values ('invalid_token'::text, null::uuid)$$,
  'an invalidated token is rejected'
);
select results_eq(
  $$select outcome, subscriber_id from public.confirm_newsletter_subscription(repeat('f', 64))$$,
  $$values ('invalid_token'::text, null::uuid)$$,
  'a token with the wrong purpose is rejected'
);
select results_eq(
  $$select outcome, subscriber_id from public.confirm_newsletter_subscription(repeat('0', 64))$$,
  $$values ('invalid_token'::text, null::uuid)$$,
  'an unknown token is rejected'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, bounced_at, complained_at, suppressed_at
) values
  ('10000000-0000-4000-8000-000000000007', 'blocked-bounce@example.invalid', 'blocked-bounce@example.invalid', 'bounced', 'sql_test', '2026-07', now(), null, null),
  ('10000000-0000-4000-8000-000000000008', 'blocked-complaint@example.invalid', 'blocked-complaint@example.invalid', 'complained', 'sql_test', '2026-07', null, now(), null),
  ('10000000-0000-4000-8000-000000000009', 'blocked-suppressed@example.invalid', 'blocked-suppressed@example.invalid', 'suppressed', 'sql_test', '2026-07', null, null, now());
insert into public.newsletter_confirmation_tokens (subscriber_id, token_hash, purpose, expires_at) values
  ('10000000-0000-4000-8000-000000000007', repeat('1', 64), 'resubscribe', now() + interval '1 day'),
  ('10000000-0000-4000-8000-000000000008', repeat('2', 64), 'resubscribe', now() + interval '1 day'),
  ('10000000-0000-4000-8000-000000000009', repeat('3', 64), 'resubscribe', now() + interval '1 day');

-- A public request cannot issue tokens for hard-suppressed subscribers. These
-- explicit, formally valid token fixtures isolate the confirmation barrier and
-- prove that even a stale/racing token cannot lift hard suppression evidence.
insert into public.newsletter_suppressions (
  subscriber_id, email_hash, reason, suppressed_at
) values
  (
    '10000000-0000-4000-8000-000000000007',
    public.newsletter_email_hash('blocked-bounce@example.invalid'),
    'permanent_bounce',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    public.newsletter_email_hash('blocked-complaint@example.invalid'),
    'complaint',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000009',
    public.newsletter_email_hash('blocked-suppressed@example.invalid'),
    'provider_suppression',
    now()
  );

select results_eq(
  $$
    with result as (
      select outcome, subscriber_id
      from public.confirm_newsletter_subscription(repeat('1', 64))
    )
    select result.outcome, result.subscriber_id, subscriber.status,
      suppression.lifted_at is null
    from result
    join public.newsletter_subscribers as subscriber
      on subscriber.id = '10000000-0000-4000-8000-000000000007'
    join public.newsletter_suppressions as suppression
      on suppression.subscriber_id = subscriber.id
  $$,
  $$values ('blocked'::text, null::uuid, 'bounced'::text, true)$$,
  'a bounced subscriber cannot be reactivated'
);
select results_eq(
  $$
    with result as (
      select outcome, subscriber_id
      from public.confirm_newsletter_subscription(repeat('2', 64))
    )
    select result.outcome, result.subscriber_id, subscriber.status,
      suppression.lifted_at is null
    from result
    join public.newsletter_subscribers as subscriber
      on subscriber.id = '10000000-0000-4000-8000-000000000008'
    join public.newsletter_suppressions as suppression
      on suppression.subscriber_id = subscriber.id
  $$,
  $$values ('blocked'::text, null::uuid, 'complained'::text, true)$$,
  'a complained subscriber cannot be reactivated'
);
select results_eq(
  $$
    with result as (
      select outcome, subscriber_id
      from public.confirm_newsletter_subscription(repeat('3', 64))
    )
    select result.outcome, result.subscriber_id, subscriber.status,
      suppression.lifted_at is null
    from result
    join public.newsletter_subscribers as subscriber
      on subscriber.id = '10000000-0000-4000-8000-000000000009'
    join public.newsletter_suppressions as suppression
      on suppression.subscriber_id = subscriber.id
  $$,
  $$values ('blocked'::text, null::uuid, 'suppressed'::text, true)$$,
  'a suppressed subscriber cannot be reactivated'
);

select ok(
  not exists(
    select 1
    from public.newsletter_confirmation_tokens t
    join public.newsletter_subscribers s on s.id = t.subscriber_id
    where t.token_hash in (repeat('a', 64), repeat('b', 64))
      and (t.used_at is null or s.status <> 'active' or not exists (
        select 1 from public.newsletter_consent_events c
        where c.subscriber_id = s.id and c.action = 'confirmed'
      ) or (
        t.token_hash = repeat('b', 64)
        and not exists (
          select 1
          from public.newsletter_suppressions as suppression
          where suppression.subscriber_id = s.id
            and suppression.reason = 'voluntary'
            and suppression.lifted_at is not null
        )
      ))
  ),
  'successful activation, token consumption and confirmed consent are atomic'
);

select * from finish();
rollback;
