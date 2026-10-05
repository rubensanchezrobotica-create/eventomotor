import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const STORIES_CI_PROJECT_ID = "eventomotor-stories-ci";
export const STORIES_CI_WORKSPACE = ".tmp/stories-supabase-ci";
export const STORIES_BASE_SCHEMA = "database/schema.sql";
export const STORIES_MIGRATION =
  "database/migrations/20260929120000_stories_foundation.sql";
export const STORIES_STORAGE_MIGRATION =
  "database/migrations/20261005120000_story_media_storage.sql";
export const STORIES_SQL_TESTS = [
  "stories_foundation.test.sql",
  "story_publication_gate.test.sql",
  "story_media_storage.test.sql",
];

const BASELINE_MIGRATION_NAME =
  "20260929110000_stories_ci_events_baseline.sql";

const CONFIG = `project_id = "${STORIES_CI_PROJECT_ID}"

[api]
enabled = true

[db]
port = 54322
shadow_port = 54320

[db.seed]
enabled = false

[realtime]
enabled = false

[studio]
enabled = false

[inbucket]
enabled = false

[storage]
enabled = true

[auth]
enabled = true
site_url = "http://127.0.0.1:54321"
additional_redirect_urls = []
enable_refresh_token_rotation = true
enable_anonymous_sign_ins = false
enable_manual_linking = false

[auth.email]
enable_signup = false
double_confirm_changes = false
enable_confirmations = false
secure_password_change = false

[edge_runtime]
enabled = false

[analytics]
enabled = false
`;

function assertInsideRoot(rootDir, target, expectedRelativePath) {
  const resolvedRoot = resolve(rootDir);
  const resolvedTarget = resolve(target);
  const expectedTarget = resolve(resolvedRoot, expectedRelativePath);
  if (
    resolvedTarget !== expectedTarget ||
    resolvedTarget === resolvedRoot ||
    !resolvedTarget.startsWith(`${resolvedRoot}${sep}`)
  ) {
    throw new Error("Stories CI workspace path is outside the allowed repository location.");
  }
}

function extractCreateTable(schemaSql, tableName) {
  const marker = `create table if not exists public.${tableName} (`;
  const start = schemaSql.indexOf(marker);
  if (start < 0) throw new Error(`Missing public.${tableName} in base schema.`);

  const end = schemaSql.indexOf("\n);", start);
  if (end < 0) throw new Error(`Unterminated public.${tableName} definition.`);

  return schemaSql.slice(start, end + 3);
}

function buildEventsBaseline(schemaSql) {
  const pgcrypto = schemaSql.match(
    /^create extension if not exists pgcrypto;$/m,
  )?.[0];
  if (!pgcrypto) throw new Error("Missing pgcrypto declaration in base schema.");

  const eventSources = extractCreateTable(schemaSql, "event_sources");
  const events = extractCreateTable(schemaSql, "events");

  if (!/^\s*id text primary key,/m.test(events)) {
    throw new Error("public.events.id is not the required text primary key.");
  }
  if (!/^\s*title text not null,/m.test(events)) {
    throw new Error("public.events.title contract is missing.");
  }
  if (!/^\s*start_date date not null,/m.test(events)) {
    throw new Error("public.events.start_date contract is missing.");
  }
  if (!/references public\.event_sources\(id\) on delete set null/.test(events)) {
    throw new Error("public.events source dependency is not the expected contract.");
  }

  return [
    "-- Generated from database/schema.sql for isolated Stories CI only.",
    "-- Contains no production data and no unrelated legacy migrations.",
    pgcrypto,
    eventSources,
    events,
    "",
  ].join("\n\n");
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}

async function assertRegularFile(path, label) {
  const details = await stat(path).catch(() => null);
  if (!details?.isFile()) throw new Error(`Missing ${label}.`);
}

export async function cleanStoriesCiWorkspace({ rootDir = process.cwd() } = {}) {
  const workspacePath = resolve(rootDir, STORIES_CI_WORKSPACE);
  assertInsideRoot(rootDir, workspacePath, STORIES_CI_WORKSPACE);
  await rm(workspacePath, { recursive: true, force: true });
}

