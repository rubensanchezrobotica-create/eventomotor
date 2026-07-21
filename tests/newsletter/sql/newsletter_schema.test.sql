begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(15);

select set_eq(
  $$
    select tablename
    from pg_tables
    where schemaname = 'public' and tablename like 'newsletter_%'
  $$,
  array[
    'newsletter_subscribers',
    'newsletter_preferences',
    'newsletter_confirmation_tokens',
    'newsletter_consent_events',
    'newsletter_email_events'
  ],
  'the isolated newsletter schema contains exactly five tables'
);

select ok(
  (
    select count(*) = 10
    from information_schema.columns
    where table_schema = 'public'
      and (table_name, column_name, data_type) in (
        ('newsletter_subscribers', 'id', 'uuid'),
        ('newsletter_subscribers', 'email', 'text'),
        ('newsletter_subscribers', 'status', 'text'),
        ('newsletter_preferences', 'subscriber_id', 'uuid'),
        ('newsletter_preferences', 'weekly_digest_enabled', 'boolean'),
        ('newsletter_confirmation_tokens', 'token_hash', 'text'),
        ('newsletter_confirmation_tokens', 'expires_at', 'timestamp with time zone'),
        ('newsletter_consent_events', 'action', 'text'),
        ('newsletter_email_events', 'event_type', 'text'),
        ('newsletter_email_events', 'occurred_at', 'timestamp with time zone')
      )
  ),
  'critical newsletter columns have their expected PostgreSQL types'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where contype = 'p'
      and conrelid in (
        'public.newsletter_subscribers'::regclass,
        'public.newsletter_preferences'::regclass,
        'public.newsletter_confirmation_tokens'::regclass,
        'public.newsletter_consent_events'::regclass,
        'public.newsletter_email_events'::regclass
      )
  ),
  5,
  'every newsletter table has a primary key'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.newsletter_preferences'::regclass
      and conname = 'newsletter_preferences_pkey'
      and contype = 'p'
  ),
  'newsletter preferences primary key has the expected conflict constraint name'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where contype = 'f'
      and conrelid in (
        'public.newsletter_preferences'::regclass,
        'public.newsletter_confirmation_tokens'::regclass,
        'public.newsletter_consent_events'::regclass,
        'public.newsletter_email_events'::regclass
      )
  ),
  4,
  'the four subscriber-owned tables have foreign keys'
);

select ok(
  (
    select count(*) = 3
    from pg_constraint
    where contype = 'u'
      and conname in (
        'newsletter_subscribers_email_normalized_key',
        'newsletter_confirmation_tokens_hash_key',
        'newsletter_email_events_provider_event_key'
      )
  ),
  'normalized email, token hash and provider event identities are unique'
);

select ok(
  (
    select count(*) >= 18
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'public.newsletter_subscribers'::regclass,
        'public.newsletter_confirmation_tokens'::regclass,
        'public.newsletter_consent_events'::regclass,
        'public.newsletter_email_events'::regclass
      )
  ),
  'data invariants are enforced by real check constraints'
);

select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'set_newsletter_subscribers_updated_at',
        'set_newsletter_preferences_updated_at'
      )
  ),
  2,
  'updated_at triggers exist on subscribers and preferences'
);

select ok(
  (
    select bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.newsletter_subscribers'::regclass,
      'public.newsletter_preferences'::regclass,
      'public.newsletter_confirmation_tokens'::regclass,
      'public.newsletter_consent_events'::regclass,
      'public.newsletter_email_events'::regclass
    )
  ),
  'RLS is enabled on all newsletter tables'
);

select set_eq(
  $$
    select format('%s(%s)', proname, oidvectortypes(proargtypes))
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'request_newsletter_subscription',
        'confirm_newsletter_subscription',
        'unsubscribe_newsletter_subscriber',
        'record_newsletter_provider_event'
      )
  $$,
  array[
    'request_newsletter_subscription(text, text, text, timestamp with time zone, text, text, text, text, text, text, text, text, text)',
    'confirm_newsletter_subscription(text)',
    'unsubscribe_newsletter_subscriber(uuid, text, text, text, text)',
    'record_newsletter_provider_event(text, text, text, uuid, text, boolean, timestamp with time zone)'
  ],
  'the four RPC signatures are exact'
);

select ok(
  (
    select bool_and(prosecdef)
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'request_newsletter_subscription',
        'confirm_newsletter_subscription',
        'unsubscribe_newsletter_subscriber',
        'record_newsletter_provider_event'
      )
  ),
  'all mutation RPCs are security definer'
);

select ok(
  (
    select bool_and('search_path=""' = any(proconfig))
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'request_newsletter_subscription',
        'confirm_newsletter_subscription',
        'unsubscribe_newsletter_subscriber',
        'record_newsletter_provider_event'
      )
  ),
  'all mutation RPCs have an empty fixed search_path'
);

select set_eq(
  $$
    select pg_get_function_result(oid)
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'request_newsletter_subscription',
        'confirm_newsletter_subscription',
        'unsubscribe_newsletter_subscriber',
        'record_newsletter_provider_event'
      )
  $$,
  array[
    'TABLE(outcome text, subscriber_id uuid, token_purpose text)',
    'TABLE(outcome text, subscriber_id uuid)',
    'TABLE(outcome text)'
  ],
  'RPC return types expose only the minimal orchestration fields'
);

select ok(
  (
    select bool_and(prosrc !~* '\mexecute\M')
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'request_newsletter_subscription',
        'confirm_newsletter_subscription',
        'unsubscribe_newsletter_subscriber',
        'record_newsletter_provider_event'
      )
  ),
  'the RPC bodies contain no dynamic EXECUTE'
);

select ok(
  (
    select count(*) = 8
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'newsletter_subscribers_status_idx',
        'newsletter_subscribers_province_idx',
        'newsletter_confirmation_tokens_subscriber_idx',
        'newsletter_confirmation_tokens_expiry_idx',
        'newsletter_consent_events_subscriber_idx',
        'newsletter_email_events_subscriber_idx',
        'newsletter_email_events_message_idx',
        'newsletter_email_events_provider_event_key'
      )
  ),
  'the expected lookup, expiry and deduplication indexes exist'
);

select * from finish();
rollback;
