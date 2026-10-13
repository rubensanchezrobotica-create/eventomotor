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

## Independent-review closure (A16D only)

The real call chain is publishStory -> createStoryPublicationService.publish ->
createSupabaseStoryMediaService.publicationReadiness -> validateStoryPublication ->
validateStoryRecord and validateContentFields. The complete original structured
content is mapped, not a reduced publication DTO. readiness.ready combines
publication.ok AND zero storage issues; it is not a caller-supplied success flag.

The new story-publication.integration.test.ts uses real loopback Supabase,
PostgreSQL and actual Sharp-generated WebP bytes. A transport observer delegates
all requests unchanged; it fabricates no responses. It calls the exported real
publishStory function and proves:
- READY plus valid media rejects unsafe links, arbitrary HTML fields, duplicate
  IDs, paragraph/body aggregate limits and total inline-node limits.
- No publish_story RPC, receipt, state or version change follows those failures.
- Valid editorial rejects incorrect byte/dimension metadata or a missing object.
- A valid 3200px derivative publishes once and exact retry reuses the receipt.
The only functional correction is aligning the SQL long-edge limit with the
existing approved STORY_MEDIA_PUBLIC_MAX_LONG_EDGE=3200. No lock, grant,
idempotency or editorial content design is changed.

The SQL suite adds effective has_table_privilege(service_role,...,'TRUNCATE')
checks and denied TRUNCATE execution on all five foundation tables plus receipts.
These statements run only in the ephemeral database. No TRUNCATE operation,
even a negative probe, is allowed in production.

### Production permission query — read-only, still pending

The current pass could not access the production SQL catalog through the
previously authorized channel. The environment reviewer rejected credential
availability probing. No alternative credential source or tool is used to bypass
that rejection. Do not infer live privileges from Git or ephemeral assertions.

Run this SELECT through an explicitly approved existing catalog channel.
Do not create a helper RPC, expose pg_catalog in REST, request secrets via chat,
or disable any transport/permission protection:

    select n.nspname as schema_name, c.relname as table_name,
           pg_catalog.has_table_privilege('service_role', c.oid, 'TRUNCATE')
             as service_role_can_truncate
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname in ('stories', 'story_media', 'editorial_people',
                       'story_credits', 'story_events',
                       'story_publication_receipts')
    order by c.relname;

Before migration: require the five foundation rows, all false. Receipts may be
absent because A16D is not applied. Afterwards: require six rows, all false.
Missing foundation tables, any true value or an unavailable read channel means
STOP; production-DDL readiness must remain NO. This query reads only privilege
metadata, not any Story, media, person or credential data.

## Exact future production sequence — PLAN ONLY

No step below is executed by this review task. A16E remains unauthorized.

1. Establish the approved catalog/administrative channels and obtain separate
   explicit authorization for the single production migration and history update.
   Record the reviewed candidate SHA, its final SQL SHA-256 and successful exact-
   SHA CI. Verify a clean release worktree, current origin/main, foundation and
   Storage history/schema. Stop on divergence/drift; never reconcile silently.

2. Schedule an editorial-write pause with the operators: no credit, event, media
   or body saves; close stale editor tabs and settle in-flight requests. Public
   reading remains available. Capture a private read-only resume checkpoint for
   the target: DRAFT, 63 blocks, 13 private media, existing credits and relations.
   Keep that checkpoint out of Git/CI. Execute the privilege SELECT above.

3. The repository stores SQL under database/migrations, NOT supabase/migrations,
   and this isolated worktree has no Supabase config/link. Prepare an approved
   release-only APPLY_WORKSPACE outside protected checkouts, using Supabase CLI
   2.101.0. Initialize its local config and copy ALL database/migrations SQL
   blobs from the exact candidate SHA into APPLY_WORKSPACE/supabase/migrations,
   preserving bytes and a filename/SHA-256 manifest. Include no seed, roles.sql,
   generated CI baseline or tests. Never reuse the Stories CI workspace for
   production. Link ONLY that release workspace to the independently verified
   project lovhbsxihpggrwnunjcz through the approved existing credential channel.
   Do not copy credentials into code or print connection strings. Run:
   supabase --workdir "$APPLY_WORKSPACE" db push --linked --dry-run
   Its pending list must contain ONLY 20261013120000. If it lists any other
   migration, STOP. Do not use --include-all, --include-seed, db reset or
   migration up. Recheck SQL hash, history, project and editorial pause
   immediately before the separately authorized:
   supabase --workdir "$APPLY_WORKSPACE" db push --linked
   The approved file's BEGIN/COMMIT protects its DDL as one transaction;
   CLI registers the migration history. Never claim success until both catalog
   and exactly-one history entry are read back. If the CLI result is ambiguous,
   read back before any retry; do not improvise a history INSERT.