export async function prepareStoriesCiWorkspace({ rootDir = process.cwd() } = {}) {
  const resolvedRoot = resolve(rootDir);
  const workspacePath = resolve(resolvedRoot, STORIES_CI_WORKSPACE);
  assertInsideRoot(resolvedRoot, workspacePath, STORIES_CI_WORKSPACE);

  const sourceSchema = resolve(resolvedRoot, STORIES_BASE_SCHEMA);
  const sourceMigration = resolve(resolvedRoot, STORIES_MIGRATION);
  const sourceStorageMigration = resolve(resolvedRoot, STORIES_STORAGE_MIGRATION);
  const sourceTests = resolve(resolvedRoot, "tests/stories/sql");

  await assertRegularFile(sourceSchema, "Stories base schema");
  await assertRegularFile(sourceMigration, "Stories migration");
  await assertRegularFile(sourceStorageMigration, "Stories Storage migration");
  for (const testFile of STORIES_SQL_TESTS) {
    await assertRegularFile(resolve(sourceTests, testFile), `SQL test ${testFile}`);
  }

  const schemaSql = await readFile(sourceSchema, "utf8");
  const baselineSql = buildEventsBaseline(schemaSql);

  await cleanStoriesCiWorkspace({ rootDir: resolvedRoot });

  const supabasePath = join(workspacePath, "supabase");
  const migrationsPath = join(supabasePath, "migrations");
  const testsPath = join(supabasePath, "tests");
  await mkdir(migrationsPath, { recursive: true });
  await mkdir(testsPath, { recursive: true });
  await writeFile(join(supabasePath, "config.toml"), CONFIG, "utf8");

  const baselinePath = join(migrationsPath, BASELINE_MIGRATION_NAME);
  await writeFile(baselinePath, baselineSql, "utf8");

  const migrationName = STORIES_MIGRATION.split("/").at(-1);
  if (!migrationName) throw new Error("Stories migration filename is invalid.");
  const copiedMigration = join(migrationsPath, migrationName);
  await copyFile(sourceMigration, copiedMigration);

  const sourceMigrationHash = await sha256(sourceMigration);
  const copiedMigrationHash = await sha256(copiedMigration);
  if (sourceMigrationHash !== copiedMigrationHash) {
    throw new Error("Stories migration hash mismatch.");
  }

  const storageMigrationName = STORIES_STORAGE_MIGRATION.split("/").at(-1);
  if (!storageMigrationName) throw new Error("Stories Storage migration filename is invalid.");
  const copiedStorageMigration = join(migrationsPath, storageMigrationName);
  await copyFile(sourceStorageMigration, copiedStorageMigration);
  const sourceStorageMigrationHash = await sha256(sourceStorageMigration);
  const copiedStorageMigrationHash = await sha256(copiedStorageMigration);
  if (sourceStorageMigrationHash !== copiedStorageMigrationHash) {
    throw new Error("Stories Storage migration hash mismatch.");
  }

  for (const testFile of STORIES_SQL_TESTS) {
    await copyFile(join(sourceTests, testFile), join(testsPath, testFile));
  }

  const copiedMigrationNames = (await readdir(migrationsPath)).sort();
  const expectedMigrationNames = [
    BASELINE_MIGRATION_NAME,
    migrationName,
    storageMigrationName,
  ];
  if (
    copiedMigrationNames.length !== expectedMigrationNames.length ||
    copiedMigrationNames.some(
      (copiedName, index) => copiedName !== expectedMigrationNames[index],
    )
  ) {
    throw new Error("Stories CI workspace contains unexpected migrations.");
  }

  const copiedTestNames = (await readdir(testsPath)).sort();
  const expectedTestNames = [...STORIES_SQL_TESTS].sort();
  if (
    copiedTestNames.length !== expectedTestNames.length ||
    copiedTestNames.some(
      (copiedName, index) => copiedName !== expectedTestNames[index],
    )
  ) {
    throw new Error("Stories CI workspace contains unexpected SQL tests.");
  }

  const manifest = {
    projectId: STORIES_CI_PROJECT_ID,
    baseSchema: STORIES_BASE_SCHEMA,
    baseSchemaSha256: await sha256(sourceSchema),
    generatedBaseline: relative(resolvedRoot, baselinePath).split(sep).join("/"),
    generatedBaselineSha256: await sha256(baselinePath),
    migration: STORIES_MIGRATION,
    migrationSha256: sourceMigrationHash,
    storageMigration: STORIES_STORAGE_MIGRATION,
    storageMigrationSha256: sourceStorageMigrationHash,
    sqlTests: [...STORIES_SQL_TESTS],
  };

  await writeFile(
    join(workspacePath, "stories-ci-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return { workspacePath, manifest };
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && args[0] !== "--clean")) {
    throw new Error("Usage: node scripts/prepare-stories-supabase-ci.mjs [--clean]");
  }

  if (args[0] === "--clean") {
    await cleanStoriesCiWorkspace();
    process.stdout.write("Stories CI workspace removed.\n");
    return;
  }

  const { manifest } = await prepareStoriesCiWorkspace();
  process.stdout.write(
    `Stories CI workspace prepared; ${manifest.sqlTests.length} SQL suites and two product migrations verified.\n`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const modulePath = resolve(fileURLToPath(import.meta.url));
if (invokedPath === modulePath) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : "Stories CI preparation failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
