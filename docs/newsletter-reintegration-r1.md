# Newsletter reintegration R1 — Core foundation

## Scope

R1 establishes an isolated newsletter domain without exposing a route, form, preview, email,
provider adapter or public capture point. The SQL migration is a reviewed draft: it has not been
applied locally or remotely.

## Historical reference

The protected commit `d965e58dc3f88e03ce297d11f0022148acfc1687` was consulted only as a
reference.

Concepts reused with changes:

- Subscriber states and confirmation purposes.
- Email normalization using only `trim()` and lowercase.
- 32-byte opaque tokens, SHA-256 token hashes and HMAC SHA-256 signatures.
- Five-table separation between subscribers, preferences, tokens, consent and provider events.
- RLS with server-role-only access.

Rewritten:

- Mode resolution now fails closed and never defaults to preview.
- Signatures are versioned and bind purpose, subject and expiration.
- State transitions are explicit pure functions.
- The migration and all mutation RPCs were designed again around atomic transactions.
- Supabase table/RPC types are strict and integrated into the existing central client.

Discarded from R1:

- Historical Resend adapter and webhook processor.
- Historical HTML and React email renderers.
- Historical routes, preview and visual components.
- Historical migration and lockfile.
- Advanced preferences without a current product requirement.
- The unused `NEWSLETTER_CONFIRMATION_SECRET` proposal.

## Core architecture

The TypeScript domain is under `lib/newsletter/`:

- `types.ts`: closed domain unions plus strict table contracts.
- `schemas.ts`: normalization and runtime membership checks.
- `policy.ts`: pure request, confirmation, unsubscribe and provider-event transitions.
- `config.ts`: pure fail-closed mode resolution.
- `config.server.ts`: server-only environment adapter.
- `crypto.server.ts`: server-only token hashing and signed-action primitives.

No module calls Supabase or an email provider in R1. The existing `lib/supabase.ts` remains the
only Supabase client and contains the temporary manual database/RPC types.

## Modes

`NEWSLETTER_MODE` accepts `off`, `preview`, `test` or `live`.

- Missing or invalid values resolve to `off`.
- Production accepts only an explicit `live`; `preview` and `test` resolve to `off`.
- Non-production accepts `off`, `preview` and `test`; `live` resolves to `off`.
- A Vercel preview deployment can resolve `preview` even though Next.js uses
  `NODE_ENV=production` during its build/runtime.

R1 does not create the visual preview. A later phase must combine `VERCEL_ENV`, `connection()` and
an explicit production block at the route boundary.

## State model

Subscriber states:

- `pending`
- `active`
- `unsubscribed`
- `bounced`
- `complained`
- `suppressed`

Confirmation purposes are `subscribe` and `resubscribe`.

Important transitions:

- A new email becomes `pending` and receives a `subscribe` token hash.
- `pending` plus a valid `subscribe` token becomes `active`.
- `unsubscribed` remains unsubscribed until a valid `resubscribe` confirmation.
- A permanent bounce becomes `bounced`; a temporary delivery delay or failure does not change state.
- `bounced` is a permanent-delivery block: it cannot request or confirm either token purpose and
  remains `bounced` during public flows.
- `bounced`, `complained` and `suppressed` cannot be publicly reactivated.
- Recovering a false-positive permanent bounce requires a future authenticated administrative
  operation with an explicit audit event; R1 intentionally provides no such RPC.
- Repeated unsubscribe requests do not create duplicate state transitions.

## Database draft

Migration: `database/migrations/20260721133000_newsletter_core_foundation.sql`.

Tables:

- `newsletter_subscribers`: canonical lifecycle, consent context and delivery aggregates.
- `newsletter_preferences`: only the justified weekly-digest switch.
- `newsletter_confirmation_tokens`: SHA-256 hashes, purposes, expiry, use and invalidation.
- `newsletter_consent_events`: append-only lifecycle evidence.
- `newsletter_email_events`: provider-neutral, idempotent future event intake.

The schema uses checks instead of PostgreSQL enums, unique normalized emails, unique token hashes,
unique `(provider, provider_event_id)` events, non-negative counters, coherent state timestamps and
automatic `updated_at` triggers.

## Transactional RPCs

All four functions are `security definer`, use an empty `search_path`, accept only explicit scalar
fields and are executable only by `service_role`.

### `request_newsletter_subscription`

