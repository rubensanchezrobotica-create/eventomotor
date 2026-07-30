begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(25);

select results_eq(
  $$
    select outcome, subscriber_id is not null, token_purpose
    from public.request_newsletter_subscription(
      '  New.Reader@Example.INVALID  ',
      'new.reader@example.invalid',
      repeat('a', 64),
      now() + interval '1 day',
      'sql_test',
      '2026-07',
      '/newsletter-test'
    )
  $$,
  $$values ('confirmation_required'::text, true, 'subscribe'::text)$$,
  'a new email requires confirmation with a minimal return'
);

select is(
  (select count(*)::integer from public.newsletter_subscribers where email_normalized = 'new.reader@example.invalid'),
  1,
  'a new request creates exactly one subscriber'
);

select is(
  (
    select email_normalized || ':' || status
    from public.newsletter_subscribers
    where email_normalized = 'new.reader@example.invalid'
  ),
  'new.reader@example.invalid:pending',
  'the subscriber is normalized and pending'
);

select ok(
  exists(
    select 1
    from public.newsletter_confirmation_tokens t
    join public.newsletter_subscribers s on s.id = t.subscriber_id
    where s.email_normalized = 'new.reader@example.invalid'
      and t.token_hash = repeat('a', 64)
      and t.purpose = 'subscribe'
  ),
  'only the supplied token hash is persisted'
);

select ok(
  not exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name like 'newsletter_%'
      and column_name ~* 'raw.*token|token.*raw'
  ),
  'the database has no raw token column'
);

select ok(
  exists(
    select 1
    from public.newsletter_consent_events c
    join public.newsletter_subscribers s on s.id = c.subscriber_id
    where s.email_normalized = 'new.reader@example.invalid'
      and c.action = 'subscribe_requested'
  ),
  'the request consent event is recorded'
);

select ok(
  exists(
    select 1
    from public.newsletter_consent_events c
    join public.newsletter_subscribers s on s.id = c.subscriber_id
    where s.email_normalized = 'new.reader@example.invalid'
      and c.action = 'confirmation_issued'
  ),
  'confirmation issuance is recorded atomically'
);

select results_eq(
  $$
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      'new.reader@example.invalid', 'new.reader@example.invalid', repeat('b', 64),
      now() + interval '1 day', 'sql_test', '2026-07'
    )
  $$,
  $$values ('cooldown'::text, null::uuid, null::text)$$,
  'an immediate repeated request is rate limited without PII'
);

update public.newsletter_subscribers
set status = 'active', confirmed_at = now()
where email_normalized = 'new.reader@example.invalid';

select results_eq(
  $$
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      'new.reader@example.invalid', 'new.reader@example.invalid', repeat('c', 64),
      now() + interval '1 day', 'sql_test', '2026-07'
    )
  $$,
  $$values ('already_active'::text, null::uuid, null::text)$$,
  'an active subscriber is not enrolled twice and reveals no state details'
);

select is(
  (select count(*)::integer from public.newsletter_subscribers where email_normalized = 'new.reader@example.invalid'),
  1,
  'active requests never duplicate the subscriber'
);

update public.newsletter_subscribers
set status = 'unsubscribed',
    unsubscribed_at = now(),
    last_confirmation_requested_at = null,
    confirmation_request_window_started_at = null,
    confirmation_request_count = 0
where email_normalized = 'new.reader@example.invalid';

