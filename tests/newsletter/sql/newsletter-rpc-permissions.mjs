import { randomBytes, randomUUID } from "node:crypto";
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
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const API_URL_ALIASES = ["API_URL", "api_url", "SUPABASE_URL"];
const PUBLIC_KEY_ALIASES = [
  "ANON_KEY",
  "anon_key",
  "PUBLISHABLE_KEY",
  "publishable_key",
];
const COUNT_TABLES = [
  "newsletter_subscribers",
  "newsletter_confirmation_tokens",
  "newsletter_unsubscribe_tokens",
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
    name: "prepare-welcome",
    rpcName: "prepare_newsletter_welcome_delivery",
    body: {
      p_subscriber_id: "00000000-0000-4000-8000-000000000001",
      p_token_hash: "c".repeat(64),
      p_expires_at: null,
    },
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
    name: "unsubscribe-by-token",
    rpcName: "unsubscribe_newsletter_by_token",
    body: {
      p_token_hash: "d".repeat(64),
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

function firstStringProperty(status, aliases) {
  for (const alias of aliases) {
    const value = status[alias];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function safePropertyNames(status) {
  return Object.keys(status)
    .filter((name) => /^[A-Za-z0-9_]{1,80}$/.test(name))
    .sort();
}

function localStatusError(message, diagnostic) {
  const error = new Error(message);
  error.localStatusDiagnostic = diagnostic;
  return error;
}

export function parseLocalStatus(output) {
  let status;
  try {
    status = JSON.parse(output);
  } catch {
    throw new Error("Local Supabase status is not valid JSON.");
  }

  if (!status || typeof status !== "object" || Array.isArray(status)) {
    throw new Error("Local Supabase status must be a JSON object.");
  }

  const propertyNames = safePropertyNames(status);
  const apiUrl = firstStringProperty(status, API_URL_ALIASES);
  const publicKey = firstStringProperty(status, PUBLIC_KEY_ALIASES);
  const diagnostic = {
    propertyNames,
    apiUrlPresent: Boolean(apiUrl),
    publicKeyPresent: Boolean(publicKey),
  };
  if (!apiUrl || !publicKey) {
    throw localStatusError("Required local Data API credentials are unavailable.", diagnostic);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw localStatusError("Local Data API URL is invalid.", diagnostic);
  }
  if (!LOCAL_HOSTNAMES.has(parsedUrl.hostname) || !["http:", "https:"].includes(parsedUrl.protocol)) {
    throw localStatusError("Data API URL is not local.", diagnostic);
  }

  return {
    apiUrl: parsedUrl.href.replace(/\/$/, ""),
    publicKey,
    propertyNames,
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
      'newsletter_unsubscribe_tokens', (select count(*)::integer from public.newsletter_unsubscribe_tokens),
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

function writeCredentialDiagnostic(
  writeError,
  {
    propertyNames = [],
    apiUrlPresent = false,
    publicKeyPresent = false,
    authServiceReachable = false,
  } = {},
) {
  writeError(`local_status_properties=${propertyNames.join(",") || "none"}\n`);
  writeError(`api_url_present=${apiUrlPresent}\n`);
  writeError(`public_key_present=${publicKeyPresent}\n`);
  writeError(`auth_service_reachable=${authServiceReachable}\n`);
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function assertLocalAuthReachable(fetchImpl, credentials, timeoutMs) {
  let response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      `${credentials.apiUrl}/auth/v1/health`,
      {
        method: "GET",
        headers: { apikey: credentials.publicKey },
      },
      timeoutMs,
    );
  } catch {
    throw new Error("local-auth-runtime-failure");
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error("local-auth-runtime-failure");
  }
}

async function readAuthAccessToken(response) {
  if (response.status >= 500) throw new Error("local-auth-runtime-failure");
  if (response.status < 200 || response.status >= 300) {
    throw new Error("local-auth-session-failure");
  }
  try {
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("local-auth-session-failure");
    }
    return typeof body.access_token === "string" ? body.access_token : null;
  } catch (error) {
    if (error instanceof Error && error.message === "local-auth-session-failure") throw error;
    throw new Error("local-auth-session-failure");
  }
}

function isAuthenticatedAccessToken(token, publicKey) {
  return (
    typeof token === "string" &&
    token.length >= 20 &&
    token !== publicKey &&
    token.split(".").length === 3 &&
    token.split(".").every(Boolean)
  );
}

async function requestLocalAuthSession(fetchImpl, credentials, password, timeoutMs) {
  const email = `rpc-permission-${randomUUID()}@example.invalid`;
  const headers = {
    apikey: credentials.publicKey,
    "Content-Type": "application/json",
  };
  let signupResponse;
  try {
    signupResponse = await fetchWithTimeout(
      fetchImpl,
      `${credentials.apiUrl}/auth/v1/signup`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password }),
      },
      timeoutMs,
    );
  } catch {
    throw new Error("local-auth-runtime-failure");
  }

  const signupAccessToken = await readAuthAccessToken(signupResponse);
  if (signupAccessToken) {
    if (!isAuthenticatedAccessToken(signupAccessToken, credentials.publicKey)) {
      throw new Error("local-auth-session-failure");
    }
    return signupAccessToken;
  }

  let loginResponse;
  try {
    loginResponse = await fetchWithTimeout(
      fetchImpl,
      `${credentials.apiUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password }),
      },
      timeoutMs,
    );
  } catch {
    throw new Error("local-auth-runtime-failure");
  }
  const loginAccessToken = await readAuthAccessToken(loginResponse);
  if (!isAuthenticatedAccessToken(loginAccessToken, credentials.publicKey)) {
    throw new Error("local-auth-session-failure");
  }
  return loginAccessToken;
}

async function postRpc(fetchImpl, url, headers, body, timeoutMs) {
  return fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
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
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("data-api-runtime-failure");

  const container = await resolveIsolatedContainer(execute);
  const failures = [];
  let stopForRuntimeFailure = false;
  let beforeCounts;
  let credentials = null;
  let authenticatedAccessToken = "";
  let localPassword = "";
  let statusDiagnostic = {
    propertyNames: [],
    apiUrlPresent: false,
    publicKeyPresent: false,
    authServiceReachable: false,
  };

  try {
    try {
      credentials = await readLocalCredentials(execute);
      statusDiagnostic = {
        propertyNames: credentials.propertyNames,
        apiUrlPresent: true,
        publicKeyPresent: true,
        authServiceReachable: false,
      };
    } catch (error) {
      const diagnostic =
        error && typeof error === "object" && error.localStatusDiagnostic
          ? error.localStatusDiagnostic
          : statusDiagnostic;
      writeCredentialDiagnostic(writeError, diagnostic);
      throw error;
    }

    maskSecret(credentials.publicKey);
    try {
      await assertLocalAuthReachable(fetchImpl, credentials, httpTimeoutMs);
      statusDiagnostic.authServiceReachable = true;
    } catch (error) {
      writeCredentialDiagnostic(writeError, statusDiagnostic);
      throw error;
    }

    localPassword = `${randomBytes(32).toString("base64url")}Aa1!`;
    maskSecret(localPassword);
    try {
      authenticatedAccessToken = await requestLocalAuthSession(
        fetchImpl,
        credentials,
        localPassword,
        httpTimeoutMs,
      );
    } catch (error) {
      writeCredentialDiagnostic(writeError, statusDiagnostic);
      throw error;
    }
    maskSecret(authenticatedAccessToken);

    await assertPostgresHealthy(execute, container);
    beforeCounts = await readProtectedCounts(execute, container);

    for (const testCase of buildRpcPermissionCases()) {
      const label = `${testCase.name} role=${testCase.role}`;
      const headers = {
        apikey: credentials.publicKey,
        "Content-Type": "application/json",
      };
      if (testCase.role === "authenticated") {
        headers.Authorization = `Bearer ${authenticatedAccessToken}`;
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
    if (credentials) credentials.publicKey = "";
    authenticatedAccessToken = "";
    localPassword = "";
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
