begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(62);

select ok(
  to_regprocedure(
    'public.repair_legacy_newsletter_unsubscribe(uuid,timestamp with time zone)'
  ) is not null,
  'the legacy unsubscribe repair helper exists'
);
select ok(
  (
    select prosecdef
      and proconfig = array['search_path=""']
    from pg_proc
    where oid = 'public.repair_legacy_newsletter_unsubscribe(uuid,timestamptz)'::regprocedure
  ),
  'the repair helper is SECURITY DEFINER with an empty search_path'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.repair_legacy_newsletter_unsubscribe(uuid,timestamptz)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.repair_legacy_newsletter_unsubscribe(uuid,timestamptz)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.repair_legacy_newsletter_unsubscribe(uuid,timestamptz)',
    'EXECUTE'
  ),
  'the repair helper is owner-only'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version,
  confirmation_request_window_started_at, confirmation_request_count,
  last_confirmation_requested_at, confirmed_at, unsubscribed_at,
  bounced_at, complained_at, suppressed_at
) values
  (
    '5a300000-0000-4000-8000-000000000001',
    'legacy-r5a3@example.invalid',
    'legacy-r5a3@example.invalid',
    'unsubscribed',
    'r5a3_sql',
    '2026-07',
    now() - interval '1 hour',
    2,
    now() - interval '5 minutes',
    now() - interval '30 days',
    now() - interval '2 days',
    null, null, null
  ),
  (
    '5a300000-0000-4000-8000-000000000002',
    'active-r5a3@example.invalid',
    'active-r5a3@example.invalid',
    'active', 'r5a3_sql', '2026-07',
    null, 0, null, now() - interval '1 day', null,
    null, null, null
  ),
  (
    '5a300000-0000-4000-8000-000000000003',
    'pending-r5a3@example.invalid',
    'pending-r5a3@example.invalid',
    'pending', 'r5a3_sql', '2026-07',
    null, 0, null, null, null,
    null, null, null
  ),
  (
    '5a300000-0000-4000-8000-000000000004',
    'bounce-r5a3@example.invalid',
    'bounce-r5a3@example.invalid',
    'bounced', 'r5a3_sql', '2026-07',
    null, 0, null, now() - interval '2 days', null,
    now() - interval '1 day', null, null
  ),
  (
    '5a300000-0000-4000-8000-000000000005',
    'complaint-r5a3@example.invalid',
    'complaint-r5a3@example.invalid',
    'complained', 'r5a3_sql', '2026-07',
    null, 0, null, now() - interval '2 days', null,
    null, now() - interval '1 day', null
  ),
  (
    '5a300000-0000-4000-8000-000000000006',
    'provider-r5a3@example.invalid',
    'provider-r5a3@example.invalid',
    'suppressed', 'r5a3_sql', '2026-07',
    null, 0, null, now() - interval '2 days', null,
    null, null, now() - interval '1 day'
  ),
  (
    '5a300000-0000-4000-8000-000000000007',
    'correct-r5a3@example.invalid',
    'correct-r5a3@example.invalid',
    'unsubscribed', 'r5a3_sql', '2026-07',
    null, 0, null, now() - interval '2 days', now() - interval '1 day',
    null, null, null
  ),
  (
    '5a300000-0000-4000-8000-000000000009',
    'hard-evidence-r5a3@example.invalid',
    'hard-evidence-r5a3@example.invalid',
    'unsubscribed', 'r5a3_sql', '2026-07',
    null, 0, null, now() - interval '2 days', now() - interval '1 day',
    now() - interval '3 days', null, null
  );

insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('5a300000-0000-4000-8000-000000000001', true);

insert into public.newsletter_consent_events (
  subscriber_id, action, consent_version, source, occurred_at
) values (
  '5a300000-0000-4000-8000-000000000001',
  'resubscribe_requested',
  '2026-07',
  'r5a3_sql',
  now() - interval '5 minutes'
);

