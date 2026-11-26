import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { NEWSLETTER_EDITION_17_CAMPAIGN_KEY, NEWSLETTER_EDITION_17_SUBJECT } from "./edition-17-editorial";
import {
  NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_17_HTML_SHA256,
  NEWSLETTER_EDITION_17_TEXT_SHA256,
  newsletterEdition17ContentManifestDigest,
} from "./edition-17-content";

const sql = readFileSync("docs/newsletter/ediciones/2026-11-26/edition-17-rpc-candidate.sql.template", "utf8");

test("Ed17 RPC binds all three operations to the sealed five-argument identity", () => {
  const args = /p_edition_key text,\s*p_subject text,\s*p_html_sha256 text,\s*p_text_sha256 text,\s*p_content_manifest_digest text/;
  for (const name of ["preview", "prepare", "audit"]) {
    assert.match(sql, new RegExp(`${name}_newsletter_campaign_edition_17\\(\\s*${args.source}`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}_newsletter_campaign_edition_17\\([\\s\\S]*?from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}_newsletter_campaign_edition_17\\([\\s\\S]*?to service_role`));
  }
  assert.equal(NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256, newsletterEdition17ContentManifestDigest());
  for (const value of [NEWSLETTER_EDITION_17_CAMPAIGN_KEY, NEWSLETTER_EDITION_17_SUBJECT]) {
    assert.equal(sql.split(`is distinct from '${value}'`).length - 1, 3);
  }
  for (const value of [NEWSLETTER_EDITION_17_HTML_SHA256, NEWSLETTER_EDITION_17_TEXT_SHA256, NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256]) {
    assert.equal(sql.split(`is distinct from '${value}'`).length - 1, 3);
  }
  assert.doesNotMatch(sql, /PENDING|UNSEALED|agenda_motor_2026_11_12|newsletter_campaign_edition_15/);
});

test("Ed17 installation is schema-only and preview/audit are read-only", () => {
  const previewStart = sql.indexOf("create or replace function public.preview_newsletter_campaign_edition_17(");
  const prepareStart = sql.indexOf("create or replace function public.prepare_newsletter_campaign_edition_17(");
  const auditStart = sql.indexOf("create or replace function public.audit_newsletter_campaign_edition_17(");
  const grantsStart = sql.indexOf("revoke all on function public.newsletter_edition_17_content_variant(text)");
  assert.ok(previewStart > 0 && prepareStart > previewStart && auditStart > prepareStart && grantsStart > auditStart);
  const topLevel = sql.replace(/as \$\$[\s\S]*?\$\$;/g, "");
  assert.doesNotMatch(topLevel, /\b(insert\s+into|update\s+public\.|delete\s+from|truncate\s+table|alter\s+table|create\s+table|drop\s+table)\b/i);
  for (const readOnly of [sql.slice(previewStart, prepareStart), sql.slice(auditStart, grantsStart)]) {
    assert.doesNotMatch(readOnly, /\b(insert\s+into|update\s+public\.|delete\s+from|truncate\s+table)\b/i);
    assert.match(readOnly, /security definer\s+set search_path = ''/);
  }
  assert.match(sql, /\bbegin;/);
  assert.match(sql, /\bcommit;\s*$/);
});

test("Ed17 prepare is one-shot, capped, consent-aware and Madrid-only", () => {
  assert.match(sql, /when 'comunidad-de-madrid' then 'madrid'\s+else 'national'/);
  assert.match(sql, /newsletter_edition_17_content_variant\(subscriber\.region_slug\)/);
  assert.match(sql, /newsletter_edition_02_subscriber_is_sendable\(subscriber\.id\)/);
  assert.match(sql, /v_preflight\.eligible_count not between 1 and 500/);
  assert.match(sql, /v_preflight\.duplicate_count <> 0/);
  assert.match(sql, /v_preflight\.invalid_count <> 0/);
  assert.match(sql, /on conflict on constraint newsletter_campaigns_edition_key do nothing/);
  assert.match(sql, /already prepared; second prepare blocked/);
  assert.match(sql, /revoke all on function public\.newsletter_edition_17_content_variant\(text\)\s+from public, anon, authenticated/);
  assert.doesNotMatch(sql, /alter table|create table|drop table/i);
});

test("Ed17 frozen audit detects duplicates and never recalculates live audience", () => {
  const audit = sql.split("create or replace function public.audit_newsletter_campaign_edition_17(")[1]?.split("revoke all on function")[0];
  assert.ok(audit);
  assert.match(audit, /v_campaign\.audience_frozen_at is null/);
  assert.match(audit, /count\(distinct delivery\.subscriber_id\)/);
  assert.match(audit, /count\(distinct subscriber\.email_normalized\)/);
  assert.doesNotMatch(audit, /newsletter_edition_02_subscriber_is_sendable/);
  assert.match(audit, /invalid_variant_count integer/);
});
