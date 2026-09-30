import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  NEWSLETTER_EDITION_09_ASSET_MANIFEST,
  NEWSLETTER_EDITION_09_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_09_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_09_HTML_SHA256,
  NEWSLETTER_EDITION_09_PREHEADER,
  NEWSLETTER_EDITION_09_REPLY_TO,
  NEWSLETTER_EDITION_09_SENDER,
  NEWSLETTER_EDITION_09_SUBJECT,
  NEWSLETTER_EDITION_09_TERRITORIAL_MODULES,
  NEWSLETTER_EDITION_09_TEXT_SHA256,
  NewsletterEdition09ContentError,
  newsletterEdition09ContentManifestDigest,
  newsletterEdition09ContentVariantForRegion,
  prepareEdition09Content,
  prepareEdition09PreviewContent,
  validateEdition09SourceIntegrity,
  type NewsletterEdition09Source,
} from "@/lib/newsletter/edition-09-content";
import {
  NEWSLETTER_EDITION_09_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_09_CAMPAIGN_CONFIRM_PHRASE,
  NewsletterEdition09CampaignError,
  executeNewsletterEdition09Campaign,
  newsletterEdition09CampaignIdentity,
  parseNewsletterEdition09CampaignArguments,
  type NewsletterEdition09CampaignClaim,
  type NewsletterEdition09CampaignClient,
  type NewsletterEdition09CampaignRepository,
  type NewsletterEdition09CampaignSummary,
} from "@/lib/newsletter/edition-09-campaign";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-01";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition09-test-token-fixture-000000000000";

async function sourceFixture(): Promise<NewsletterEdition09Source> {
  const [html, text, assetManifest, assets] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_09_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(assets) };
}

function summary(
  overrides: Partial<NewsletterEdition09CampaignSummary> = {},
): NewsletterEdition09CampaignSummary {
  return {
    campaignId: null,
    campaignStatus: "not_created",
    audienceFrozenAt: null,
    eligibleCount: 144,
    preparedCount: 0,
    sendingCount: 0,
    acceptedCount: 0,
    failedCount: 0,
    unknownCount: 0,
    retryableCount: 0,
    nationalCount: 144,
    madridCount: 0,
    catalunaCount: 0,
    comunidadValencianaCount: 0,
    excludedCount: 2,
    duplicateCount: 0,
    invalidCount: 0,
    ...overrides,
  };
}

function mutationEnvironment() {
  return {
    armed: NEWSLETTER_EDITION_09_CAMPAIGN_ARMED_VALUE,
    apiKey: "re_edition09_test_api_key_1234567890",
    mailTransport: "resend",
    newsletterMode: "live",
    publicLaunchEnabled: "public-newsletter-live",
  };
}

function mutationRequest() {
  return {
    sendPrepared: false,
    prepareOnly: true,
    limit: 25,
    confirmEdition: NEWSLETTER_EDITION_09_CAMPAIGN_KEY,
    confirmPhrase: NEWSLETTER_EDITION_09_CAMPAIGN_CONFIRM_PHRASE,
  };
}

function repository(overrides: Partial<NewsletterEdition09CampaignRepository> = {}) {
  const calls = { preview: 0, prepare: 0, claim: 0, accepted: 0 };
  const value: NewsletterEdition09CampaignRepository = {
    async previewCampaign() {
      calls.preview += 1;
      return summary();
    },
    async prepareCampaign() {
      calls.prepare += 1;
      return summary({
        campaignId: "11111111-1111-4111-8111-111111111111",
        campaignStatus: "prepared",
        audienceFrozenAt: "2026-10-01T08:00:00.000Z",
        preparedCount: 144,
      });
    },
    async claimDelivery() {
      calls.claim += 1;
      return null;
    },
    async recordAccepted() {
      calls.accepted += 1;
    },
    async recordFailed() {
      throw new Error("unexpected failed delivery");
    },
    async recordUnknown() {
      throw new Error("unexpected unknown delivery");
    },
    ...overrides,
  };
  return { calls, value };
}