insert into public.newsletter_confirmation_tokens (
  subscriber_id, token_hash, purpose, expires_at, used_at
) values
  (
    '5a300000-0000-4000-8000-000000000001',
    repeat('a', 64),
    'resubscribe',
    now() + interval '1 day',
    null
  ),
  (
    '5a300000-0000-4000-8000-000000000001',
    repeat('b', 64),
    'subscribe',
    now() + interval '1 day',
    null
  ),
  (
    '5a300000-0000-4000-8000-000000000001',
    repeat('c', 64),
    'resubscribe',
    now() + interval '1 day',
    now()
  );

insert into public.newsletter_suppressions (
  subscriber_id, email_hash, reason, suppressed_at
) values
  (
    '5a300000-0000-4000-8000-000000000004',
    public.newsletter_email_hash('bounce-r5a3@example.invalid'),
    'permanent_bounce',
    now() - interval '1 day'
  ),
  (
    '5a300000-0000-4000-8000-000000000005',
    public.newsletter_email_hash('complaint-r5a3@example.invalid'),
    'complaint',
    now() - interval '1 day'
  ),
  (
    '5a300000-0000-4000-8000-000000000006',
    public.newsletter_email_hash('provider-r5a3@example.invalid'),
    'provider_suppression',
    now() - interval '1 day'
  ),
  (
    '5a300000-0000-4000-8000-000000000007',
    public.newsletter_email_hash('correct-r5a3@example.invalid'),
    'voluntary',
    now() - interval '1 day'
  );

select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000001',
    now()
  ),
  true,
  'the observed legacy unsubscribe is repaired'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
      and lifted_at is null
  ),
  1,
  'repair creates exactly one active suppression'
);
select results_eq(
  $$
    select reason, email_hash
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      'voluntary'::text,
      public.newsletter_email_hash('legacy-r5a3@example.invalid')
    )
  $$,
  'repair stores the voluntary reason and minimized email hash'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000001'
  ),
  'unsubscribed',
  'repair does not reactivate the subscriber'
);
select results_eq(
  $$
    select confirmed_at, unsubscribed_at
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      now() - interval '30 days',
      now() - interval '2 days'
    )
  $$,
  'repair preserves confirmation and unsubscribe timestamps'
);
select matches(
  (
    select email_normalized
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000001'
  ),
  '^suppressed\+[0-9a-f]+' || chr(64) || 'invalid\.eventomotor\.local$',
  'repair removes the clear recipient address'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_preferences
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
  ),
  0,
  'repair does not retain or restore delivery preferences'
);
select ok(
  (
    select invalidated_at is not null
    from public.newsletter_confirmation_tokens
    where token_hash = repeat('a', 64)
  ),
  'the undelivered active resubscribe token is invalidated'
);
select ok(
  (
    select invalidated_at is null
    from public.newsletter_confirmation_tokens
    where token_hash = repeat('b', 64)
  ),
  'an active subscribe token is not invalidated by legacy repair'
);
select ok(
  (
    select used_at is not null and invalidated_at is null
    from public.newsletter_confirmation_tokens
    where token_hash = repeat('c', 64)
  ),
  'a consumed resubscribe token remains unchanged'
);
select results_eq(
  $$
    select last_confirmation_requested_at,
           confirmation_request_window_started_at,
           confirmation_request_count
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000001'
  $$,
  $$values (null::timestamptz, null::timestamptz, 0)$$,
  'only the operational request window is reset'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_consent_events
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
      and action = 'resubscribe_requested'
  ),
  1,
  'historical consent evidence is preserved'
);
select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000001',
    now()
  ),
  false,
  'a second repair is a no-op'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
  ),
  1,
  'a repeated repair cannot duplicate suppression evidence'
);

