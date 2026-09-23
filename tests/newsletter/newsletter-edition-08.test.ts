import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_08_ASSET_MANIFEST,
  NEWSLETTER_EDITION_08_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_08_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_08_HTML_SHA256,
  NEWSLETTER_EDITION_08_PREHEADER,
  NEWSLETTER_EDITION_08_REPLY_TO,
  NEWSLETTER_EDITION_08_SENDER,
  NEWSLETTER_EDITION_08_SUBJECT,
  NEWSLETTER_EDITION_08_TERRITORIAL_MODULES,
  NEWSLETTER_EDITION_08_TEXT_SHA256,
  NewsletterEdition08ContentError,
  newsletterEdition08ContentManifestDigest,
  newsletterEdition08ContentVariantForRegion,
  prepareEdition08Content,
  prepareEdition08PreviewContent,
  validateEdition08SourceIntegrity,
  type NewsletterEdition08ContentVariant,
  type NewsletterEdition08Source,
} from "@/lib/newsletter/edition-08-content";
import {
  NEWSLETTER_EDITION_08_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_08_CAMPAIGN_CONFIRM_PHRASE,
  NewsletterEdition08CampaignError,
  executeNewsletterEdition08Campaign,
  newsletterEdition08CampaignIdentity,
  parseNewsletterEdition08CampaignArguments,
  type NewsletterEdition08CampaignClaim,
  type NewsletterEdition08CampaignClient,
  type NewsletterEdition08CampaignRepository,
  type NewsletterEdition08CampaignSummary,
} from "@/lib/newsletter/edition-08-campaign";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-24";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition08-test-token-fixture-000000000000";

async function sourceFixture(): Promise<NewsletterEdition08Source> {
  const [html, text, assetManifest, assets] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_08_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(assets) };
}

function summary(
  overrides: Partial<NewsletterEdition08CampaignSummary> = {},
): NewsletterEdition08CampaignSummary {
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
    nationalCount: 104,
    madridCount: 27,
    catalunaCount: 7,
    comunidadValencianaCount: 6,
    excludedCount: 2,
    duplicateCount: 0,
    invalidCount: 0,
    ...overrides,
  };
}

function mutationEnvironment() {
  return {
    armed: NEWSLETTER_EDITION_08_CAMPAIGN_ARMED_VALUE,
    apiKey: "re_edition08_test_api_key_1234567890",
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
    confirmEdition: NEWSLETTER_EDITION_08_CAMPAIGN_KEY,
    confirmPhrase: NEWSLETTER_EDITION_08_CAMPAIGN_CONFIRM_PHRASE,
  };
}

