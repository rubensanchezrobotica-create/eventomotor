begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(17);

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
    'newsletter_unsubscribe_tokens',
    'newsletter_consent_events',
    'newsletter_email_events',
    'newsletter_suppressions',
    'newsletter_webhook_receipts',
    'newsletter_campaigns',
    'newsletter_campaign_deliveries',
    'newsletter_campaign_unsubscribe_tokens'
  ],
  'the isolated newsletter schema contains exactly eleven tables'
);

select ok(
  (
    select count(*) = 18
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
        ('newsletter_unsubscribe_tokens', 'id', 'uuid'),
        ('newsletter_unsubscribe_tokens', 'subscriber_id', 'uuid'),
        ('newsletter_unsubscribe_tokens', 'token_hash', 'text'),
        ('newsletter_unsubscribe_tokens', 'created_at', 'timestamp with time zone'),
        ('newsletter_unsubscribe_tokens', 'expires_at', 'timestamp with time zone'),
        ('newsletter_unsubscribe_tokens', 'invalidated_at', 'timestamp with time zone'),
        ('newsletter_unsubscribe_tokens', 'first_used_at', 'timestamp with time zone'),
        ('newsletter_unsubscribe_tokens', 'updated_at', 'timestamp with time zone'),
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
        'public.newsletter_unsubscribe_tokens'::regclass,
        'public.newsletter_consent_events'::regclass,
        'public.newsletter_email_events'::regclass,
        'public.newsletter_suppressions'::regclass,
        'public.newsletter_webhook_receipts'::regclass,
        'public.newsletter_campaigns'::regclass,
        'public.newsletter_campaign_deliveries'::regclass,
        'public.newsletter_campaign_unsubscribe_tokens'::regclass
      )
  ),
  11,
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
        'public.newsletter_unsubscribe_tokens'::regclass,
        'public.newsletter_consent_events'::regclass,
        'public.newsletter_email_events'::regclass,
        'public.newsletter_suppressions'::regclass,
        'public.newsletter_webhook_receipts'::regclass,
        'public.newsletter_campaign_deliveries'::regclass,
        'public.newsletter_campaign_unsubscribe_tokens'::regclass
      )
  ),
  11,
  'subscriber and campaign-owned tables have foreign keys'
);

select ok(
  (
    select count(*) = 4
    from pg_constraint
    where contype = 'u'
      and conname in (
        'newsletter_subscribers_email_normalized_key',
        'newsletter_confirmation_tokens_hash_key',
        'newsletter_unsubscribe_tokens_hash_key',
        'newsletter_email_events_provider_event_key'
      )
  ),
  'normalized email, token hashes and provider event identities are unique'
);

select ok(
  (
    select count(*) >= 22
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'public.newsletter_subscribers'::regclass,
        'public.newsletter_confirmation_tokens'::regclass,
        'public.newsletter_unsubscribe_tokens'::regclass,
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
        'set_newsletter_preferences_updated_at',
        'set_newsletter_unsubscribe_tokens_updated_at'
      )
  ),
  3,
  'updated_at triggers exist on every mutable newsletter aggregate'
);

select ok(
  (
    select bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.newsletter_subscribers'::regclass,
      'public.newsletter_preferences'::regclass,
      'public.newsletter_confirmation_tokens'::regclass,
      'public.newsletter_unsubscribe_tokens'::regclass,
      'public.newsletter_consent_events'::regclass,
      'public.newsletter_email_events'::regclass,
      'public.newsletter_suppressions'::regclass,
      'public.newsletter_webhook_receipts'::regclass,
      'public.newsletter_campaigns'::regclass,
      'public.newsletter_campaign_deliveries'::regclass,
      'public.newsletter_campaign_unsubscribe_tokens'::regclass
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
        'prepare_newsletter_welcome_delivery',
        'unsubscribe_newsletter_subscriber',
        'unsubscribe_newsletter_by_token',
        'record_newsletter_provider_event',
        'purge_stale_newsletter_pending',
        'check_newsletter_delivery_eligibility',
        'register_newsletter_outbound_delivery',
        'process_newsletter_resend_webhook',
        'preview_newsletter_campaign',
        'prepare_newsletter_campaign',
        'claim_newsletter_campaign_delivery',
        'record_newsletter_campaign_delivery_accepted',
        'record_newsletter_campaign_delivery_failed',
        'record_newsletter_campaign_delivery_unknown'
      )
  $$,
  array[
    'request_newsletter_subscription(text, text, text, timestamp with time zone, text, text, text, text, text, text, text, text, text)',
    'confirm_newsletter_subscription(text)',
    'prepare_newsletter_welcome_delivery(uuid, text, timestamp with time zone)',
    'unsubscribe_newsletter_subscriber(uuid, text, text, text, text)',
    'unsubscribe_newsletter_by_token(text, text, text, text, text)',
    'record_newsletter_provider_event(text, text, text, uuid, text, boolean, timestamp with time zone)',
    'purge_stale_newsletter_pending(integer, timestamp with time zone)',
    'check_newsletter_delivery_eligibility(uuid, text)',
    'register_newsletter_outbound_delivery(uuid, text, text, timestamp with time zone)',
    'process_newsletter_resend_webhook(text, text, text, timestamp with time zone, text, boolean)',
    'preview_newsletter_campaign(text, text, text, text)',
    'prepare_newsletter_campaign(text, text, text, text)',
    'claim_newsletter_campaign_delivery(uuid, text, boolean)',
    'record_newsletter_campaign_delivery_accepted(uuid, uuid, text, timestamp with time zone)',
    'record_newsletter_campaign_delivery_failed(uuid, uuid, text, boolean, timestamp with time zone)',
    'record_newsletter_campaign_delivery_unknown(uuid, uuid, text, timestamp with time zone)'
  ],
  'the sixteen RPC signatures are exact'
);