select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000002',
    now()
  ),
  false,
  'an active subscriber is not repaired'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000002'
  ),
  'active',
  'the active subscriber remains active'
);
select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000003',
    now()
  ),
  false,
  'a pending subscriber is not repaired'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000003'
  ),
  'pending',
  'the pending subscriber remains pending'
);
select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000004',
    now()
  ),
  false,
  'a permanent bounce is not repaired'
);
select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000005',
    now()
  ),
  false,
  'a complaint is not repaired'
);
select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000006',
    now()
  ),
  false,
  'a provider suppression is not repaired'
);
select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000007',
    now()
  ),
  false,
  'a correctly suppressed voluntary unsubscribe is not rewritten'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where reason in ('permanent_bounce', 'complaint', 'provider_suppression')
      and lifted_at is null
  ),
  3,
  'all three hard suppressions remain active'
);

select is(
  public.repair_legacy_newsletter_unsubscribe(
    '5a300000-0000-4000-8000-000000000009',
    now()
  ),
  false,
  'an unsubscribed row with canonical hard evidence is not repaired'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000009'
  ),
  0,
  'hard evidence without a suppression is never converted to voluntary'
);

select results_eq(
  $$
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      'bounce-r5a3@example.invalid',
      'bounce-r5a3@example.invalid',
      repeat('1', 64),
      now() + interval '1 day',
      'r5a3_hard_guard',
      '2026-07'
    )
  $$,
  $$values ('blocked'::text, null::uuid, null::text)$$,
  'permanent bounce is blocked before cooldown'
);
select results_eq(
  $$
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      'complaint-r5a3@example.invalid',
      'complaint-r5a3@example.invalid',
      repeat('2', 64),
      now() + interval '1 day',
      'r5a3_hard_guard',
      '2026-07'
    )
  $$,
  $$values ('blocked'::text, null::uuid, null::text)$$,
  'complaint is blocked before cooldown'
);
select results_eq(
  $$
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      'provider-r5a3@example.invalid',
      'provider-r5a3@example.invalid',
      repeat('3', 64),
      now() + interval '1 day',
      'r5a3_hard_guard',
      '2026-07'
    )
  $$,
  $$values ('blocked'::text, null::uuid, null::text)$$,
  'provider suppression is blocked before cooldown'
);
select results_eq(
  $$
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      'hard-evidence-r5a3@example.invalid',
      'hard-evidence-r5a3@example.invalid',
      repeat('4', 64),
      now() + interval '1 day',
      'r5a3_hard_guard',
      '2026-07'
    )
  $$,
  $$values ('blocked'::text, null::uuid, null::text)$$,
  'canonical hard timestamp evidence is blocked before legacy repair'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_confirmation_tokens
    where subscriber_id in (
      '5a300000-0000-4000-8000-000000000004',
      '5a300000-0000-4000-8000-000000000005',
      '5a300000-0000-4000-8000-000000000006',
      '5a300000-0000-4000-8000-000000000009'
    )
  ),
  0,
  'hard blocks create no confirmation token'
);
select ok(
  (
    select bool_and(confirmation_request_count = 0)
    from public.newsletter_subscribers
    where id in (
      '5a300000-0000-4000-8000-000000000004',
      '5a300000-0000-4000-8000-000000000005',
      '5a300000-0000-4000-8000-000000000006',
      '5a300000-0000-4000-8000-000000000009'
    )
  ),
  'hard blocks do not increment the request counter'
);
select ok(
  (
    select bool_and(last_confirmation_requested_at is null)
    from public.newsletter_subscribers
    where id in (
      '5a300000-0000-4000-8000-000000000004',
      '5a300000-0000-4000-8000-000000000005',
      '5a300000-0000-4000-8000-000000000006',
      '5a300000-0000-4000-8000-000000000009'
    )
  ),
  'hard blocks do not update the cooldown timestamp'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id in (
      '5a300000-0000-4000-8000-000000000004',
      '5a300000-0000-4000-8000-000000000005',
      '5a300000-0000-4000-8000-000000000006',
      '5a300000-0000-4000-8000-000000000009'
    )
      and reason = 'voluntary'
  ),
  0,
  'hard blocks never create a voluntary suppression'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_consent_events
    where subscriber_id in (
      '5a300000-0000-4000-8000-000000000004',
      '5a300000-0000-4000-8000-000000000005',
      '5a300000-0000-4000-8000-000000000006',
      '5a300000-0000-4000-8000-000000000009'
    )
  ),
  0,
  'hard blocks create no consent event'
);
select results_eq(
  $$
    select id, status
    from public.newsletter_subscribers
    where id in (
      '5a300000-0000-4000-8000-000000000004',
      '5a300000-0000-4000-8000-000000000005',
      '5a300000-0000-4000-8000-000000000006',
      '5a300000-0000-4000-8000-000000000009'
    )
    order by id
  $$,
  $$
    values
      ('5a300000-0000-4000-8000-000000000004'::uuid, 'bounced'::text),
      ('5a300000-0000-4000-8000-000000000005'::uuid, 'complained'::text),
      ('5a300000-0000-4000-8000-000000000006'::uuid, 'suppressed'::text),
      ('5a300000-0000-4000-8000-000000000009'::uuid, 'unsubscribed'::text)
  $$,
  'hard blocks preserve every subscriber status'
);

