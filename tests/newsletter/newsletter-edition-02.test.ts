import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_01_CAMPAIGN_KEY,
} from "@/lib/newsletter/edition-01-campaign";
import {
  NEWSLETTER_EDITION_02_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_02_REPLY_TO,
  NEWSLETTER_EDITION_02_SENDER,
  NEWSLETTER_EDITION_02_SUBJECT,
  NewsletterEdition02CampaignError,
  executeNewsletterEdition02Campaign,
  newsletterEdition02CampaignIdentity,
  parseNewsletterEdition02CampaignArguments,
  type NewsletterEdition02CampaignClaim,
  type NewsletterEdition02CampaignRepository,
  type NewsletterEdition02CampaignSummary,
} from "@/lib/newsletter/edition-02-campaign";
import {
  NEWSLETTER_EDITION_02_ASSET_MANIFEST,
  NEWSLETTER_EDITION_02_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_02_HTML_SHA256,
  NEWSLETTER_EDITION_02_PREHEADER,
  NEWSLETTER_EDITION_02_TEXT_SHA256,
  NewsletterEdition02ContentError,
  canonicalizeEdition02Text,
  newsletterEdition02ContentManifestDigest,
  prepareEdition02Content,
  prepareEdition02PreviewContent,
  validateEdition02SourceIntegrity,
  type NewsletterEdition02ContentVariant,
  type NewsletterEdition02Source,
} from "@/lib/newsletter/edition-02-content";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-13";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition02-preview-token-fixture-000000000000";
const CAMPAIGN_ID = "12000000-0000-4000-8000-000000000001";

async function sourceFixture(): Promise<NewsletterEdition02Source> {
  const [html, text, assetManifest, entries] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_02_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(entries) };
}

function summary(
  overrides: Partial<NewsletterEdition02CampaignSummary> = {},
): NewsletterEdition02CampaignSummary {
  return {
    campaignId: null,
    campaignStatus: "not_created",
    audienceFrozenAt: null,
    eligibleCount: 4,
    preparedCount: 0,
    sendingCount: 0,
    acceptedCount: 0,
    failedCount: 0,
    unknownCount: 0,
    retryableCount: 0,
    nationalCount: 1,
    madridCount: 1,
    aCorunaCount: 1,
    barcelonaCount: 1,
    excludedCount: 2,
    duplicateCount: 0,
    invalidCount: 0,
    ...overrides,
  };
}

function repositoryFixture(
  overrides: Partial<NewsletterEdition02CampaignRepository> = {},
): NewsletterEdition02CampaignRepository {
  return {
    previewCampaign: async () => summary(),
    prepareCampaign: async () =>
      summary({
        campaignId: CAMPAIGN_ID,
        campaignStatus: "prepared",
        audienceFrozenAt: "2026-08-13T08:00:00.000Z",
        preparedCount: 4,
      }),
    claimDelivery: async () => null,
    recordAccepted: async () => undefined,
    recordFailed: async () => undefined,
    recordUnknown: async () => undefined,
    ...overrides,
  };
}

function sendRequest() {
  return {
    send: true,
    resume: false,
    limit: 25,
    confirmEdition: NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
    confirmPhrase: NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE,
  } as const;
}

function sendEnvironment() {
  return {
    armed: NEWSLETTER_EDITION_02_CAMPAIGN_ARMED_VALUE,
    apiKey: "re_test_fixture_key_never_sent_1234567890",
    mailTransport: "resend",
    newsletterMode: "live",
    nodeEnv: "test",
    publicLaunchEnabled: "public-newsletter-live",
  };
}

test("Edition 02 has an independent immutable identity and approved mail identity", () => {
  assert.equal(NEWSLETTER_EDITION_02_CAMPAIGN_KEY, "agenda_motor_2026_08_13");
  assert.notEqual(NEWSLETTER_EDITION_02_CAMPAIGN_KEY, NEWSLETTER_EDITION_01_CAMPAIGN_KEY);
  assert.equal(
    NEWSLETTER_EDITION_02_SUBJECT,
    "Drift nocturno, rally y 4 planes más para este fin de semana",
  );
  assert.equal(
    NEWSLETTER_EDITION_02_PREHEADER,
    "Seis planes entre Valladolid, Asturias, Xàtiva, Burgos, Cambrils y Bizkaia para vivir el motor del 14 al 16 de agosto.",
  );
  assert.equal(
    NEWSLETTER_EDITION_02_SENDER,
    "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>",
  );
  assert.equal(NEWSLETTER_EDITION_02_REPLY_TO, "info@eventomotor.com");
  assert.doesNotMatch(NEWSLETTER_EDITION_02_SUBJECT, /^\[PRUEBA]/);
});

