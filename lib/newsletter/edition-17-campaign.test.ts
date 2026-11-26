import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_17_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_17_CAMPAIGN_CONFIRM_PHRASE,
  executeNewsletterEdition17Campaign,
  parseNewsletterEdition17CampaignArguments,
  type ExecuteNewsletterEdition17CampaignOptions,
  type NewsletterEdition17CampaignClaim,
  type NewsletterEdition17CampaignRepository,
  type NewsletterEdition17CampaignSummary,
  type NewsletterEdition17SnapshotAudit,
} from "./edition-17-campaign";
import {
  NEWSLETTER_EDITION_17_ASSET_MANIFEST,
  NEWSLETTER_EDITION_17_REPLY_TO,
  NEWSLETTER_EDITION_17_SENDER,
} from "./edition-17-content";

const CAMPAIGN_ID = "e9e90fb9-271b-4371-9756-d61299157ea1";
const DELIVERY_ID = "37d927f8-6f4b-4a74-ad26-629fdd192173";
const SUBSCRIBER_ID = "ad65cf3a-df6d-41af-b160-4786e02e5046";
const CLAIM_ID = "50cf4e40-7a75-4bbf-bafa-e2a833969ae7";

async function source() {
  const root = resolve("docs/newsletter/ediciones/2026-11-26");
  return {
    assetManifest: await readFile(resolve(root, "asset-manifest.json"), "utf8"),
    assets: Object.fromEntries(await Promise.all(NEWSLETTER_EDITION_17_ASSET_MANIFEST.map(async ({ file }) => [
      file, await readFile(resolve(root, "assets", file)),
    ] as const))),
  };
}

function preview(overrides: Partial<NewsletterEdition17CampaignSummary> = {}): NewsletterEdition17CampaignSummary {
  return {
    campaignId: null, campaignStatus: "not_created", audienceFrozenAt: null,
    eligibleCount: 2, preparedCount: 0, sendingCount: 0, acceptedCount: 0,
    failedCount: 0, unknownCount: 0, retryableCount: 0,
    nationalCount: 1, madridCount: 1, excludedCount: 1,
    duplicateCount: 0, invalidCount: 0, ...overrides,
  };
}

function claim(variant: "national" | "madrid"): NewsletterEdition17CampaignClaim {
  return {
    deliveryId: DELIVERY_ID, campaignId: CAMPAIGN_ID, subscriberId: SUBSCRIBER_ID,
    recipientEmail: "fixture@example.com", claimId: CLAIM_ID, attemptCount: 1,
    idempotencyKey: `ed17-${variant}-fixture`, contentVariant: variant,
  };
}

function frozenAudit(overrides: Partial<NewsletterEdition17SnapshotAudit> = {}): NewsletterEdition17SnapshotAudit {
  return {
    campaignId: CAMPAIGN_ID, campaignStatus: "prepared",
    audienceFrozenAt: "2026-10-28T12:00:00Z", deliveryCount: 2,
    preparedCount: 2, sendingCount: 0, acceptedCount: 0,
    failedCount: 0, unknownCount: 0, nationalCount: 1, madridCount: 1,
    duplicateSubscriberCount: 0, duplicateEmailCount: 0,
    invalidVariantCount: 0, ...overrides,
  };
}

function armedEnvironment() {
  return {
    armed: NEWSLETTER_EDITION_17_CAMPAIGN_ARMED_VALUE,
    apiKey: "mock_resend_key_0000000000000000",
    newsletterMode: "live", mailTransport: "resend",
    publicLaunchEnabled: "public-newsletter-live",
  };
}

function armedRequest(mode: "prepare" | "send", limit = 2) {
  return {
    prepareOnly: mode === "prepare", sendPrepared: mode === "send", limit,
    confirmEdition: "agenda_motor_2026_11_26",
    confirmPhrase: NEWSLETTER_EDITION_17_CAMPAIGN_CONFIRM_PHRASE,
    ...(mode === "send" ? { confirmCampaignId: CAMPAIGN_ID } : {}),
  };
}

