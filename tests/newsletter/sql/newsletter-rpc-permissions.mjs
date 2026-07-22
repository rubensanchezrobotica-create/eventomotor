import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const NEWSLETTER_RPC_PERMISSION_PROJECT_ID = "eventomotor-newsletter-ci";
export const NEWSLETTER_RPC_PERMISSION_CONTAINER =
  `supabase_db_${NEWSLETTER_RPC_PERMISSION_PROJECT_ID}`;
export const NEWSLETTER_RPC_PERMISSION_WORKDIR = ".tmp/newsletter-supabase-ci";
export const EXPECTED_PERMISSION_SQLSTATE = "42501";
export const EXPECTED_PERMISSION_HTTP_STATUS = Object.freeze({
  anon: 401,
  authenticated: 403,
});

const PROCESS_TIMEOUT_MS = 20_000;
const HTTP_TIMEOUT_MS = 15_000;
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);
const COUNT_TABLES = [
  "newsletter_subscribers",
  "newsletter_confirmation_tokens",
  "newsletter_consent_events",
  "newsletter_email_events",
];

const RPCS = [
  {
    name: "request-subscription",
    rpcName: "request_newsletter_subscription",
    body: {
      p_email: "rpc-permission@example.invalid",
      p_email_normalized: "rpc-permission@example.invalid",
      p_token_hash: "a".repeat(64),
      p_token_expires_at: "2099-01-01T00:00:00.000Z",
      p_source: "permission_test",
      p_consent_version: "2026-07",
      p_source_path: "/ci/newsletter-permissions",
      p_source_detail: "data-api",
      p_language_code: "es",
      p_country_code: "ES",
      p_province_slug: null,
      p_region_slug: null,
      p_ip_hash: null,
    },
  },
  {
    name: "confirm-subscription",
    rpcName: "confirm_newsletter_subscription",
    body: { p_token_hash: "b".repeat(64) },
  },
  {
    name: "unsubscribe-subscriber",
    rpcName: "unsubscribe_newsletter_subscriber",
    body: {
      p_subscriber_id: "00000000-0000-4000-8000-000000000001",
      p_consent_version: "2026-07",
      p_source: "permission_test",
      p_source_path: "/ci/newsletter-permissions",
      p_ip_hash: null,
    },
  },
  {
    name: "record-provider-event",
    rpcName: "record_newsletter_provider_event",
    body: {
      p_provider: "permission_test",
      p_provider_event_id: "rpc-permission-event",
      p_provider_message_id: "rpc-permission-message",
      p_subscriber_id: "00000000-0000-4000-8000-000000000001",
      p_event_type: "delivered",
      p_is_permanent: false,
      p_occurred_at: "2099-01-01T00:00:00.000Z",
    },
  },
];

export function buildRpcPermissionCases() {
  return ["anon", "authenticated"].flatMap((role) =>
    RPCS.map((rpc) => ({
      ...rpc,
      role,
      expectedStatus: EXPECTED_PERMISSION_HTTP_STATUS[role],
    })),
  );
}

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function createAuthenticatedJwt(jwtSecret, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof jwtSecret !== "string" || jwtSecret.length < 32) {
    throw new Error("Local JWT material is unavailable.");
  }
  const header = encodeJwtPart({ alg: "HS256", typ: "JWT" });
  const payload = encodeJwtPart({
    aud: "authenticated",
    exp: now + 300,
    iat: now,
    iss: "supabase-local",
    role: "authenticated",
    sub: "00000000-0000-4000-8000-000000000042",
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(unsignedToken)
    .digest("base64url");
  return `${unsignedToken}.${signature}`;
}

export function parseLocalStatus(output) {
  let status;
  try {
    status = JSON.parse(output);
  } catch {
    throw new Error("Local Supabase status is not valid JSON.");
  }

  const apiUrl = status.API_URL ?? status.api_url;
  const publicKey =
    status.PUBLISHABLE_KEY ??
    status.publishable_key ??
    status.ANON_KEY ??
    status.anon_key;
  const jwtSecret = status.JWT_SECRET ?? status.jwt_secret;
  if (
    typeof apiUrl !== "string" ||
    typeof publicKey !== "string" ||
    publicKey.length < 20 ||
    typeof jwtSecret !== "string" ||
    jwtSecret.length < 32
  ) {
    throw new Error("Required local Data API credentials are unavailable.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error("Local Data API URL is invalid.");
  }
  if (!LOCAL_HOSTNAMES.has(parsedUrl.hostname) || !["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Data API URL is not local.");
  }

  return {
    apiUrl: parsedUrl.href.replace(/\/$/, ""),
    publicKey,
    jwtSecret,
  };
}

export function runProcess(command, args, { timeoutMs = PROCESS_TIMEOUT_MS } = {}) {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
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
  });
}

function processSucceeded(result) {
  return result.code === 0 && !result.timedOut && !result.spawnError;
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
    !processSucceeded(result) ||
    names.length !== 1 ||
    names[0] !== NEWSLETTER_RPC_PERMISSION_CONTAINER
  ) {
    throw new Error("data-api-runtime-failure");
  }
  return names[0];
}

async function readLocalCredentials(execute) {
  const result = await execute(
    "supabase",
    ["--workdir", NEWSLETTER_RPC_PERMISSION_WORKDIR, "status", "-o", "json"],
    { timeoutMs: PROCESS_TIMEOUT_MS },
  );
  if (!processSucceeded(result)) throw new Error("data-api-runtime-failure");
  return parseLocalStatus(result.stdout);
}

