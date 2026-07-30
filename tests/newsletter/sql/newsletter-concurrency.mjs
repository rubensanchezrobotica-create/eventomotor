import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildConcurrencyBarrierSql,
  formatConcurrencyAssertionFailure,
  runConcurrencyProcess,
  waitForConcurrencyWorkers,
} from "./newsletter-concurrency-harness.mjs";

const execFileAsync = promisify(execFile);
const PROJECT_ID = "eventomotor-newsletter-ci";
const EXPECTED_CONTAINER = `supabase_db_${PROJECT_ID}`;
const QUERY_TIMEOUT_MS = 20_000;
const assertionExecutions = [];
let querySequence = 0;
let scenarioSequence = 0;

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

async function query(
  container,
  sql,
  {
    name = `query-${++querySequence}`,
    phase = "sequential-validation",
    workerIndex = 0,
    captureForAssertion = true,
  } = {},
) {
  const execution = await runConcurrencyProcess({
    command: "docker",
    args: [
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
    input: `${sql.trim()}\n`,
    name,
    phase,
    workerIndex,
    timeoutMs: QUERY_TIMEOUT_MS,
  });
  if (captureForAssertion) assertionExecutions.push(execution);
  return execution.stdout.trim();
}

function assertEqual(actual, expected, label) {
  const executions = assertionExecutions.slice(-12);
  if (actual !== expected) {
    throw new Error(
      formatConcurrencyAssertionFailure({
        label,
        actual,
        expected,
        executions,
      }),
    );
  }
}

function sortedOutcomes(outputs) {
  return outputs.map((output) => output.split("|")[0]).sort().join(",");
}

function assertIncluded(actual, expectedValues, label) {
  const executions = assertionExecutions.slice(-12);
  if (!expectedValues.includes(actual)) {
    throw new Error(
      formatConcurrencyAssertionFailure({
        label,
        actual,
        expected: expectedValues.join(" or "),
        executions,
      }),
    );
  }
}

async function runConcurrentScenario(container, runId, phase, queries) {
  const scenarioIndex = ++scenarioSequence;
  const applicationPrefix = `newsletter-concurrency-${runId}-${scenarioIndex}`;
  const barrierTable = `newsletter_ci_barrier_${runId}_${scenarioIndex}`;
  await query(
    container,
    `
      create unlogged table public.${barrierTable} (
        worker_index integer primary key
      );
    `,
    {
      name: `${phase}-barrier-setup`,
      phase: `${phase}-setup`,
      workerIndex: 0,
    },
  );
  let executions;
  let scenarioError;
  let barrierCleanupError;
  try {
    executions = await waitForConcurrencyWorkers(
      queries.map(({ name, sql }, workerIndex) => async () => {
        const barrierSql = buildConcurrencyBarrierSql({
          barrierTable,
          applicationPrefix,
          workerIndex,
          workerCount: queries.length,
        });
        return runConcurrencyProcess({
          command: "docker",
          args: [
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
          input: `${barrierSql}\n${sql.trim()}\n`,
          name,
          phase,
          workerIndex,
          timeoutMs: QUERY_TIMEOUT_MS,
        });
      }),
    );
  } catch (error) {
    scenarioError = error;
  } finally {
    try {
      await query(container, `drop table public.${barrierTable};`, {
        name: `${phase}-barrier-cleanup`,
        phase: `${phase}-cleanup`,
        workerIndex: 0,
        captureForAssertion: false,
      });
    } catch (error) {
      barrierCleanupError = error;
    }
  }

  if (scenarioError && barrierCleanupError) {
    process.stderr.write(
      `Concurrency barrier cleanup also failed; preserving the scenario failure.\n${barrierCleanupError.stack ?? barrierCleanupError}\n`,
    );
  }
  if (scenarioError) throw scenarioError;
  if (barrierCleanupError) throw barrierCleanupError;

  assertionExecutions.push(...executions);
  return executions.map((execution) => execution.stdout.trim());
}

const runId = randomBytes(8).toString("hex");
const requestEmail = `concurrent-request-${runId}@example.invalid`;
const providerEmail = `concurrent-provider-${runId}@example.invalid`;
const unsubscribeEmail = `concurrent-unsubscribe-${runId}@example.invalid`;
const webhookEmail = `concurrent-webhook-${runId}@example.invalid`;
const suppressionRaceEmail = `concurrent-suppression-${runId}@example.invalid`;
const purgeRaceEmail = `concurrent-purge-confirm-${runId}@example.invalid`;
const providerName = `ci-${runId}`;

let container = "";
let primaryError;
let cleanupError;
try {
  container = await resolveDatabaseContainer();

  const requestSql = (hashCharacter) => `
    select outcome, subscriber_id, token_purpose
    from public.request_newsletter_subscription(
      ${sqlLiteral(requestEmail)}, ${sqlLiteral(requestEmail)}, repeat(${sqlLiteral(hashCharacter)}, 64),
      now() + interval '1 day', 'concurrency_test', '2026-07'
    );
  `;
  const requestOutputs = await runConcurrentScenario(
    container,
    runId,
    "subscription-request-race",
    [
      { name: "subscription-request-a", sql: requestSql("a") },
      { name: "subscription-request-b", sql: requestSql("b") },
    ],
  );
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
  const confirmationOutputs = await runConcurrentScenario(
    container,
    runId,
    "confirmation-race",
    [
      { name: "confirmation-a", sql: confirmSql },
      { name: "confirmation-b", sql: confirmSql },
    ],
  );
  assertEqual(
    sortedOutcomes(confirmationOutputs),
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
  const providerOutputs = await runConcurrentScenario(
    container,
    runId,
    "provider-event-race",
    [
      { name: "provider-event-a", sql: providerSql },
      { name: "provider-event-b", sql: providerSql },
    ],
  );
  assertEqual(
    sortedOutcomes(providerOutputs),
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
  const preparationOutputs = await runConcurrentScenario(
    container,
    runId,
    "welcome-preparation-race",
    [
      { name: "welcome-preparation-e", sql: prepareWelcomeSql("e") },
      { name: "welcome-preparation-f", sql: prepareWelcomeSql("f") },
    ],
  );
  assertEqual(preparationOutputs.length, 2, "welcome preparation result count");
  for (const output of preparationOutputs) {
    assertEqual(output, unsubscribeSubscriberId, "welcome preparation context");
  }
  assertEqual(
    await query(
      container,
      `
        select concat(
          count(*) filter (where invalidated_at is null), '|',
          count(*) filter (where invalidated_at is not null), '|',
          count(*) filter (where invalidated_at < created_at), '|',
          count(*) filter (where updated_at < created_at)
        )
        from public.newsletter_unsubscribe_tokens
        where subscriber_id = ${sqlLiteral(unsubscribeSubscriberId)}::uuid;
      `,
    ),
    "1|1|0|0",
    "concurrent welcome token state",
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
  const unsubscribeOutputs = await runConcurrentScenario(
    container,
    runId,
    "token-unsubscribe-race",
    [
      { name: "token-unsubscribe-a", sql: unsubscribeSql },
      { name: "token-unsubscribe-b", sql: unsubscribeSql },
    ],
  );
  assertEqual(unsubscribeOutputs.length, 2, "unsubscribe result count");
  assertEqual(
    sortedOutcomes(unsubscribeOutputs),
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
  assertEqual(
    await query(
      container,
      `
        select concat(
          count(*) filter (where first_used_at is not null), '|',
          count(*) filter (where first_used_at < created_at), '|',
          count(*) filter (where updated_at < created_at)
        )
        from public.newsletter_unsubscribe_tokens
        where subscriber_id = ${sqlLiteral(unsubscribeSubscriberId)}::uuid;
      `,
    ),
    "1|0|0",
    "concurrent unsubscribe token timestamps",
  );

  const webhookSubscriberId = await query(
    container,
    `
      with subscriber as (
        insert into public.newsletter_subscribers (
          email, email_normalized, status, source, consent_version, confirmed_at
        ) values (
          ${sqlLiteral(webhookEmail)}, ${sqlLiteral(webhookEmail)},
          'active', 'concurrency_test', '2026-07', now()
        ) returning id
      ), preference as (
        insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
        select id, true from subscriber
      )
      select id from subscriber;
    `,
  );
  await query(
    container,
    `
      select outcome from public.register_newsletter_outbound_delivery(
        ${sqlLiteral(webhookSubscriberId)}::uuid,
        ${sqlLiteral(`message-${runId}`)},
        'welcome',
        now()
      );
    `,
  );
  const webhookSql = `
    select outcome from public.process_newsletter_resend_webhook(
      ${sqlLiteral(`svix-${runId}`)},
      'email.complained',
      ${sqlLiteral(`message-${runId}`)},
      now(),
      null,
      false
    );
  `;
  const webhookOutputs = await runConcurrentScenario(
    container,
    runId,
    "webhook-replay-race",
    [
      { name: "webhook-replay-a", sql: webhookSql },
      { name: "webhook-replay-b", sql: webhookSql },
    ],
  );
  assertEqual(
    sortedOutcomes(webhookOutputs),
    "duplicate,processed",
    "duplicate webhook outcomes",
  );
  assertEqual(
    await query(
      container,
      `select concat(
        (select count(*) from public.newsletter_webhook_receipts where svix_id = ${sqlLiteral(`svix-${runId}`)}),
        '|',
        (select count(*) from public.newsletter_suppressions where subscriber_id = ${sqlLiteral(webhookSubscriberId)}::uuid and reason = 'complaint' and lifted_at is null)
      );`,
    ),
    "1|1",
    "duplicate webhook persisted state",
  );

  const suppressionRaceSubscriberId = await query(
    container,
    `
      with subscriber as (
        insert into public.newsletter_subscribers (
          email, email_normalized, status, source, consent_version, confirmed_at
        ) values (
          ${sqlLiteral(suppressionRaceEmail)}, ${sqlLiteral(suppressionRaceEmail)},
          'active', 'concurrency_test', '2026-07', now()
        ) returning id
      ), preference as (
        insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
        select id, true from subscriber
      )
      select id from subscriber;
    `,
  );
  const [suppressionRequestOutput, suppressionOutput] = await runConcurrentScenario(
    container,
    runId,
    "request-versus-suppression-race",
    [
      {
        name: "request-during-suppression",
        sql: `
        select outcome from public.request_newsletter_subscription(
          ${sqlLiteral(suppressionRaceEmail)}, ${sqlLiteral(suppressionRaceEmail)},
          repeat('7', 64), now() + interval '1 day',
          'concurrency_test', '2026-07'
        );
      `,
      },
      {
        name: "voluntary-suppression",
        sql: `
        select outcome from public.unsubscribe_newsletter_subscriber(
          ${sqlLiteral(suppressionRaceSubscriberId)}::uuid,
          '2026-07',
          'concurrency_test'
        );
      `,
      },
    ],
  );
  assertIncluded(
    suppressionRequestOutput,
    ["already_active", "confirmation_required"],
    "request versus suppression outcome",
  );
  assertEqual(suppressionOutput, "unsubscribed", "request versus suppression unsubscribe");
  assertEqual(
    await query(
      container,
      `select concat(status, '|', (
        select count(*) from public.newsletter_suppressions
        where subscriber_id = ${sqlLiteral(suppressionRaceSubscriberId)}::uuid
          and reason = 'voluntary' and lifted_at is null
      )) from public.newsletter_subscribers
      where id = ${sqlLiteral(suppressionRaceSubscriberId)}::uuid;`,
    ),
    "unsubscribed|1",
    "request versus suppression final state",
  );

  const purgeTokenHash = "8".repeat(64);
  await query(
    container,
    `
      select outcome from public.request_newsletter_subscription(
        ${sqlLiteral(purgeRaceEmail)}, ${sqlLiteral(purgeRaceEmail)},
        ${sqlLiteral(purgeTokenHash)}, now() + interval '1 day',
        'concurrency_test', '2026-07'
      );
      update public.newsletter_subscribers
      set created_at = now() - interval '9 days',
          last_confirmation_requested_at = now() - interval '8 days'
      where email_normalized = ${sqlLiteral(purgeRaceEmail)};
    `,
  );
  const [purgeRaceOutput, confirmRaceOutput] = await runConcurrentScenario(
    container,
    runId,
    "purge-versus-confirmation-race",
    [
      {
        name: "pending-retention-purge",
        sql: `select purged_count from public.purge_stale_newsletter_pending(10, now() - interval '7 days');`,
      },
      {
        name: "pending-confirmation",
        sql: `select outcome from public.confirm_newsletter_subscription(${sqlLiteral(purgeTokenHash)});`,
      },
    ],
  );
  const purgeConfirmPair = `${purgeRaceOutput}|${confirmRaceOutput}`;
  assertIncluded(
    purgeConfirmPair,
    ["1|invalid_token", "0|confirmed"],
    "purge versus confirmation outcome",
  );

  const purgeEmails = Array.from(
    { length: 3 },
    (_, index) => `concurrent-purge-${runId}-${index}@example.invalid`,
  );
  for (const email of purgeEmails) {
    await query(
      container,
      `
        insert into public.newsletter_subscribers (
          email, email_normalized, status, source, consent_version,
          created_at, last_confirmation_requested_at
        ) values (
          ${sqlLiteral(email)}, ${sqlLiteral(email)}, 'pending',
          'concurrency_test', '2026-07',
          now() - interval '9 days', now() - interval '8 days'
        );
      `,
    );
  }
  const purgeOutputs = await runConcurrentScenario(
    container,
    runId,
    "parallel-retention-purge",
    [
      {
        name: "parallel-purge-a",
        sql: `select purged_count from public.purge_stale_newsletter_pending(2, now() - interval '7 days');`,
      },
      {
        name: "parallel-purge-b",
        sql: `select purged_count from public.purge_stale_newsletter_pending(2, now() - interval '7 days');`,
      },
    ],
  );
  assertEqual(
    purgeOutputs.map(Number).sort((left, right) => left - right).join(","),
    "1,2",
    "concurrent purge counts",
  );
  assertEqual(
    await query(
      container,
      `select count(*) from public.newsletter_subscribers where email_normalized in (${purgeEmails.map(sqlLiteral).join(", ")});`,
    ),
    "0",
    "concurrent purge final count",
  );

} catch (error) {
  primaryError = error;
} finally {
  if (container) {
    try {
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
        {
          name: "concurrency-fixture-cleanup",
          phase: "cleanup",
          workerIndex: 0,
          captureForAssertion: false,
        },
      );
    } catch (error) {
      cleanupError = error;
    }
  }
}

if (primaryError && cleanupError) {
  process.stderr.write(
    `Concurrency cleanup also failed; preserving the primary failure.\n${cleanupError.stack ?? cleanupError}\n`,
  );
}

if (primaryError) {
  throw primaryError;
}

if (cleanupError) {
  throw cleanupError;
}

process.stdout.write("Newsletter concurrency tests passed in isolated PostgreSQL.\n");
