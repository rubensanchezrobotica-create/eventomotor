import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_12_ASSET_MANIFEST,
  NEWSLETTER_EDITION_12_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_12_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_12_HTML_SHA256,
  NEWSLETTER_EDITION_12_PREHEADER,
  NEWSLETTER_EDITION_12_REPLY_TO,
  NEWSLETTER_EDITION_12_SENDER,
  NEWSLETTER_EDITION_12_SUBJECT,
  NEWSLETTER_EDITION_12_TERRITORIAL_MODULES,
  NEWSLETTER_EDITION_12_TEXT_SHA256,
  NewsletterEdition12ContentError,
  canonicalizeEdition12Text,
  newsletterEdition12ContentManifestDigest,
  newsletterEdition12ContentVariantForRegion,
  prepareEdition12Content,
  prepareEdition12PreviewContent,
  validateEdition12SourceIntegrity,
  type NewsletterEdition12ContentVariant,
  type NewsletterEdition12Source,
} from "@/lib/newsletter/edition-12-content";
import {
  NEWSLETTER_EDITION_12_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_12_CAMPAIGN_CONFIRM_PHRASE,
  NewsletterEdition12CampaignError,
  executeNewsletterEdition12Campaign,
  newsletterEdition12CampaignIdentity,
  parseNewsletterEdition12CampaignArguments,
  type NewsletterEdition12CampaignClaim,
  type NewsletterEdition12CampaignClient,
  type NewsletterEdition12CampaignRepository,
  type NewsletterEdition12CampaignSummary,
} from "@/lib/newsletter/edition-12-campaign";
import {
  NEWSLETTER_EDITION_12_CANONICAL_RENDER_SHA256,
  NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
} from "@/lib/newsletter/edition-12-render-seal";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-22";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition12-test-token-fixture-000000000000";

async function sourceFixture(): Promise<NewsletterEdition12Source> {
  const [html, text, assetManifest, assets] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_12_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(assets) };
}

function summary(
  overrides: Partial<NewsletterEdition12CampaignSummary> = {},
): NewsletterEdition12CampaignSummary {
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
    armed: NEWSLETTER_EDITION_12_CAMPAIGN_ARMED_VALUE,
    apiKey: "re_edition12_test_api_key_1234567890",
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
    confirmEdition: NEWSLETTER_EDITION_12_CAMPAIGN_KEY,
    confirmPhrase: NEWSLETTER_EDITION_12_CAMPAIGN_CONFIRM_PHRASE,
  };
}