function adminPsqlArgs(container, sql) {
  return [
    "exec",
    container,
    "psql",
    "-X",
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--quiet",
    "--username=postgres",
    "--dbname=postgres",
    "--command",
    sql,
  ];
}

async function executeAdminQuery(execute, container, sql) {
  const result = await execute("docker", adminPsqlArgs(container, sql), {
    timeoutMs: PROCESS_TIMEOUT_MS,
  });
  if (!processSucceeded(result)) throw new Error("data-api-runtime-failure");
  return result.stdout.trim();
}

async function assertPostgresHealthy(execute, container) {
  const inspect = await execute(
    "docker",
    [
      "inspect",
      "--format",
      "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
      container,
    ],
    { timeoutMs: PROCESS_TIMEOUT_MS },
  );
  if (!processSucceeded(inspect) || inspect.stdout.trim() !== "running|healthy") {
    throw new Error("data-api-runtime-failure");
  }
  const databaseState = await executeAdminQuery(
    execute,
    container,
    "select case when pg_is_in_recovery() then 'recovery' else 'ready' end;",
  );
  if (databaseState !== "ready") throw new Error("data-api-runtime-failure");
}

async function readProtectedCounts(execute, container) {
  const output = await executeAdminQuery(
    execute,
    container,
    `select json_build_object(
      'newsletter_subscribers', (select count(*)::integer from public.newsletter_subscribers),
      'newsletter_confirmation_tokens', (select count(*)::integer from public.newsletter_confirmation_tokens),
      'newsletter_consent_events', (select count(*)::integer from public.newsletter_consent_events),
      'newsletter_email_events', (select count(*)::integer from public.newsletter_email_events)
    )::text;`,
  );
  let counts;
  try {
    counts = JSON.parse(output);
  } catch {
    throw new Error("data-api-runtime-failure");
  }
  if (COUNT_TABLES.some((table) => !Number.isInteger(counts[table]) || counts[table] < 0)) {
    throw new Error("data-api-runtime-failure");
  }
  return counts;
}

function countsMatch(before, after) {
  return COUNT_TABLES.every((table) => before[table] === after[table]);
}

async function postRpc(fetchImpl, url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateDataApiResponse(response, expectedStatus) {
  if (response.status >= 500) return "data-api-runtime-failure";
  if (response.status >= 200 && response.status < 300) return "unexpected-success";
  if (response.status !== expectedStatus) return `unexpected-http-${response.status}`;

  let body;
  try {
    body = await response.json();
  } catch {
    return "invalid-json";
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return "invalid-json";
  if (body.code !== EXPECTED_PERMISSION_SQLSTATE) {
    const code = typeof body.code === "string" ? body.code : "missing";
    return `unexpected-code-${code}`;
  }
  return null;
}

export async function runRpcPermissionValidation({
  execute = runProcess,
  fetchImpl = globalThis.fetch,
  writeOutput = (message) => {
    process.stdout.write(message);
  },
  writeError = (message) => {
    process.stderr.write(message);
  },
  maskSecret = (secret) => {
    process.stdout.write(`::add-mask::${secret}\n`);
  },
  httpTimeoutMs = HTTP_TIMEOUT_MS,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("data-api-runtime-failure");

  const container = await resolveIsolatedContainer(execute);
  let credentials = await readLocalCredentials(execute);
  maskSecret(credentials.publicKey);
  maskSecret(credentials.jwtSecret);
  let authenticatedJwt = createAuthenticatedJwt(credentials.jwtSecret, { now });
  maskSecret(authenticatedJwt);

  const failures = [];
  let stopForRuntimeFailure = false;
  let beforeCounts;

  try {
    await assertPostgresHealthy(execute, container);
    beforeCounts = await readProtectedCounts(execute, container);

    for (const testCase of buildRpcPermissionCases()) {
      const label = `${testCase.name} role=${testCase.role}`;
      const headers = {
        apikey: credentials.publicKey,
        "Content-Type": "application/json",
      };
      if (testCase.role === "authenticated") {
        headers.Authorization = `Bearer ${authenticatedJwt}`;
      }

      let response;
      try {
        response = await postRpc(
          fetchImpl,
          `${credentials.apiUrl}/rest/v1/rpc/${testCase.rpcName}`,
          headers,
          testCase.body,
          httpTimeoutMs,
        );
      } catch {
        writeError(`${label} data-api-runtime-failure\n`);
        failures.push("data-api-runtime-failure");
        stopForRuntimeFailure = true;
      }

      try {
        await assertPostgresHealthy(execute, container);
      } catch {
        writeError(`${label} data-api-runtime-failure\n`);
        failures.push("data-api-runtime-failure");
        stopForRuntimeFailure = true;
      }
      if (stopForRuntimeFailure) break;

      const responseFailure = await validateDataApiResponse(response, testCase.expectedStatus);
      if (responseFailure) {
        writeError(`${label} ${responseFailure}\n`);
        failures.push(responseFailure);
        if (responseFailure === "data-api-runtime-failure") break;
        continue;
      }
      writeOutput(
        `${label} denied-http-${testCase.expectedStatus}-sqlstate-${EXPECTED_PERMISSION_SQLSTATE}\n`,
      );
    }

    const afterCounts = await readProtectedCounts(execute, container);
    if (!countsMatch(beforeCounts, afterCounts)) {
      writeError("newsletter-permission-fixtures unexpected-side-effect\n");
      failures.push("unexpected-side-effect");
    }
  } finally {
    credentials.publicKey = "";
    credentials.jwtSecret = "";
    authenticatedJwt = "";
    credentials = null;
  }

  if (failures.length > 0) {
    throw new Error("Newsletter RPC Data API permission validation failed.");
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