function repository(overrides: Partial<NewsletterEdition08CampaignRepository> = {}) {
  const calls = { preview: 0, prepare: 0, claim: 0, accepted: 0 };
  const value: NewsletterEdition08CampaignRepository = {
    async previewCampaign() {
      calls.preview += 1;
      return summary();
    },
    async prepareCampaign() {
      calls.prepare += 1;
      return summary({
        campaignId: "11111111-1111-4111-8111-111111111111",
        campaignStatus: "prepared",
        audienceFrozenAt: "2026-09-24T08:00:00.000Z",
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

test("canonical Edition 08 source, manifest and visual hardening are sealed", async () => {
  const source = await sourceFixture();
  const validated = validateEdition08SourceIntegrity(source);
  assert.deepEqual(validated, {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 10,
  });
  assert.equal(NEWSLETTER_EDITION_08_CAMPAIGN_KEY, "agenda_motor_2026_09_24");
  assert.equal(
    NEWSLETTER_EDITION_08_SUBJECT,
    "Llanes, Arteixo y lo que viene este fin de semana",
  );
  assert.equal(
    NEWSLETTER_EDITION_08_PREHEADER,
    "Rallye Villa de Llanes, Trial des Nations, Jerez y Onil para un fin de semana cargado de motor.",
  );
  assert.equal(newsletterEdition08ContentManifestDigest(), NEWSLETTER_EDITION_08_CONTENT_MANIFEST_SHA256);
  assert.equal(createHash("sha256").update(source.html).digest("hex"), NEWSLETTER_EDITION_08_HTML_SHA256);
  assert.equal(createHash("sha256").update(source.text).digest("hex"), NEWSLETTER_EDITION_08_TEXT_SHA256);
  assert.match(source.html, /bgcolor="#050608"/);
  assert.match(source.html, /bgcolor="#090b0f"/);
  assert.match(source.html, /width="42%"/);
  assert.match(source.html, /width="58%"/);
  assert.match(source.html, /max-width:700px/);
  assert.doesNotMatch(source.html, /mix-blend-mode|linear-gradient|color-scheme/i);
});

test("all eight canonical EventoMotor URLs and UTM markers are present", async () => {
  const source = await sourceFixture();
  const allUrls = [
    "rallye-villa-de-llanes-2026-09-25",
    "fim-trial-des-nations-arteixo-2026-09-26",
    "racing-weekend-jerez-2026-09-26",
    "subida-internacional-onil-2026-09-26",
    "festival-de-la-velocidad-de-barcelona-gt-world-challenge-2026-10-02",
    "xtreme-challenge-madrid-2026-09-25",
    "salon-automovil-lleida-2026-09-25",
    "supercars-roow-cheste-2026-09-26",
  ];
  const renders = (["national", "madrid", "cataluna", "comunidad-valenciana"] as const).map(
    (variant) => prepareEdition08Content(source, variant, UNSUBSCRIBE_URL),
  );
  for (const slug of allUrls) {
    assert.equal(renders.some((rendered) => rendered.html.includes(`/evento/${slug}?`)), true, slug);
  }
  for (const rendered of renders) {
    assert.doesNotMatch(rendered.html, /\{\{(?:unsubscribe_url|territorial_block)\}\}/);
    assert.match(rendered.html, /utm_source=la_agenda_motor/);
    assert.match(rendered.html, /utm_medium=email/);
    assert.match(rendered.html, /utm_campaign=agenda_motor_2026_09_24/);
    assert.match(rendered.html, /newsletter\/unsubscribe\?token=/);
  }
});

test("region_slug mapping is central, extensible and falls back to national", () => {
  assert.deepEqual(Object.keys(NEWSLETTER_EDITION_08_TERRITORIAL_MODULES).sort(), [
    "cataluna",
    "comunidad-de-madrid",
    "comunidad-valenciana",
  ]);
  assert.equal(newsletterEdition08ContentVariantForRegion("comunidad-de-madrid"), "madrid");
  assert.equal(newsletterEdition08ContentVariantForRegion("cataluna"), "cataluna");
  assert.equal(
    newsletterEdition08ContentVariantForRegion("comunidad-valenciana"),
    "comunidad-valenciana",
  );
  for (const region of ["andalucia", "galicia", "", "region-desconocida", null, undefined]) {
    assert.equal(newsletterEdition08ContentVariantForRegion(region), "national");
  }
});

test("territorial modules are mutually exclusive and national events are not duplicated", async () => {
  const source = await sourceFixture();
  const expected: Record<NewsletterEdition08ContentVariant, string | null> = {
    national: null,
    madrid: "Xtreme Challenge Madrid 2026",
    cataluna: "Salón del Automóvil de Lleida 2026",
    "comunidad-valenciana": "Supercars + ROOW",
  };
  const titles = Object.values(expected).filter((title): title is string => title !== null);
  for (const variant of Object.keys(expected) as NewsletterEdition08ContentVariant[]) {
    const rendered = prepareEdition08Content(source, variant, UNSUBSCRIBE_URL);
    for (const title of titles) {
      assert.equal(rendered.html.includes(title), expected[variant] === title);
      assert.equal(rendered.text.includes(title), expected[variant] === title);
    }
    assert.equal(rendered.html.includes("LO PRÓXIMO CERCA DE TI"), false);
    assert.equal(rendered.html.includes("Lo próximo cerca de ti"), variant !== "national");
    for (const slug of [
      "fim-trial-des-nations-arteixo-2026-09-26",
      "racing-weekend-jerez-2026-09-26",
      "subida-internacional-onil-2026-09-26",
      "festival-de-la-velocidad-de-barcelona-gt-world-challenge-2026-10-02",
    ]) {
      assert.equal((rendered.html.match(new RegExp(slug, "g")) ?? []).length, 2);
    }
  }
});

test("Andalucía, Galicia, empty and unknown region renders equal national HTML", async () => {
  const source = await sourceFixture();
  const national = prepareEdition08Content(source, "national", UNSUBSCRIBE_URL);
  for (const region of ["andalucia", "galicia", "", "unknown", null, undefined]) {
    const variant = newsletterEdition08ContentVariantForRegion(region);
    const rendered = prepareEdition08Content(source, variant, UNSUBSCRIBE_URL);
    assert.equal(rendered.html, national.html);
    assert.equal(rendered.text, national.text);
  }
});

test("local previews rewrite every image without changing links", async () => {
  const source = await sourceFixture();
  for (const variant of ["national", "madrid", "cataluna", "comunidad-valenciana"] as const) {
    const preview = prepareEdition08PreviewContent(source, variant, UNSUBSCRIBE_URL);
    assert.doesNotMatch(preview.html, /https:\/\/www\.eventomotor\.com\/newsletter\/2026-09-24\/assets\//);
    assert.equal((preview.html.match(/src="assets\//g) ?? []).length, preview.imageCount);
  }
});

test("tampered source and unsafe unsubscribe URLs fail closed", async () => {
  const source = await sourceFixture();
  assert.throws(
    () => validateEdition08SourceIntegrity({ ...source, html: `${source.html} ` }),
    (error) => error instanceof NewsletterEdition08ContentError && error.code === "template_digest_mismatch",
  );
  assert.throws(
    () => prepareEdition08Content(source, "national", "http://evil.invalid/unsubscribe?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    (error) => error instanceof NewsletterEdition08ContentError && error.code === "unsubscribe_url_invalid",
  );
});

test("Edition 08 migration freezes variants from subscriber.region_slug", async () => {
  const migration = await readFile(
    resolve(ROOT, "database/migrations/20260923120000_newsletter_edition_08_regions.sql"),
    "utf8",
  );
  assert.match(migration, /newsletter_edition_08_content_variant\(subscriber\.region_slug\)/);
  assert.doesNotMatch(migration, /newsletter_edition_08_content_variant\(subscriber\.province_slug\)/);
  assert.match(migration, /when 'comunidad-de-madrid' then 'madrid'/);
  assert.match(migration, /when 'cataluna' then 'cataluna'/);
  assert.match(migration, /when 'comunidad-valenciana' then 'comunidad-valenciana'/);
  assert.match(migration, /if v_campaign\.audience_frozen_at is null then/);
  assert.match(migration, /on conflict on constraint newsletter_campaign_deliveries_recipient_key do nothing/);
  assert.match(migration, /grant execute on function public\.preview_newsletter_campaign_edition_08/);
  assert.doesNotMatch(migration, /grant execute[\s\S]+to anon|grant execute[\s\S]+to authenticated/i);
});

test("campaign dry-run uses preview only and performs no mutation", async () => {
  const mock = repository();
  const result = await executeNewsletterEdition08Campaign({
    request: { sendPrepared: false, prepareOnly: false, limit: 25 },
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
  });
  assert.equal(result.status, "dry_run");
  assert.deepEqual(mock.calls, { preview: 1, prepare: 0, claim: 0, accepted: 0 });
});

test("prepare-only freezes once and does not claim or contact a provider", async () => {
  const mock = repository();
  let providerFactories = 0;
  const result = await executeNewsletterEdition08Campaign({
    request: mutationRequest(),
    environment: mutationEnvironment(),
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    clientFactory: () => {
      providerFactories += 1;
      throw new Error("provider must not be constructed during prepare-only");
    },
  });
  assert.equal(result.status, "prepared");
  assert.deepEqual(mock.calls, { preview: 0, prepare: 1, claim: 0, accepted: 0 });
  assert.equal(providerFactories, 0);
});

test("send-prepared consumes exactly the sealed snapshot without a second prepare", async () => {
  const campaignId = "11111111-1111-4111-8111-111111111111";
  const variants: readonly NewsletterEdition08ContentVariant[] = [
    "national",
    "madrid",
    "cataluna",
    "comunidad-valenciana",
  ];
  let claimIndex = 0;
  const payloadVariants: string[] = [];
  const mock = repository({
    async previewCampaign() {
      throw new Error("live audience recalculation is forbidden");
    },
    async prepareCampaign() {
      throw new Error("second prepare is forbidden");
    },
    async claimDelivery() {
      if (claimIndex >= variants.length) return null;
      const index = claimIndex++;
      const claim: NewsletterEdition08CampaignClaim = {
        deliveryId: `00000000-0000-4000-8000-00000000000${index + 1}`,
        campaignId,
        subscriberId: `10000000-0000-4000-8000-00000000000${index + 1}`,
        recipientEmail: `qa${index + 1}@example.com`,
        claimId: `20000000-0000-4000-8000-00000000000${index + 1}`,
        attemptCount: 1,
        idempotencyKey: `edition08-${index + 1}`,
        contentVariant: variants[index] ?? "national",
      };
      return claim;
    },
  });
  const client: NewsletterEdition08CampaignClient = {
    async sendEmail(payload) {
      payloadVariants.push(payload.html);
      return {
        status: "accepted",
        providerMessageId: `provider-${payloadVariants.length}`,
      };
    },
  };
  const result = await executeNewsletterEdition08Campaign({
    request: {
      ...mutationRequest(),
      sendPrepared: true,
      prepareOnly: false,
      limit: 4,
      confirmCampaignId: campaignId,
    },
    environment: mutationEnvironment(),
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    preparedCampaignSeal: {
      campaignId,
      deliveryCount: 4,
      variantCounts: {
        national: 1,
        madrid: 1,
        cataluna: 1,
        "comunidad-valenciana": 1,
      },
    },
    clientFactory: () => client,
    tokenFactory: () => `edition08-send-token-${String(claimIndex).padStart(32, "0")}`,
    tokenHasher: (token) => createHash("sha256").update(token).digest("hex"),
  });
  assert.equal(result.status, "prepared_sent");
  assert.equal(result.processedCount, 4);
  assert.equal(mock.calls.preview, 0);
  assert.equal(mock.calls.prepare, 0);
  assert.equal(claimIndex, 4);
  assert.equal(mock.calls.accepted, 4);
  assert.equal(payloadVariants.length, 4);
  assert.doesNotMatch(payloadVariants[0] ?? "", /Lo próximo cerca de ti/);
  assert.match(payloadVariants[1] ?? "", /Xtreme Challenge Madrid 2026/);
  assert.match(payloadVariants[2] ?? "", /Salón del Automóvil de Lleida 2026/);
  assert.match(payloadVariants[3] ?? "", /Supercars \+ ROOW/);
});

test("send-prepared requires a reviewed seal before any repository call", async () => {
  const mock = repository();
  await assert.rejects(
    executeNewsletterEdition08Campaign({
      request: {
        ...mutationRequest(),
        sendPrepared: true,
        prepareOnly: false,
        confirmCampaignId: "11111111-1111-4111-8111-111111111111",
      },
      environment: mutationEnvironment(),
      source: await sourceFixture(),
      repository: mock.value,
      sender: NEWSLETTER_EDITION_08_SENDER,
      replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition08CampaignError &&
      error.code === "prepared_campaign_not_sealed",
  );
  assert.deepEqual(mock.calls, { preview: 0, prepare: 0, claim: 0, accepted: 0 });
});

test("campaign CLI preserves MAX_LIMIT=500 and separated modes", () => {
  assert.equal(parseNewsletterEdition08CampaignArguments(["--limit", "500"]).limit, 500);
  assert.throws(
    () => parseNewsletterEdition08CampaignArguments(["--limit", "501"]),
    (error) => error instanceof NewsletterEdition08CampaignError && error.code === "limit_invalid",
  );
  assert.throws(
    () => parseNewsletterEdition08CampaignArguments(["--send-prepared", "--prepare-only"]),
    (error) =>
      error instanceof NewsletterEdition08CampaignError &&
      error.code === "send_prepared_mode_conflict",
  );
  assert.deepEqual(newsletterEdition08CampaignIdentity(), {
    editionKey: NEWSLETTER_EDITION_08_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_08_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_08_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_08_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_08_CONTENT_MANIFEST_SHA256,
  });
});