select results_eq(
  $$
    select outcome, token_purpose
    from public.request_newsletter_subscription(
      'legacy-r5a3@example.invalid',
      'legacy-r5a3@example.invalid',
      repeat('d', 64),
      now() + interval '1 day',
      'r5a3_sql',
      '2026-07'
    )
  $$,
  $$values ('confirmation_required'::text, 'resubscribe'::text)$$,
  'a repaired legacy row can request one new double opt-in token'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000001'
  ),
  'unsubscribed',
  'the new request still does not reactivate the subscriber'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_confirmation_tokens
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
      and purpose = 'resubscribe'
      and used_at is null
      and invalidated_at is null
  ),
  1,
  'the repaired aggregate has one active resubscribe token'
);
select results_eq(
  $$
    select token_hash, invalidated_at is null
    from public.newsletter_confirmation_tokens
    where token_hash in (repeat('a', 64), repeat('d', 64))
    order by token_hash
  $$,
  $$
    values
      (repeat('a', 64), false),
      (repeat('d', 64), true)
  $$,
  'the orphan remains invalid and the replacement token is valid'
);
select results_eq(
  $$
    select outcome
    from public.request_newsletter_subscription(
      'legacy-r5a3@example.invalid',
      'legacy-r5a3@example.invalid',
      repeat('e', 64),
      now() + interval '1 day',
      'r5a3_sql',
      '2026-07'
    )
  $$,
  $$values ('cooldown'::text)$$,
  'the normal cooldown applies after the one replacement request'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_confirmation_tokens
    where token_hash = repeat('e', 64)
  ),
  0,
  'a cooldown response does not persist a second replacement token'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
      and lifted_at is null
  ),
  1,
  'the replacement request keeps one active suppression'
);
select results_eq(
  $$
    select outcome
    from public.check_newsletter_delivery_eligibility(
      '5a300000-0000-4000-8000-000000000001',
      'confirmation'
    )
  $$,
  $$values ('allowed'::text)$$,
  'the delivery guard allows the replacement confirmation'
);
select results_eq(
  $$select outcome from public.confirm_newsletter_subscription(repeat('d', 64))$$,
  $$values ('confirmed'::text)$$,
  'the replacement resubscribe token confirms'
);
select is(
  (
    select status
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000001'
  ),
  'active',
  'only token confirmation reactivates the subscriber'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
      and reason = 'voluntary'
      and lifted_at is not null
  ),
  1,
  'confirmation lifts only the voluntary suppression'
);
select is(
  (
    select weekly_digest_enabled
    from public.newsletter_preferences
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
  ),
  true,
  'only confirmation restores the weekly preference'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000001'
      and lifted_at is null
  ),
  0,
  'the confirmed aggregate has no active suppression'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_suppressions'
  ),
  0,
  'RLS remains fail-closed without client policies'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.newsletter_request_subscription_r5a2_internal(text,text,text,timestamptz,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'the preserved R5A.2 request implementation is owner-only'
);
select results_eq(
  $$
    select parameter_name::text collate "C",
           data_type::text collate "C"
    from information_schema.parameters
    where specific_schema::text collate "C" = 'public'::text collate "C"
      and specific_name::text collate "C" = (
        select (p.proname || '_' || p.oid::text)::text collate "C"
        from pg_proc as p
        join pg_namespace as n on n.oid = p.pronamespace
        where n.nspname::text collate "C" = 'public'::text collate "C"
          and p.proname::text collate "C"
            = 'request_newsletter_subscription'::text collate "C"
      )
      and parameter_mode::text collate "C" = 'OUT'::text collate "C"
    order by ordinal_position
  $$,
  $$
    values
      ('outcome'::text collate "C", 'text'::text collate "C"),
      ('subscriber_id'::text collate "C", 'uuid'::text collate "C"),
      ('token_purpose'::text collate "C", 'text'::text collate "C")
  $$,
  'the public request RPC preserves historical output names, order and types'
);
select is(
  (
    select count(*)::integer
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'request_newsletter_subscription'
  ),
  1,
  'the public request RPC has no additional overload'
);
select is(
  (
    select count(*)::integer
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'request_newsletter_subscription_%'
  ),
  0,
  'no internal helper can be mistaken for a public request RPC result'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.request_newsletter_subscription(text,text,text,timestamptz,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.request_newsletter_subscription(text,text,text,timestamptz,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.request_newsletter_subscription(text,text,text,timestamptz,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'the three-column public request RPC remains service-role-only'
);

insert into public.newsletter_subscribers (
  id, email, email_normalized, status, source, consent_version,
  confirmation_request_window_started_at, confirmation_request_count,
  last_confirmation_requested_at, confirmed_at, unsubscribed_at
) values (
  '5a300000-0000-4000-8000-000000000008',
  'rollback-r5a3@example.invalid',
  'rollback-r5a3@example.invalid',
  'unsubscribed',
  'r5a3_sql',
  '2026-07',
  now() - interval '1 hour',
  2,
  now() - interval '5 minutes',
  now() - interval '2 days',
  now() - interval '1 day'
);
insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
values ('5a300000-0000-4000-8000-000000000008', true);
insert into public.newsletter_confirmation_tokens (
  subscriber_id, token_hash, purpose, expires_at
) values (
  '5a300000-0000-4000-8000-000000000008',
  repeat('f', 64),
  'resubscribe',
  now() + interval '1 day'
);

create function pg_temp.fail_r5a3_suppression()
returns trigger
language plpgsql
as $$
begin
  if new.subscriber_id = '5a300000-0000-4000-8000-000000000008' then
    raise exception 'forced R5A.3 repair failure';
  end if;
  return new;
end;
$$;

create trigger force_r5a3_repair_failure
after insert on public.newsletter_suppressions
for each row execute function pg_temp.fail_r5a3_suppression();

select throws_ok(
  $$
    select public.repair_legacy_newsletter_unsubscribe(
      '5a300000-0000-4000-8000-000000000008',
      now()
    )
  $$,
  'P0001',
  'forced R5A.3 repair failure',
  'a late repair failure aborts the helper'
);
select is(
  (
    select count(*)::integer
    from public.newsletter_suppressions
    where subscriber_id = '5a300000-0000-4000-8000-000000000008'
  ),
  0,
  'rollback leaves no partial suppression'
);
select ok(
  (
    select invalidated_at is null
    from public.newsletter_confirmation_tokens
    where token_hash = repeat('f', 64)
  ),
  'rollback leaves the orphan token unchanged'
);
select results_eq(
  $$
    select email_normalized, confirmation_request_count,
           last_confirmation_requested_at is not null
    from public.newsletter_subscribers
    where id = '5a300000-0000-4000-8000-000000000008'
  $$,
  $$values ('rollback-r5a3@example.invalid'::text, 2, true)$$,
  'rollback preserves recipient and operational window state'
);
select is(
  (
    select weekly_digest_enabled
    from public.newsletter_preferences
    where subscriber_id = '5a300000-0000-4000-8000-000000000008'
  ),
  true,
  'rollback preserves pre-existing preferences'
);

select * from finish();
rollback;