function repository(counters: Record<string, number>, overrides: Partial<NewsletterEdition17CampaignRepository> = {}): NewsletterEdition17CampaignRepository {
  return {
    async previewCampaign() { counters.preview++; return preview(); },
    async prepareCampaign() { counters.prepare++; return preview({ campaignId: CAMPAIGN_ID, campaignStatus: "prepared", audienceFrozenAt: "2026-10-28T12:00:00Z", preparedCount: 2 }); },
    async auditFrozenCampaign() {
      counters.audit++;
      return counters.accepted === 2
        ? frozenAudit({ campaignStatus: "completed", preparedCount: 0, acceptedCount: 2 })
        : frozenAudit();
    },
    async claimDelivery() { counters.claim++; return null; },
    async recordAccepted() { counters.accepted++; },
    async recordFailed() { counters.failed++; },
    async recordUnknown() { counters.unknown++; },
    ...overrides,
  };
}

function counters() {
  return { preview: 0, prepare: 0, audit: 0, claim: 0, accepted: 0, failed: 0, unknown: 0, provider: 0 };
}

async function options(extra: Partial<ExecuteNewsletterEdition17CampaignOptions> = {}): Promise<ExecuteNewsletterEdition17CampaignOptions> {
  return {
    request: { prepareOnly: false, sendPrepared: false, limit: 25 },
    source: await source(), repository: repository(counters()),
    sender: NEWSLETTER_EDITION_17_SENDER, replyTo: NEWSLETTER_EDITION_17_REPLY_TO,
    ...extra,
  };
}

test("Edition 17 default runner is read-only and has no provider access", async () => {
  const count = counters();
  const result = await executeNewsletterEdition17Campaign(await options({
    repository: repository(count),
    clientFactory: () => { throw new Error("provider must not be constructed"); },
  }));
  assert.equal(result.status, "dry_run");
  assert.equal(result.identity.editionKey, "agenda_motor_2026_11_26");
  assert.deepEqual([count.preview, count.prepare, count.claim, count.provider], [1, 0, 0, 0]);
});

test("Edition 17 prepare is separate, gated, and freezes exactly once in the mock", async () => {
  const count = counters();
  const base = await options({ request: armedRequest("prepare"), repository: repository(count) });
  await assert.rejects(() => executeNewsletterEdition17Campaign(base), /send_not_armed/);
  assert.equal(count.preview, 0);
  const result = await executeNewsletterEdition17Campaign({
    ...base, environment: armedEnvironment(),
    clientFactory: () => { throw new Error("provider must not be constructed"); },
  });
  assert.equal(result.status, "prepared");
  assert.equal(result.summary?.preparedCount, 2);
  assert.deepEqual([count.preview, count.prepare, count.audit, count.claim, count.provider], [1, 1, 1, 0, 0]);
});

test("Edition 17 send-prepared uses only frozen claims and both correct renders", async () => {
  const count = counters();
  const queue = [claim("national"), claim("madrid")];
  const payloads: Array<{ html: string; text: string; subject: string; to: readonly string[] }> = [];
  const result = await executeNewsletterEdition17Campaign(await options({
    request: armedRequest("send"), environment: armedEnvironment(),
    repository: repository(count, {
      async claimDelivery(input) {
        count.claim++;
        assert.equal(input.campaignId, CAMPAIGN_ID);
        assert.equal(input.allowRetry, false);
        return queue.shift() ?? null;
      },
    }),
    preparedCampaignSeal: { campaignId: CAMPAIGN_ID, deliveryCount: 2, variantCounts: { national: 1, madrid: 1 } },
    tokenFactory: () => "edition16-recipient-token-fixture-000000000000",
    tokenHasher: () => "a".repeat(64),
    clientFactory: () => ({ async sendEmail(payload) {
      count.provider++;
      payloads.push(payload);
      return { status: "accepted", providerMessageId: `mock-${count.provider}` };
    } }),
  }));
  assert.equal(result.status, "prepared_sent");
  assert.deepEqual([count.preview, count.prepare, count.audit, count.claim, count.provider, count.accepted], [0, 0, 2, 2, 2, 2]);
  assert.ok(!payloads[0]?.html.includes("Lo próximo cerca de ti"));
  assert.equal(payloads[1]?.html.split("Lo próximo cerca de ti").length - 1, 1);
  assert.ok(payloads.every(({ html, text, subject, to }) =>
    !html.includes("PREVIEW LOCAL") && text.includes("Darme de baja:") &&
    subject === "MotoGP cierra en Cheste: drift en Jarama y montaña en Tenerife" &&
    to.length === 1 && to[0] === "fixture@example.com"));
});

