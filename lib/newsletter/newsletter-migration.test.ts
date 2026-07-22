import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MIGRATION_PATH = join(
  process.cwd(),
  "database/migrations/20260721133000_newsletter_core_foundation.sql",
);
const sql = readFileSync(MIGRATION_PATH, "utf8");

const TABLES = [
  "newsletter_subscribers",
  "newsletter_preferences",
  "newsletter_confirmation_tokens",
  "newsletter_consent_events",
  "newsletter_email_events",
] as const;
const RPCS = [
  "request_newsletter_subscription",
  "confirm_newsletter_subscription",
  "unsubscribe_newsletter_subscriber",
  "record_newsletter_provider_event",
] as const;

function returnedColumns(functionName: (typeof RPCS)[number]): string {
  const match = sql.match(
    new RegExp(
      `create or replace function public\\.${functionName}\\([\\s\\S]+?returns table \\(\\s*([\\s\\S]+?)\\s*\\)\\s*language`,
      "i",
    ),
  );
  assert.ok(match, `missing return declaration for ${functionName}`);
  return match[1];
}

function functionDefinition(functionName: (typeof RPCS)[number]): string {
  const match = sql.match(
    new RegExp(
      `create or replace function public\\.${functionName}\\([\\s\\S]+?\\n\\$\\$;`,
      "i",
    ),
  );
  assert.ok(match, `missing definition for ${functionName}`);
  return match[0];
}

test("defines the five isolated newsletter tables and their indexes", () => {
  for (const table of TABLES) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  }
  assert.match(sql, /unique \(email_normalized\)/i);
  assert.match(sql, /unique \(token_hash\)/i);
  assert.match(sql, /unique \(provider, provider_event_id\)/i);
  assert.match(sql, /newsletter_confirmation_tokens_expiry_idx/i);
  assert.match(sql, /newsletter_consent_events_subscriber_idx/i);
});

test("defines state, purpose, action and data invariants without PostgreSQL enums", () => {
  assert.match(sql, /newsletter_subscribers_status_check[\s\S]*?'suppressed'/i);
  assert.match(sql, /newsletter_confirmation_tokens_purpose_check[\s\S]*?'resubscribe'/i);
  assert.match(sql, /newsletter_consent_events_action_check[\s\S]*?'confirmation_issued'[\s\S]*?'unsubscribed'/i);
  assert.match(sql, /email_normalized = lower\(btrim\(email\)\)/i);
  assert.match(sql, /confirmation_request_count >= 0/i);
  assert.match(sql, /newsletter_subscribers_active_date_check/i);
  assert.doesNotMatch(sql, /create\s+type[\s\S]+?as\s+enum/i);
});

