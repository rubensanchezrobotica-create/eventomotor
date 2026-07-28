import { randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_ID = "eventomotor-newsletter-ci";
const EXPECTED_CONTAINER = `supabase_db_${PROJECT_ID}`;
const QUERY_TIMEOUT_MS = 20_000;

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function resolveDatabaseContainer() {
  const { stdout } = await execFileAsync(
    "docker",
    ["ps", "--filter", `name=^/${EXPECTED_CONTAINER}$`, "--format", "{{.Names}}"],
    { timeout: QUERY_TIMEOUT_MS, windowsHide: true },
  );
  const names = stdout.trim().split(/\r?\n/).filter(Boolean);
  if (names.length !== 1 || names[0] !== EXPECTED_CONTAINER) {
    throw new Error("The isolated newsletter database container is unavailable.");
  }
  return names[0];
}

function query(container, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
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
      ],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.resume();

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("An isolated concurrency query timed out."));
    }, QUERY_TIMEOUT_MS);

    child.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("Unable to start an isolated concurrency query."));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error("An isolated concurrency query failed."));
        return;
      }
      resolve(stdout.trim());
    });
    child.stdin.end(`${sql.trim()}\n`);
  });
}

function fulfilledValues(results, label) {
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected) throw new Error(`${label} concurrency operation failed.`);
  return results.map((result) => result.value);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} assertion failed.`);
}

function sortedOutcomes(outputs) {
  return outputs.map((output) => output.split("|")[0]).sort().join(",");
}

const runId = randomBytes(8).toString("hex");
const requestEmail = `concurrent-request-${runId}@example.invalid`;
const providerEmail = `concurrent-provider-${runId}@example.invalid`;
const unsubscribeEmail = `concurrent-unsubscribe-${runId}@example.invalid`;
const providerName = `ci-${runId}`;

let container = "";
try {
  container = await resolveDatabaseContainer();

  const requestSql = (hashCharacter) => `
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      ${sqlLiteral(requestEmail)}, ${sqlLiteral(requestEmail)}, repeat(${sqlLiteral(hashCharacter)}, 64),
      now() + interval '1 day', 'concurrency_test', '2026-07'
    );
  `;
  const requestResults = await Promise.allSettled([
    query(container, requestSql("a")),
    query(container, requestSql("b")),
  ]);
  const requestOutputs = fulfilledValues(requestResults, "request");
  assertEqual(
    sortedOutcomes(requestOutputs),
    "confirmation_required,cooldown",
    "request outcomes",
  );
  assertEqual(
    await query(
      container,
      `select count(*) from public.newsletter_subscribers where email_normalized = ${sqlLiteral(requestEmail)};`,
    ),
    "1",
    "request subscriber count",
  );
  assertEqual(
    await query(
      container,
      `select count(*) from public.newsletter_confirmation_tokens t join public.newsletter_subscribers s on s.id = t.subscriber_id where s.email_normalized = ${sqlLiteral(requestEmail)};`,
    ),
    "1",
    "request token count",
  );

  const confirmationHash = await query(
    container,
    `select t.token_hash from public.newsletter_confirmation_tokens t join public.newsletter_subscribers s on s.id = t.subscriber_id where s.email_normalized = ${sqlLiteral(requestEmail)};`,
  );
  const confirmSql = `select outcome from public.confirm_newsletter_subscription(${sqlLiteral(confirmationHash)});`;
  const confirmationResults = await Promise.allSettled([
    query(container, confirmSql),
    query(container, confirmSql),
  ]);
  assertEqual(
    sortedOutcomes(fulfilledValues(confirmationResults, "confirmation")),
    "confirmed,used_token",
    "confirmation outcomes",
  );

  const providerSubscriberId = await query(
    container,
    `
      insert into public.newsletter_subscribers (
        email, email_normalized, status, source, consent_version, confirmed_at
      ) values (
        ${sqlLiteral(providerEmail)}, ${sqlLiteral(providerEmail)}, 'active', 'concurrency_test', '2026-07', now()
      ) returning id;
    `,
  );
  const providerSql = `
    select outcome from public.record_newsletter_provider_event(
      ${sqlLiteral(providerName)}, 'shared-event', null, ${sqlLiteral(providerSubscriberId)}::uuid,
      'delivered', false, now()
    );
  `;
  const providerResults = await Promise.allSettled([
    query(container, providerSql),
    query(container, providerSql),
  ]);
  assertEqual(
    sortedOutcomes(fulfilledValues(providerResults, "provider event")),
    "duplicate,recorded",
    "provider event outcomes",
  );
  assertEqual(
    await query(
      container,
      `select count(*) from public.newsletter_email_events where provider = ${sqlLiteral(providerName)} and provider_event_id = 'shared-event';`,
    ),
    "1",
    "provider event count",
  );

  const unsubscribeSubscriberId = await query(
    container,
    `
      with subscriber as (
        insert into public.newsletter_subscribers (
          email, email_normalized, status, source, consent_version, confirmed_at
        ) values (
          ${sqlLiteral(unsubscribeEmail)}, ${sqlLiteral(unsubscribeEmail)}, 'active', 'concurrency_test', '2026-07', now()
        ) returning id
      ), preference as (
        insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
        select id, true from subscriber
      )
      select id from subscriber;
    `,
  );
  const prepareWelcomeSql = (hashCharacter) => `
    select subscriber_id from public.prepare_newsletter_welcome_delivery(
      ${sqlLiteral(unsubscribeSubscriberId)}::uuid,
      repeat(${sqlLiteral(hashCharacter)}, 64),
      null
    );
  `;
  const preparationResults = await Promise.allSettled([
    query(container, prepareWelcomeSql("e")),
    query(container, prepareWelcomeSql("f")),
  ]);
  fulfilledValues(preparationResults, "welcome preparation");
  assertEqual(
    await query(
      container,
      `select count(*) from public.newsletter_unsubscribe_tokens where subscriber_id = ${sqlLiteral(unsubscribeSubscriberId)}::uuid and invalidated_at is null;`,
    ),
    "1",
    "active unsubscribe token count",
  );

  const activeUnsubscribeHash = await query(
    container,
    `select token_hash from public.newsletter_unsubscribe_tokens where subscriber_id = ${sqlLiteral(unsubscribeSubscriberId)}::uuid and invalidated_at is null;`,
  );
  const unsubscribeSql = `
    select outcome from public.unsubscribe_newsletter_by_token(
      ${sqlLiteral(activeUnsubscribeHash)}, '2026-07', 'concurrency_test'
    );
  `;
  const unsubscribeResults = await Promise.allSettled([
    query(container, unsubscribeSql),
    query(container, unsubscribeSql),
  ]);
  assertEqual(
    sortedOutcomes(fulfilledValues(unsubscribeResults, "unsubscribe")),
    "already_unsubscribed,unsubscribed",
    "unsubscribe outcomes",
  );
  assertEqual(
    await query(
      container,
      `select status from public.newsletter_subscribers where id = ${sqlLiteral(unsubscribeSubscriberId)}::uuid;`,
    ),
    "unsubscribed",
    "unsubscribe final state",
  );
  assertEqual(
    await query(
      container,
      `select count(*) from public.newsletter_consent_events where subscriber_id = ${sqlLiteral(unsubscribeSubscriberId)}::uuid and action = 'unsubscribed';`,
    ),
    "1",
    "unsubscribe consent event count",
  );

  process.stdout.write("Newsletter concurrency tests passed in isolated PostgreSQL.\n");
} finally {
  if (container) {
    await query(
      container,
      `
        delete from public.newsletter_email_events where provider = ${sqlLiteral(providerName)};
        delete from public.newsletter_consent_events where subscriber_id in (
          select id from public.newsletter_subscribers
          where email_normalized in (${sqlLiteral(requestEmail)}, ${sqlLiteral(providerEmail)}, ${sqlLiteral(unsubscribeEmail)})
        );
        delete from public.newsletter_confirmation_tokens where subscriber_id in (
          select id from public.newsletter_subscribers
          where email_normalized in (${sqlLiteral(requestEmail)}, ${sqlLiteral(providerEmail)}, ${sqlLiteral(unsubscribeEmail)})
        );
        delete from public.newsletter_unsubscribe_tokens where subscriber_id in (
          select id from public.newsletter_subscribers
          where email_normalized in (${sqlLiteral(requestEmail)}, ${sqlLiteral(providerEmail)}, ${sqlLiteral(unsubscribeEmail)})
        );
        delete from public.newsletter_preferences where subscriber_id in (
          select id from public.newsletter_subscribers
          where email_normalized in (${sqlLiteral(requestEmail)}, ${sqlLiteral(providerEmail)}, ${sqlLiteral(unsubscribeEmail)})
        );
        delete from public.newsletter_subscribers
        where email_normalized in (${sqlLiteral(requestEmail)}, ${sqlLiteral(providerEmail)}, ${sqlLiteral(unsubscribeEmail)});
      `,
    ).catch(() => undefined);
  }
}
