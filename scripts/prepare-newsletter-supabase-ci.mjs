import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const NEWSLETTER_CI_PROJECT_ID = "eventomotor-newsletter-ci";
export const NEWSLETTER_CI_WORKSPACE = ".tmp/newsletter-supabase-ci";
export const NEWSLETTER_MIGRATIONS = [
  "database/migrations/20260721133000_newsletter_core_foundation.sql",
  "database/migrations/20260729120000_newsletter_launch_operations.sql",
];
export const NEWSLETTER_SQL_TESTS = [
  "newsletter_schema.test.sql",
  "newsletter_permissions.test.sql",
  "newsletter_subscription.test.sql",
  "newsletter_confirmation.test.sql",
  "newsletter_welcome_unsubscribe.test.sql",
  "newsletter_unsubscribe.test.sql",
  "newsletter_provider_events.test.sql",
  "newsletter_rollback.test.sql",
  "newsletter_launch_operations.test.sql",
];

const CONFIG = `project_id = "${NEWSLETTER_CI_PROJECT_ID}"

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
enabled = false

[auth]
enabled = true
site_url = "http://127.0.0.1:54321"
additional_redirect_urls = []
jwt_expiry = 3600
enable_refresh_token_rotation = true
enable_anonymous_sign_ins = false
enable_manual_linking = false

[auth.email]
enable_signup = true
double_confirm_changes = false
enable_confirmations = false
secure_password_change = false
max_frequency = "1s"

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
    throw new Error("Newsletter CI workspace path is outside the allowed repository location.");
  }
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}

async function assertRegularFile(path, label) {
  const details = await stat(path).catch(() => null);
  if (!details?.isFile()) throw new Error(`Missing ${label}.`);
}

export async function cleanNewsletterCiWorkspace({ rootDir = process.cwd() } = {}) {
  const workspacePath = resolve(rootDir, NEWSLETTER_CI_WORKSPACE);
  assertInsideRoot(rootDir, workspacePath, NEWSLETTER_CI_WORKSPACE);
  await rm(workspacePath, { recursive: true, force: true });
}

export async function prepareNewsletterCiWorkspace({ rootDir = process.cwd() } = {}) {
  const resolvedRoot = resolve(rootDir);
  const workspacePath = resolve(resolvedRoot, NEWSLETTER_CI_WORKSPACE);
  assertInsideRoot(resolvedRoot, workspacePath, NEWSLETTER_CI_WORKSPACE);

  const sourceMigrations = NEWSLETTER_MIGRATIONS.map((migration) =>
    resolve(resolvedRoot, migration));
  const sourceTests = resolve(resolvedRoot, "tests/newsletter/sql");
  for (const sourceMigration of sourceMigrations) {
    await assertRegularFile(sourceMigration, "newsletter migration");
  }
  for (const testFile of NEWSLETTER_SQL_TESTS) {
    await assertRegularFile(resolve(sourceTests, testFile), `SQL test ${testFile}`);
  }

  await cleanNewsletterCiWorkspace({ rootDir: resolvedRoot });

  const supabasePath = join(workspacePath, "supabase");
  const migrationsPath = join(supabasePath, "migrations");
  const testsPath = join(supabasePath, "tests");
  await mkdir(migrationsPath, { recursive: true });
  await mkdir(testsPath, { recursive: true });
  await writeFile(join(supabasePath, "config.toml"), CONFIG, "utf8");

  const copiedMigrations = [];
  const migrationHashes = [];
  for (const [index, migration] of NEWSLETTER_MIGRATIONS.entries()) {
    const migrationName = migration.split("/").at(-1);
    if (!migrationName) throw new Error("Newsletter migration filename is invalid.");
    const copiedMigration = join(migrationsPath, migrationName);
    await copyFile(sourceMigrations[index], copiedMigration);
    const sourceHash = await sha256(sourceMigrations[index]);
    const copiedHash = await sha256(copiedMigration);
    if (sourceHash !== copiedHash) throw new Error("Newsletter migration hash mismatch.");
    copiedMigrations.push(copiedMigration);
    migrationHashes.push({
      sourceMigration: migration,
      copiedMigration: relative(resolvedRoot, copiedMigration).split(sep).join("/"),
      sha256: sourceHash,
    });
  }

  for (const testFile of NEWSLETTER_SQL_TESTS) {
    await copyFile(join(sourceTests, testFile), join(testsPath, testFile));
  }

  const copiedMigrationNames = await readdir(migrationsPath);
  const expectedMigrationNames = NEWSLETTER_MIGRATIONS.map(
    (migration) => migration.split("/").at(-1),
  );
  if (
    copiedMigrationNames.length !== expectedMigrationNames.length ||
    copiedMigrationNames.some(
      (migrationName, index) => migrationName !== expectedMigrationNames[index],
    )
  ) {
    throw new Error("Newsletter CI workspace contains unexpected migrations.");
  }

  const manifest = {
    projectId: NEWSLETTER_CI_PROJECT_ID,
    migrations: migrationHashes,
    sqlTests: [...NEWSLETTER_SQL_TESTS],
  };
  await writeFile(
    join(workspacePath, "newsletter-ci-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return { workspacePath, manifest };
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && args[0] !== "--clean")) {
    throw new Error("Usage: node scripts/prepare-newsletter-supabase-ci.mjs [--clean]");
  }
  if (args[0] === "--clean") {
    await cleanNewsletterCiWorkspace();
    process.stdout.write("Newsletter CI workspace removed.\n");
    return;
  }
  const { manifest } = await prepareNewsletterCiWorkspace();
  process.stdout.write(
    `Newsletter CI workspace prepared; ${manifest.migrations.length} migration hashes verified.\n`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const modulePath = resolve(fileURLToPath(import.meta.url));
if (invokedPath === modulePath) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : "Newsletter CI preparation failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
