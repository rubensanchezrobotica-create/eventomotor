import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_CI_PROJECT_ID,
  NEWSLETTER_CI_WORKSPACE,
  NEWSLETTER_MIGRATION,
  NEWSLETTER_SQL_TESTS,
  cleanNewsletterCiWorkspace,
  prepareNewsletterCiWorkspace,
} from "./prepare-newsletter-supabase-ci.mjs";
import {
  EXPECTED_PERMISSION_SQLSTATE,
  NEWSLETTER_RPC_PERMISSION_CONTAINER,
  buildPsqlInput,
  buildRpcPermissionCases,
  extractSqlstate,
  isPostgresProcessCrash,
  runRpcPermissionValidation,
} from "../tests/newsletter/sql/newsletter-rpc-permissions.mjs";

async function createFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), "newsletter-ci-preparer-"));
  const migrationPath = join(rootDir, ...NEWSLETTER_MIGRATION.split("/"));
  const testsPath = join(rootDir, "tests", "newsletter", "sql");
  await mkdir(join(rootDir, "database", "migrations"), { recursive: true });
  await mkdir(testsPath, { recursive: true });
  await writeFile(migrationPath, "select 'newsletter migration';\n", "utf8");
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
  return { rootDir, migrationPath };
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
  assert.deepEqual(copiedFiles, ["20260721133000_newsletter_core_foundation.sql"]);
  assert.equal(result.manifest.sha256, await digest(fixture.migrationPath));
  assert.equal(await digest(join(migrationsPath, copiedFiles[0])), result.manifest.sha256);
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
  for (const sqlTest of NEWSLETTER_SQL_TESTS) {
    const source = await readFile(join(testsPath, sqlTest), "utf8");
    assert.match(source, /^begin;/i, `${sqlTest} must begin a transaction`);
    assert.match(source, /select\s+plan\(\d+\);/i, `${sqlTest} must declare a plan`);
    assert.match(source, /select\s+\*\s+from\s+finish\(\);/i, `${sqlTest} must call finish`);
    assert.match(source, /rollback;\s*$/i, `${sqlTest} must roll back`);
    assert.doesNotMatch(source, /@(?!example\.invalid)/i, `${sqlTest} must use reserved emails only`);
  }
});

