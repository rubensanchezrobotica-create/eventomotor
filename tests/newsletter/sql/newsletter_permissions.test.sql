begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(22);

set local role anon;
select throws_ok(
  $$select * from public.newsletter_subscribers$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'anon cannot select subscribers'
);
select throws_ok(
  $$insert into public.newsletter_subscribers (email, email_normalized, source, consent_version) values ('anon@example.invalid', 'anon@example.invalid', 'test', 'test')$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'anon cannot insert subscribers'
);
select throws_ok(
  $$update public.newsletter_subscribers set source = 'anon'$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'anon cannot update subscribers'
);
select throws_ok(
  $$delete from public.newsletter_subscribers$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'anon cannot delete subscribers'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select * from public.newsletter_subscribers$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'authenticated cannot select subscribers'
);
select throws_ok(
  $$insert into public.newsletter_subscribers (email, email_normalized, source, consent_version) values ('auth@example.invalid', 'auth@example.invalid', 'test', 'test')$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'authenticated cannot insert subscribers'
);
select throws_ok(
  $$update public.newsletter_subscribers set source = 'authenticated'$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'authenticated cannot update subscribers'
);
select throws_ok(
  $$delete from public.newsletter_subscribers$$,
  '42501',
  'permission denied for table newsletter_subscribers',
  'authenticated cannot delete subscribers'
);
reset role;

select ok(
  not has_function_privilege(
    'anon',
    'public.request_newsletter_subscription(text,text,text,timestamptz,text,text,text,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'anon has no execute privilege on request RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.confirm_newsletter_subscription(text)'::regprocedure,
    'EXECUTE'
  ),
  'anon has no execute privilege on confirmation RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.unsubscribe_newsletter_subscriber(uuid,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'anon has no execute privilege on unsubscribe RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_newsletter_provider_event(text,text,text,uuid,text,boolean,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'anon has no execute privilege on provider RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.request_newsletter_subscription(text,text,text,timestamptz,text,text,text,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated has no execute privilege on request RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_newsletter_subscription(text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated has no execute privilege on confirmation RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.unsubscribe_newsletter_subscriber(uuid,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated has no execute privilege on unsubscribe RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_newsletter_provider_event(text,text,text,uuid,text,boolean,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated has no execute privilege on provider RPC'
);

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