select results_eq(
  $$
    select outcome, subscriber_id is not null, token_purpose
    from public.request_newsletter_subscription(
      'new.reader@example.invalid', 'new.reader@example.invalid', repeat('d', 64),
      now() + interval '1 day', 'sql_test', '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, true, 'resubscribe'::text)$$,
  'an unsubscribed subscriber may begin an explicit resubscription'
);

update public.newsletter_subscribers
set status = 'bounced', bounced_at = now(), last_confirmation_requested_at = null
where email_normalized = 'new.reader@example.invalid';
select results_eq(
  $$select outcome, subscriber_id, token_purpose from public.request_newsletter_subscription('new.reader@example.invalid', 'new.reader@example.invalid', repeat('e', 64), now() + interval '1 day', 'sql_test', '2026-07')$$,
  $$values ('blocked'::text, null::uuid, null::text)$$,
  'a bounced subscriber is blocked'
);

update public.newsletter_subscribers
set status = 'complained', complained_at = now()
where email_normalized = 'new.reader@example.invalid';
select results_eq(
  $$select outcome, subscriber_id, token_purpose from public.request_newsletter_subscription('new.reader@example.invalid', 'new.reader@example.invalid', repeat('f', 64), now() + interval '1 day', 'sql_test', '2026-07')$$,
  $$values ('blocked'::text, null::uuid, null::text)$$,
  'a complained subscriber is blocked'
);

update public.newsletter_subscribers
set status = 'suppressed', suppressed_at = now()
where email_normalized = 'new.reader@example.invalid';
select results_eq(
  $$select outcome, subscriber_id, token_purpose from public.request_newsletter_subscription('new.reader@example.invalid', 'new.reader@example.invalid', repeat('0', 64), now() + interval '1 day', 'sql_test', '2026-07')$$,
  $$values ('blocked'::text, null::uuid, null::text)$$,
  'a suppressed subscriber is blocked'
);

select results_eq(
  $$
    select outcome, subscriber_id is not null, token_purpose
    from public.request_newsletter_subscription(
      'rotation.reader@example.invalid',
      'rotation.reader@example.invalid',
      repeat('1', 64),
      now() + interval '1 day',
      'sql_test',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, true, 'subscribe'::text)$$,
  'a clean rotation fixture creates its first token'
);

update public.newsletter_subscribers
set last_confirmation_requested_at = now() - interval '16 minutes'
where email_normalized = 'rotation.reader@example.invalid';

select results_eq(
  $$
    select outcome, subscriber_id is not null, token_purpose
    from public.request_newsletter_subscription(
      'rotation.reader@example.invalid',
      'rotation.reader@example.invalid',
      repeat('2', 64),
      now() + interval '1 day',
      'sql_test',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, true, 'subscribe'::text)$$,
  'the clean rotation fixture passes cooldown and creates a replacement'
);

select ok(
  (
    select invalidated_at is not null
    from public.newsletter_confirmation_tokens
    where token_hash = repeat('1', 64)
  ),
  'a newer equivalent token invalidates the previous token'
);

select ok(
  (
    select used_at is null
      and invalidated_at is null
      and expires_at > now()
    from public.newsletter_confirmation_tokens
    where token_hash = repeat('2', 64)
  ),
  'the replacement token remains active'
);
select results_eq(
  $$
    select ns.status,
           ns.bounced_at is null,
           ns.complained_at is null,
           ns.suppressed_at is null,
           count(nsp.id)::integer
    from public.newsletter_subscribers as ns
    left join public.newsletter_suppressions as nsp
      on nsp.subscriber_id = ns.id
      and nsp.lifted_at is null
    where ns.email_normalized = 'rotation.reader@example.invalid'
    group by ns.id
  $$,
  $$values ('pending'::text, true, true, true, 0)$$,
  'the rotation fixture has no hard state or active suppression'
);

select results_eq(
  $$
    select outcome, subscriber_id is not null, token_purpose
    from public.request_newsletter_subscription(
      'limit.reader@example.invalid',
      'limit.reader@example.invalid',
      repeat('3', 64),
      now() + interval '1 day',
      'sql_test',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, true, 'subscribe'::text)$$,
  'a clean daily-limit fixture accepts request one'
);

update public.newsletter_subscribers
set last_confirmation_requested_at = now() - interval '16 minutes'
where email_normalized = 'limit.reader@example.invalid';
select results_eq(
  $$
    select outcome, subscriber_id is not null, token_purpose
    from public.request_newsletter_subscription(
      'limit.reader@example.invalid',
      'limit.reader@example.invalid',
      repeat('4', 64),
      now() + interval '1 day',
      'sql_test',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, true, 'subscribe'::text)$$,
  'a clean daily-limit fixture accepts request two'
);

update public.newsletter_subscribers
set last_confirmation_requested_at = now() - interval '16 minutes'
where email_normalized = 'limit.reader@example.invalid';
select results_eq(
  $$
    select outcome, subscriber_id is not null, token_purpose
    from public.request_newsletter_subscription(
      'limit.reader@example.invalid',
      'limit.reader@example.invalid',
      repeat('5', 64),
      now() + interval '1 day',
      'sql_test',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, true, 'subscribe'::text)$$,
  'a clean daily-limit fixture accepts request three'
);

update public.newsletter_subscribers
set last_confirmation_requested_at = now() - interval '16 minutes'
where email_normalized = 'limit.reader@example.invalid';

select results_eq(
  $$select outcome, subscriber_id, token_purpose from public.request_newsletter_subscription('limit.reader@example.invalid', 'limit.reader@example.invalid', repeat('6', 64), now() + interval '1 day', 'sql_test', '2026-07')$$,
  $$values ('daily_limit'::text, null::uuid, null::text)$$,
  'the daily request window is enforced'
);

select results_eq(
  $$
    select ns.status,
           ns.confirmation_request_count,
           ns.bounced_at is null,
           ns.complained_at is null,
           ns.suppressed_at is null,
           count(nsp.id)::integer
    from public.newsletter_subscribers as ns
    left join public.newsletter_suppressions as nsp
      on nsp.subscriber_id = ns.id
      and nsp.lifted_at is null
    where ns.email_normalized = 'limit.reader@example.invalid'
    group by ns.id
  $$,
  $$values ('pending'::text, 3, true, true, true, 0)$$,
  'the daily limit is independent of hard evidence and prior fixtures'
);

select is(
  (
    select count(*)::integer
    from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'request_newsletter_subscription_%'
      and parameter_mode = 'OUT'
  ),
  3,
  'the request RPC returns exactly three minimal fields'
);

select * from finish();
rollback;
