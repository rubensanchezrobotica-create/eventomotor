import { createHash, randomBytes, randomUUID } from "node:crypto";
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

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function tokenHash(runId, workerIndex) {
  return createHash("sha256")
    .update(`newsletter-edition-02:${runId}:claim:${workerIndex}`, "utf8")
    .digest("hex");
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

async function query(container, sql, name = `edition02-query-${++querySequence}`) {
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
    phase: "edition-02-validation",
    workerIndex: 0,
    timeoutMs: QUERY_TIMEOUT_MS,
  });
  assertionExecutions.push(execution);
  return execution.stdout.trim();
}

function assertEqual(actual, expected, label) {
  if (actual === expected) return;
  throw new Error(
    formatConcurrencyAssertionFailure({
      label,
      actual,
      expected,
      executions: assertionExecutions.slice(-12),
    }),
  );
}

function assertOneOf(actual, expectedValues, label) {
  if (expectedValues.includes(actual)) return;
  throw new Error(
    formatConcurrencyAssertionFailure({
      label,
      actual,
      expected: expectedValues.join(" OR "),
      executions: assertionExecutions.slice(-12),
    }),
  );
}

async function runRace(container, runId, phase, statements) {
  const barrierTable = `newsletter_ci_barrier_e02_${runId}_${phase.replaceAll("-", "_")}`;
  await query(
    container,
    `create unlogged table public.${barrierTable} (worker_index integer primary key);`,
    `${phase}-barrier-setup`,
  );
  try {
    const executions = await waitForConcurrencyWorkers(
      statements.map((statement, workerIndex) => async () =>
        runConcurrencyProcess({
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
          input: `${buildConcurrencyBarrierSql({
            barrierTable,
            applicationPrefix: `newsletter-e02-${runId}-${phase}`,
            workerIndex,
            workerCount: statements.length,
          })}\n${statement.trim()}\n`,
          name: `${phase}-worker-${workerIndex}`,
          phase,
          workerIndex,
          timeoutMs: QUERY_TIMEOUT_MS,
        }),
      ),
    );
    assertionExecutions.push(...executions);
    return executions.map((execution) => execution.stdout.trim());
  } finally {
    await query(
      container,
      `drop table if exists public.${barrierTable};`,
      `${phase}-barrier-cleanup`,
    );
  }
}

