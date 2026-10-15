import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_11_ASSET_MANIFEST,
  NEWSLETTER_EDITION_11_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_11_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_11_HTML_SHA256,
  NEWSLETTER_EDITION_11_PREHEADER,
  NEWSLETTER_EDITION_11_REPLY_TO,
  NEWSLETTER_EDITION_11_SENDER,
  NEWSLETTER_EDITION_11_SUBJECT,
  NEWSLETTER_EDITION_11_TERRITORIAL_MODULES,
  NEWSLETTER_EDITION_11_TEXT_SHA256,
  NewsletterEdition11ContentError,
  canonicalizeEdition11Text,
  newsletterEdition11ContentManifestDigest,
  newsletterEdition11ContentVariantForRegion,
  prepareEdition11Content,
  prepareEdition11PreviewContent,
  validateEdition11SourceIntegrity,
  type NewsletterEdition11ContentVariant,
  type NewsletterEdition11Source,
} from "@/lib/newsletter/edition-11-content";
import {
  NEWSLETTER_EDITION_11_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_11_CAMPAIGN_CONFIRM_PHRASE,
  NewsletterEdition11CampaignError,
  executeNewsletterEdition11Campaign,
  newsletterEdition11CampaignIdentity,
  parseNewsletterEdition11CampaignArguments,
  type NewsletterEdition11CampaignClaim,
  type NewsletterEdition11CampaignClient,
  type NewsletterEdition11CampaignRepository,
  type NewsletterEdition11CampaignSummary,
} from "@/lib/newsletter/edition-11-campaign";
import {
  NEWSLETTER_EDITION_11_CANONICAL_RENDER_SHA256,
  NEWSLETTER_EDITION_11_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
} from "@/lib/newsletter/edition-11-render-seal";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-15";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition11-test-token-fixture-000000000000";

async function sourceFixture(): Promise<NewsletterEdition11Source> {
  const [html, text, assetManifest, assets] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_11_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(assets) };
}

function summary(
  overrides: Partial<NewsletterEdition11CampaignSummary> = {},
): NewsletterEdition11CampaignSummary {
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
    madridCount: 40,
    excludedCount: 2,
    duplicateCount: 0,
    invalidCount: 0,
    ...overrides,
  };
}

function mutationEnvironment() {
  return {
    armed: NEWSLETTER_EDITION_11_CAMPAIGN_ARMED_VALUE,
    apiKey: "re_edition11_test_api_key_1234567890",
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
    confirmEdition: NEWSLETTER_EDITION_11_CAMPAIGN_KEY,
    confirmPhrase: NEWSLETTER_EDITION_11_CAMPAIGN_CONFIRM_PHRASE,
  };
}