test("canonical Edition 09 source, manifest and visual hardening are sealed", async () => {
  const source = await sourceFixture();
  const validated = validateEdition09SourceIntegrity(source);
  assert.deepEqual(validated, {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 7,
  });
  assert.equal(NEWSLETTER_EDITION_09_CAMPAIGN_KEY, "agenda_motor_2026_10_01");
  assert.equal(
    NEWSLETTER_EDITION_09_SUBJECT,
    "Barcelona, Jarama y lo que viene este fin de semana",
  );
  assert.equal(
    NEWSLETTER_EDITION_09_PREHEADER,
    "GT3 en Montmeló, camiones en Jarama, históricos en A Coruña y karting internacional en Valencia.",
  );
  assert.equal(
    newsletterEdition09ContentManifestDigest(),
    NEWSLETTER_EDITION_09_CONTENT_MANIFEST_SHA256,
  );
  assert.equal(
    createHash("sha256").update(source.html).digest("hex"),
    NEWSLETTER_EDITION_09_HTML_SHA256,
  );
  assert.equal(
    createHash("sha256").update(source.text).digest("hex"),
    NEWSLETTER_EDITION_09_TEXT_SHA256,
  );
  assert.match(source.html, /bgcolor="#050608"/);
  assert.match(source.html, /bgcolor="#090b0f"/);
  assert.match(source.html, /width="42%"/);
  assert.match(source.html, /width="58%"/);
  assert.match(source.html, /max-width:700px/);
  assert.doesNotMatch(source.html, /mix-blend-mode|linear-gradient|color-scheme/i);

  const header = source.assets["eventomotor-header.png"];
  assert.ok(header);
  const raw = await sharp(header).ensureAlpha().raw().toBuffer();
  for (let index = 3; index < raw.length; index += 4) {
    assert.equal(raw[index], 255);
  }
});

test("all five canonical EventoMotor URLs and UTM markers are present", async () => {
  const source = await sourceFixture();
  const rendered = prepareEdition09Content(source, "national", UNSUBSCRIBE_URL);
  for (const slug of [
    "festival-de-la-velocidad-de-barcelona-gt-world-challenge-2026-10-02",
    "gran-premio-del-camion-jarama-2026-10-03",
    "rallye-rias-altas-historico-2026-10-02",
    "t4-nations-cup-chiva-2026-09-30",
    "fin-de-semana-de-carreras-con-f4-espanola-circuito-de-navarra-2026-10-10",
  ]) {
    assert.equal((rendered.html.match(new RegExp(slug, "g")) ?? []).length, 2, slug);
  }
  assert.doesNotMatch(rendered.html, /\{\{(?:unsubscribe_url|territorial_block)\}\}/);
  assert.match(rendered.html, /utm_source=la_agenda_motor/);
  assert.match(rendered.html, /utm_medium=email/);
  assert.equal(
    (rendered.html.match(/utm_campaign=agenda_motor_2026_10_01/g) ?? []).length,
    11,
  );
  assert.match(rendered.html, /newsletter\/unsubscribe\?token=/);
});

test("territorialModules remains generic but empty and every region maps to national", async () => {
  assert.deepEqual(NEWSLETTER_EDITION_09_TERRITORIAL_MODULES, {});
  const regions = [
    "comunidad-de-madrid",
    "cataluna",
    "comunidad-valenciana",
    "galicia",
    "andalucia",
    "",
    "sin-region",
    "unknown",
    "region-desconocida",
    null,
    undefined,
  ];
  for (const region of regions) {
    assert.equal(newsletterEdition09ContentVariantForRegion(region), "national");
  }

  const source = await sourceFixture();
  const national = prepareEdition09Content(source, "national", UNSUBSCRIBE_URL);
  for (const region of regions) {
    const rendered = prepareEdition09Content(
      source,
      newsletterEdition09ContentVariantForRegion(region),
      UNSUBSCRIBE_URL,
    );
    assert.equal(rendered.html, national.html);
    assert.equal(rendered.text, national.text);
  }
  assert.doesNotMatch(national.html, /Lo próximo cerca de ti/i);
  assert.doesNotMatch(national.text, /LO PRÓXIMO CERCA DE TI/);
});

