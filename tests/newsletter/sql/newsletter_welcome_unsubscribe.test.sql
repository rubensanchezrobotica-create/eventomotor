begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(26);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, language_code, province_slug, region_slug,
  source, consent_version, confirmed_at
) values (
  '50000000-0000-4000-8000-000000000001',
  'welcome-flow@example.invalid',
  'welcome-flow@example.invalid',
  'active',
  'es',
  'barcelona',
  'cataluna',
  'sql_test',
  '2026-07',
  now()
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('50000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$
    select subscriber_id, recipient_email, preferred_province, preferred_region, locale
    from public.prepare_newsletter_welcome_delivery(
      '50000000-0000-4000-8000-000000000001',
      repeat('a', 64)
    )
  $$,
  $$
    values (
      '50000000-0000-4000-8000-000000000001'::uuid,
      'welcome-flow@example.invalid'::text,
      'barcelona'::text,
      'cataluna'::text,
      'es'::text
    )
  $$,
  'welcome preparation returns only the minimal delivery context'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_unsubscribe_tokens
    where subscriber_id = '50000000-0000-4000-8000-000000000001'
      and token_hash = repeat('a', 64)
  ),
  1,
  'welcome preparation persists the unsubscribe token hash'
);
select ok(
  (
    select expires_at is null
    from public.newsletter_unsubscribe_tokens
    where token_hash = repeat('a', 64)
  ),
  'unsubscribe tokens do not expire ordinarily'
);
select ok(
  (
    select bool_and(token_hash ~ '^[0-9a-f]{64}$')
    from public.newsletter_unsubscribe_tokens
  ),
  'only SHA-256 token hashes are persisted'
);

select results_eq(
  $$
    select subscriber_id, preferred_province
    from public.prepare_newsletter_welcome_delivery(
      '50000000-0000-4000-8000-000000000001',
      repeat('b', 64)
    )
  $$,
  $$
    values (
      '50000000-0000-4000-8000-000000000001'::uuid,
      'barcelona'::text
    )
  $$,
  'a later welcome preparation rotates the action token'
);
select ok(
  (
    select invalidated_at is not null
    from public.newsletter_unsubscribe_tokens
    where token_hash = repeat('a', 64)
  ),
  'rotation invalidates the previous token'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_unsubscribe_tokens
    where subscriber_id = '50000000-0000-4000-8000-000000000001'
      and invalidated_at is null
  ),
  1,
  'rotation leaves exactly one non-invalidated token'
);
select ok(
  (
    select invalidated_at is null
    from public.newsletter_unsubscribe_tokens
    where token_hash = repeat('b', 64)
  ),
  'the newly rotated token is active'
);
select ok(
  not exists (
    select 1
    from public.newsletter_unsubscribe_tokens
    where invalidated_at is not null
      and invalidated_at < created_at
  ),
  'every invalidated token is invalidated at or after creation'
);
select ok(
  not exists (
    select 1
    from public.newsletter_unsubscribe_tokens
    where updated_at < created_at
  ),
  'every unsubscribe token is updated at or after creation'
);

select throws_ok(
  $$
    select * from public.prepare_newsletter_welcome_delivery(
      '50000000-0000-4000-8000-000000000099',
      repeat('9', 64)
    )
  $$,
  'P0001',
  'newsletter welcome delivery unavailable',
  'welcome preparation rejects a missing subscriber'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version
) values (
  '50000000-0000-4000-8000-000000000002',
  'welcome-pending@example.invalid',
  'welcome-pending@example.invalid',
  'pending',
  'sql_test',
  '2026-07'
);
select throws_ok(
  $$
    select * from public.prepare_newsletter_welcome_delivery(
      '50000000-0000-4000-8000-000000000002',
      repeat('8', 64)
    )
  $$,
  'P0001',
  'newsletter welcome delivery unavailable',
  'welcome preparation rejects a subscriber that is not active'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_unsubscribe_tokens
    where subscriber_id = '50000000-0000-4000-8000-000000000002'
  ),
  0,
  'an ineligible subscriber receives no unsubscribe token'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '50000000-0000-4000-8000-000000000003',
  'welcome-collision@example.invalid',
  'welcome-collision@example.invalid',
  'active',
  'sql_test',
  '2026-07',
  now()
);
insert into public.newsletter_unsubscribe_tokens (subscriber_id, token_hash)
values ('50000000-0000-4000-8000-000000000003', repeat('c', 64));