test("Edition 17 uncertain provider result stops after one mock call without retry", async () => {
  const count = counters();
  const sendOptions = await options({
    request: armedRequest("send", 1), environment: armedEnvironment(),
    repository: repository(count, {
      async auditFrozenCampaign() { count.audit++; return frozenAudit({ deliveryCount: 1, preparedCount: 1, madridCount: 0 }); },
      async claimDelivery() { count.claim++; return claim("national"); },
    }),
    preparedCampaignSeal: { campaignId: CAMPAIGN_ID, deliveryCount: 1, variantCounts: { national: 1, madrid: 0 } },
    tokenFactory: () => "edition16-recipient-token-fixture-000000000000",
    tokenHasher: () => "a".repeat(64),
    clientFactory: () => ({ async sendEmail() { count.provider++; return { status: "timeout" }; } }),
  });
  await assert.rejects(() => executeNewsletterEdition17Campaign(sendOptions), /provider_result_unknown/);
  assert.deepEqual([count.preview, count.prepare, count.claim, count.provider, count.unknown], [0, 0, 1, 1, 1]);
});

test("Edition 17 rejects wrong seal, duplicate flags, and altered assets before side effects", async () => {
  const count = counters();
  const base = await options({
    request: armedRequest("send"), environment: armedEnvironment(),
    repository: repository(count),
    preparedCampaignSeal: { campaignId: CAMPAIGN_ID, deliveryCount: 3, variantCounts: { national: 2, madrid: 1 } },
  });
  await assert.rejects(() => executeNewsletterEdition17Campaign(base), /prepared_delivery_limit_invalid/);
  const modified = { ...base.source, assets: { ...base.source.assets, "06-x-trial-madrid.webp": new Uint8Array([0]) } };
  await assert.rejects(() => executeNewsletterEdition17Campaign({ ...base, source: modified }), /asset_digest_mismatch/);
  assert.deepEqual([count.preview, count.prepare, count.claim, count.provider], [0, 0, 0, 0]);
  assert.throws(() => parseNewsletterEdition17CampaignArguments(["--send"]), /unknown_argument/);
  assert.throws(() => parseNewsletterEdition17CampaignArguments(["--prepare-only", "--send-prepared"]), /request_mode_conflict/);
  assert.throws(() => parseNewsletterEdition17CampaignArguments(["--limit", "501"]), /limit_invalid/);
});

test("Edition 17 refuses wrong frozen campaign or a second send before provider access", async () => {
  for (const audit of [
    frozenAudit({ campaignId: "af59dd09-c191-4925-bb46-5169ced5f8b8" }),
    frozenAudit({ campaignStatus: "completed", preparedCount: 0, acceptedCount: 2 }),
  ]) {
    const count = counters();
    const sendOptions = await options({
      request: armedRequest("send"), environment: armedEnvironment(),
      repository: repository(count, { async auditFrozenCampaign() { count.audit++; return audit; } }),
      preparedCampaignSeal: { campaignId: CAMPAIGN_ID, deliveryCount: 2, variantCounts: { national: 1, madrid: 1 } },
      clientFactory: () => { count.provider++; throw new Error("provider must not be constructed"); },
    });
    await assert.rejects(() => executeNewsletterEdition17Campaign(sendOptions), /prepared_snapshot_mismatch/);
    assert.deepEqual([count.audit, count.claim, count.provider], [1, 0, 0]);
  }
});
