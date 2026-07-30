import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_CI_PROJECT_ID,
  NEWSLETTER_CI_WORKSPACE,
  NEWSLETTER_MIGRATIONS,
  NEWSLETTER_SQL_TESTS,
  cleanNewsletterCiWorkspace,
  prepareNewsletterCiWorkspace,
} from "./prepare-newsletter-supabase-ci.mjs";
import {
  EXPECTED_PERMISSION_HTTP_STATUS,
  EXPECTED_PERMISSION_SQLSTATE,
  NEWSLETTER_RPC_PERMISSION_CONTAINER,
  NEWSLETTER_RPC_PERMISSION_WORKDIR,
  buildRpcPermissionCases,
  parseLocalStatus,
  runRpcPermissionValidation,
  validateDataApiResponse,
} from "../tests/newsletter/sql/newsletter-rpc-permissions.mjs";
import {
  buildConcurrencyBarrierSql,
  formatConcurrencyAssertionFailure,
  formatConcurrencyFailure,
  redactConcurrencyDiagnostics,
  runConcurrencyProcess,
  waitForConcurrencyWorkers,
} from "../tests/newsletter/sql/newsletter-concurrency-harness.mjs";

async function createFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), "newsletter-ci-preparer-"));
  const migrationPaths = NEWSLETTER_MIGRATIONS.map((migration) =>
    join(rootDir, ...migration.split("/")));
  const testsPath = join(rootDir, "tests", "newsletter", "sql");
  await mkdir(join(rootDir, "database", "migrations"), { recursive: true });
  await mkdir(testsPath, { recursive: true });
  for (const [index, migrationPath] of migrationPaths.entries()) {
    await writeFile(
      migrationPath,
      `select 'newsletter migration ${index + 1}';\n`,
      "utf8",
    );
  }
  await writeFile(
    join(rootDir, "database", "migrations", "19990101000000_unrelated.sql"),
    "select 'unrelated';\n",
    "utf8",
  );
  await writeFile(join(rootDir, "database", "seed.sql"), "select 'seed';\n", "utf8");
  await writeFile(join(rootDir, ".env.local"), "PROTECTED_TEST_VALUE=unchanged\n", "utf8");
  await writeFile(join(rootDir, "protected-sentinel.txt"), "unchanged\n", "utf8");
  for (const sqlTest of NEWSLETTER_SQL_TESTS) {
    await writeFile(join(testsPath, sqlTest), `select '${sqlTest}';\n`, "utf8");
  }
  return { rootDir, migrationPaths };
}

async function digest(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

test("prepara sólo la migración newsletter y verifica una copia byte a byte", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));

  const result = await prepareNewsletterCiWorkspace({ rootDir: fixture.rootDir });
  const migrationsPath = join(result.workspacePath, "supabase", "migrations");
  const copiedFiles = await readdir(migrationsPath);
  assert.deepEqual(copiedFiles, [
    "20260721133000_newsletter_core_foundation.sql",
    "20260729120000_newsletter_launch_operations.sql",
    "20260730100000_newsletter_canary_hardening.sql",
  ]);
  assert.equal(result.manifest.migrations.length, 3);
  for (const [index, copiedFile] of copiedFiles.entries()) {
    assert.equal(
      result.manifest.migrations[index].sha256,
      await digest(fixture.migrationPaths[index]),
    );
    assert.equal(
      await digest(join(migrationsPath, copiedFile)),
      result.manifest.migrations[index].sha256,
    );
  }
});

test("no copia migraciones ajenas, seeds, .env.local ni archivos protegidos", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));

  const envBefore = await digest(join(fixture.rootDir, ".env.local"));
  const protectedBefore = await digest(join(fixture.rootDir, "protected-sentinel.txt"));
  const { workspacePath } = await prepareNewsletterCiWorkspace({ rootDir: fixture.rootDir });
  const generatedNames = await readdir(join(workspacePath, "supabase"));

  assert.deepEqual(generatedNames.sort(), ["config.toml", "migrations", "tests"]);
  assert.equal(await digest(join(fixture.rootDir, ".env.local")), envBefore);
  assert.equal(await digest(join(fixture.rootDir, "protected-sentinel.txt")), protectedBefore);
  await assert.rejects(stat(join(workspacePath, "supabase", "seed.sql")));
});

test("usa un project ID aislado y no contiene enlace o comandos remotos", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));

  const { workspacePath } = await prepareNewsletterCiWorkspace({ rootDir: fixture.rootDir });
  const config = await readFile(join(workspacePath, "supabase", "config.toml"), "utf8");
  const generatedFiles = [
    config,
    await readFile(join(workspacePath, "newsletter-ci-manifest.json"), "utf8"),
  ].join("\n");

  assert.match(config, new RegExp(`project_id = "${NEWSLETTER_CI_PROJECT_ID}"`));
  assert.match(config, /\[api\]\s+enabled = true/i);
  assert.match(config, /\[auth\]\s+enabled = true/i);
  assert.match(config, /site_url = "http:\/\/127\.0\.0\.1:54321"/i);
  assert.match(config, /\[auth\.email\][\s\S]+enable_signup = true/i);
  assert.match(config, /\[auth\.email\][\s\S]+enable_confirmations = false/i);
  assert.match(config, /\[inbucket\]\s+enabled = false/i);
  assert.doesNotMatch(config, /\[auth\.external\./i);
  assert.doesNotMatch(config, /\[auth\.email\.smtp\]/i);
  assert.doesNotMatch(generatedFiles, /project[_-]?ref|supabase\s+(?:link|login)|db\s+push|--linked/i);
});