Locks the canonical subscriber, enforces blocked/active/cooldown/window rules, invalidates earlier
equivalent tokens, inserts the new hash and records request/issuance consent in one transaction.
It neither sends nor selects an email provider.

Returns `outcome` for server policy orchestration. Only when a confirmation must be issued does it
also return `subscriber_id` and `token_purpose`; blocked, active, cooldown and limit outcomes return
null for both. It never returns an email or internal subscriber status. A future public endpoint
must map every outcome to the same generic response.

### `confirm_newsletter_subscription`

Locks the token and subscriber, rejects invalidated, used or expired tokens, checks purpose against
state, activates the subscriber, consumes the token, enables the weekly preference and records the
confirmation together. Any failure rolls back every step.

Returns `outcome` and `subscriber_id` only after a successful confirmation. Invalid, expired, used
or blocked tokens return no subscriber identifier. No email or state value is exposed.

### `unsubscribe_newsletter_subscriber`

Locks the subscriber, disables weekly delivery, changes eligible states to `unsubscribed`,
invalidates outstanding tokens and records consent. Repetitions return an idempotent outcome
without adding another transition event.

Returns only `outcome`; the caller already supplied the authenticated subscriber target.

### `record_newsletter_provider_event`

Prepares the provider-neutral R2/R3 boundary. Event deduplication and aggregate state/timestamp
updates share the same transaction. If an aggregate update fails, the event insert rolls back so a
provider retry can succeed.

Returns only `outcome` (`recorded` or `duplicate`). Provider identifiers, email data and aggregate
subscriber state are not returned.

## SQL security

- RLS is enabled on all newsletter tables.
- `public`, `anon` and `authenticated` receive no direct table or RPC access.
- `service_role` receives table read access and RPC execution; direct mutations stay behind the RPCs.
- There is no delete grant in R1.
- Raw tokens are never persisted.
- Consent events use a restrictive subscriber foreign key to prevent accidental audit deletion.

The future server layer must still authenticate its own action tokens before calling unsubscribe
or other subscriber-specific RPCs. Possession of a public UUID must never be treated as authority.
All four functions use scalar typed parameters and contain no dynamic SQL. `EXECUTE` is revoked
explicitly from `public`, `anon` and `authenticated`, then granted only to `service_role`.

## Supabase types

This repository currently maintains manual types in `lib/supabase.ts`, so R1 adds the five tables
and four functions there. These types are temporary representations of the unapplied migration,
not a claim that the remote schema already contains them.

After the migration is eventually applied, regenerate and compare types using the project's future
Supabase CLI workflow, for example:

```powershell
npx supabase gen types typescript --linked > database.types.ts
```

Do not run that command until a linked project and an approved type-generation location exist.

## Tests and validation

Unit and structural tests:

```powershell
npm run test:newsletter-core
npm run typecheck
npx eslint lib/newsletter lib/supabase.ts
npm run build
git diff --check
```

Structural SQL tests verify table/check/index declarations, RLS, grants, transactional function
shape, token row locking, unsubscribe idempotency and provider-event deduplication.

There is no local Supabase SQL-test harness in this repository. Real PostgreSQL tests remain
mandatory before applying the migration: concurrent requests, concurrent confirmations, rollback
after each statement, grant enforcement, RLS behavior and provider-event retries must be exercised
against an isolated database. R1 intentionally does not introduce Docker or new database tooling.

## Not implemented

- Route Handlers or Server Actions.
- Public or private forms.
- Visual preview.
- Confirmation, result, unsubscribe or preferences pages.
- Email rendering or sending.
- Resend SDK, contacts, topics or webhooks.
- HTTP rate limiting.
- Analytics or public acquisition.
- Weekly campaign scheduling.

## Pending risks

- The migration has structural tests but has not been parsed/executed by PostgreSQL.
- Manual Supabase types can drift until the migration is applied and generated types are adopted.
- HTTP authorization, abuse controls and token-to-RPC orchestration are deliberately absent.
- Privacy copy, controller identity, retention and provider-processing terms must be approved before
  any public capture or live mode.
- Existing repository dependency advisories remain to be triaged separately; R1 does not run an
  automatic audit fix.

## Proposed R2 checkpoint

`Newsletter reintegration R2 — Server application layer and internal double opt-in`

R2 should add a typed server repository over these RPCs, request/confirmation/unsubscribe service
orchestration, persistent abuse controls, sanitized logging and integration tests against an
isolated Supabase environment. Email-provider integration and public UI should remain separate,
reviewable checkpoints.