async function main() {
  const container = await resolveDatabaseContainer();
  const runId = randomBytes(8).toString("hex");
  const campaignKey = `agenda_motor_2026_08_13_${runId}`;
  const v1V2RaceCampaignKey = `agenda_motor_2026_08_13_v1_v2_${runId}`;
  const v1V2ResultTable = `newsletter_ci_e02_v1_v2_${runId}`;
  const nationalId = randomUUID();
  const madridId = randomUUID();
  const nationalEmail = `edition02-national-${runId}@example.invalid`;
  const madridEmail = `edition02-madrid-${runId}@example.invalid`;

  try {
    await query(
      container,
      `
        insert into public.newsletter_subscribers (
          id, email, email_normalized, status, source, consent_version,
          confirmed_at, province_slug, region_slug
        ) values
          (${sqlLiteral(nationalId)}, ${sqlLiteral(nationalEmail)}, ${sqlLiteral(nationalEmail)}, 'active', 'edition02_concurrency', '2026-08', now(), null, null),
          (${sqlLiteral(madridId)}, ${sqlLiteral(madridEmail)}, ${sqlLiteral(madridEmail)}, 'active', 'edition02_concurrency', '2026-08', now(), 'madrid', 'comunidad-de-madrid');
        insert into public.newsletter_preferences (subscriber_id, weekly_digest_enabled)
        values (${sqlLiteral(nationalId)}, true), (${sqlLiteral(madridId)}, true);
        insert into public.newsletter_consent_events (
          subscriber_id, action, consent_version, source
        ) values
          (${sqlLiteral(nationalId)}, 'confirmed', '2026-08', 'edition02_concurrency'),
          (${sqlLiteral(madridId)}, 'confirmed', '2026-08', 'edition02_concurrency');
      `,
      "edition02-fixture-setup",
    );

    const prepareSql = `
      select campaign_id::text, audience_frozen_at is not null, prepared_count
      from public.prepare_newsletter_campaign_v2(
        ${sqlLiteral(campaignKey)},
        'Drift nocturno, rally y 4 planes más para este fin de semana',
        repeat('1', 64), repeat('2', 64), repeat('3', 64)
      );
    `;
    const prepareResults = await runRace(
      container,
      runId,
      "prepare-race",
      [prepareSql, prepareSql],
    );
    assertEqual(
      String(prepareResults.filter((value) => /\|t\|2$/.test(value)).length),
      "2",
      "both concurrent preparations return the same frozen two-recipient snapshot",
    );
    assertEqual(
      await query(
        container,
        `
          select count(*)::text || '|' ||
            count(distinct delivery.subscriber_id)::text || '|' ||
            count(distinct campaign.audience_frozen_at)::text
          from public.newsletter_campaigns as campaign
          join public.newsletter_campaign_deliveries as delivery
            on delivery.campaign_id = campaign.id
          where campaign.edition_key = ${sqlLiteral(campaignKey)};
        `,
        "edition02-prepare-race-result",
      ),
      "2|2|1",
      "concurrent prepare creates one frozen delivery per subscriber",
    );
    assertEqual(
      await query(
        container,
        `
          select string_agg(content_variant, ',' order by content_variant)
          from public.newsletter_campaign_deliveries
          where campaign_id = (
            select id from public.newsletter_campaigns
            where edition_key = ${sqlLiteral(campaignKey)}
          );
        `,
        "edition02-variant-snapshot-result",
      ),
      "madrid,national",
      "concurrent prepare preserves both territorial snapshots",
    );

    await query(
      container,
      `
        create unlogged table public.${v1V2ResultTable} (
          worker_index integer primary key,
          api_version text not null,
          outcome text not null
        );
      `,
      "edition02-v1-v2-result-setup",
    );

    const v1PrepareRaceSql = `
      do $newsletter_v1_prepare$
      declare
        v_outcome text;
      begin
        begin
          perform 1
          from public.prepare_newsletter_campaign(
            ${sqlLiteral(v1V2RaceCampaignKey)},
            'Drift nocturno, rally y 4 planes mÃ¡s para este fin de semana',
            repeat('1', 64), repeat('2', 64)
          );
          v_outcome := 'prepared';
        exception when sqlstate 'P0001' then
          v_outcome := sqlerrm;
        end;

        insert into public.${v1V2ResultTable} (worker_index, api_version, outcome)
        values (0, 'v1', v_outcome);
      end;
      $newsletter_v1_prepare$;
      select outcome from public.${v1V2ResultTable} where worker_index = 0;
    `;
    const v2PrepareRaceSql = `
      do $newsletter_v2_prepare$
      declare
        v_outcome text;
      begin
        begin
          perform 1
          from public.prepare_newsletter_campaign_v2(
            ${sqlLiteral(v1V2RaceCampaignKey)},
            'Drift nocturno, rally y 4 planes mÃ¡s para este fin de semana',
            repeat('1', 64), repeat('2', 64), repeat('3', 64)
          );
          v_outcome := 'prepared';
        exception when sqlstate 'P0001' then
          v_outcome := sqlerrm;
        end;

        insert into public.${v1V2ResultTable} (worker_index, api_version, outcome)
        values (1, 'v2', v_outcome);
      end;
      $newsletter_v2_prepare$;
      select outcome from public.${v1V2ResultTable} where worker_index = 1;
    `;
    const v1V2PrepareResults = await runRace(
      container,
      runId,
      "v1-v2-prepare-race",
      [v1PrepareRaceSql, v2PrepareRaceSql],
    );
    assertOneOf(
      v1V2PrepareResults.join("|"),
      [
        "prepared|newsletter campaign v2 content mismatch",
        "newsletter campaign v2 requires prepare v2|prepared",
      ],
      "the v1/v2 prepare race always fails closed on the incompatible boundary",
    );
    assertEqual(
      await query(
        container,
        `
          select (
            count(delivery.id) = 2
            and (
              (
                campaign.content_manifest_digest is null
                and campaign.audience_frozen_at is null
              )
              or (
                campaign.content_manifest_digest = repeat('3', 64)
                and campaign.audience_frozen_at is not null
                and count(delivery.id) filter (
                  where delivery.content_variant in ('madrid', 'national')
                ) = 2
              )
            )
          )::text
          from public.newsletter_campaigns as campaign
          left join public.newsletter_campaign_deliveries as delivery
            on delivery.campaign_id = campaign.id
          where campaign.edition_key = ${sqlLiteral(v1V2RaceCampaignKey)}
          group by campaign.content_manifest_digest, campaign.audience_frozen_at;
        `,
        "edition02-v1-v2-prepare-race-result",
      ),
      "true",
      "the race cannot produce a frozen v2 campaign enlarged through v1",
    );

    const claimResults = await runRace(
      container,
      runId,
      "claim-race",
      [0, 1].map(
        (workerIndex) => `
          select delivery_id::text, content_variant
          from public.claim_newsletter_campaign_delivery_v2(
            (
              select id from public.newsletter_campaigns
              where edition_key = ${sqlLiteral(campaignKey)}
            ),
            ${sqlLiteral(tokenHash(runId, workerIndex))},
            false
          );
        `,
      ),
    );
    assertEqual(
      String(claimResults.filter(Boolean).length),
      "1",
      "only one concurrent worker obtains a v2 delivery claim",
    );
    assertEqual(
      await query(
        container,
        `
          select
            count(*) filter (where status = 'sending')::text || '|' ||
            count(*) filter (where status = 'prepared')::text || '|' ||
            count(distinct idempotency_key) filter (where idempotency_key is not null)::text
          from public.newsletter_campaign_deliveries
          where campaign_id = (
            select id from public.newsletter_campaigns
            where edition_key = ${sqlLiteral(campaignKey)}
          );
        `,
        "edition02-claim-race-result",
      ),
      "1|1|1",
      "claim race leaves one sending lease and one untouched prepared delivery",
    );
    assertEqual(
      await query(
        container,
        `
          select count(*)
          from public.newsletter_campaign_unsubscribe_tokens
          where delivery_id in (
            select id from public.newsletter_campaign_deliveries
            where campaign_id = (
              select id from public.newsletter_campaigns
              where edition_key = ${sqlLiteral(campaignKey)}
            )
          );
        `,
        "edition02-claim-token-result",
      ),
      "1",
      "only the winning claim persists one unsubscribe hash",
    );

    process.stdout.write(
      "Edition 02 concurrency passed: audience frozen once, v1/v2 boundary closed, variants snapshotted, one claim winner.\n",
    );
  } finally {
    await query(
      container,
      `
        delete from public.newsletter_campaign_unsubscribe_tokens
        where delivery_id in (
          select delivery.id
          from public.newsletter_campaign_deliveries as delivery
          join public.newsletter_campaigns as campaign on campaign.id = delivery.campaign_id
          where campaign.edition_key in (
            ${sqlLiteral(campaignKey)}, ${sqlLiteral(v1V2RaceCampaignKey)}
          )
        );
        delete from public.newsletter_campaign_deliveries
        where campaign_id in (
          select id from public.newsletter_campaigns
          where edition_key in (
            ${sqlLiteral(campaignKey)}, ${sqlLiteral(v1V2RaceCampaignKey)}
          )
        );
        delete from public.newsletter_campaigns
        where edition_key in (
          ${sqlLiteral(campaignKey)}, ${sqlLiteral(v1V2RaceCampaignKey)}
        );
        drop table if exists public.${v1V2ResultTable};
        delete from public.newsletter_consent_events
        where subscriber_id in (${sqlLiteral(nationalId)}, ${sqlLiteral(madridId)});
        delete from public.newsletter_preferences
        where subscriber_id in (${sqlLiteral(nationalId)}, ${sqlLiteral(madridId)});
        delete from public.newsletter_subscribers
        where id in (${sqlLiteral(nationalId)}, ${sqlLiteral(madridId)});
      `,
      "edition02-fixture-cleanup",
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
