begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(22);

set local role anon;
select throws_ok($$select * from public.newsletter_subscribers$$, 'anon cannot select subscribers');
select throws_ok(
  $$insert into public.newsletter_subscribers (email, email_normalized, source, consent_version) values ('anon@example.invalid', 'anon@example.invalid', 'test', 'test')$$,
  'anon cannot insert subscribers'
);
select throws_ok(
  $$update public.newsletter_subscribers set source = 'anon'$$,
  'anon cannot update subscribers'
);
select throws_ok($$delete from public.newsletter_subscribers$$, 'anon cannot delete subscribers');
reset role;

set local role authenticated;
select throws_ok($$select * from public.newsletter_subscribers$$, 'authenticated cannot select subscribers');
select throws_ok(
  $$insert into public.newsletter_subscribers (email, email_normalized, source, consent_version) values ('auth@example.invalid', 'auth@example.invalid', 'test', 'test')$$,
  'authenticated cannot insert subscribers'
);
select throws_ok(
  $$update public.newsletter_subscribers set source = 'authenticated'$$,
  'authenticated cannot update subscribers'
);
select throws_ok($$delete from public.newsletter_subscribers$$, 'authenticated cannot delete subscribers');
reset role;

set local role anon;
select throws_ok(
  $$select * from public.request_newsletter_subscription('anon@example.invalid', 'anon@example.invalid', repeat('a', 64), now() + interval '1 day', 'test', 'test')$$,
  'anon cannot execute request RPC'
);
select throws_ok(
  $$select * from public.confirm_newsletter_subscription(repeat('a', 64))$$,
  'anon cannot execute confirmation RPC'
);
select throws_ok(
  $$select * from public.unsubscribe_newsletter_subscriber('00000000-0000-4000-8000-000000000001', 'test', 'test')$$,
  'anon cannot execute unsubscribe RPC'
);
select throws_ok(
  $$select * from public.record_newsletter_provider_event('test', 'anon-event', null, null, 'delivered', false, now())$$,
  'anon cannot execute provider RPC'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select * from public.request_newsletter_subscription('auth@example.invalid', 'auth@example.invalid', repeat('b', 64), now() + interval '1 day', 'test', 'test')$$,
  'authenticated cannot execute request RPC'
);
select throws_ok(
  $$select * from public.confirm_newsletter_subscription(repeat('b', 64))$$,
  'authenticated cannot execute confirmation RPC'
);
select throws_ok(
  $$select * from public.unsubscribe_newsletter_subscriber('00000000-0000-4000-8000-000000000002', 'test', 'test')$$,
  'authenticated cannot execute unsubscribe RPC'
);
select throws_ok(
  $$select * from public.record_newsletter_provider_event('test', 'auth-event', null, null, 'delivered', false, now())$$,
  'authenticated cannot execute provider RPC'
);
reset role;

set local role service_role;
select lives_ok(
  $$
    select count(*) from public.newsletter_subscribers
    union all select count(*) from public.newsletter_preferences
    union all select count(*) from public.newsletter_confirmation_tokens
    union all select count(*) from public.newsletter_consent_events
    union all select count(*) from public.newsletter_email_events
  $$,
  'service_role can read every newsletter table'
);
select lives_ok(
  $$select * from public.request_newsletter_subscription('service@example.invalid', 'service@example.invalid', repeat('c', 64), now() + interval '1 day', 'permissions_test', 'test')$$,
  'service_role can execute the request RPC'
);
reset role;

select ok(
  has_function_privilege('service_role', 'public.request_newsletter_subscription(text,text,text,timestamptz,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.confirm_newsletter_subscription(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.unsubscribe_newsletter_subscriber(uuid,text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.record_newsletter_provider_event(text,text,text,uuid,text,boolean,timestamptz)', 'EXECUTE'),
  'service_role has execute privilege on all four RPCs'
);

select ok(
  (
    select bool_and(
      pg_get_function_result(oid) !~* 'email|token_hash|token_raw|subscriber_status|consent'
    )
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'request_newsletter_subscription',
        'confirm_newsletter_subscription',
        'unsubscribe_newsletter_subscriber',
        'record_newsletter_provider_event'
      )
  ),
  'RPC returns expose no email, token raw, internal status or consent event'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name like 'newsletter_%'
      and grantee in ('anon', 'authenticated')
  ),
  0,
  'client roles have no newsletter table grants'
);

select ok(
  (
    select count(*) = 5
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name like 'newsletter_%'
      and grantee = 'service_role'
      and privilege_type = 'SELECT'
  ),
  'service_role has exactly the intended table read grants'
);

select * from finish();
rollback;