test("canonical HTML, text and all seven assets pass fail-closed integrity", async () => {
  const source = await sourceFixture();
  const result = validateEdition02SourceIntegrity(source);
  assert.deepEqual(result, {
    imageCount: 7,
    linkCount: 16,
    htmlCampaignCount: 13,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 7,
  });
  assert.equal(
    createHash("sha256")
      .update(canonicalizeEdition02Text(source.html), "utf8")
      .digest("hex"),
    NEWSLETTER_EDITION_02_HTML_SHA256,
  );
  assert.equal(
    createHash("sha256")
      .update(canonicalizeEdition02Text(source.text), "utf8")
      .digest("hex"),
    NEWSLETTER_EDITION_02_TEXT_SHA256,
  );
  assert.equal(
    newsletterEdition02ContentManifestDigest(),
    NEWSLETTER_EDITION_02_CONTENT_MANIFEST_SHA256,
  );
});

test("LF and CRLF have the same canonical template identity", async () => {
  const source = await sourceFixture();
  assert.doesNotThrow(() =>
    validateEdition02SourceIntegrity({
      ...source,
      html: source.html.replace(/\n/g, "\r\n"),
      text: source.text.replace(/\n/g, "\r\n"),
    }),
  );
});

test("a real HTML or text edit fails closed", async () => {
  const source = await sourceFixture();
  assert.throws(
    () =>
      validateEdition02SourceIntegrity({
        ...source,
        html: source.html.replace("el motor no para", "el motor sigue"),
      }),
    (error) =>
      error instanceof NewsletterEdition02ContentError &&
      error.code === "template_digest_mismatch",
  );
  assert.throws(
    () =>
      validateEdition02SourceIntegrity({
        ...source,
        text: `${source.text}cambio`,
      }),
    (error) =>
      error instanceof NewsletterEdition02ContentError &&
      error.code === "template_digest_mismatch",
  );
});

test("asset manifest and bytes detect any alteration", async () => {
  const source = await sourceFixture();
  const changedManifest = source.assetManifest.replace("227745", "227744");
  assert.throws(
    () => validateEdition02SourceIntegrity({ ...source, assetManifest: changedManifest }),
    (error) =>
      error instanceof NewsletterEdition02ContentError &&
      error.code === "asset_manifest_mismatch",
  );
  const changedHero = Uint8Array.from(source.assets["01-rpm-fest-hero.jpg"]);
  changedHero[changedHero.length - 1] ^= 1;
  assert.throws(
    () =>
      validateEdition02SourceIntegrity({
        ...source,
        assets: { ...source.assets, "01-rpm-fest-hero.jpg": changedHero },
      }),
    (error) =>
      error instanceof NewsletterEdition02ContentError &&
      error.code === "asset_digest_mismatch",
  );
});