test("enables RLS and removes direct access from public client roles", () => {
  assert.equal((sql.match(/enable row level security/gi) ?? []).length, TABLES.length);
  assert.match(sql, /revoke all on table[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant select on table[\s\S]+to service_role/i);
  assert.doesNotMatch(sql, /grant\s+.+\s+to\s+(anon|authenticated)/i);
});

test("marks every mutation RPC as server-only security definer with an empty search path", () => {
  for (const fn of RPCS) {
    const definition = new RegExp(
      `create or replace function public\\.${fn}[\\s\\S]+?security definer[\\s\\S]+?set search_path = ''`,
      "i",
    );
    assert.match(sql, definition);
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}`, "i"));
    assert.match(
      sql,
      new RegExp(
        `revoke all on function public\\.${fn}\\([\\s\\S]+?\\) from public, anon, authenticated`,
        "i",
      ),
    );
  }
  const executeGrants = [...sql.matchAll(/grant execute on function public\.(\w+)\([\s\S]*?\)\s+to\s+(\w+);/gi)];
  assert.equal(executeGrants.length, RPCS.length);
  assert.deepEqual(new Set(executeGrants.map((grant) => grant[1])), new Set(RPCS));
  assert.ok(executeGrants.every((grant) => grant[2] === "service_role"));
  assert.doesNotMatch(sql, /execute\s+(format|immediate)|execute\s+[^;]*\|\|/i);
});

test("RPC return contracts expose only minimum server orchestration data", () => {
  assert.match(returnedColumns("request_newsletter_subscription"), /^outcome text,\s*subscriber_id uuid,\s*token_purpose text$/i);
  assert.match(returnedColumns("confirm_newsletter_subscription"), /^outcome text,\s*subscriber_id uuid$/i);
  assert.match(returnedColumns("unsubscribe_newsletter_subscriber"), /^outcome text$/i);
  assert.match(returnedColumns("record_newsletter_provider_event"), /^outcome text$/i);
  for (const fn of RPCS) {
    assert.doesNotMatch(
      returnedColumns(fn),
      /email|email_normalized|subscriber_status|token_expires_at|event_inserted|provider_message_id/i,
    );
  }
});

test("SQL blocks permanent bounced subscribers from requesting or confirming", () => {
  assert.match(
    sql,
    /request_newsletter_subscription[\s\S]+?status in \('bounced', 'complained', 'suppressed'\)[\s\S]+?select 'blocked'/i,
  );
  assert.match(
    sql,
    /confirm_newsletter_subscription[\s\S]+?status in \('bounced', 'complained', 'suppressed'\)[\s\S]+?select 'blocked'/i,
  );
  assert.doesNotMatch(sql, /status in \('unsubscribed', 'bounced'\)[\s\S]+?purpose = 'resubscribe'/i);
});

test("confirmation locks the token and records activation, consumption and consent together", () => {
  assert.match(sql, /confirm_newsletter_subscription[\s\S]+?newsletter_confirmation_tokens[\s\S]+?for update/i);
  assert.match(sql, /confirm_newsletter_subscription[\s\S]+?set status = 'active'/i);
  assert.match(sql, /confirm_newsletter_subscription[\s\S]+?set used_at = v_now/i);
  assert.match(sql, /confirm_newsletter_subscription[\s\S]+?'confirmed'/i);
  assert.doesNotMatch(sql, /delete from public\.newsletter_subscribers/i);
});

test("RPC SQL avoids collisions with PL/pgSQL return columns", () => {
  const requestDefinition = functionDefinition("request_newsletter_subscription");
  const confirmationDefinition = functionDefinition("confirm_newsletter_subscription");

  assert.match(
    requestDefinition,
    /update public\.newsletter_confirmation_tokens as confirmation_token[\s\S]+?where confirmation_token\.subscriber_id = v_subscriber\.id/i,
  );
  assert.doesNotMatch(requestDefinition, /where\s+subscriber_id\s*=/i);
  assert.match(
    confirmationDefinition,
    /on conflict on constraint newsletter_preferences_pkey do update/i,
  );
  assert.doesNotMatch(confirmationDefinition, /on conflict\s*\(\s*subscriber_id\s*\)/i);
});

test("unsubscribe is idempotent and disables delivery inside the RPC", () => {
  assert.match(sql, /unsubscribe_newsletter_subscriber[\s\S]+?'already_unsubscribed'/i);
  assert.match(sql, /unsubscribe_newsletter_subscriber[\s\S]+?weekly_digest_enabled = false/i);
  assert.match(sql, /unsubscribe_newsletter_subscriber[\s\S]+?set status = 'unsubscribed'/i);
  assert.match(sql, /unsubscribe_newsletter_subscriber[\s\S]+?'unsubscribed'/i);
});

test("provider event insertion and aggregate updates share one idempotent transaction", () => {
  assert.match(sql, /record_newsletter_provider_event[\s\S]+?on conflict \(provider, provider_event_id\) do nothing/i);
  assert.match(sql, /record_newsletter_provider_event[\s\S]+?return query select 'duplicate'/i);
  assert.match(sql, /record_newsletter_provider_event[\s\S]+?update public\.newsletter_subscribers/i);
  assert.match(sql, /record_newsletter_provider_event[\s\S]+?weekly_digest_enabled = false/i);
});

test("provider event states and latest timestamps are monotonic", () => {
  const providerDefinition = functionDefinition("record_newsletter_provider_event");

  assert.match(
    providerDefinition,
    /set status = case\s+when status = 'suppressed' then 'suppressed'\s+when p_event_type = 'suppressed' then 'suppressed'\s+when status = 'complained' then 'complained'\s+when p_event_type = 'complained' then 'complained'\s+when status = 'bounced' then 'bounced'\s+when p_event_type = 'bounced' and p_is_permanent then 'bounced'\s+else status\s+end/i,
  );
  assert.doesNotMatch(
    providerDefinition,
    /set status = case\s+when p_event_type = 'complained' then 'complained'/i,
  );
  assert.doesNotMatch(providerDefinition, /then 'active'/i);

  for (const timestamp of [
    "bounced_at",
    "complained_at",
    "suppressed_at",
    "last_sent_at",
    "last_delivered_at",
    "last_opened_at",
    "last_clicked_at",
  ]) {
    assert.match(
      providerDefinition,
      new RegExp(
        `${timestamp} = case[\\s\\S]+?greatest\\(coalesce\\(${timestamp}, p_occurred_at\\), p_occurred_at\\)[\\s\\S]+?else ${timestamp}[\\s\\S]+?end`,
        "i",
      ),
    );
  }
});
