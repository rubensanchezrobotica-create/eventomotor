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

test("los rechazos de permisos pgTAP fijan SQLSTATE y usan cuatro argumentos", async () => {
  const permissions = await readFile(
    join(process.cwd(), "tests", "newsletter", "sql", "newsletter_permissions.test.sql"),
    "utf8",
  );
  const throwsBlocks = [...permissions.matchAll(/select\s+throws_ok\(([\s\S]*?)\n\);/gi)].map(
    (match) => match[1],
  );

  assert.equal(throwsBlocks.length, 16);
  for (const block of throwsBlocks) {
    assert.match(
      block,
      /\$\$,\s*'42501',\s*(?:'permission denied for table newsletter_subscribers'|null),\s*'[^']+'\s*$/i,
    );
  }
  assert.equal(
    throwsBlocks.filter((block) =>
      /'permission denied for table newsletter_subscribers'/i.test(block),
    ).length,
    8,
  );
  assert.equal(throwsBlocks.filter((block) => /'42501',\s*null,/i.test(block)).length, 8);
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
  assert.doesNotMatch(
    workflow,
    /pull_request_target|secrets\.|supabase\s+(?:link|login)|db\s+push|--linked|project[_-]?ref|\.env\.local|upload-artifact|supabase\s+status/i,
  );
});