test("pgTAP conserva ocho rechazos reales de tabla y ocho comprobaciones RPC de catálogo", async () => {
  const permissions = await readFile(
    join(process.cwd(), "tests", "newsletter", "sql", "newsletter_permissions.test.sql"),
    "utf8",
  );
  const throwsBlocks = [...permissions.matchAll(/select\s+throws_ok\(([\s\S]*?)\n\);/gi)].map(
    (match) => match[1],
  );

  assert.equal(throwsBlocks.length, 8);
  for (const block of throwsBlocks) {
    assert.match(
      block,
      /\$\$,\s*'42501',\s*'permission denied for table newsletter_subscribers',\s*'[^']+'\s*$/i,
    );
  }
  const catalogChecks = [
    ...permissions.matchAll(/not\s+has_function_privilege\(([\s\S]*?)\n\s*\)/gi),
  ].map((match) => match[1]);
  assert.equal(catalogChecks.length, 8);
  assert.equal(catalogChecks.filter((block) => /'anon'/i.test(block)).length, 4);
  assert.equal(catalogChecks.filter((block) => /'authenticated'/i.test(block)).length, 4);
  for (const block of catalogChecks) {
    assert.match(block, /'public\.[^']+\([^']*\)'::regprocedure/i);
    assert.match(block, /'EXECUTE'/i);
  }
  assert.match(permissions, /select\s+plan\(22\);/i);
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
  options: { input?: string; timeoutMs?: number };
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

function createPermissionExecutor(
  permissionResult: ProcessResult | ((callIndex: number) => ProcessResult),
) {
  const invocations: ProcessInvocation[] = [];
  let permissionCallIndex = 0;
  const execute = async (
    command: string,
    args: string[],
    options: ProcessInvocation["options"] = {},
  ) => {
    invocations.push({ command, args, options });
    if (args[0] === "ps") {
      return processResult({ stdout: `${NEWSLETTER_RPC_PERMISSION_CONTAINER}\n` });
    }
    if (args[0] === "inspect") return processResult({ stdout: "running|healthy\n" });
    const result =
      typeof permissionResult === "function"
        ? permissionResult(permissionCallIndex)
        : permissionResult;
    permissionCallIndex += 1;
    return result;
  };
  return { execute, invocations };
}

test("el validador externo genera ocho casos aislados para anon y authenticated", async () => {
  const cases = buildRpcPermissionCases();
  assert.equal(cases.length, 8);
  assert.equal(cases.filter(({ role }) => role === "anon").length, 4);
  assert.equal(cases.filter(({ role }) => role === "authenticated").length, 4);
  assert.deepEqual(
    cases.map(({ name }) => name),
    [
      "request-subscription",
      "confirm-subscription",
      "unsubscribe-subscriber",
      "record-provider-event",
      "request-subscription",
      "confirm-subscription",
      "unsubscribe-subscriber",
      "record-provider-event",
    ],
  );

  for (const testCase of cases) {
    const input = buildPsqlInput(testCase);
    assert.match(input, new RegExp(`set role ${testCase.role};`, "i"));
    assert.doesNotMatch(input, /throws_ok/i);
  }

  const { execute, invocations } = createPermissionExecutor(
    processResult({
      code: 3,
      stderr: "ERROR:  42501: permission denied for function fixture\n",
    }),
  );
  const output: string[] = [];
  await runRpcPermissionValidation({
    execute,
    writeOutput: (message: string) => output.push(message),
    writeError: (message: string) => output.push(message),
    pause: async () => undefined,
  });

  const psqlCalls = invocations.filter(({ args }) => args[0] === "exec");
  assert.equal(psqlCalls.length, 8);
  assert.equal(output.filter((message) => message.includes("denied-42501")).length, 8);
  for (const invocation of psqlCalls) {
    assert.equal(invocation.command, "docker");
    assert.equal(invocation.args[2], NEWSLETTER_RPC_PERMISSION_CONTAINER);
    assert.match(invocation.options.input ?? "", /set role (?:anon|authenticated);/i);
  }
});

test("el validador exige 42501 y rechaza éxito u otro SQLSTATE", async () => {
  assert.equal(EXPECTED_PERMISSION_SQLSTATE, "42501");
  assert.equal(extractSqlstate("ERROR:  42501: denied"), "42501");

  for (const permissionResult of [
    processResult({ code: 0 }),
    processResult({ code: 3, stderr: "ERROR:  42883: undefined function\n" }),
  ]) {
    const { execute } = createPermissionExecutor(permissionResult);
    await assert.rejects(
      runRpcPermissionValidation({
        execute,
        writeOutput: () => undefined,
        writeError: () => undefined,
        pause: async () => undefined,
      }),
      /permission validation failed/i,
    );
  }
});

test("un cierre de conexión se clasifica como crash, espera health y no reintenta", async () => {
  const crash = "server closed the connection unexpectedly; connection to server was lost";
  assert.equal(isPostgresProcessCrash(crash), true);
  const { execute, invocations } = createPermissionExecutor(
    processResult({ code: 2, stderr: crash }),
  );
  const errors: string[] = [];

  await assert.rejects(
    runRpcPermissionValidation({
      execute,
      writeOutput: () => undefined,
      writeError: (message: string) => errors.push(message),
      healthTimeoutMs: 10,
      pause: async () => undefined,
    }),
    /permission validation failed/i,
  );

  assert.equal(invocations.filter(({ args }) => args[0] === "exec").length, 1);
  assert.equal(errors.filter((message) => message.includes("postgres-process-crash")).length, 1);
});

test("el validador externo no contiene rutas remotas, secrets ni salida sensible", async () => {
  const source = await readFile(
    join(process.cwd(), "tests", "newsletter", "sql", "newsletter-rpc-permissions.mjs"),
    "utf8",
  );
  assert.match(source, /eventomotor-newsletter-ci/);
  assert.match(source, /name=\^\/\$\{NEWSLETTER_RPC_PERMISSION_CONTAINER\}\$/);
  assert.match(source, /--set=ON_ERROR_STOP=1/);
  assert.doesNotMatch(
    source,
    /throws_ok|\.env\.local|project[_-]?ref|supabase\s+(?:link|login)|db\s+push|--linked|supabase\s+status|process\.env|docker\s+logs|inspect[^\n]+Env/i,
  );
  assert.doesNotMatch(
    source,
    /write(?:Output|Error)\([^\n]*(?:combinedOutput|testCase\.sql|result\.(?:stderr|stdout)|input)/i,
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
  const orderedSteps = [
    "Test and prepare isolated workspace",
    "Start ephemeral PostgreSQL and apply migration",
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
    /pull_request_target|secrets\.|supabase\s+(?:link|login)|db\s+push|--linked|project[_-]?ref|\.env\.local|upload-artifact|supabase\s+status/i,
  );
});