test("production HTML keeps exactly seven absolute production asset URLs", async () => {
  const { html } = await sourceFixture();
  const imageSources = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(
    (match) => match[1] ?? "",
  );
  assert.equal(imageSources.length, 7);
  assert.ok(
    imageSources.every((source) =>
      source.startsWith(
        "https://www.eventomotor.com/newsletter/2026-08-13/assets/",
      ),
    ),
  );
  assert.doesNotMatch(html, /src=["']assets\//i);
});

test("the national variant has six events and no territorial block", async () => {
  const rendered = prepareEdition02Content(
    await sourceFixture(),
    "national",
    UNSUBSCRIBE_URL,
  );
  for (const title of [
    "RPM FEST · Night Demons 2026",
    "Rallysprint Carbayín",
    "LXXIII Trofeu de Velocitat Fira de Xàtiva",
    "Supercross Castrojeriz 2026",
    "Concentración Motera de Cambrils",
    "IV Concentración de Clásicos El Regato",
  ]) {
    assert.match(rendered.html, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(rendered.text, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(rendered.html, /Lo próximo cerca de ti/i);
  assert.doesNotMatch(rendered.text, /LO PRÓXIMO CERCA DE TI/);
});

for (const [variant, title] of [
  ["madrid", "F4 Spain · Jarama"],
  ["a-coruna", "Rallye Ferrol 2026"],
  ["barcelona", "Motor Extremo Montmeló"],
] as const) {
  test(`${variant} renders only its own territorial HTML and text`, async () => {
    const rendered = prepareEdition02Content(
      await sourceFixture(),
      variant,
      UNSUBSCRIBE_URL,
    );
    assert.match(rendered.html, /Lo próximo cerca de ti/i);
    assert.match(rendered.text, /LO PRÓXIMO CERCA DE TI/);
    assert.match(rendered.html, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(rendered.text, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    for (const otherTitle of [
      "F4 Spain · Jarama",
      "Rallye Ferrol 2026",
      "Motor Extremo Montmeló",
    ]) {
      if (otherTitle !== title) {
        assert.doesNotMatch(rendered.html, new RegExp(otherTitle));
        assert.doesNotMatch(rendered.text, new RegExp(otherTitle));
      }
    }
  });
}

test("every rendered variant keeps one individual unsubscribe and no tracking identifiers", async () => {
  const source = await sourceFixture();
  for (const variant of ["national", "madrid", "a-coruna", "barcelona"] as const) {
    const rendered = prepareEdition02Content(source, variant, UNSUBSCRIBE_URL);
    assert.equal(rendered.html.split(UNSUBSCRIBE_URL).length - 1, 1);
    assert.equal(rendered.text.split(UNSUBSCRIBE_URL).length - 1, 1);
    assert.doesNotMatch(
      `${rendered.html}\n${rendered.text}`,
      /(?:recipient|subscriber|delivery)[_-]?id|open[_-]?id|click[_-]?id|tracking[_-]?pixel/i,
    );
  }
});

test("the four static previews are renderer outputs without placeholders", async () => {
  const source = await sourceFixture();
  for (const variant of ["national", "madrid", "a-coruna", "barcelona"] as const) {
    const previewPath = resolve(
      ROOT,
      EDITION_DIRECTORY,
      `preview-${variant}.html`,
    );
    const preview = await readFile(previewPath, "utf8");
    const expected = prepareEdition02PreviewContent(
      source,
      variant,
      UNSUBSCRIBE_URL,
    ).html;
    assert.equal(preview, expected);
    assert.doesNotMatch(preview, /\{\{(?:territorial_block|unsubscribe_url)\}\}/);
    assert.doesNotMatch(
      preview,
      /https:\/\/www\.eventomotor\.com\/newsletter\/2026-08-13\/assets\//,
    );
    assert.doesNotMatch(preview, /(?:localhost|\/_next\/image|src=["']data:)/i);

    const imageSources = [
      ...preview.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),
    ].map((match) => match[1] ?? "");
    assert.equal(imageSources.length, 7);
    assert.ok(imageSources.every((imageSource) => /^assets\/[^/]+$/.test(imageSource)));
    await Promise.all(
      imageSources.map((imageSource) =>
        readFile(resolve(dirname(previewPath), imageSource)),
      ),
    );
  }
});

test("dry-run is read-only, aggregate-only and never constructs a Resend client", async () => {
  const logs: string[] = [];
  let previewCalls = 0;
  let prepareCalls = 0;
  const result = await executeNewsletterEdition02Campaign({
    request: { send: false, resume: false, limit: 25 },
    source: await sourceFixture(),
    repository: repositoryFixture({
      previewCampaign: async () => {
        previewCalls += 1;
        return summary();
      },
      prepareCampaign: async () => {
        prepareCalls += 1;
        return summary();
      },
    }),
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    clientFactory: () => {
      throw new Error("network must not be configured");
    },
    logger: (message) => logs.push(message),
  });
  assert.equal(result.status, "dry_run");
  assert.equal(previewCalls, 1);
  assert.equal(prepareCalls, 0);
  assert.match(logs.join("\n"), /National: 1[\s\S]+Madrid: 1[\s\S]+A Coruña: 1[\s\S]+Barcelona: 1/);
  assert.match(logs.at(-1) ?? "", /No campaign was prepared and no email was sent/);
  assert.doesNotMatch(logs.join("\n"), /@example\.invalid|unsubscribe\?token=/);
});

test("send requires Edition 02-specific arming and exact mail identity", async () => {
  const source = await sourceFixture();
  await assert.rejects(
    executeNewsletterEdition02Campaign({
      request: sendRequest(),
      environment: { ...sendEnvironment(), armed: "edition-01-value" },
      source,
      repository: repositoryFixture(),
      sender: NEWSLETTER_EDITION_02_SENDER,
      replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "send_not_armed",
  );
  await assert.rejects(
    executeNewsletterEdition02Campaign({
      request: { send: false, resume: false, limit: 25 },
      source,
      repository: repositoryFixture(),
      sender: "Another Sender <agenda@news.eventomotor.com>",
      replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "mail_identity_invalid",
  );
});

test("CI, Vercel and production runtime remain fail-closed", async () => {
  const source = await sourceFixture();
  for (const environment of [
    { ci: "true" },
    { vercel: "1" },
    { vercelEnv: "preview" },
    { nodeEnv: "production" },
  ]) {
    await assert.rejects(
      executeNewsletterEdition02Campaign({
        request: { send: false, resume: false, limit: 25 },
        environment,
        source,
        repository: repositoryFixture(),
        sender: NEWSLETTER_EDITION_02_SENDER,
        replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
      }),
      NewsletterEdition02CampaignError,
    );
  }
});

test("the runner renders the frozen variant per claim and persists only token hashes", async () => {
  const variants: NewsletterEdition02ContentVariant[] = [
    "national",
    "madrid",
    "a-coruna",
    "barcelona",
  ];
  const claims: NewsletterEdition02CampaignClaim[] = variants.map(
    (contentVariant, index) => ({
      deliveryId: `12000000-0000-4000-8000-00000000001${index + 1}`,
      campaignId: CAMPAIGN_ID,
      subscriberId: `12000000-0000-4000-8000-00000000002${index + 1}`,
      recipientEmail: `edition02-${index}@example.invalid`,
      claimId: `12000000-0000-4000-8000-00000000003${index + 1}`,
      attemptCount: 1,
      idempotencyKey: `newsletter/${CAMPAIGN_ID}/delivery-${index}/1`,
      contentVariant,
    }),
  );
  const seenHashes: string[] = [];
  const payloads: Array<{ html: string; text: string; to: readonly [string] }> = [];
  const accepted: string[] = [];
  const logs: string[] = [];
  let tokenIndex = 0;
  let claimIndex = 0;
  const repository = repositoryFixture({
    claimDelivery: async ({ tokenHash }) => {
      seenHashes.push(tokenHash);
      return claims[claimIndex++] ?? null;
    },
    recordAccepted: async ({ deliveryId }) => {
      accepted.push(deliveryId);
    },
    previewCampaign: async () =>
      summary({
        campaignId: CAMPAIGN_ID,
        campaignStatus: "completed",
        audienceFrozenAt: "2026-08-13T08:00:00.000Z",
        acceptedCount: 4,
      }),
  });
  const result = await executeNewsletterEdition02Campaign({
    request: sendRequest(),
    environment: sendEnvironment(),
    source: await sourceFixture(),
    repository,
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    tokenFactory: () => `edition02-raw-token-${tokenIndex++}-fixture-000000000000`,
    tokenHasher: (rawToken) =>
      createHash("sha256").update(rawToken, "utf8").digest("hex"),
    clientFactory: () => ({
      async sendEmail(payload) {
        payloads.push({ html: payload.html, text: payload.text, to: payload.to });
        return {
          status: "accepted" as const,
          providerMessageId: `resend-edition02-${payloads.length}`,
        };
      },
    }),
    logger: (message) => logs.push(message),
  });
  assert.equal(result.processedCount, 4);
  assert.equal(payloads.length, 4);
  assert.equal(accepted.length, 4);
  assert.equal(new Set(seenHashes).size, 5);
  assert.ok(seenHashes.every((hash) => /^[0-9a-f]{64}$/.test(hash)));
  assert.match(payloads[1].html, /F4 Spain · Jarama/);
  assert.match(payloads[2].text, /Rallye Ferrol 2026/);
  assert.match(payloads[3].html, /Motor Extremo Montmeló/);
  assert.doesNotMatch(payloads[0].html, /Lo próximo cerca de ti/i);
  assert.doesNotMatch(logs.join("\n"), /@example\.invalid|edition02-raw-token/);
});

test("ambiguous provider result becomes unknown and is never described as accepted", async () => {
  const unknownRecords: string[] = [];
  let claimed = false;
  const claim: NewsletterEdition02CampaignClaim = {
    deliveryId: "12000000-0000-4000-8000-000000000041",
    campaignId: CAMPAIGN_ID,
    subscriberId: "12000000-0000-4000-8000-000000000042",
    recipientEmail: "edition02-unknown@example.invalid",
    claimId: "12000000-0000-4000-8000-000000000043",
    attemptCount: 1,
    idempotencyKey: `newsletter/${CAMPAIGN_ID}/unknown/1`,
    contentVariant: "national",
  };
  await executeNewsletterEdition02Campaign({
    request: sendRequest(),
    environment: sendEnvironment(),
    source: await sourceFixture(),
    repository: repositoryFixture({
      claimDelivery: async () => {
        if (claimed) return null;
        claimed = true;
        return claim;
      },
      recordUnknown: async ({ errorCode }) => {
        unknownRecords.push(errorCode);
      },
      previewCampaign: async () =>
        summary({
          campaignId: CAMPAIGN_ID,
          campaignStatus: "paused",
          audienceFrozenAt: "2026-08-13T08:00:00.000Z",
          unknownCount: 1,
        }),
    }),
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    tokenFactory: () => "edition02-unknown-token-fixture-000000000000",
    tokenHasher: (value) => createHash("sha256").update(value).digest("hex"),
    clientFactory: () => ({
      async sendEmail() {
        return { status: "timeout" as const };
      },
    }),
  });
  assert.deepEqual(unknownRecords, ["provider_timeout"]);
});

test("argument parser is dry-run by default and requires send for resume", () => {
  assert.deepEqual(parseNewsletterEdition02CampaignArguments([]), {
    send: false,
    resume: false,
    limit: 25,
  });
  assert.deepEqual(
    parseNewsletterEdition02CampaignArguments([
      "--send",
      "--resume",
      "--limit",
      "10",
      "--confirm-edition",
      NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
      "--confirm-phrase",
      NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE,
    ]),
    {
      send: true,
      resume: true,
      limit: 10,
      confirmEdition: NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
      confirmPhrase: NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE,
    },
  );
  assert.throws(
    () => parseNewsletterEdition02CampaignArguments(["--resume"]),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "resume_requires_send",
  );
});

test("server adapter remains server-only and CLI imports only that adapter", async () => {
  const [adapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-02-campaign.server.ts"), "utf8"),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-02.ts"), "utf8"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /NEWSLETTER_EDITION_02_CAMPAIGN_ARMED/);
  assert.match(cli, /@\/lib\/newsletter\/edition-02-campaign\.server/);
  assert.doesNotMatch(cli, /edition-02-campaign"/);
});

test("Edition 01 historical digests and campaign key are untouched", async () => {
  const edition01 = await readFile(
    resolve(ROOT, "lib/newsletter/edition-01-test-send.ts"),
    "utf8",
  );
  assert.match(
    edition01,
    /75299306a8cfd8b67b37f1770244dccedd81e00137b44deff3432730bdb722ab/,
  );
  assert.match(
    edition01,
    /1e455b715895999acf47327e8732d99466cc3c0ab629d68f1bd69bbca22371be/,
  );
  assert.equal(NEWSLETTER_EDITION_01_CAMPAIGN_KEY, "agenda_motor_2026_08_06");
  assert.deepEqual(newsletterEdition02CampaignIdentity(), {
    editionKey: NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_02_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_02_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_02_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_02_CONTENT_MANIFEST_SHA256,
  });
});