test("la reejecución limpia sólo su workspace propio", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));

  const first = await prepareNewsletterCiWorkspace({ rootDir: fixture.rootDir });
  await writeFile(join(first.workspacePath, "stale.txt"), "remove me\n", "utf8");
  await prepareNewsletterCiWorkspace({ rootDir: fixture.rootDir });

  await assert.rejects(stat(join(first.workspacePath, "stale.txt")));
  assert.equal(await readFile(join(fixture.rootDir, "protected-sentinel.txt"), "utf8"), "unchanged\n");
  await cleanNewsletterCiWorkspace({ rootDir: fixture.rootDir });
  await assert.rejects(stat(join(fixture.rootDir, NEWSLETTER_CI_WORKSPACE)));
  assert.equal(await readFile(join(fixture.rootDir, "protected-sentinel.txt"), "utf8"), "unchanged\n");
});

test("cada test pgTAP permanente declara transacción, plan, finish y rollback", async () => {
  const testsPath = join(process.cwd(), "tests", "newsletter", "sql");
  let plannedAssertions = 0;
  for (const sqlTest of NEWSLETTER_SQL_TESTS) {
    const source = await readFile(join(testsPath, sqlTest), "utf8");
    assert.match(source, /^begin;/i, `${sqlTest} must begin a transaction`);
    const plan = source.match(/select\s+plan\((\d+)\);/i);
    assert.ok(plan, `${sqlTest} must declare a plan`);
    plannedAssertions += Number(plan[1]);
    assert.match(source, /select\s+\*\s+from\s+finish\(\);/i, `${sqlTest} must call finish`);
    assert.match(source, /rollback;\s*$/i, `${sqlTest} must roll back`);
    assert.doesNotMatch(source, /@(?!example\.invalid)/i, `${sqlTest} must use reserved emails only`);
  }
  assert.equal(plannedAssertions, 298);
});

test("la concurrencia conserva todos los escenarios y exige una rotación temporal coherente", async () => {
  const source = await readFile(
    join(process.cwd(), "tests", "newsletter", "sql", "newsletter-concurrency.mjs"),
    "utf8",
  );
  const harness = await readFile(
    join(
      process.cwd(),
      "tests",
      "newsletter",
      "sql",
      "newsletter-concurrency-harness.mjs",
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /Promise\.all(?:Settled)?/);
  assert.match(harness, /Promise\.allSettled/);
  assert.match(source, /runConcurrentScenario[\s\S]+?subscription-request-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?legacy-resubscription-repair-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?confirmation-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?provider-event-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?welcome-preparation-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?token-unsubscribe-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?webhook-replay-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?request-versus-suppression-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?purge-versus-confirmation-race/);
  assert.match(source, /runConcurrentScenario[\s\S]+?parallel-retention-purge/);
  assert.match(source, /create unlogged table public\.\$\{barrierTable\}/);
  assert.match(source, /drop table public\.\$\{barrierTable\}/);
  assert.match(harness, /insert into public\.\$\{barrierTable\}/);
  assert.match(harness, /select count\(\*\)[\s\S]+?from public\.\$\{barrierTable\}/);
  assert.match(harness, /statement_timeout = '15s'/);
  assert.match(harness, /Concurrency barrier \$\{applicationPrefix\} timed out/);
  assert.match(source, /confirmation_required,cooldown/);
  assert.match(source, /confirmed,used_token/);
  assert.match(source, /duplicate,recorded/);
  assert.match(source, /already_unsubscribed,unsubscribed/);
  assert.match(source, /unsubscribeOutputs\.length, 2/);
  assert.match(source, /first_used_at < created_at/);
  assert.match(source, /invalidated_at < created_at/);
  assert.match(source, /updated_at < created_at/);
  assert.match(source, /"1\|1\|0\|0"/);
  assert.match(source, /"1\|0\|0"/);
});

test("el harness conserva stdout, stderr, exit code, worker y comando seguros", async () => {
  await assert.rejects(
    runConcurrencyProcess({
      command: process.execPath,
      args: [
        "-e",
        "process.stdout.write('diagnostic stdout'); process.stderr.write('diagnostic stderr'); process.exit(7)",
      ],
      name: "unit-worker-failure",
      phase: "unit-diagnostics",
      workerIndex: 3,
      timeoutMs: 5_000,
    }),
    (error: Error) => {
      assert.match(error.message, /Concurrency query unit-worker-failure failed/);
      assert.match(error.message, /phase: unit-diagnostics/);
      assert.match(error.message, /worker: 3/);
      assert.match(error.message, /exit code: 7/);
      assert.match(error.message, /signal: null/);
      assert.match(error.message, /command: [^\n]*node/i);
      assert.match(error.message, /stdout:\ndiagnostic stdout/);
      assert.match(error.message, /stderr:\ndiagnostic stderr/);
      return true;
    },
  );
});

test("el harness captura ambos canales en éxito para una aserción posterior", async () => {
  const execution = await runConcurrencyProcess({
    command: process.execPath,
    args: [
      "-e",
      "process.stdout.write('successful stdout'); process.stderr.write('successful stderr')",
    ],
    name: "unit-success",
    phase: "unit-assertion",
    workerIndex: 1,
    timeoutMs: 5_000,
  });
  const message = formatConcurrencyAssertionFailure({
    label: "unit assertion",
    actual: "unexpected",
    expected: "expected",
    executions: [execution],
  });

  assert.match(message, /stdout:\nsuccessful stdout/);
  assert.match(message, /stderr:\nsuccessful stderr/);
  assert.match(message, /exit code: 0/);
  assert.match(message, /worker: 1/);
});

test("el harness redacta credenciales sin perder la causa diagnóstica", () => {
  const execution = {
    name: "redaction",
    phase: "unit-security",
    workerIndex: 0,
    command: "psql postgresql://postgres:super-secret@localhost/postgres",
    durationMs: 4,
    code: 1,
    signal: null,
    timedOut: false,
    stdout: "service_role_key=secret-value",
    stderr: "eyJhbGciOiJIUzI1NiJ9.payload.signature",
  };
  const message = formatConcurrencyFailure(execution);

  assert.doesNotMatch(message, /super-secret|secret-value|eyJhbGciOiJIUzI1NiJ9/);
  assert.match(message, /\[REDACTED\]/);
  assert.match(message, /Concurrency query redaction failed/);
  assert.equal(
    redactConcurrencyDiagnostics("password=hidden-value"),
    "password=[REDACTED]",
  );
});

test("el harness espera a todos los workers antes de propagar un rechazo", async () => {
  let secondWorkerCompleted = false;
  await assert.rejects(
    waitForConcurrencyWorkers([
      async () => {
        throw new Error("first worker failed");
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        secondWorkerCompleted = true;
        return "completed";
      },
    ]),
    /first worker failed/,
  );
  assert.equal(secondWorkerCompleted, true);
});

test("la barrera usa estado PostgreSQL observable y timeouts controlados", () => {
  const sql = buildConcurrencyBarrierSql({
    barrierTable: "newsletter_ci_barrier_unit_1",
    applicationPrefix: "newsletter-concurrency-unit-1",
    workerIndex: 0,
    workerCount: 2,
  });

  assert.match(sql, /set statement_timeout = '15s'/);
  assert.match(sql, /set lock_timeout = '10s'/);
  assert.match(
    sql,
    /insert into public\.newsletter_ci_barrier_unit_1 \(worker_index\) values \(0\)/,
  );
  assert.match(sql, /select count\(\*\)/);
  assert.match(sql, /from public\.newsletter_ci_barrier_unit_1/);
  assert.match(sql, /interval '5 seconds'/);
  assert.doesNotMatch(sql, /pg_advisory/);
});

test("provider y rollback exigen SQLSTATE mediante throws_ok de cuatro argumentos", async () => {
  const testsPath = join(process.cwd(), "tests", "newsletter", "sql");
  const provider = await readFile(join(testsPath, "newsletter_provider_events.test.sql"), "utf8");
  const rollback = await readFile(join(testsPath, "newsletter_rollback.test.sql"), "utf8");
  const throwsBlocks = (source: string) =>
    [...source.matchAll(/select\s+throws_ok\(([\s\S]*?)\n\);/gi)].map((match) => match[1]);

  const providerThrows = throwsBlocks(provider);
  assert.equal(providerThrows.length, 1);
  assert.match(
    providerThrows[0],
    /\$\$,\s*'23503',\s*null,\s*'an aggregate update failure aborts the provider RPC'\s*$/i,
  );

  const rollbackThrows = throwsBlocks(rollback);
  assert.equal(rollbackThrows.length, 5);
  assert.equal(
    rollbackThrows.filter((block) =>
      /\$\$,\s*'P0001',\s*'forced newsletter consent failure',\s*'[^']+'\s*$/i.test(block),
    ).length,
    4,
  );
  assert.equal(
    rollbackThrows.filter((block) => /\$\$,\s*'23503',\s*null,\s*'[^']+'\s*$/i.test(block))
      .length,
    1,
  );
});

