import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const NEWSLETTER_RPC_PERMISSION_PROJECT_ID = "eventomotor-newsletter-ci";
export const NEWSLETTER_RPC_PERMISSION_CONTAINER =
  `supabase_db_${NEWSLETTER_RPC_PERMISSION_PROJECT_ID}`;
export const EXPECTED_PERMISSION_SQLSTATE = "42501";

const PROCESS_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 15_000;
const HEALTH_INSPECT_TIMEOUT_MS = 5_000;
const HEALTH_POLL_MS = 500;
const CRASH_PATTERNS = [
  /server closed the connection unexpectedly/i,
  /connection to server was lost/i,
  /database system is (?:in recovery mode|not accepting connections)/i,
  /segmentation fault/i,
  /terminated by signal/i,
];

const RPCS = [
  {
    name: "request-subscription",
    sql: `select * from public.request_newsletter_subscription(
      'rpc-permission@example.invalid',
      'rpc-permission@example.invalid',
      repeat('a', 64),
      now() + interval '1 day',
      'permission_test',
      '2026-07'
    );`,
  },
  {
    name: "confirm-subscription",
    sql: "select * from public.confirm_newsletter_subscription(repeat('a', 64));",
  },
  {
    name: "unsubscribe-subscriber",
    sql: `select * from public.unsubscribe_newsletter_subscriber(
      '00000000-0000-4000-8000-000000000001'::uuid,
      '2026-07',
      'permission_test'
    );`,
  },
  {
    name: "record-provider-event",
    sql: `select * from public.record_newsletter_provider_event(
      'permission_test',
      'rpc-permission-event',
      null,
      null,
      'delivered',
      false,
      now()
    );`,
  },
];

export function buildRpcPermissionCases() {
  return ["anon", "authenticated"].flatMap((role) =>
    RPCS.map((rpc) => ({ ...rpc, role })),
  );
}

export function buildPsqlInput(testCase) {
  if (!["anon", "authenticated"].includes(testCase.role)) {
    throw new Error("Unsupported newsletter permission role.");
  }
  return `\\set VERBOSITY verbose
set role ${testCase.role};
${testCase.sql.trim()}
`;
}

export function extractSqlstate(output) {
  const match = output.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function isPostgresProcessCrash(output) {
  return CRASH_PATTERNS.some((pattern) => pattern.test(output));
}

export function runProcess(command, args, { input = "", timeoutMs = PROCESS_TIMEOUT_MS } = {}) {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveProcess({ stdout, stderr, ...result });
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish({ code: null, signal: null, timedOut: true, spawnError: false });
    }, timeoutMs);

    child.on("error", () => {
      finish({ code: null, signal: null, timedOut: false, spawnError: true });
    });
    child.on("close", (code, signal) => {
      finish({ code, signal, timedOut: false, spawnError: false });
    });
    child.stdin.end(input);
  });
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function resolveIsolatedContainer(execute) {
  const result = await execute(
    "docker",
    [
      "ps",
      "--filter",
      `name=^/${NEWSLETTER_RPC_PERMISSION_CONTAINER}$`,
      "--format",
      "{{.Names}}",
    ],
    { timeoutMs: PROCESS_TIMEOUT_MS },
  );
  const names = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (
    result.code !== 0 ||
    result.timedOut ||
    result.spawnError ||
    names.length !== 1 ||
    names[0] !== NEWSLETTER_RPC_PERMISSION_CONTAINER
  ) {
    throw new Error("Isolated PostgreSQL container is unavailable.");
  }
  return names[0];
}

async function waitForPostgresHealth(
  execute,
  container,
  { timeoutMs = HEALTH_TIMEOUT_MS, pause = wait } = {},
) {
  const deadline = Date.now() + timeoutMs;
  do {
    const result = await execute(
      "docker",
      [
        "inspect",
        "--format",
        "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
        container,
      ],
      { timeoutMs: HEALTH_INSPECT_TIMEOUT_MS },
    );
    if (result.code === 0 && result.stdout.trim() === "running|healthy") return;
    if (Date.now() >= deadline) break;
    await pause(HEALTH_POLL_MS);
  } while (Date.now() < deadline);
  throw new Error("Isolated PostgreSQL did not become healthy within the timeout.");
}

async function executePermissionCase(execute, container, testCase) {
  return execute(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--quiet",
      "--username=postgres",
      "--dbname=postgres",
    ],
    { input: buildPsqlInput(testCase), timeoutMs: PROCESS_TIMEOUT_MS },
  );
}

export async function runRpcPermissionValidation({
  execute = runProcess,
  writeOutput = (message) => {
    process.stdout.write(message);
  },
  writeError = (message) => {
    process.stderr.write(message);
  },
  healthTimeoutMs = HEALTH_TIMEOUT_MS,
  pause = wait,
} = {}) {
  const container = await resolveIsolatedContainer(execute);
  const failures = [];

  for (const testCase of buildRpcPermissionCases()) {
    const label = `${testCase.name} role=${testCase.role}`;
    try {
      await waitForPostgresHealth(execute, container, {
        timeoutMs: healthTimeoutMs,
        pause,
      });
    } catch {
      writeError(`${label} infrastructure-error\n`);
      failures.push("infrastructure-error");
      break;
    }

    const result = await executePermissionCase(execute, container, testCase);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    if (isPostgresProcessCrash(combinedOutput)) {
      writeError(`${label} postgres-process-crash\n`);
      failures.push("postgres-process-crash");
      try {
        await waitForPostgresHealth(execute, container, {
          timeoutMs: healthTimeoutMs,
          pause,
        });
      } catch {
        writeError(`${label} infrastructure-health-timeout\n`);
      }
      break;
    }

    if (result.code === 0) {
      writeError(`${label} unexpected-success\n`);
      failures.push("unexpected-success");
      continue;
    }

    if (result.timedOut || result.spawnError) {
      writeError(`${label} infrastructure-error\n`);
      failures.push("infrastructure-error");
      continue;
    }

    const sqlstate = extractSqlstate(combinedOutput);
    if (sqlstate === null) {
      writeError(`${label} infrastructure-error\n`);
      failures.push("infrastructure-error");
      continue;
    }

    if (sqlstate !== EXPECTED_PERMISSION_SQLSTATE) {
      writeError(`${label} sqlstate=${sqlstate}\n`);
      failures.push("unexpected-sqlstate");
      continue;
    }

    writeOutput(`${label} denied-${EXPECTED_PERMISSION_SQLSTATE}\n`);
  }

  if (failures.length > 0) {
    throw new Error("Newsletter RPC permission validation failed.");
  }
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  runRpcPermissionValidation().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