function repository(overrides: Partial<NewsletterEdition12CampaignRepository> = {}) {
  const calls = { preview: 0, prepare: 0, claim: 0, accepted: 0 };
  const value: NewsletterEdition12CampaignRepository = {
    async previewCampaign() {
      calls.preview += 1;
      return summary();
    },
    async prepareCampaign() {
      calls.prepare += 1;
      return summary({
        campaignId: "11111111-1111-4111-8111-111111111111",
        campaignStatus: "prepared",
        audienceFrozenAt: "2026-10-22T08:00:00.000Z",
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

test("canonical Edition 12 source, manifest and visual hardening are sealed", async () => {
  const source = await sourceFixture();
  const validated = validateEdition12SourceIntegrity(source);
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
  assert.equal(NEWSLETTER_EDITION_12_CAMPAIGN_KEY, "agenda_motor_2026_10_22");
  assert.equal(
    NEWSLETTER_EDITION_12_SUBJECT,
    "Barcelona cierra el GT Open: un fin de semana de finales",
  );
  assert.equal(
    NEWSLETTER_EDITION_12_PREHEADER,
    "GT Open en Montmeló, clásicos en MotorLand, rally en Valencia y motocross en Talavera.",
  );
  assert.equal(newsletterEdition12ContentManifestDigest(), NEWSLETTER_EDITION_12_CONTENT_MANIFEST_SHA256);
  assert.equal(createHash("sha256").update(canonicalizeEdition12Text(source.html)).digest("hex"), NEWSLETTER_EDITION_12_HTML_SHA256);
  assert.equal(createHash("sha256").update(canonicalizeEdition12Text(source.text)).digest("hex"), NEWSLETTER_EDITION_12_TEXT_SHA256);
  assert.match(source.html, /Esta semana ponemos el foco en Barcelona\. El International GT Open cierra su temporada en Montmeló/);
  assert.match(source.html, /bgcolor="#050608"/);
  assert.match(source.html, /bgcolor="#090b0f"/);
  assert.match(source.html, /width="42%"/);
  assert.match(source.html, /width="58%"/);
  assert.match(source.html, /max-width:700px/);
  assert.doesNotMatch(source.html, /mix-blend-mode|linear-gradient|color-scheme/i);
});

test("canonical render hashes use the fixed preview unsubscribe fixture", async () => {
  assert.equal(
    NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    "https://www.eventomotor.com/newsletter/unsubscribe?token=edition12-preview-token-fixture-000000000000",
  );
  const source = await sourceFixture();
  for (const variant of ["national", "madrid"] as const) {
    const rendered = prepareEdition12Content(
      source,
      variant,
      NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    );
    const preview = prepareEdition12PreviewContent(
      source,
      variant,
      NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    );
    const savedPreview = await readFile(
      resolve(ROOT, EDITION_DIRECTORY, `preview-${variant}.html`),
      "utf8",
    );
    assert.equal(
      canonicalizeEdition12Text(preview.html),
      canonicalizeEdition12Text(savedPreview),
    );
    assert.equal(
      createHash("sha256").update(canonicalizeEdition12Text(rendered.html), "utf8").digest("hex"),
      NEWSLETTER_EDITION_12_CANONICAL_RENDER_SHA256[variant].html,
    );
    assert.equal(
      createHash("sha256").update(canonicalizeEdition12Text(rendered.text), "utf8").digest("hex"),
      NEWSLETTER_EDITION_12_CANONICAL_RENDER_SHA256[variant].text,
    );
  }
});

test("five canonical EventoMotor event URLs and the official Jarama fallback carry UTM markers", async () => {
  const source = await sourceFixture();
  const allUrls = [
    "international-gt-open-circuit-de-barcelona-catalunya-2026-10-24",
    "motorland-classic-festival-2026-10-24",
    "rallye-ciudad-de-valencia-2026-10-23",
    "campeonato-de-espana-de-motocross-talavera-2026-10-24",
    "xxiii-rally-costa-brava-historic-2026-10-29",
  ];
  const renders = (["national", "madrid"] as const).map(
    (variant) => prepareEdition12Content(source, variant, UNSUBSCRIBE_URL),
  );
  for (const slug of allUrls) {
    assert.equal(renders.some((rendered) => rendered.html.includes(`/evento/${slug}?`)), true, slug);
  }
  assert.equal(renders[1]?.html.includes("https://www.jarama.org/competicion/crv?utm_source=la_agenda_motor"), true);
  for (const rendered of renders) {
    assert.doesNotMatch(rendered.html, /\{\{(?:unsubscribe_url|territorial_block)\}\}/);
    assert.match(rendered.html, /utm_source=la_agenda_motor/);
    assert.match(rendered.html, /utm_medium=email/);
    assert.match(rendered.html, /utm_campaign=agenda_motor_2026_10_22/);
    assert.match(rendered.html, /newsletter\/unsubscribe\?token=/);
  }
});

test("region_slug mapping is central, extensible and falls back to national", () => {
  assert.deepEqual(Object.keys(NEWSLETTER_EDITION_12_TERRITORIAL_MODULES).sort(), [
    "comunidad-de-madrid",
  ]);
  assert.equal(newsletterEdition12ContentVariantForRegion("comunidad-de-madrid"), "madrid");
  for (const region of ["cataluna", "comunidad-valenciana", "andalucia", "galicia", "", "region-desconocida", null, undefined]) {
    assert.equal(newsletterEdition12ContentVariantForRegion(region), "national");
  }
});

test("territorial modules are mutually exclusive and national events are not duplicated", async () => {
  const source = await sourceFixture();
  const expected: Record<NewsletterEdition12ContentVariant, string | null> = {
    national: null,
    madrid: "Campeonato RACE de Velocidad + GR Cup Spain",
  };
  const titles = Object.values(expected).filter((title): title is string => title !== null);
  for (const variant of Object.keys(expected) as NewsletterEdition12ContentVariant[]) {
    const rendered = prepareEdition12Content(source, variant, UNSUBSCRIBE_URL);
    for (const title of titles) {
      assert.equal(rendered.html.includes(title), expected[variant] === title);
      assert.equal(rendered.text.includes(title), expected[variant] === title);
    }
    assert.equal(rendered.html.includes("LO PRÓXIMO CERCA DE TI"), false);
    assert.equal(rendered.html.includes("Lo próximo cerca de ti"), variant !== "national");
    for (const slug of [
      "international-gt-open-circuit-de-barcelona-catalunya-2026-10-24",
      "motorland-classic-festival-2026-10-24",
      "rallye-ciudad-de-valencia-2026-10-23",
      "campeonato-de-espana-de-motocross-talavera-2026-10-24",
      "xxiii-rally-costa-brava-historic-2026-10-29",
    ]) {
      assert.equal((rendered.html.match(new RegExp(slug, "g")) ?? []).length, 2);
    }
  }
});

test("Andalucía, Galicia, empty and unknown region renders equal national HTML", async () => {
  const source = await sourceFixture();
  const national = prepareEdition12Content(source, "national", UNSUBSCRIBE_URL);
  for (const region of ["cataluna", "comunidad-valenciana", "andalucia", "galicia", "", "unknown", null, undefined]) {
    const variant = newsletterEdition12ContentVariantForRegion(region);
    const rendered = prepareEdition12Content(source, variant, UNSUBSCRIBE_URL);
    assert.equal(rendered.html, national.html);
    assert.equal(rendered.text, national.text);
  }
});

test("local previews rewrite every image without changing links", async () => {
  const source = await sourceFixture();
  for (const variant of ["national", "madrid"] as const) {
    const preview = prepareEdition12PreviewContent(source, variant, UNSUBSCRIBE_URL);
    assert.doesNotMatch(preview.html, /https:\/\/www\.eventomotor\.com\/newsletter\/2026-10-22\/assets\//);
    assert.equal((preview.html.match(/src="assets\//g) ?? []).length, preview.imageCount);
  }
});

test("tampered source and unsafe unsubscribe URLs fail closed", async () => {
  const source = await sourceFixture();
  assert.throws(
    () => validateEdition12SourceIntegrity({ ...source, html: `${source.html} ` }),
    (error) => error instanceof NewsletterEdition12ContentError && error.code === "template_digest_mismatch",
  );
  assert.throws(
    () => prepareEdition12Content(source, "national", "http://evil.invalid/unsubscribe?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    (error) => error instanceof NewsletterEdition12ContentError && error.code === "unsubscribe_url_invalid",
  );
});

test("Edition 12 migration freezes variants from subscriber.region_slug", async () => {
  const migration = await readFile(
    resolve(ROOT, "database/migrations/20261021120000_newsletter_edition_12_madrid.sql"),
    "utf8",
  );
  assert.match(migration, /newsletter_edition_12_content_variant\(subscriber\.region_slug\)/);
  assert.doesNotMatch(migration, /newsletter_edition_12_content_variant\(subscriber\.province_slug\)/);
  assert.match(migration, /when 'comunidad-de-madrid' then 'madrid'/);
  assert.doesNotMatch(migration, /when 'cataluna' then 'cataluna'/);
  assert.doesNotMatch(migration, /alter table|drop constraint|add constraint/i);
  assert.match(migration, /if v_campaign\.audience_frozen_at is null then/);
  assert.match(migration, /on conflict on constraint newsletter_campaign_deliveries_recipient_key do nothing/);
  assert.match(migration, /grant execute on function public\.preview_newsletter_campaign_edition_12/);
  assert.doesNotMatch(migration, /grant execute[\s\S]+to anon|grant execute[\s\S]+to authenticated/i);
});

test("campaign dry-run uses preview only and performs no mutation", async () => {
  const mock = repository();
  const result = await executeNewsletterEdition12Campaign({
    request: { sendPrepared: false, prepareOnly: false, limit: 25 },
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
  });
  assert.equal(result.status, "dry_run");
  assert.deepEqual(mock.calls, { preview: 1, prepare: 0, claim: 0, accepted: 0 });
});

test("prepare-only freezes once and does not claim or contact a provider", async () => {
  const mock = repository();
  let providerFactories = 0;
  const result = await executeNewsletterEdition12Campaign({
    request: mutationRequest(),
    environment: mutationEnvironment(),
    source: await sourceFixture(),
    repository: mock.value,
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
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
  const variants: readonly NewsletterEdition12ContentVariant[] = Array.from(
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
      const claim: NewsletterEdition12CampaignClaim = {
        deliveryId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        campaignId,
        subscriberId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        recipientEmail: `qa${index + 1}@example.com`,
        claimId: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        attemptCount: 1,
        idempotencyKey: `edition12-${index + 1}`,
        contentVariant: variants[index] ?? "national",
      };
      return claim;
    },
  });
  const client: NewsletterEdition12CampaignClient = {
    async sendEmail(payload) {
      payloadVariants.push(payload.html);
      return {
        status: "accepted",
        providerMessageId: `provider-${payloadVariants.length}`,
      };
    },
  };
  const result = await executeNewsletterEdition12Campaign({
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
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
    preparedCampaignSeal: {
      campaignId,
      deliveryCount: 120,
      variantCounts: {
        national: 90,
        madrid: 30,
      },
    },
    clientFactory: () => client,
    tokenFactory: () => `edition12-send-token-${String(claimIndex).padStart(32, "0")}`,
    tokenHasher: (token) => createHash("sha256").update(token).digest("hex"),
  });
  assert.equal(result.status, "prepared_sent");
  assert.equal(result.processedCount, 120);
  assert.equal(mock.calls.preview, 0);
  assert.equal(mock.calls.prepare, 0);
  assert.equal(claimIndex, 120);
  assert.equal(mock.calls.accepted, 120);
  assert.equal(payloadVariants.length, 120);
  assert.equal(payloadVariants.filter((html) => html.includes("Campeonato RACE de Velocidad + GR Cup Spain")).length, 30);
  assert.equal(payloadVariants.filter((html) => !html.includes("Lo próximo cerca de ti")).length, 90);
});

test("send-prepared requires a reviewed seal before any repository call", async () => {
  const mock = repository();
  await assert.rejects(
    executeNewsletterEdition12Campaign({
      request: {
        ...mutationRequest(),
        sendPrepared: true,
        prepareOnly: false,
        confirmCampaignId: "11111111-1111-4111-8111-111111111111",
      },
      environment: mutationEnvironment(),
      source: await sourceFixture(),
      repository: mock.value,
      sender: NEWSLETTER_EDITION_12_SENDER,
      replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition12CampaignError &&
      error.code === "prepared_campaign_not_sealed",
  );
  await assert.rejects(
    executeNewsletterEdition12Campaign({
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
      sender: NEWSLETTER_EDITION_12_SENDER,
      replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
      preparedCampaignSeal: {
        campaignId: "11111111-1111-4111-8111-111111111111",
        deliveryCount: 501,
        variantCounts: { national: 501, madrid: 0 },
      },
    }),
    (error) =>
      error instanceof NewsletterEdition12CampaignError &&
      error.code === "prepared_campaign_seal_invalid",
  );
  assert.deepEqual(mock.calls, { preview: 0, prepare: 0, claim: 0, accepted: 0 });
});

test("campaign CLI preserves MAX_LIMIT=500 and separated modes", () => {
  assert.equal(parseNewsletterEdition12CampaignArguments(["--limit", "500"]).limit, 500);
  assert.throws(
    () => parseNewsletterEdition12CampaignArguments(["--limit", "501"]),
    (error) => error instanceof NewsletterEdition12CampaignError && error.code === "limit_invalid",
  );
  assert.throws(
    () => parseNewsletterEdition12CampaignArguments(["--send-prepared", "--prepare-only"]),
    (error) =>
      error instanceof NewsletterEdition12CampaignError &&
      error.code === "send_prepared_mode_conflict",
  );
  assert.deepEqual(newsletterEdition12CampaignIdentity(), {
    editionKey: NEWSLETTER_EDITION_12_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_12_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_12_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_12_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_12_CONTENT_MANIFEST_SHA256,
  });
});