select ok(
  (
    select bool_and(prosecdef)
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'request_newsletter_subscription',
        'confirm_newsletter_subscription',
        'prepare_newsletter_welcome_delivery',
        'unsubscribe_newsletter_subscriber',
        'unsubscribe_newsletter_by_token',
        'record_newsletter_provider_event',
        'purge_stale_newsletter_pending',
        'check_newsletter_delivery_eligibility',
        'register_newsletter_outbound_delivery',
        'process_newsletter_resend_webhook',
        'preview_newsletter_campaign',
        'prepare_newsletter_campaign',
        'claim_newsletter_campaign_delivery',
        'record_newsletter_campaign_delivery_accepted',
        'record_newsletter_campaign_delivery_failed',
        'record_newsletter_campaign_delivery_unknown'
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
        'prepare_newsletter_welcome_delivery',
        'unsubscribe_newsletter_subscriber',
        'unsubscribe_newsletter_by_token',
        'record_newsletter_provider_event',
        'purge_stale_newsletter_pending',
        'check_newsletter_delivery_eligibility',
        'register_newsletter_outbound_delivery',
        'process_newsletter_resend_webhook',
        'preview_newsletter_campaign',
        'prepare_newsletter_campaign',
        'claim_newsletter_campaign_delivery',
        'record_newsletter_campaign_delivery_accepted',
        'record_newsletter_campaign_delivery_failed',
        'record_newsletter_campaign_delivery_unknown'
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
        'prepare_newsletter_welcome_delivery',
        'unsubscribe_newsletter_subscriber',
        'unsubscribe_newsletter_by_token',
        'record_newsletter_provider_event',
        'purge_stale_newsletter_pending',
        'check_newsletter_delivery_eligibility',
        'register_newsletter_outbound_delivery',
        'process_newsletter_resend_webhook',
        'preview_newsletter_campaign',
        'prepare_newsletter_campaign',
        'claim_newsletter_campaign_delivery',
        'record_newsletter_campaign_delivery_accepted',
        'record_newsletter_campaign_delivery_failed',
        'record_newsletter_campaign_delivery_unknown'
      )
  $$,
  array[
    'TABLE(outcome text, subscriber_id uuid, token_purpose text)',
    'TABLE(outcome text, subscriber_id uuid)',
    'TABLE(outcome text)',
    'TABLE(subscriber_id uuid, recipient_email text, preferred_province text, preferred_region text, locale text)',
    'TABLE(purged_count integer)',
    'TABLE(campaign_id uuid, campaign_status text, eligible_count integer, prepared_count integer, sending_count integer, accepted_count integer, failed_count integer, unknown_count integer, retryable_count integer)',
    'TABLE(delivery_id uuid, campaign_id uuid, subscriber_id uuid, recipient_email text, claim_id uuid, attempt_count integer, idempotency_key text)'
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
        'prepare_newsletter_welcome_delivery',
        'unsubscribe_newsletter_subscriber',
        'unsubscribe_newsletter_by_token',
        'record_newsletter_provider_event',
        'purge_stale_newsletter_pending',
        'check_newsletter_delivery_eligibility',
        'register_newsletter_outbound_delivery',
        'process_newsletter_resend_webhook',
        'preview_newsletter_campaign',
        'prepare_newsletter_campaign',
        'claim_newsletter_campaign_delivery',
        'record_newsletter_campaign_delivery_accepted',
        'record_newsletter_campaign_delivery_failed',
        'record_newsletter_campaign_delivery_unknown'
      )
  ),
  'the RPC bodies contain no dynamic EXECUTE'
);

select ok(
  (
    select count(*) = 25
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'newsletter_subscribers_status_idx',
        'newsletter_subscribers_province_idx',
        'newsletter_confirmation_tokens_subscriber_idx',
        'newsletter_confirmation_tokens_expiry_idx',
        'newsletter_unsubscribe_tokens_hash_key',
        'newsletter_unsubscribe_tokens_subscriber_idx',
        'newsletter_unsubscribe_tokens_active_key',
        'newsletter_consent_events_subscriber_idx',
        'newsletter_email_events_subscriber_idx',
        'newsletter_email_events_message_idx',
        'newsletter_email_events_provider_event_key',
        'newsletter_email_events_resend_outbound_message_key',
        'newsletter_suppressions_subscriber_key',
        'newsletter_suppressions_active_email_key',
        'newsletter_suppressions_active_subscriber_idx',
        'newsletter_webhook_receipts_message_idx',
        'newsletter_campaigns_edition_key',
        'newsletter_campaign_deliveries_recipient_key',
        'newsletter_campaign_deliveries_idempotency_key',
        'newsletter_campaign_deliveries_provider_message_key',
        'newsletter_campaign_unsubscribe_tokens_hash_key',
        'newsletter_campaign_unsubscribe_tokens_attempt_key',
        'newsletter_campaign_deliveries_claim_idx',
        'newsletter_campaign_deliveries_subscriber_idx',
        'newsletter_campaign_unsubscribe_tokens_subscriber_idx'
      )
  ),
  'the expected lookup, expiry and deduplication indexes exist'
);

select ok(
  (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'newsletter_unsubscribe_tokens'
      and column_name = 'expires_at'
  ),
  'unsubscribe tokens have nullable expiry by policy'
);

select ok(
  (
    select indexdef ~* 'unique.*subscriber_id.*where.*invalidated_at is null'
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'newsletter_unsubscribe_tokens_active_key'
  ),
  'a partial unique index enforces one non-invalidated token per subscriber'
);

select * from finish();
rollback;