test("la migración R5A.2 cualifica columnas sensibles sin ocultar conflictos", async () => {
  const migration = await readFile(
    join(
      process.cwd(),
      "database",
      "migrations",
      "20260729120000_newsletter_launch_operations.sql",
    ),
    "utf8",
  );
  const plpgsqlBodies = [
    ...migration.matchAll(/language\s+plpgsql[\s\S]*?as\s+\$\$([\s\S]*?)\$\$;/gi),
  ]
    .map((match) => match[1])
    .join("\n");
  const confirmation = migration.match(
    /create or replace function public\.confirm_newsletter_subscription[\s\S]*?\$\$;/i,
  )?.[0];

  assert.ok(confirmation);
  assert.doesNotMatch(migration, /#variable_conflict/i);
  assert.match(
    migration,
    /revoke all on table\s+public\.newsletter_suppressions,\s+public\.newsletter_webhook_receipts\s+from public, anon, authenticated, service_role;\s+[\s\S]*?grant select on table\s+public\.newsletter_suppressions,\s+public\.newsletter_webhook_receipts\s+to service_role;/i,
  );
  assert.doesNotMatch(
    plpgsqlBodies,
    /\b(?:from|update|delete\s+from)\s+public\.newsletter_[a-z_]+\s*(?:\r?\n|where\b)/i,
  );
  assert.doesNotMatch(
    plpgsqlBodies,
    /\b(?:where|and|or|order\s+by)\s+(?:not\s+)?(?:subscriber_id|status|reason|event_type|provider_message_id|suppression_kind|created_at|used_at|invalidated_at|token_hash)\b/i,
  );
  assert.doesNotMatch(
    plpgsqlBodies,
    /\b(?:coalesce|greatest)\(\s*(?:subscriber_id|status|reason|event_type|provider_message_id|suppression_kind|created_at|used_at|invalidated_at|token_hash)\b/i,
  );
  const purposeValidationIndex = confirmation.indexOf(
    "v_token.purpose <> 'subscribe'",
  );
  const suppressionLockIndex = confirmation.indexOf(
    "from public.newsletter_suppressions as nsp",
  );
  const hardSuppressionIndex = confirmation.indexOf(
    "v_suppression.reason in (",
  );
  const voluntaryLiftIndex = confirmation.indexOf(
    "update public.newsletter_suppressions as nsp",
  );
  const activationIndex = confirmation.indexOf("set status = 'active'");
  const tokenConsumptionIndex = confirmation.indexOf("set used_at = v_now");
  const confirmedConsentIndex = confirmation.indexOf(
    "v_subscriber.id, 'confirmed'",
  );

  assert.ok(purposeValidationIndex >= 0);
  assert.ok(suppressionLockIndex > purposeValidationIndex);
  assert.ok(hardSuppressionIndex > suppressionLockIndex);
  assert.ok(voluntaryLiftIndex > hardSuppressionIndex);
  assert.ok(activationIndex > voluntaryLiftIndex);
  assert.ok(tokenConsumptionIndex > activationIndex);
  assert.ok(confirmedConsentIndex > tokenConsumptionIndex);
});

test("R5A.3 repara sólo la baja heredada y conserva helpers fuera de Data API", async () => {
  const migration = await readFile(
    join(
      process.cwd(),
      "database",
      "migrations",
      "20260730100000_newsletter_canary_hardening.sql",
    ),
    "utf8",
  );

  assert.match(migration, /status <> 'unsubscribed'/);
  assert.match(
    migration,
    /insert into public\.newsletter_suppressions[\s\S]+?'voluntary'/,
  );
  assert.match(migration, /public\.newsletter_email_hash\(v_subscriber\.email_normalized\)/);
  assert.match(
    migration,
    /purpose = 'resubscribe'[\s\S]+?used_at is null[\s\S]+?invalidated_at is null/,
  );
  assert.doesNotMatch(
    migration,
    /delete from public\.newsletter_confirmation_tokens/,
  );
  assert.match(
    migration,
    /last_confirmation_requested_at = null,[\s\S]+?confirmation_request_window_started_at = null,[\s\S]+?confirmation_request_count = 0/,
  );
  assert.match(
    migration,
    /revoke all on function public\.repair_legacy_newsletter_unsubscribe\([\s\S]+?\) from public, anon, authenticated, service_role;/,
  );
  assert.match(
    migration,
    /revoke all on function public\.newsletter_request_subscription_r5a2_internal\([\s\S]+?\) from public, anon, authenticated, service_role;/,
  );
  assert.match(
    migration,
    /status in \('bounced', 'complained', 'suppressed'\)[\s\S]+?return query select 'blocked', null::uuid, null::text;[\s\S]+?repair_legacy_newsletter_unsubscribe/i,
  );
  assert.match(
    migration,
    /status = 'unsubscribed'[\s\S]+?unsubscribed_at is not null[\s\S]+?bounced_at is null[\s\S]+?complained_at is null[\s\S]+?suppressed_at is null/i,
  );
  assert.doesNotMatch(
    migration,
    /request_newsletter_subscription_r5a2\s*\(/,
  );
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.doesNotMatch(migration, /https?:\/\/|supabase (?:link|db push)|resend/i);
});

test("la baja pending materializa el outcome antes de leer el estado persistido", async () => {
  const unsubscribe = await readFile(
    join(process.cwd(), "tests", "newsletter", "sql", "newsletter_unsubscribe.test.sql"),
    "utf8",
  );
  const materialization = unsubscribe.indexOf("create temporary table pending_unsubscribe_result");
  const persistedRead = unsubscribe.indexOf("from pg_temp.pending_unsubscribe_result as result");

  assert.ok(materialization >= 0);
  assert.ok(persistedRead > materialization);
  assert.match(
    unsubscribe,
    /create temporary table pending_unsubscribe_result on commit drop as\s+select outcome\s+from public\.unsubscribe_newsletter_subscriber\([\s\S]+?\);[\s\S]+?select results_eq\([\s\S]+?select result\.outcome, subscriber\.status\s+from pg_temp\.pending_unsubscribe_result as result/i,
  );
  assert.doesNotMatch(
    unsubscribe,
    /with result as \(\s*select outcome from public\.unsubscribe_newsletter_subscriber\('20000000-0000-4000-8000-000000000002'/i,
  );
});

test("pgTAP conserva rechazos reales de tabla, RPCs y helpers sensibles", async () => {
  const permissions = await readFile(
    join(process.cwd(), "tests", "newsletter", "sql", "newsletter_permissions.test.sql"),
    "utf8",
  );
  const throwsBlocks = [...permissions.matchAll(/select\s+throws_ok\(([\s\S]*?)\n\);/gi)].map(
    (match) => match[1],
  );

  assert.equal(throwsBlocks.length, 14);
  for (const block of throwsBlocks) {
    assert.match(
      block,
      /\$\$,\s*'42501',\s*'permission denied for table newsletter_(?:subscribers|unsubscribe_tokens|suppressions|webhook_receipts)',\s*'[^']+'\s*$/i,
    );
  }
  const catalogChecks = [
    ...permissions.matchAll(
      /not\s+has_function_privilege\(\s*'(?:anon|authenticated)'([\s\S]*?)\n\s*\)/gi,
    ),
  ].map((match) => match[0]);
  assert.equal(catalogChecks.length, 20);
  assert.equal(catalogChecks.filter((block) => /'anon'/i.test(block)).length, 10);
  assert.equal(catalogChecks.filter((block) => /'authenticated'/i.test(block)).length, 10);
  for (const block of catalogChecks) {
    assert.match(block, /'public\.[^']+\([^']*\)'::regprocedure/i);
    assert.match(block, /'EXECUTE'/i);
  }
  assert.match(permissions, /public\.newsletter_email_hash\(text\)/i);
  assert.match(
    permissions,
    /public\.minimize_newsletter_subscriber\(uuid,text,timestamptz,text,uuid\)/i,
  );
  assert.match(permissions, /'service_role'[\s\S]+newsletter_email_hash/i);
  assert.match(permissions, /'service_role'[\s\S]+minimize_newsletter_subscriber/i);
  assert.match(permissions, /select\s+plan\(44\);/i);
});

type ProcessResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  timedOut: boolean;
  spawnError: boolean;
};

type ProcessInvocation = {
  command: string;
  args: string[];
  options: { timeoutMs?: number };
};

type FetchInvocation = {
  url: string;
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
};

const processResult = (overrides: Partial<ProcessResult> = {}): ProcessResult => ({
  stdout: "",
  stderr: "",
  code: 0,
  signal: null,
  timedOut: false,
  spawnError: false,
  ...overrides,
});

const LOCAL_PUBLIC_KEY = "sb_publishable_local_fixture_key_1234567890";
const LOCAL_ACCESS_TOKEN = "local-header.local-authenticated-payload.local-signature";
const LOCAL_STATUS = JSON.stringify({
  API_URL: "http://127.0.0.1:54321",
  PUBLISHABLE_KEY: LOCAL_PUBLIC_KEY,
});
const ZERO_COUNTS = {
  newsletter_subscribers: 0,
  newsletter_preferences: 0,
  newsletter_confirmation_tokens: 0,
  newsletter_unsubscribe_tokens: 0,
  newsletter_consent_events: 0,
  newsletter_email_events: 0,
  newsletter_suppressions: 0,
  newsletter_webhook_receipts: 0,
};

function createDataApiHarness({
  responseForCall,
  afterCounts = ZERO_COUNTS,
  authReachable = true,
  signupProvidesSession = true,
  loginProvidesSession = true,
  authAccessToken = LOCAL_ACCESS_TOKEN,
  localStatus = LOCAL_STATUS,
}: {
  responseForCall?: (
    callIndex: number,
    invocation: FetchInvocation,
  ) => Response | Promise<never>;
  afterCounts?: typeof ZERO_COUNTS;
  authReachable?: boolean;
  signupProvidesSession?: boolean;
  loginProvidesSession?: boolean;
  authAccessToken?: string;
  localStatus?: string;
} = {}) {
  const invocations: ProcessInvocation[] = [];
  const fetchInvocations: FetchInvocation[] = [];
  const rpcInvocations: FetchInvocation[] = [];
  let countCallIndex = 0;
  const execute = async (
    command: string,
    args: string[],
    options: ProcessInvocation["options"] = {},
  ) => {
    invocations.push({ command, args, options });
    if (command === "supabase") return processResult({ stdout: `${localStatus}\n` });
    if (args[0] === "ps") {
      return processResult({ stdout: `${NEWSLETTER_RPC_PERMISSION_CONTAINER}\n` });
    }
    if (args[0] === "inspect") return processResult({ stdout: "running|healthy\n" });
    if (args[0] === "exec") {
      const commandIndex = args.indexOf("--command");
      const sql = commandIndex >= 0 ? args[commandIndex + 1] : "";
      if (/pg_is_in_recovery/i.test(sql)) return processResult({ stdout: "ready\n" });
      if (/json_build_object/i.test(sql)) {
        const counts = countCallIndex === 0 ? ZERO_COUNTS : afterCounts;
        countCallIndex += 1;
        return processResult({ stdout: `${JSON.stringify(counts)}\n` });
      }
    }
    return processResult({ code: 1, stderr: "unexpected process invocation" });
  };

  const fetchImpl = async (input: string | URL | Request, init: RequestInit = {}) => {
    const invocation: FetchInvocation = {
      url: String(input),
      init: {
        method: init.method,
        headers: init.headers as Record<string, string>,
        body: init.body as string,
      },
    };
    fetchInvocations.push(invocation);
    if (invocation.url.endsWith("/auth/v1/health")) {
      return new Response(JSON.stringify({ name: "GoTrue" }), {
        status: authReachable ? 200 : 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (invocation.url.endsWith("/auth/v1/signup")) {
      return new Response(
        JSON.stringify(
          signupProvidesSession
            ? { access_token: authAccessToken, user: { id: "local-fixture" } }
            : { user: { id: "local-fixture" } },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (invocation.url.endsWith("/auth/v1/token?grant_type=password")) {
      return new Response(
        JSON.stringify(loginProvidesSession ? { access_token: authAccessToken } : {}),
        {
        status: 200,
        headers: { "Content-Type": "application/json" },
        },
      );
    }
    rpcInvocations.push(invocation);
    const callIndex = rpcInvocations.length - 1;
    if (responseForCall) return responseForCall(callIndex, invocation);
    const authenticated = Boolean(invocation.init.headers?.Authorization);
    return new Response(JSON.stringify({ code: "42501", message: "permission denied" }), {
      status: authenticated ? 403 : 401,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { execute, fetchImpl, invocations, fetchInvocations, rpcInvocations };
}

test("el validador Data API genera diez casos anon y diez authenticated con firmas exactas", async () => {
  const cases = buildRpcPermissionCases();
  assert.equal(cases.length, 20);
  assert.equal(cases.filter(({ role }) => role === "anon").length, 10);
  assert.equal(cases.filter(({ role }) => role === "authenticated").length, 10);
  assert.equal(cases.filter(({ expectedStatus }) => expectedStatus === 401).length, 10);
  assert.equal(cases.filter(({ expectedStatus }) => expectedStatus === 403).length, 10);
  assert.deepEqual(
    cases.map(({ rpcName }) => rpcName),
    [
      "request_newsletter_subscription",
      "confirm_newsletter_subscription",
      "prepare_newsletter_welcome_delivery",
      "unsubscribe_newsletter_subscriber",
      "unsubscribe_newsletter_by_token",
      "record_newsletter_provider_event",
      "purge_stale_newsletter_pending",
      "check_newsletter_delivery_eligibility",
      "register_newsletter_outbound_delivery",
      "process_newsletter_resend_webhook",
      "request_newsletter_subscription",
      "confirm_newsletter_subscription",
      "prepare_newsletter_welcome_delivery",
      "unsubscribe_newsletter_subscriber",
      "unsubscribe_newsletter_by_token",
      "record_newsletter_provider_event",
      "purge_stale_newsletter_pending",
      "check_newsletter_delivery_eligibility",
      "register_newsletter_outbound_delivery",
      "process_newsletter_resend_webhook",
    ],
  );
  assert.deepEqual(Object.keys(cases[0].body), [
    "p_email",
    "p_email_normalized",
    "p_token_hash",
    "p_token_expires_at",
    "p_source",
    "p_consent_version",
    "p_source_path",
    "p_source_detail",
    "p_language_code",
    "p_country_code",
    "p_province_slug",
    "p_region_slug",
    "p_ip_hash",
  ]);
  assert.deepEqual(Object.keys(cases[1].body), ["p_token_hash"]);
  assert.deepEqual(Object.keys(cases[2].body), [
    "p_subscriber_id",
    "p_token_hash",
    "p_expires_at",
  ]);
  assert.deepEqual(Object.keys(cases[3].body), [
    "p_subscriber_id",
    "p_consent_version",
    "p_source",
    "p_source_path",
    "p_ip_hash",
  ]);
  assert.deepEqual(Object.keys(cases[4].body), [
    "p_token_hash",
    "p_consent_version",
    "p_source",
    "p_source_path",
    "p_ip_hash",
  ]);
  assert.deepEqual(Object.keys(cases[5].body), [
    "p_provider",
    "p_provider_event_id",
    "p_provider_message_id",
    "p_subscriber_id",
    "p_event_type",
    "p_is_permanent",
    "p_occurred_at",
  ]);
});

test("status JSON acepta aliases auditables y no exige material JWT", () => {
  const parsed = parseLocalStatus(LOCAL_STATUS);
  assert.deepEqual(parsed, {
    apiUrl: "http://127.0.0.1:54321",
    publicKey: LOCAL_PUBLIC_KEY,
    propertyNames: ["API_URL", "PUBLISHABLE_KEY"],
  });
  assert.deepEqual(
    parseLocalStatus(
      JSON.stringify({
        SUPABASE_URL: "http://localhost:54321",
        ANON_KEY: LOCAL_PUBLIC_KEY,
      }),
    ),
    {
      apiUrl: "http://localhost:54321",
      publicKey: LOCAL_PUBLIC_KEY,
      propertyNames: ["ANON_KEY", "SUPABASE_URL"],
    },
  );
  for (const apiAlias of ["API_URL", "api_url", "SUPABASE_URL"]) {
    const parsedAlias = parseLocalStatus(
      JSON.stringify({
        [apiAlias]: "http://127.0.0.1:54321",
        ANON_KEY: LOCAL_PUBLIC_KEY,
      }),
    );
    assert.equal(parsedAlias.apiUrl, "http://127.0.0.1:54321");
  }
  for (const keyAlias of ["ANON_KEY", "anon_key", "PUBLISHABLE_KEY", "publishable_key"]) {
    const parsedAlias = parseLocalStatus(
      JSON.stringify({
        API_URL: "http://127.0.0.1:54321",
        [keyAlias]: LOCAL_PUBLIC_KEY,
      }),
    );
    assert.equal(parsedAlias.publicKey, LOCAL_PUBLIC_KEY);
  }
  assert.throws(
    () =>
      parseLocalStatus(
        JSON.stringify({
          API_URL: "https://project-ref.supabase.co",
          PUBLISHABLE_KEY: LOCAL_PUBLIC_KEY,
        }),
      ),
    /not local/i,
  );
  assert.throws(
    () => parseLocalStatus(JSON.stringify({ API_URL: "http://127.0.0.1:54321" })),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const diagnostic = (
        error as Error & {
          localStatusDiagnostic?: {
            propertyNames: string[];
            apiUrlPresent: boolean;
            publicKeyPresent: boolean;
          };
        }
      ).localStatusDiagnostic;
      assert.deepEqual(diagnostic, {
        propertyNames: ["API_URL"],
        apiUrlPresent: true,
        publicKeyPresent: false,
      });
      return true;
    },
  );
});

test("ejecuta veinte POST, exige 401/403 con 42501 y conserva recuentos", async () => {
  const { execute, fetchImpl, invocations, fetchInvocations, rpcInvocations } =
    createDataApiHarness();
  const output: string[] = [];
  const masked: string[] = [];
  await runRpcPermissionValidation({
    execute,
    fetchImpl,
    writeOutput: (message: string) => output.push(message),
    writeError: (message: string) => output.push(message),
    maskSecret: (secret: string) => masked.push(secret),
  });

  assert.equal(rpcInvocations.length, 20);
  assert.equal(fetchInvocations.length, 22);
  assert.equal(
    output.filter((message) => /denied-http-(?:401|403)-sqlstate-42501/.test(message)).length,
    20,
  );
  assert.equal(masked.length, 3);
  assert.ok(masked.includes(LOCAL_PUBLIC_KEY));
  assert.ok(masked.includes(LOCAL_ACCESS_TOKEN));
  assert.equal(rpcInvocations.filter(({ init }) => !init.headers?.Authorization).length, 10);
  assert.equal(
    rpcInvocations.filter(
      ({ init }) => init.headers?.Authorization === `Bearer ${LOCAL_ACCESS_TOKEN}`,
    )
      .length,
    10,
  );
  for (const invocation of rpcInvocations) {
    assert.equal(invocation.init.method, "POST");
    assert.equal(invocation.init.headers?.apikey, LOCAL_PUBLIC_KEY);
    assert.match(invocation.init.headers?.["Content-Type"] ?? "", /^application\/json$/i);
    assert.match(
      invocation.url,
      /^http:\/\/127\.0\.0\.1:54321\/rest\/v1\/rpc\/[a-z_]+$/,
    );
    assert.doesNotThrow(() => JSON.parse(invocation.init.body ?? ""));
  }
  const authHealth = fetchInvocations.find(({ url }) => url.endsWith("/auth/v1/health"));
  assert.equal(authHealth?.init.method, "GET");
  const signup = fetchInvocations.find(({ url }) => url.endsWith("/auth/v1/signup"));
  assert.equal(signup?.init.method, "POST");
  const signupBody = JSON.parse(signup?.init.body ?? "{}");
  assert.match(signupBody.email, /^rpc-permission-[0-9a-f-]+@example\.invalid$/i);
  assert.equal(typeof signupBody.password, "string");
  assert.ok(signupBody.password.length >= 32);
  assert.equal(
    fetchInvocations.filter(({ url }) => url.includes("/auth/v1/token?grant_type=password")).length,
    0,
  );

  const statusCalls = invocations.filter(({ command }) => command === "supabase");
  assert.equal(statusCalls.length, 1);
  assert.deepEqual(statusCalls[0].args, [
    "--workdir",
    NEWSLETTER_RPC_PERMISSION_WORKDIR,
    "status",
    "-o",
    "json",
  ]);
  const adminSql = invocations
    .filter(({ args }) => args[0] === "exec")
    .map(({ args }) => args[args.indexOf("--command") + 1]);
  assert.equal(adminSql.filter((sql) => /json_build_object/i.test(sql)).length, 2);
  assert.equal(adminSql.filter((sql) => /pg_is_in_recovery/i.test(sql)).length, 21);
  assert.equal(
    adminSql.filter((sql) => /request_newsletter_subscription|set role/i.test(sql)).length,
    0,
  );
});

test("usa login local si signup crea usuario sin devolver sesión", async () => {
  const { execute, fetchImpl, fetchInvocations, rpcInvocations } = createDataApiHarness({
    signupProvidesSession: false,
  });
  const masked: string[] = [];
  await runRpcPermissionValidation({
    execute,
    fetchImpl,
    writeOutput: () => undefined,
    writeError: () => undefined,
    maskSecret: (secret: string) => masked.push(secret),
  });

  assert.equal(rpcInvocations.length, 20);
  assert.equal(
    fetchInvocations.filter(({ url }) => url.endsWith("/auth/v1/signup")).length,
    1,
  );
  assert.equal(
    fetchInvocations.filter(({ url }) => url.endsWith("/auth/v1/token?grant_type=password")).length,
    1,
  );
  assert.ok(masked.includes(LOCAL_ACCESS_TOKEN));
});

test("diagnostica propiedades y presencia sin mostrar valores sensibles", async () => {
  const statusWithoutPublicKey = JSON.stringify({
    API_URL: "http://127.0.0.1:54321",
    GRAPHQL_URL: "http://127.0.0.1:54321/graphql/v1",
  });
  const { execute, fetchImpl, fetchInvocations } = createDataApiHarness({
    localStatus: statusWithoutPublicKey,
  });
  const errors: string[] = [];

  await assert.rejects(
    runRpcPermissionValidation({
      execute,
      fetchImpl,
      writeOutput: () => undefined,
      writeError: (message: string) => errors.push(message),
      maskSecret: () => undefined,
    }),
    /credentials are unavailable/i,
  );

  assert.equal(fetchInvocations.length, 0);
  assert.deepEqual(errors, [
    "local_status_properties=API_URL,GRAPHQL_URL\n",
    "api_url_present=true\n",
    "public_key_present=false\n",
    "auth_service_reachable=false\n",
  ]);
  assert.doesNotMatch(errors.join(""), /127\.0\.0\.1|54321|sb_|Bearer|password/i);
});

test("falla de forma segura si Auth local no está disponible", async () => {
  const { execute, fetchImpl, fetchInvocations, rpcInvocations } = createDataApiHarness({
    authReachable: false,
  });
  const errors: string[] = [];

  await assert.rejects(
    runRpcPermissionValidation({
      execute,
      fetchImpl,
      writeOutput: () => undefined,
      writeError: (message: string) => errors.push(message),
      maskSecret: () => undefined,
    }),
    /local-auth-runtime-failure/i,
  );

  assert.equal(fetchInvocations.length, 1);
  assert.equal(rpcInvocations.length, 0);
  assert.match(errors.join(""), /auth_service_reachable=false/);
  assert.doesNotMatch(errors.join(""), /127\.0\.0\.1|54321|sb_|Bearer/i);
});

test("diagnostica Auth alcanzable si no puede obtener una sesión", async () => {
  const { execute, fetchImpl, rpcInvocations } = createDataApiHarness({
    signupProvidesSession: false,
    loginProvidesSession: false,
  });
  const errors: string[] = [];

  await assert.rejects(
    runRpcPermissionValidation({
      execute,
      fetchImpl,
      writeOutput: () => undefined,
      writeError: (message: string) => errors.push(message),
      maskSecret: () => undefined,
    }),
    /local-auth-session-failure/i,
  );

  assert.equal(rpcInvocations.length, 0);
  assert.match(errors.join(""), /api_url_present=true/);
  assert.match(errors.join(""), /public_key_present=true/);
  assert.match(errors.join(""), /auth_service_reachable=true/);
  assert.doesNotMatch(errors.join(""), /127\.0\.0\.1|54321|sb_|Bearer|password/i);
});

test("no acepta la clave pública como access token de usuario", async () => {
  const { execute, fetchImpl, rpcInvocations } = createDataApiHarness({
    authAccessToken: LOCAL_PUBLIC_KEY,
  });

  await assert.rejects(
    runRpcPermissionValidation({
      execute,
      fetchImpl,
      writeOutput: () => undefined,
      writeError: () => undefined,
      maskSecret: () => undefined,
    }),
    /local-auth-session-failure/i,
  );
  assert.equal(rpcInvocations.length, 0);
});

test("rechaza 2xx, otros 4xx, PGRST, 5xx y JSON inválido", async () => {
  assert.equal(EXPECTED_PERMISSION_SQLSTATE, "42501");
  assert.deepEqual(EXPECTED_PERMISSION_HTTP_STATUS, { anon: 401, authenticated: 403 });
  const response = (status: number, body: unknown) => ({
    status,
    json: async () => body,
  });

  assert.equal(await validateDataApiResponse(response(401, { code: "42501" }), 401), null);
  assert.equal(await validateDataApiResponse(response(403, { code: "42501" }), 403), null);
  assert.equal(await validateDataApiResponse(response(200, {}), 401), "unexpected-success");
  assert.equal(
    await validateDataApiResponse(response(400, { code: "42501" }), 401),
    "unexpected-http-400",
  );
  assert.equal(
    await validateDataApiResponse(response(404, { code: "PGRST202" }), 401),
    "unexpected-http-404",
  );
  assert.equal(
    await validateDataApiResponse(response(401, { code: "PGRST202" }), 401),
    "unexpected-code-PGRST202",
  );
  assert.equal(
    await validateDataApiResponse(response(403, { code: "PGRST203" }), 403),
    "unexpected-code-PGRST203",
  );
  assert.equal(
    await validateDataApiResponse(response(500, { code: "42501" }), 401),
    "data-api-runtime-failure",
  );
  assert.equal(
    await validateDataApiResponse(
      { status: 401, json: async () => Promise.reject(new Error("invalid")) },
      401,
    ),
    "invalid-json",
  );
});

test("una desconexión se clasifica como runtime failure y no reintenta", async () => {
  const { execute, fetchImpl, rpcInvocations } = createDataApiHarness({
    responseForCall: async () => Promise.reject(new Error("connection reset")),
  });
  const errors: string[] = [];

  await assert.rejects(
    runRpcPermissionValidation({
      execute,
      fetchImpl,
      writeOutput: () => undefined,
      writeError: (message: string) => errors.push(message),
      maskSecret: () => undefined,
    }),
    /Data API permission validation failed/i,
  );

  assert.equal(rpcInvocations.length, 1);
  assert.equal(errors.filter((message) => message.includes("data-api-runtime-failure")).length, 1);
});

test("detecta cualquier efecto lateral aunque las veinte denegaciones sean correctas", async () => {
  const { execute, fetchImpl } = createDataApiHarness({
    afterCounts: { ...ZERO_COUNTS, newsletter_subscribers: 1 },
  });
  const errors: string[] = [];
  await assert.rejects(
    runRpcPermissionValidation({
      execute,
      fetchImpl,
      writeOutput: () => undefined,
      writeError: (message: string) => errors.push(message),
      maskSecret: () => undefined,
    }),
    /Data API permission validation failed/i,
  );
  assert.equal(errors.filter((message) => message.includes("unexpected-side-effect")).length, 1);
});

test("el validador externo no contiene rutas remotas, secrets ni salida sensible", async () => {
  const source = await readFile(
    join(process.cwd(), "tests", "newsletter", "sql", "newsletter-rpc-permissions.mjs"),
    "utf8",
  );
  assert.match(source, /eventomotor-newsletter-ci/);
  assert.match(source, /name=\^\/\$\{NEWSLETTER_RPC_PERMISSION_CONTAINER\}\$/);
  assert.match(source, /"status", "-o", "json"/);
  assert.match(source, /\/auth\/v1\/health/);
  assert.match(source, /\/auth\/v1\/signup/);
  assert.match(source, /\/auth\/v1\/token\?grant_type=password/);
  assert.match(source, /\/rest\/v1\/rpc\/\$\{testCase\.rpcName\}/);
  assert.match(source, /::add-mask::\$\{secret\}/);
  assert.match(source, /pg_is_in_recovery/);
  assert.match(source, /json_build_object/);
  assert.doesNotMatch(
    source,
    /throws_ok|set\s+role|buildPsqlInput|\.env\.local|project[_-]?ref|supabase\s+(?:link|login)|db\s+push|--linked|status[^\n]+-o[^\n]+env|process\.env|docker\s+logs|inspect[^\n]+Env|SERVICE_ROLE_KEY|service_role|JWT_SECRET|jwt_secret|createHmac|HS256/i,
  );
  assert.doesNotMatch(
    source,
    /write(?:Output|Error)\([^\n]*(?:credentials|authenticatedAccessToken|localPassword|testCase\.body|result\.(?:stderr|stdout)|response\.body)/i,
  );
});

test("el workflow es read-only, efímero y no contiene rutas remotas", async () => {
  const workflow = await readFile(
    join(process.cwd(), ".github", "workflows", "newsletter-database-tests.yml"),
    "utf8",
  );
  assert.match(workflow, /permissions:\s*\n\s+contents: read/i);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /supabase\/setup-cli@v3[\s\S]+version: 2\.101\.0/);
  assert.match(workflow, /docker ps -aq --filter "name=\^\/\$\{postgres_container_name\}\$"/);
  assert.match(workflow, /docker inspect --format[\s\S]+?ExitCode=[\s\S]+?OOMKilled=[\s\S]+?Health=/);
  assert.match(workflow, /docker logs --tail 300 --timestamps/);
  assert.match(workflow, /supabase --workdir "\$NEWSLETTER_CI_WORKDIR" start > \/dev\/null 2>&1/);
  const orderedSteps = [
    "Test and prepare isolated workspace",
    "Start ephemeral Data API and Auth and apply migration",
    "Run pgTAP database tests",
    "Run real concurrency tests",
    "Lint isolated newsletter schema",
    "Run isolated RPC permission validation",
    "Safe PostgreSQL failure diagnostics",
    "Stop and destroy ephemeral workspace",
  ];
  let previousIndex = -1;
  for (const step of orderedSteps) {
    const index = workflow.indexOf(`- name: ${step}`);
    assert.ok(index > previousIndex, `${step} must preserve the required workflow order`);
    previousIndex = index;
  }
  assert.doesNotMatch(
    workflow,
    /pull_request_target|secrets\.|supabase\s+(?:link|login)|db\s+(?:push|start)|--linked|project[_-]?ref|\.env\.local|upload-artifact|supabase\s+status|status[^\n]+-o[^\n]+env/i,
  );
});