4. Read-only post-check: history version 20261013120000 exactly once; receipt
   table/RLS and expected guards; three exact public RPC signatures; internal
   helper not executable by application roles; SECURITY DEFINER and empty
   search_path on RPCs; service_role EXECUTE only; direct credit/event DML denied;
   six TRUNCATE booleans false. Confirm the target checkpoint is unchanged.
   GET PostgREST OpenAPI through the authorized service channel to check the
   new RPCs are visible. A stale schema cache is a blocker, not a reason to
   invoke data writes or use old services. Any schema-cache reload requires its
   approved operational mechanism; do not change exposure/grants.

5. Only after SQL/history/RPC post-checks pass, separately authorize integration
   and deployment of the EXACT tested administrative-service SHA. Re-read
   origin/main immediately before a normal push. Fast-forward only if possible;
   otherwise STOP for review. Use a clean release worktree and preserve the
   historical checkout. Wait for automatic Vercel Production success on that
   exact SHA and verify the public domain assignment. Do not accept GitHub
   status for another SHA, a Preview build or an unverified alias as Production.

6. Guarded save smoke requires separate explicit authorization for synthetic
   administrative writes, not permission to edit the real first Story. Use one
   dedicated synthetic DRAFT (no public route, hero or publication), one approved
   existing person and approved existing event IDs. Through existing authenticated
   same-origin admin actions:
   a) Save TEXT+PHOTO for one person in ONE replacement, re-read exactly two
      pairs and a new Story version.
   b) Remove PHOTO, confirm TEXT remains and another version is consumed.
   c) Save PRIMARY+RELATED event relations in ONE replacement, re-read order.
   d) Try a stale reviewed version, confirm conflict and unchanged state.
   No legacy DELETE/INSERT HTTP fallback, manual split replace or new ingest API.
   If authorized, clean up only that identified synthetic DRAFT through the
   approved scoped administrative route; do not delete the real target or add
   a privileged temporary endpoint.

7. Publication-mechanism smoke in production is READ-ONLY: confirm private
   access/auth boundaries, RPC catalog/grants and the target is still DRAFT
   with private media, hence not publishable. The end-to-end PUBLISHED and
   idempotency proof is the ephemeral integration/CI. Do not call publishStory
   or publish_story on the real target, promote media, change READY status or
   add a publishing UI in this rollout. Wiring the future authorized publishing
   action must use publishStory and its complete gate, never a direct RPC bypass.
   Actual first publication is a separately authorized A16E step.

8. End the editorial pause only after code, RPCs and guarded-save smoke agree.
   Record source SHA, deployed SHA, SQL hash, history, privilege results and
   unchanged real-target checkpoint. Missing evidence is not PASS.

### Recovery — fail closed, never restore split writes

- SQL fails inside the transaction: investigate the error and catalog/history
  in read-only mode. No automatic rerun or unrelated migration application.
- Network/CLI result unknown: inspect exact history, objects and function/grant
  definitions. If applied but history is inconsistent, STOP for an explicitly
  authorized reconciliation. Do not rerun an already-applied CREATE migration.
- SQL succeeds but Vercel fails: maintain the editorial-write pause. The old
  service's credit/event writes must stay denied. Fix forward on an isolated
  branch with CI; do not restore direct DML grants to make old code work.
- New save smoke fails: pause writes, preserve data/guards and diagnose. No DROP,
  TRUNCATE, destructive down migration, grant weakening or automatic rollback
  to nontransactional relation writes.
- Future publication reply is ambiguous: read the existing receipt and status
  for the same request_id/reviewed version before retrying. Do not create a new
  request, regenerate timestamps or compensate by editing published rows.

Privilege inspection semantics:
https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE
Migration CLI semantics (pending-list dry-run and automatic history registration):
https://supabase.com/docs/reference/cli/supabase-db-push
