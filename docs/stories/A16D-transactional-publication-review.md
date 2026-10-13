# A16D — Transactional Story publication (review candidate)

Base: origin/main 89cfed314a92cc715468d88c407f46c1a0524d7f.
No real editorial content, media or credentials are fixtures.
This change adds no public route, publishing button or production execution.

## Cause

The old relation service claimed stories.updated_at with one REST UPDATE,
then DELETEd and INSERTed credits/events in separate HTTP transactions.
A publisher could interleave between the claim and child mutation. The media
integrity trigger read parent status without acquiring a common lock. Neither
the TypeScript check nor service_role/RLS alone closes these races.

## Protocol / lock order

- Relation RPC: Story FOR UPDATE -> referenced people FOR SHARE (UUID order)
  or events FOR KEY SHARE (ID order) -> affected child rows -> final version.
  Delete, insert and version consume belong to ONE transaction.
- Publisher: Story FOR UPDATE -> fixed Storage bucket rows FOR SHARE (ID order)
  -> referenced Storage object rows FOR SHARE -> receipt -> status/timestamp.
  It does NOT lock or update child media, credit or event rows.
- Media direct DML can already own its tuple when its BEFORE trigger runs.
  The trigger takes Story FOR UPDATE NOWAIT, NEVER a waiting inverted lock.
  Busy Story: 55P03, no save, caller reloads/retries explicitly. The caller
  must rollback a containing failed transaction/savepoint as usual.
- Every child INSERT/UPDATE/DELETE consumes a strictly increasing Story version.
  This covers metadata saves, finalization and promotion row updates.
- Unrelated Stories do not share a global advisory lock or mutex.
- Credit/event direct INSERT/UPDATE/DELETE privileges are removed from
  service_role. Legacy split batches fail closed, including zero-row DELETE.
  SELECT and atomic RPC EXECUTE remain allowed.
- PostgreSQL table owner/superuser maintenance is a privileged trust boundary,
  not an untrusted route. The guards still run; no claim is made that they
  prevent a superuser from changing code, disabling triggers or granting access.
- No reverse waiting edge is introduced by the supported single-Story paths.
  Multi-Story maintenance transactions must lock parents in ID order.
  Actual lock waits, NOWAIT and rollback are verified by two live connections,
  not inferred from timing or a Promise.all HTTP simulation.

## Publication / idempotency

publish_story(story_id, expected_updated_at, request_id) requires READY and
checks the expected version while holding the Story lock. Existing lifecycle
metadata/media/rights guards are preserved. The RPC also checks canonical
public bucket/path, derivative dimensions, object catalog presence and
EVENT_REFERENCE relationships. Receipt and PUBLISHED/clock_timestamp are one
transaction. Failed validation or SQL error rolls both back.

Only the same request_id AND same reviewed expected version can reuse a receipt.
Exact retries change neither updated_at nor published_at. A different request,
stale review, wrong state or archived retry fails closed. Direct service_role
REST publication is forbidden; no forgeable GUC enables it.

Stories published using the new receipt protocol have immutable editorial and
child snapshots, including ARCHIVED. Status/home_rank remain subject to existing
lifecycle constraints. Historical owner-operated publication/valid corrections
without an A16D receipt retain the old lifecycle contract; no existing content
is rewritten by the migration.

The new server-only service uses the existing pure editorial + byte inspection +
public-delivery readiness validator before the RPC. A changed Story/media version
between readiness and commit is rejected by PostgreSQL. No unauthenticated Server
Action or temporary ingestion API is added.

## Scope / limits

SQL can lock Storage catalog rows but cannot transact the remote object's bytes
or public HTTP delivery with a PostgreSQL COMMIT. Existing immutable-path,
no-overwrite promotion and byte/delivery checks remain necessary. Out-of-band
privileged Storage changes are not made safe by a Story row lock.

The migration does not publish any Story, create buckets or move/promote objects.
The actual 63-block draft and its 13 private photographs are never contacted by
the tests. Production state is preserved by making zero production calls/writes,
not by declaring a new live readback or authenticated visual QA.

## Deployment choreography — NOT authorized in this task

Review SQL and ephemeral evidence first. The migration removes legacy relation
write access: it must be coordinated with deployment of the new RPC repository.
If SQL is applied before code, old credit/event saves fail closed during that
window. Do not restore the split DELETE/INSERT implementation as fallback.
A separate explicit production-DDL authorization and deployment plan are required.
No production migration, main integration or production deployment is done here.

## Reproducible gates

Local mock/pure tests, tsc --noEmit --incremental false, focused ESLint, diff check.
CI Stories workflow: locked dependencies; all earlier unit/Storage/admin suites;
isolated Supabase CLI 2.101.0 workspace; 3 product migrations verified by SHA-256;
4 pgTAP suites; story-concurrency.mjs; real Storage/admin integration; DB lint;
always stop --no-backup and remove the isolated workspace.

The concurrency runner accepts only Docker container
supabase_db_eventomotor-stories-ci. No DSN, dotenv or project ref input.
The HTTP integration suites reject non-loopback Supabase endpoints.