function repository(overrides: Partial<NewsletterEdition11CampaignRepository> = {}) {
  const calls = { preview: 0, prepare: 0, claim: 0, accepted: 0 };
  const value: NewsletterEdition11CampaignRepository = {
    async previewCampaign() {
      calls.preview += 1;
      return summary();
    },
    async prepareCampaign() {
      calls.prepare += 1;
      return summary({
        campaignId: "11111111-1111-4111-8111-111111111111",
        campaignStatus: "prepared",
        audienceFrozenAt: "2026-10-15T08:00:00.000Z",
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

test("canonical Edition 11 source, manifest and visual hardening are sealed", async () => {
  const source = await sourceFixture();
  const validated = validateEdition11SourceIntegrity(source);
  assert.deepEqual(validated, {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 8,
  });
  assert.equal(NEWSLETTER_EDITION_11_CAMPAIGN_KEY, "agenda_motor_2026_10_15");
  assert.equal(
    NEWSLETTER_EDITION_11_SUBJECT,
    "Barcelona, Jerez y RallyRACC: fin de semana grande",
  );
  assert.equal(
    NEWSLETTER_EDITION_11_PREHEADER,
    "WEC en Montmeló, final de WorldSBK, RallyRACC y BMW Motorrad Days en Peñíscola.",
  );
  assert.equal(newsletterEdition11ContentManifestDigest(), NEWSLETTER_EDITION_11_CONTENT_MANIFEST_SHA256);
  assert.equal(createHash("sha256").update(canonicalizeEdition11Text(source.html)).digest("hex"), NEWSLETTER_EDITION_11_HTML_SHA256);
  assert.equal(createHash("sha256").update(canonicalizeEdition11Text(source.text)).digest("hex"), NEWSLETTER_EDITION_11_TEXT_SHA256);
  assert.match(source.html, /Esta semana cuesta elegir por dónde empezar\. El WEC se estrena en Barcelona, WorldSBK cierra la temporada en Jerez y el RallyRACC pone punto final al S-CER\./);
  assert.match(source.html, /bgcolor="#050608"/);
  assert.match(source.html, /bgcolor="#090b0f"/);
  assert.match(source.html, /width="42%"/);
  assert.match(source.html, /width="58%"/);
  assert.match(source.html, /max-width:700px/);
  assert.doesNotMatch(source.html, /mix-blend-mode|linear-gradient|color-scheme/i);
});

test("canonical render hashes use the fixed preview unsubscribe fixture", async () => {
  assert.equal(
    NEWSLETTER_EDITION_11_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    "https://www.eventomotor.com/newsletter/unsubscribe?token=edition11-preview-token-fixture-000000000000",
  );
  const source = await sourceFixture();
  for (const variant of ["national", "madrid"] as const) {
    const rendered = prepareEdition11Content(
      source,
      variant,
      NEWSLETTER_EDITION_11_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    );
    const preview = prepareEdition11PreviewContent(
      source,
      variant,
      NEWSLETTER_EDITION_11_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    );
    const savedPreview = await readFile(
      resolve(ROOT, EDITION_DIRECTORY, `preview-${variant}.html`),
      "utf8",
    );
    assert.equal(
      canonicalizeEdition11Text(preview.html),
      canonicalizeEdition11Text(savedPreview),
    );
    assert.equal(
      createHash("sha256").update(canonicalizeEdition11Text(rendered.html), "utf8").digest("hex"),
      NEWSLETTER_EDITION_11_CANONICAL_RENDER_SHA256[variant].html,
    );
    assert.equal(
      createHash("sha256").update(canonicalizeEdition11Text(rendered.text), "utf8").digest("hex"),
      NEWSLETTER_EDITION_11_CANONICAL_RENDER_SHA256[variant].text,
    );
  }
});

test("all six canonical EventoMotor URLs and UTM markers are present", async () => {
  const source = await sourceFixture();
  const allUrls = [
    "fia-wec-6-horas-de-barcelona-2026-10-16",
    "worldsbk-jerez-pirelli-spanish-round-2026-10-16",
    "rallyracc-catalunya-2026-10-17",
    "bmw-motorrad-days-peniscola-2026-10-16",
    "motorland-classic-festival-2026-10-24",
    "xxvii-jornada-puertas-abiertas-fundacion-race-2026-10-17",
  ];
  const renders = (["national", "madrid"] as const).map(
    (variant) => prepareEdition11Content(source, variant, UNSUBSCRIBE_URL),
  );
  for (const slug of allUrls) {
    assert.equal(renders.some((rendered) => rendered.html.includes(`/evento/${slug}?`)), true, slug);
  }
  for (const rendered of renders) {
    assert.doesNotMatch(rendered.html, /\{\{(?:unsubscribe_url|territorial_block)\}\}/);
    assert.match(rendered.html, /utm_source=la_agenda_motor/);
    assert.match(rendered.html, /utm_medium=email/);
    assert.match(rendered.html, /utm_campaign=agenda_motor_2026_10_15/);
    assert.match(rendered.html, /newsletter\/unsubscribe\?token=/);
  }
});

test("region_slug mapping is central, extensible and falls back to national", () => {
  assert.deepEqual(Object.keys(NEWSLETTER_EDITION_11_TERRITORIAL_MODULES).sort(), [
    "comunidad-de-madrid",
  ]);
  assert.equal(newsletterEdition11ContentVariantForRegion("comunidad-de-madrid"), "madrid");
  for (const region of ["cataluna", "comunidad-valenciana", "andalucia", "galicia", "", "region-desconocida", null, undefined]) {
    assert.equal(newsletterEdition11ContentVariantForRegion(region), "national");
  }
});

test("territorial modules are mutually exclusive and national events are not duplicated", async () => {
  const source = await sourceFixture();
  const expected: Record<NewsletterEdition11ContentVariant, string | null> = {
    national: null,
    madrid: "XXVII Jornada de Puertas Abiertas · Fundación RACE",
  };
  const titles = Object.values(expected).filter((title): title is string => title !== null);
  for (const variant of Object.keys(expected) as NewsletterEdition11ContentVariant[]) {
    const rendered = prepareEdition11Content(source, variant, UNSUBSCRIBE_URL);
    for (const title of titles) {
      assert.equal(rendered.html.includes(title), expected[variant] === title);
      assert.equal(rendered.text.includes(title), expected[variant] === title);
    }
    assert.equal(rendered.html.includes("LO PRÓXIMO CERCA DE TI"), false);
    assert.equal(rendered.html.includes("Lo próximo cerca de ti"), variant !== "national");
    for (const slug of [
      "fia-wec-6-horas-de-barcelona-2026-10-16",
      "worldsbk-jerez-pirelli-spanish-round-2026-10-16",
      "rallyracc-catalunya-2026-10-17",
      "bmw-motorrad-days-peniscola-2026-10-16",
      "motorland-classic-festival-2026-10-24",
    ]) {
      assert.equal((rendered.html.match(new RegExp(slug, "g")) ?? []).length, 2);
    }
  }
});

test("Andalucía, Galicia, empty and unknown region renders equal national HTML", async () => {
  const source = await sourceFixture();
  const national = prepareEdition11Content(source, "national", UNSUBSCRIBE_URL);
  for (const region of ["cataluna", "comunidad-valenciana", "andalucia", "galicia", "", "unknown", null, undefined]) {
    const variant = newsletterEdition11ContentVariantForRegion(region);
    const rendered = prepareEdition11Content(source, variant, UNSUBSCRIBE_URL);
    assert.equal(rendered.html, national.html);
    assert.equal(rendered.text, national.text);
  }
});

test("local previews rewrite every image without changing links", async () => {
  const source = await sourceFixture();
  for (const variant of ["national", "madrid"] as const) {
    const preview = prepareEdition11PreviewContent(source, variant, UNSUBSCRIBE_URL);
    assert.doesNotMatch(preview.html, /https:\/\/www\.eventomotor\.com\/newsletter\/2026-10-15\/assets\//);
    assert.equal((preview.html.match(/src="assets\//g) ?? []).length, preview.imageCount);
  }
});

test("tampered source and unsafe unsubscribe URLs fail closed", async () => {
  const source = await sourceFixture();
  assert.throws(
    () => validateEdition11SourceIntegrity({ ...source, html: `${source.html} ` }),
    (error) => error instanceof NewsletterEdition11ContentError && error.code === "template_digest_mismatch",
  );
  assert.throws(
    () => prepareEdition11Content(source, "national", "http://evil.invalid/unsubscribe?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    (error) => error instanceof NewsletterEdition11ContentError && error.code === "unsubscribe_url_invalid",
  );
});

test("Edition 11 migration freezes variants from subscriber.region_slug", async () => {
  const migration = await readFile(
    resolve(ROOT, "database/migrations/20261014120000_newsletter_edition_11_madrid.sql"),
    "utf8",
  );
  assert.match(migration, /newsletter_edition_11_content_variant\(subscriber\.region_slug\)/);
  assert.doesNotMatch(migration, /newsletter_edition_11_content_variant\(subscriber\.province_slug\)/);
  assert.match(migration, /when 'comunidad-de-madrid' then 'madrid'/);
  assert.doesNotMatch(migration, /when 'cataluna' then 'cataluna'/);
  assert.doesNotMatch(migration, /alter table|drop constraint|add constraint/i);
  assert.match(migration, /if v_campaign\.audience_frozen_at is null then/);
  assert.match(migration, /on conflict on constraint newsletter_campaign_deliveries_recipient_key do nothing/);
  assert.match(migration, /grant execute on function public\.preview_newsletter_campaign_edition_11/);
  assert.doesNotMatch(migration, /grant execute[\s\S]+to anon|grant execute[\s\S]+to authenticated/i);
});

test("campaign dry-run uses preview only and performs no mutation", async () => {
  const mock = repository();
  const result = await executeNewsletterEdition11Campaign({
    request: { sendPrepared: false, prepareOnly: false, limit: 25 },
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_11_SENDER,
    replyTo: NEWSLETTER_EDITION_11_REPLY_TO,
  });
  assert.equal(result.status, "dry_run");
  assert.deepEqual(mock.calls, { preview: 1, prepare: 0, claim: 0, accepted: 0 });
});

test("prepare-only freezes once and does not claim or contact a provider", async () => {
  const mock = repository();
  let providerFactories = 0;
  const result = await executeNewsletterEdition11Campaign({
    request: mutationRequest(),
    environment: mutationEnvironment(),
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_11_SENDER,
    replyTo: NEWSLETTER_EDITION_11_REPLY_TO,
    clientFactory: () => {
      providerFactories += 1;
      throw new Error("provider must not be constructed during prepare-only");
    },
  });
  assert.equal(result.status, "prepared");
  assert.deepEqual(mock.calls, { preview: 0, prepare: 1, claim: 0, accepted: 0 });
  assert.equal(providerFactories, 0);
});

test("send-prepared consumes one mixed snapshot above 100 without prepare or regional recalculation", async () => {
  const campaignId = "11111111-1111-4111-8111-111111111111";
  const variants: readonly NewsletterEdition11ContentVariant[] = Array.from(
    { length: 120 },
    (_, index) => (index % 4 === 0 ? "madrid" : "national"),
  );
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
      const claim: NewsletterEdition11CampaignClaim = {
        deliveryId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        campaignId,
        subscriberId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        recipientEmail: `qa${index + 1}@example.com`,
        claimId: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        attemptCount: 1,
        idempotencyKey: `edition11-${index + 1}`,
        contentVariant: variants[index] ?? "national",
      };
      return claim;
    },
  });
  const client: NewsletterEdition11CampaignClient = {
    async sendEmail(payload) {
      payloadVariants.push(payload.html);
      return {
        status: "accepted",
        providerMessageId: `provider-${payloadVariants.length}`,
      };
    },
  };
  const result = await executeNewsletterEdition11Campaign({
    request: {
      ...mutationRequest(),
      sendPrepared: true,
      prepareOnly: false,
      limit: 120,
      confirmCampaignId: campaignId,
    },
    environment: mutationEnvironment(),
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_11_SENDER,
    replyTo: NEWSLETTER_EDITION_11_REPLY_TO,
    preparedCampaignSeal: {
      campaignId,
      deliveryCount: 120,
      variantCounts: {
        national: 90,
        madrid: 30,
      },
    },
    clientFactory: () => client,
    tokenFactory: () => `edition11-send-token-${String(claimIndex).padStart(32, "0")}`,
    tokenHasher: (token) => createHash("sha256").update(token).digest("hex"),
  });
  assert.equal(result.status, "prepared_sent");
  assert.equal(result.processedCount, 120);
  assert.equal(mock.calls.preview, 0);
  assert.equal(mock.calls.prepare, 0);
  assert.equal(claimIndex, 120);
  assert.equal(mock.calls.accepted, 120);
  assert.equal(payloadVariants.length, 120);
  assert.equal(payloadVariants.filter((html) => html.includes("XXVII Jornada de Puertas Abiertas · Fundación RACE")).length, 30);
  assert.equal(payloadVariants.filter((html) => !html.includes("Lo próximo cerca de ti")).length, 90);
});

test("send-prepared requires a reviewed seal before any repository call", async () => {
  const mock = repository();
  await assert.rejects(
    executeNewsletterEdition11Campaign({
      request: {
        ...mutationRequest(),
        sendPrepared: true,
        prepareOnly: false,
        confirmCampaignId: "11111111-1111-4111-8111-111111111111",
      },
      environment: mutationEnvironment(),
      source: await sourceFixture(),
      repository: mock.value,
      sender: NEWSLETTER_EDITION_11_SENDER,
      replyTo: NEWSLETTER_EDITION_11_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition11CampaignError &&
      error.code === "prepared_campaign_not_sealed",
  );
  await assert.rejects(
    executeNewsletterEdition11Campaign({
      request: {
        ...mutationRequest(),
        sendPrepared: true,
        prepareOnly: false,
        limit: 500,
        confirmCampaignId: "11111111-1111-4111-8111-111111111111",
      },
      environment: mutationEnvironment(),
      source: await sourceFixture(),
      repository: mock.value,
      sender: NEWSLETTER_EDITION_11_SENDER,
      replyTo: NEWSLETTER_EDITION_11_REPLY_TO,
      preparedCampaignSeal: {
        campaignId: "11111111-1111-4111-8111-111111111111",
        deliveryCount: 501,
        variantCounts: { national: 501, madrid: 0 },
      },
    }),
    (error) =>
      error instanceof NewsletterEdition11CampaignError &&
      error.code === "prepared_campaign_seal_invalid",
  );
  assert.deepEqual(mock.calls, { preview: 0, prepare: 0, claim: 0, accepted: 0 });
});

test("campaign CLI preserves MAX_LIMIT=500 and separated modes", () => {
  assert.equal(parseNewsletterEdition11CampaignArguments(["--limit", "500"]).limit, 500);
  assert.throws(
    () => parseNewsletterEdition11CampaignArguments(["--limit", "501"]),
    (error) => error instanceof NewsletterEdition11CampaignError && error.code === "limit_invalid",
  );
  assert.throws(
    () => parseNewsletterEdition11CampaignArguments(["--send-prepared", "--prepare-only"]),
    (error) =>
      error instanceof NewsletterEdition11CampaignError &&
      error.code === "send_prepared_mode_conflict",
  );
  assert.deepEqual(newsletterEdition11CampaignIdentity(), {
    editionKey: NEWSLETTER_EDITION_11_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_11_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_11_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_11_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_11_CONTENT_MANIFEST_SHA256,
  });
});