select throws_ok(
  $$
    select * from public.prepare_newsletter_welcome_delivery(
      '50000000-0000-4000-8000-000000000001',
      repeat('c', 64)
    )
  $$,
  '23505',
  null,
  'a duplicate hash aborts welcome preparation'
);
select ok(
  (
    select invalidated_at is null
    from public.newsletter_unsubscribe_tokens
    where token_hash = repeat('b', 64)
  ),
  'a failed token insert rolls back invalidation of the previous token'
);

select results_eq(
  $$
    select outcome from public.unsubscribe_newsletter_by_token(
      repeat('b', 64), '2026-07', 'sql_test', '/preview/newsletter/unsubscribe', null
    )
  $$,
  $$values ('unsubscribed'::text)$$,
  'the first valid token use unsubscribes'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  'unsubscribed',
  'token unsubscribe updates the final subscriber state'
);
select is(
  (
    select weekly_digest_enabled
    from public.newsletter_preferences
    where subscriber_id = '50000000-0000-4000-8000-000000000001'
  ),
  false,
  'token unsubscribe disables the weekly preference'
);
select ok(
  (
    select first_used_at is not null
    from public.newsletter_unsubscribe_tokens
    where token_hash = repeat('b', 64)
  ),
  'the first token use records first_used_at'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_consent_events
    where subscriber_id = '50000000-0000-4000-8000-000000000001'
      and action = 'unsubscribed'
  ),
  1,
  'the first token use records one unsubscribe consent event'
);

create temporary table first_use_snapshot on commit drop as
select first_used_at
from public.newsletter_unsubscribe_tokens
where token_hash = repeat('b', 64);

select results_eq(
  $$
    select outcome from public.unsubscribe_newsletter_by_token(
      repeat('b', 64), '2026-07', 'sql_test', '/preview/newsletter/unsubscribe', null
    )
  $$,
  $$values ('already_unsubscribed'::text)$$,
  'the same token remains publicly idempotent after first use'
);
select ok(
  (
    select token.first_used_at = snapshot.first_used_at
    from public.newsletter_unsubscribe_tokens as token
    cross join pg_temp.first_use_snapshot as snapshot
    where token.token_hash = repeat('b', 64)
  ),
  'a repeated use does not change first_used_at'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_consent_events
    where subscriber_id = '50000000-0000-4000-8000-000000000001'
      and action = 'unsubscribed'
  ),
  1,
  'a repeated use creates no duplicate unsubscribe consent event'
);
select results_eq(
  $$
    select outcome from public.unsubscribe_newsletter_by_token(
      repeat('a', 64), '2026-07', 'sql_test', null, null
    )
  $$,
  $$values ('invalid_or_expired'::text)$$,
  'a rotated token is invalid'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version, confirmed_at
) values (
  '50000000-0000-4000-8000-000000000004',
  'welcome-expired@example.invalid',
  'welcome-expired@example.invalid',
  'active',
  'sql_test',
  '2026-07',
  now()
);
insert into public.newsletter_unsubscribe_tokens (
  subscriber_id, token_hash, created_at, expires_at
) values (
  '50000000-0000-4000-8000-000000000004',
  repeat('d', 64),
  now() - interval '2 days',
  now() - interval '1 day'
);
select results_eq(
  $$
    select outcome from public.unsubscribe_newsletter_by_token(
      repeat('d', 64), '2026-07', 'sql_test', null, null
    )
  $$,
  $$values ('invalid_or_expired'::text)$$,
  'an explicitly expired token is invalid'
);
select results_eq(
  $$
    select outcome from public.unsubscribe_newsletter_by_token(
      repeat('e', 64), '2026-07', 'sql_test', null, null
    )
  $$,
  $$values ('invalid_or_expired'::text)$$,
  'an unknown token is invalid without revealing subscriber existence'
);

select * from finish();
rollback;