test("the single local preview rewrites every image without changing links", async () => {
  const preview = prepareEdition09PreviewContent(
    await sourceFixture(),
    "national",
    UNSUBSCRIBE_URL,
  );
  assert.doesNotMatch(
    preview.html,
    /https:\/\/www\.eventomotor\.com\/newsletter\/2026-10-01\/assets\//,
  );
  assert.equal((preview.html.match(/src="assets\//g) ?? []).length, preview.imageCount);
});

test("tampered source and unsafe unsubscribe URLs fail closed", async () => {
  const source = await sourceFixture();
  assert.throws(
    () => validateEdition09SourceIntegrity({ ...source, html: `${source.html} ` }),
    (error) =>
      error instanceof NewsletterEdition09ContentError &&
      error.code === "template_digest_mismatch",
  );
  assert.throws(
    () =>
      prepareEdition09Content(
        source,
        "national",
        "http://evil.invalid/unsubscribe?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    (error) =>
      error instanceof NewsletterEdition09ContentError &&
      error.code === "unsubscribe_url_invalid",
  );
});

test("Edition 09 migration is RPC-only and freezes every delivery as national", async () => {
  const migration = await readFile(
    resolve(
      ROOT,
      "database/migrations/20260930120000_newsletter_edition_09_national.sql",
    ),
    "utf8",
  );
  assert.match(migration, /preview_newsletter_campaign_edition_09/);
  assert.match(migration, /prepare_newsletter_campaign_edition_09/);
  assert.match(migration, /subscriber\.id,\s+'national',/);
  assert.match(migration, /if v_campaign\.audience_frozen_at is null then/);
  assert.match(
    migration,
    /on conflict on constraint newsletter_campaign_deliveries_recipient_key do nothing/,
  );
  assert.doesNotMatch(migration, /alter table|drop constraint|add constraint/i);
  assert.doesNotMatch(migration, /newsletter_edition_09_content_variant|region_slug/i);
  assert.match(
    migration,
    /grant execute on function public\.preview_newsletter_campaign_edition_09/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute[\s\S]+to anon|grant execute[\s\S]+to authenticated/i,
  );
});

test("campaign dry-run uses preview only and performs no mutation", async () => {
  const mock = repository();
  const result = await executeNewsletterEdition09Campaign({
    request: { sendPrepared: false, prepareOnly: false, limit: 25 },
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_09_SENDER,
    replyTo: NEWSLETTER_EDITION_09_REPLY_TO,
  });
  assert.equal(result.status, "dry_run");
  assert.deepEqual(mock.calls, { preview: 1, prepare: 0, claim: 0, accepted: 0 });
});

test("prepare-only freezes once and does not claim or contact a provider", async () => {
  const mock = repository();
  let providerFactories = 0;
  const result = await executeNewsletterEdition09Campaign({
    request: mutationRequest(),
    environment: mutationEnvironment(),
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_09_SENDER,
    replyTo: NEWSLETTER_EDITION_09_REPLY_TO,
    clientFactory: () => {
      providerFactories += 1;
      throw new Error("provider must not be constructed during prepare-only");
    },
  });
  assert.equal(result.status, "prepared");
  assert.deepEqual(mock.calls, { preview: 0, prepare: 1, claim: 0, accepted: 0 });
  assert.equal(providerFactories, 0);
});

test("send-prepared consumes only the sealed national snapshot without a second prepare", async () => {
  const campaignId = "11111111-1111-4111-8111-111111111111";
  let claimIndex = 0;
  const payloads: string[] = [];
  const mock = repository({
    async previewCampaign() {
      throw new Error("live audience recalculation is forbidden");
    },
    async prepareCampaign() {
      throw new Error("second prepare is forbidden");
    },
    async claimDelivery() {
      if (claimIndex >= 3) return null;
      const index = claimIndex++;
      const claim: NewsletterEdition09CampaignClaim = {
        deliveryId: `00000000-0000-4000-8000-00000000000${index + 1}`,
        campaignId,
        subscriberId: `10000000-0000-4000-8000-00000000000${index + 1}`,
        recipientEmail: `qa${index + 1}@example.com`,
        claimId: `20000000-0000-4000-8000-00000000000${index + 1}`,
        attemptCount: 1,
        idempotencyKey: `edition09-${index + 1}`,
        contentVariant: "national",
      };
      return claim;
    },
  });
  const client: NewsletterEdition09CampaignClient = {
    async sendEmail(payload) {
      payloads.push(payload.html);
      return {
        status: "accepted",
        providerMessageId: `provider-${payloads.length}`,
      };
    },
  };
  const result = await executeNewsletterEdition09Campaign({
    request: {
      ...mutationRequest(),
      sendPrepared: true,
      prepareOnly: false,
      limit: 3,
      confirmCampaignId: campaignId,
    },
    environment: mutationEnvironment(),
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_09_SENDER,
    replyTo: NEWSLETTER_EDITION_09_REPLY_TO,
    preparedCampaignSeal: {
      campaignId,
      deliveryCount: 3,
      variantCounts: { national: 3 },
    },
    clientFactory: () => client,
    tokenFactory: () =>
      `edition09-send-token-${String(claimIndex).padStart(32, "0")}`,
    tokenHasher: (token) => createHash("sha256").update(token).digest("hex"),
  });
  assert.equal(result.status, "prepared_sent");
  assert.equal(result.processedCount, 3);
  assert.equal(mock.calls.preview, 0);
  assert.equal(mock.calls.prepare, 0);
  assert.equal(claimIndex, 3);
  assert.equal(mock.calls.accepted, 3);
  assert.equal(payloads.length, 3);
  for (const html of payloads) assert.doesNotMatch(html, /Lo próximo cerca de ti/i);
});

test("send-prepared requires a reviewed seal before any repository call", async () => {
  const mock = repository();
  await assert.rejects(
    executeNewsletterEdition09Campaign({
      request: {
        ...mutationRequest(),
        sendPrepared: true,
        prepareOnly: false,
        confirmCampaignId: "11111111-1111-4111-8111-111111111111",
      },
      environment: mutationEnvironment(),
      source: await sourceFixture(),
      repository: mock.value,
      sender: NEWSLETTER_EDITION_09_SENDER,
      replyTo: NEWSLETTER_EDITION_09_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition09CampaignError &&
      error.code === "prepared_campaign_not_sealed",
  );
  assert.deepEqual(mock.calls, { preview: 0, prepare: 0, claim: 0, accepted: 0 });
});

test("campaign CLI preserves MAX_LIMIT=500 and separated modes", () => {
  assert.equal(parseNewsletterEdition09CampaignArguments(["--limit", "500"]).limit, 500);
  assert.throws(
    () => parseNewsletterEdition09CampaignArguments(["--limit", "501"]),
    (error) =>
      error instanceof NewsletterEdition09CampaignError &&
      error.code === "limit_invalid",
  );
  assert.throws(
    () =>
      parseNewsletterEdition09CampaignArguments([
        "--send-prepared",
        "--prepare-only",
      ]),
    (error) =>
      error instanceof NewsletterEdition09CampaignError &&
      error.code === "send_prepared_mode_conflict",
  );
  assert.deepEqual(newsletterEdition09CampaignIdentity(), {
    editionKey: NEWSLETTER_EDITION_09_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_09_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_09_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_09_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_09_CONTENT_MANIFEST_SHA256,
  });
});
