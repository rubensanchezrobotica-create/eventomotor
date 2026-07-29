# Newsletter R5A.2 — lifecycle and authenticated Resend webhook

## Status and scope

R5A.2 prepares the launch operations required by the production canary. It does
not enable the canary, apply a migration, configure a remote webhook, change
Vercel or contact Resend. Production must remain:

```text
NEWSLETTER_MODE=off
NEWSLETTER_MAIL_TRANSPORT=disabled
```

The historical foundation migration remains unchanged. The additive migration
is `20260729120000_newsletter_launch_operations.sql`.

## Architecture

The existing subscriber, consent, token and provider-event model remains the
single source of truth. R5A.2 adds:

- `newsletter_suppressions`: one minimized suppression aggregate per
  subscriber, with a SHA-256 email lookup and monotonic reason;
- `newsletter_webhook_receipts`: minimal Svix delivery metadata keyed by the
  unique `svix_id`;
- four service-role RPCs for retention, delivery eligibility, outbound
  provider-message registration and transactional webhook processing.

No webhook body, raw signature, token or clear recipient is persisted in the
receipt table.

## Seven-day pending retention

`purge_stale_newsletter_pending(batch, cutoff)` deletes only rows that are still
`pending`, have no `confirmed_at`, have no active suppression and whose
retention anchor is older than the cutoff. The anchor is
`coalesce(last_confirmation_requested_at, created_at)`: a new confirmation
request restarts the seven-day period; the 24-hour token expiry is not used as
the retention policy.

The function is bounded to 1–1000 rows, locks candidates with
`FOR UPDATE SKIP LOCKED`, deletes consent evidence belonging solely to the
unconfirmed request, and returns only `purged_count`. Dependent tokens and
preferences are removed through verified foreign-key cascades.

The migration schedules the stable pg_cron job
`newsletter-pending-retention-daily` at `03:17 UTC` with no HTTP call and no
secret. Reapplying the same named schedule updates the job rather than creating
a second name. CI checks the definition; it does not wait for the daily run.

Manual launch check in Supabase Dashboard:

1. Confirm the `pg_cron` extension and the single stable job.
2. Confirm its command is only
   `select public.purge_stale_newsletter_pending(500);`.
3. Run the function first with a conservative explicit cutoff and record only
   the returned count.
4. Confirm active and confirmed subscribers are unchanged.

## Transactional minimization and resubscription

Voluntary unsubscribe and permanent provider suppression execute in the same
database transaction as the state transition:

- delete territorial preferences and unnecessary confirmation tokens;
- replace the clear email with an internal non-deliverable address;
- clear province, region, source detail, IP hash and delivery aggregates;
- preserve a SHA-256 email lookup plus minimal consent/suppression evidence;
- retain only the unsubscribe token required to make the current token flow
  idempotent;
- assign a suppression reason: `voluntary`, `permanent_bounce`, `complaint` or
  `provider_suppression`.

Suppression priority is monotonic. A late bounce cannot downgrade a complaint,
and neither can reactivate a provider-suppressed recipient.

A new request matching a voluntary suppression may rehydrate the delivery
address only long enough to create a fresh `resubscribe` confirmation token.
The subscriber stays `unsubscribed` and the suppression stays active. Only a
successful confirmation of that new token lifts the voluntary suppression,
recreates the weekly preference and activates the subscriber.

Permanent bounce, complaint and provider suppression remain blocked. R5A.2
adds no administrative bypass.

Every live confirmation or welcome delivery calls
`check_newsletter_delivery_eligibility` before invoking the transport. An
absent RPC, missing subscriber or active non-voluntary suppression fails
closed. Accepted Resend message IDs are registered so later provider events are
matched by provider message ID before any recipient fallback.

## Resend webhook

The future route is:

```text
POST /api/newsletter/webhooks/resend
```

It is unavailable unless all existing production-canary guards are satisfied
and `NEWSLETTER_RESEND_WEBHOOK_SECRET` is a valid server-only `whsec_` value.
Preview, development, non-production Vercel, disabled mode and missing
configuration return a generic 404.

The handler:

1. reads `svix-id`, `svix-timestamp` and `svix-signature`;
2. reads the exact body once with `request.text()`;
3. verifies the raw body and headers using the official `svix` verifier,
   including its timestamp tolerance;
4. parses the verified object;
5. processes the receipt and provider event in one database transaction.

Invalid signature, timestamp, body or payload returns 400. A valid processed,
duplicate, ignored or unmatched delivery returns 200. A transient persistence
failure returns 503 so Resend can retry.

`svix_id` is the replay/idempotency key. The unique receipt is inserted in the
same transaction as suppression. A rollback leaves no processed marker, while
a retry after success returns `duplicate` without repeating the transition.
Events are never assumed to arrive in order.

Processed mappings:

- `email.bounced`: suppress only when Resend marks it permanent;
- `email.complained`: complaint suppression;
- `email.suppressed`: provider suppression;
- `email.delivered`, `email.failed`, `email.delivery_delayed`: non-suppressing
  delivery state.

`suppression.added` is not implemented because it is not part of the currently
documented Resend email webhook contract. Unknown valid event types return 200
as ignored.

`email.opened` and `email.clicked` are deliberately ignored. Their receipt does
not persist a provider message ID, subscriber or recipient. Receiving either
event is a signal to recheck the external tracking configuration.

## Tracking audit and launch checklist

The versioned Resend payload contains only sender, one recipient, Reply-To,
subject, HTML and plain text. It has no open/click tracking fields. The
transport does not rewrite links, and the React Email templates add no tracking
pixel. This code audit cannot prove the provider-side domain setting.

Before any canary, verify manually in Resend:

```text
Domains
→ news.eventomotor.com
→ Configuration
→ Open tracking OFF
→ Click tracking OFF
→ no tracking subdomain
```

Record a dated screenshot or change record. Do not mark this requirement
complete based only on repository tests.

## Configuration and future deployment

`NEWSLETTER_RESEND_WEBHOOK_SECRET` must remain empty in `.env.example`. For a
future release, add the actual endpoint in Resend, copy its webhook signing
secret into a Vercel server-only Sensitive variable, and never reuse the Resend
API key as the webhook secret.

Required rollout order:

1. Keep `off/disabled`.
2. Review the migration and take the normal database backup.
3. Run a dry-run against a disposable clone from the historical migration.
4. Apply the additive migration manually to the intended Supabase project.
5. Verify eight tables, ten service-role RPCs, RLS, grants and one cron job.
6. Configure the signed Resend webhook and provider tracking settings.
7. Deploy while still `off/disabled`.
8. Run invalid-signature and duplicate-delivery checks with synthetic,
   non-personal fixtures.
9. Only after an explicit separate approval, arm the allowlisted canary.

The repository CI is prepared to apply both newsletter migrations from zero,
run 215 pgTAP assertions in nine suites, concurrency races, DB lint and twenty
Data API permission denials. Local execution also requires the pinned Supabase
CLI and Docker; neither should be installed merely to claim validation.

## Rollback and emergency stop

First return to:

```text
NEWSLETTER_MODE=off
NEWSLETTER_MAIL_TRANSPORT=disabled
```

Disable the webhook endpoint in Resend and unschedule the cron job if its
behavior is suspect. Do not drop `newsletter_suppressions`, webhook receipts or
consent evidence, and do not restore clear emails, preferences or active
statuses. Rolling application code back is safe only while sends remain
disabled, because older code does not enforce the new suppression guard.

Database rollback should be a reviewed forward migration that preserves
suppression evidence and privileges. Never reverse the migration by dropping
tables or reactivating recipients.
