import { spawn } from "node:child_process";

const SENSITIVE_PATTERNS = [
  [/\b(postgres(?:ql)?):\/\/([^:\s/@]+):([^@\s/]+)@/gi, "$1://$2:[REDACTED]@"],
  [/\b(password|passwd|service_role_key|supabase_service_role_key)\s*[=:]\s*\S+/gi, "$1=[REDACTED]"],
  [/\bsb_(?:secret|service_role)_[A-Za-z0-9._-]+/g, "[REDACTED_SUPABASE_KEY]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]"],
];

export function redactConcurrencyDiagnostics(value) {
  let redacted = String(value ?? "");
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

function renderCommand(command, args) {
  return [command, ...args]
    .map((part) => (/^[A-Za-z0-9_./:=@-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(" ");
}

export function formatConcurrencyExecution(execution) {
  return [
    `query: ${execution.name}`,
    `phase: ${execution.phase}`,
    `worker: ${execution.workerIndex}`,
    `command: ${redactConcurrencyDiagnostics(execution.command)}`,
    `duration_ms: ${execution.durationMs}`,
    `exit code: ${execution.code ?? "null"}`,
    `signal: ${execution.signal ?? "null"}`,
    `timed out: ${execution.timedOut ? "true" : "false"}`,
    "stdout:",
    redactConcurrencyDiagnostics(execution.stdout),
    "stderr:",
    redactConcurrencyDiagnostics(execution.stderr),
  ].join("\n");
}

export function formatConcurrencyFailure(execution) {
  return `Concurrency query ${execution.name} failed\n${formatConcurrencyExecution(execution)}`;
}

export function formatConcurrencyAssertionFailure({
  label,
  actual,
  expected,
  executions,
}) {
  const diagnostics =
    executions.length === 0
      ? "No child-process diagnostics were captured for this assertion."
      : executions.map(formatConcurrencyExecution).join("\n\n");
  return [
    `Concurrency assertion ${label} failed`,
    `expected: ${redactConcurrencyDiagnostics(expected)}`,
    `actual: ${redactConcurrencyDiagnostics(actual)}`,
    diagnostics,
  ].join("\n");
}

export function runConcurrencyProcess({
  command,
  args,
  input = "",
  name,
  phase,
  workerIndex,
  timeoutMs,
  spawnProcess = spawn,
  now = Date.now,
}) {
  return new Promise((resolve, reject) => {
    const startedAt = now();
    let stdout = "";
    let stderr = "";
    let spawnError = null;
    let timedOut = false;
    let settled = false;
    const child = spawnProcess(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const execution = {
        name,
        phase,
        workerIndex,
        command: renderCommand(command, args),
        durationMs: Math.max(0, now() - startedAt),
        code,
        signal,
        timedOut,
        stdout,
        stderr: spawnError
          ? `${stderr}${stderr ? "\n" : ""}${spawnError.message}`
          : stderr,
      };
      if (timedOut || spawnError || code !== 0) {
        reject(
          new Error(formatConcurrencyFailure(execution), {
            cause: spawnError ?? undefined,
          }),
        );
        return;
      }
      resolve(execution);
    });

    child.stdin.on("error", (error) => {
      spawnError ??= error;
    });
    child.stdin.end(input);
  });
}

export async function waitForConcurrencyWorkers(workers) {
  const settled = await Promise.allSettled(workers.map((worker) => worker()));
  const failures = settled.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    if (failures.length === 1) throw failures[0].reason;
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      failures.map((failure) => failure.reason?.message ?? String(failure.reason)).join("\n\n"),
    );
  }
  return settled.map((result) => result.value);
}

export function buildConcurrencyBarrierSql({
  barrierTable,
  applicationPrefix,
  workerIndex,
  workerCount,
}) {
  if (!/^newsletter_ci_barrier_[a-z0-9_]+$/.test(barrierTable)) {
    throw new Error("Invalid concurrency barrier table.");
  }
  if (!/^[a-z0-9-]+$/.test(applicationPrefix)) {
    throw new Error("Invalid concurrency barrier application prefix.");
  }
  if (!Number.isInteger(workerIndex) || workerIndex < 0) {
    throw new Error("Invalid concurrency worker index.");
  }
  if (!Number.isInteger(workerCount) || workerCount < 2 || workerCount > 8) {
    throw new Error("Invalid concurrency worker count.");
  }

  const applicationName = `${applicationPrefix}-worker-${workerIndex}`;
  return `
    set statement_timeout = '15s';
    set lock_timeout = '10s';
    set application_name = ${`'${applicationName}'`};
    insert into public.${barrierTable} (worker_index) values (${workerIndex});
    do $newsletter_barrier$
    declare
      v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
    begin
      loop
        exit when (
          select count(*)
          from public.${barrierTable}
        ) >= ${workerCount};
        if pg_catalog.clock_timestamp() >= v_deadline then
          raise exception 'Concurrency barrier ${applicationPrefix} timed out';
        end if;
        perform pg_catalog.pg_sleep(0.01);
      end loop;
    end;
    $newsletter_barrier$;
  `;
}
