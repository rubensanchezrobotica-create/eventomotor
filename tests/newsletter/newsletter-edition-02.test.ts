import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import { NEWSLETTER_EDITION_01_CAMPAIGN_KEY } from "@/lib/newsletter/edition-01-campaign";
import { NEWSLETTER_EDITION_01_TEST_ARMED_VALUE } from "@/lib/newsletter/edition-01-test-send";
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
import {
  NEWSLETTER_EDITION_02_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_02_TEST_CONFIRM_PHRASE,
  NewsletterEdition02TestSendError,
  executeNewsletterEdition02TestSend,
  newsletterEdition02TestSubject,
  parseNewsletterEdition02TestArguments,
} from "@/lib/newsletter/edition-02-test-send";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-13";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition02-preview-token-fixture-000000000000";
const CAMPAIGN_ID = "12000000-0000-4000-8000-000000000001";
const EDITION_02_HEADER_ASSET_SHA256 =
  "65a06197b671ec948083e54b70400aa50716caf93f57bb02192c27c7c8c4f041";

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
    prepareOnly: false,
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

function prepareOnlyRequest() {
  return {
    ...sendRequest(),
    send: false,
    prepareOnly: true,
  } as const;
}

function testSendEnvironment(recipient = "edition02-test@example.invalid") {
  return {
    armed: NEWSLETTER_EDITION_02_TEST_ARMED_VALUE,
    apiKey: "re_test_fixture_key_never_sent_1234567890",
    mailTransport: "resend",
    newsletterMode: "test",
    nodeEnv: "test",
    recipientAllowlist: recipient,
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

test("the fixed opaque header follows the Edition 01 email-safe pattern", async () => {
  const source = await sourceFixture();
  const docsHeader = source.assets["eventomotor-header.png"];
  const publicHeader = await readFile(
    resolve(
      ROOT,
      "public/newsletter/2026-08-13/assets/eventomotor-header.png",
    ),
  );

  assert.ok(docsHeader);
  for (const header of [docsHeader, publicHeader]) {
    assert.equal(
      createHash("sha256").update(header).digest("hex"),
      EDITION_02_HEADER_ASSET_SHA256,
    );
  }
  assert.deepEqual(Buffer.from(docsHeader), publicHeader);
  assert.match(
    source.html,
    /class="email-header"[^>]+bgcolor="#050608"[^>]*>[\s\S]*?class="email-header-table"[^>]+bgcolor="#050608"[^>]*>[\s\S]*?<img[^>]+eventomotor-header\.png[^>]+width="620"/,
  );
  assert.match(
    source.html,
    /alt="EventoMotor · La Agenda Motor · Edición 02 · 14–16 agosto 2026"/,
  );
  assert.doesNotMatch(source.html, /eventomotor-logo\.png/);
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
    request: { send: false, prepareOnly: false, resume: false, limit: 25 },
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

test("prepare-only freezes the audience with strong gates and performs zero claims or provider calls", async () => {
  const logs: string[] = [];
  let prepareCalls = 0;
  let claimCalls = 0;
  let clientFactoryCalls = 0;
  const result = await executeNewsletterEdition02Campaign({
    request: prepareOnlyRequest(),
    environment: { ...sendEnvironment(), apiKey: undefined },
    source: await sourceFixture(),
    repository: repositoryFixture({
      prepareCampaign: async () => {
        prepareCalls += 1;
        return summary({
          campaignId: CAMPAIGN_ID,
          campaignStatus: "prepared",
          audienceFrozenAt: "2026-08-13T08:00:00.000Z",
          preparedCount: 4,
        });
      },
      claimDelivery: async () => {
        claimCalls += 1;
        return null;
      },
    }),
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    clientFactory: () => {
      clientFactoryCalls += 1;
      throw new Error("provider must not be configured");
    },
    logger: (message) => logs.push(message),
  });
  assert.equal(result.status, "prepared");
  assert.equal(result.processedCount, 0);
  assert.equal(prepareCalls, 1);
  assert.equal(claimCalls, 0);
  assert.equal(clientFactoryCalls, 0);
  assert.match(logs.join("\n"), new RegExp(`Campaign ID: ${CAMPAIGN_ID}`));
  assert.match(logs.join("\n"), /Campaign status: prepared/);
  assert.match(logs.join("\n"), /Audience frozen at: 2026-08-13T08:00:00\.000Z/);
  assert.match(logs.at(-1) ?? "", /no delivery was claimed and no email was sent/i);

  let blockedPrepareCalls = 0;
  for (const [request, code] of [
    [{ ...prepareOnlyRequest(), resume: true }, "resume_requires_send"],
    [{ ...sendRequest(), prepareOnly: true }, "send_prepare_only_conflict"],
  ] as const) {
    await assert.rejects(
      executeNewsletterEdition02Campaign({
        request,
        environment: sendEnvironment(),
        source: await sourceFixture(),
        repository: repositoryFixture({
          prepareCampaign: async () => {
            blockedPrepareCalls += 1;
            return summary();
          },
        }),
        sender: NEWSLETTER_EDITION_02_SENDER,
        replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
      }),
      (error) =>
        error instanceof NewsletterEdition02CampaignError && error.code === code,
    );
  }
  await assert.rejects(
    executeNewsletterEdition02Campaign({
      request: prepareOnlyRequest(),
      environment: { ...sendEnvironment(), armed: "not-armed" },
      source: await sourceFixture(),
      repository: repositoryFixture({
        prepareCampaign: async () => {
          blockedPrepareCalls += 1;
          return summary();
        },
      }),
      sender: NEWSLETTER_EDITION_02_SENDER,
      replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "send_not_armed",
  );
  assert.equal(blockedPrepareCalls, 0);
});

test("prepare-only is idempotent and a later send reuses the frozen campaign and variant", async () => {
  const frozen = summary({
    campaignId: CAMPAIGN_ID,
    campaignStatus: "prepared",
    audienceFrozenAt: "2026-08-13T08:00:00.000Z",
    preparedCount: 1,
    eligibleCount: 1,
    nationalCount: 0,
    madridCount: 1,
    aCorunaCount: 0,
    barcelonaCount: 0,
  });
  const claim: NewsletterEdition02CampaignClaim = {
    deliveryId: "12000000-0000-4000-8000-000000000051",
    campaignId: CAMPAIGN_ID,
    subscriberId: "12000000-0000-4000-8000-000000000052",
    recipientEmail: "edition02-frozen@example.invalid",
    claimId: "12000000-0000-4000-8000-000000000053",
    attemptCount: 1,
    idempotencyKey: `newsletter/${CAMPAIGN_ID}/frozen/1`,
    contentVariant: "madrid",
  };
  let prepareCalls = 0;
  let claimCalls = 0;
  let sentHtml = "";
  const repository = repositoryFixture({
    prepareCampaign: async () => {
      prepareCalls += 1;
      return frozen;
    },
    claimDelivery: async ({ campaignId }) => {
      assert.equal(campaignId, CAMPAIGN_ID);
      claimCalls += 1;
      return claimCalls === 1 ? claim : null;
    },
    previewCampaign: async () => ({
      ...frozen,
      campaignStatus: "completed",
      preparedCount: 0,
      acceptedCount: 1,
    }),
  });
  const baseOptions = {
    environment: sendEnvironment(),
    source: await sourceFixture(),
    repository,
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
  };
  const first = await executeNewsletterEdition02Campaign({
    ...baseOptions,
    request: prepareOnlyRequest(),
  });
  const second = await executeNewsletterEdition02Campaign({
    ...baseOptions,
    request: prepareOnlyRequest(),
  });
  assert.equal(first.summary.campaignId, CAMPAIGN_ID);
  assert.deepEqual(second.summary, first.summary);
  assert.equal(claimCalls, 0);

  await executeNewsletterEdition02Campaign({
    ...baseOptions,
    request: sendRequest(),
    tokenFactory: () => "edition02-frozen-token-fixture-000000000000",
    tokenHasher: (value) => createHash("sha256").update(value).digest("hex"),
    clientFactory: () => ({
      async sendEmail(payload) {
        sentHtml = payload.html;
        return { status: "accepted", providerMessageId: "resend-frozen-1" };
      },
    }),
  });
  assert.equal(prepareCalls, 3);
  assert.equal(claimCalls, 2);
  assert.match(sentHtml, /F4 Spain .* Jarama/);
});

test("send requires Edition 02-specific arming and exact mail identity", async () => {
  const source = await sourceFixture();
  let prepareCalls = 0;
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
      request: { send: false, prepareOnly: false, resume: false, limit: 25 },
      source,
      repository: repositoryFixture(),
      sender: "Another Sender <agenda@news.eventomotor.com>",
      replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "mail_identity_invalid",
  );
  await assert.rejects(
    executeNewsletterEdition02Campaign({
      request: sendRequest(),
      environment: { ...sendEnvironment(), apiKey: undefined },
      source,
      repository: repositoryFixture({
        prepareCampaign: async () => {
          prepareCalls += 1;
          return summary();
        },
      }),
      sender: NEWSLETTER_EDITION_02_SENDER,
      replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "api_key_unavailable",
  );
  assert.equal(prepareCalls, 0);
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
        request: { send: false, prepareOnly: false, resume: false, limit: 25 },
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

test("accepted then unknown stops before every later prepared delivery and resume cannot claim", async () => {
  const claims: NewsletterEdition02CampaignClaim[] = [
    {
      deliveryId: "12000000-0000-4000-8000-000000000041",
      campaignId: CAMPAIGN_ID,
      subscriberId: "12000000-0000-4000-8000-000000000042",
      recipientEmail: "edition02-accepted@example.invalid",
      claimId: "12000000-0000-4000-8000-000000000043",
      attemptCount: 1,
      idempotencyKey: `newsletter/${CAMPAIGN_ID}/accepted/1`,
      contentVariant: "national",
    },
    {
      deliveryId: "12000000-0000-4000-8000-000000000044",
      campaignId: CAMPAIGN_ID,
      subscriberId: "12000000-0000-4000-8000-000000000045",
      recipientEmail: "edition02-unknown@example.invalid",
      claimId: "12000000-0000-4000-8000-000000000046",
      attemptCount: 1,
      idempotencyKey: `newsletter/${CAMPAIGN_ID}/unknown/1`,
      contentVariant: "madrid",
    },
    {
      deliveryId: "12000000-0000-4000-8000-000000000047",
      campaignId: CAMPAIGN_ID,
      subscriberId: "12000000-0000-4000-8000-000000000048",
      recipientEmail: "edition02-must-remain-prepared@example.invalid",
      claimId: "12000000-0000-4000-8000-000000000049",
      attemptCount: 1,
      idempotencyKey: `newsletter/${CAMPAIGN_ID}/prepared/1`,
      contentVariant: "barcelona",
    },
  ];
  const unknownRecords: string[] = [];
  const acceptedRecords: string[] = [];
  let claimCalls = 0;
  let providerCalls = 0;
  let paused = false;
  const repository = repositoryFixture({
      prepareCampaign: async () =>
        paused
          ? summary({
              campaignId: CAMPAIGN_ID,
              campaignStatus: "paused",
              audienceFrozenAt: "2026-08-13T08:00:00.000Z",
              preparedCount: 1,
              acceptedCount: 1,
              unknownCount: 1,
            })
          : summary({
              campaignId: CAMPAIGN_ID,
              campaignStatus: "prepared",
              audienceFrozenAt: "2026-08-13T08:00:00.000Z",
              preparedCount: 3,
            }),
      claimDelivery: async () => {
        claimCalls += 1;
        return claims[claimCalls - 1] ?? null;
      },
      recordAccepted: async ({ deliveryId }) => {
        acceptedRecords.push(deliveryId);
      },
      recordUnknown: async ({ errorCode }) => {
        unknownRecords.push(errorCode);
        paused = true;
      },
    });
  const execution = {
    environment: sendEnvironment(),
    source: await sourceFixture(),
    repository,
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    tokenFactory: () => `edition02-unknown-token-${claimCalls}-fixture-000000000000`,
    tokenHasher: (value: string) => createHash("sha256").update(value).digest("hex"),
    clientFactory: () => ({
      async sendEmail() {
        providerCalls += 1;
        return providerCalls === 1
          ? { status: "accepted" as const, providerMessageId: "resend-accepted-1" }
          : { status: "timeout" as const };
      },
    }),
  };
  await assert.rejects(
    executeNewsletterEdition02Campaign({
      ...execution,
      request: sendRequest(),
    }),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "provider_result_unknown",
  );
  assert.equal(claimCalls, 2);
  assert.equal(providerCalls, 2);
  assert.equal(acceptedRecords.length, 1);
  assert.deepEqual(unknownRecords, ["provider_timeout"]);

  await assert.rejects(
    executeNewsletterEdition02Campaign({
      ...execution,
      request: { ...sendRequest(), resume: true },
    }),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "campaign_paused_unknown",
  );
  assert.equal(claimCalls, 2);
  assert.equal(providerCalls, 2);
});

test("HTTP 429 remains retryable while the execution can continue to another prepared delivery", async () => {
  const claims: NewsletterEdition02CampaignClaim[] = [
    {
      deliveryId: "12000000-0000-4000-8000-000000000061",
      campaignId: CAMPAIGN_ID,
      subscriberId: "12000000-0000-4000-8000-000000000062",
      recipientEmail: "edition02-rate-limited@example.invalid",
      claimId: "12000000-0000-4000-8000-000000000063",
      attemptCount: 2,
      idempotencyKey: `newsletter/${CAMPAIGN_ID}/retry/2`,
      contentVariant: "national",
    },
    {
      deliveryId: "12000000-0000-4000-8000-000000000064",
      campaignId: CAMPAIGN_ID,
      subscriberId: "12000000-0000-4000-8000-000000000065",
      recipientEmail: "edition02-next@example.invalid",
      claimId: "12000000-0000-4000-8000-000000000066",
      attemptCount: 1,
      idempotencyKey: `newsletter/${CAMPAIGN_ID}/next/1`,
      contentVariant: "barcelona",
    },
  ];
  const failures: Array<{ errorCode: string; retryable: boolean }> = [];
  let claimIndex = 0;
  let providerCalls = 0;
  const result = await executeNewsletterEdition02Campaign({
    request: { ...sendRequest(), resume: true },
    environment: sendEnvironment(),
    source: await sourceFixture(),
    repository: repositoryFixture({
      claimDelivery: async ({ allowRetry }) => {
        assert.equal(allowRetry, true);
        return claims[claimIndex++] ?? null;
      },
      recordFailed: async ({ errorCode, retryable }) => {
        failures.push({ errorCode, retryable });
      },
      previewCampaign: async () =>
        summary({
          campaignId: CAMPAIGN_ID,
          campaignStatus: "sending",
          audienceFrozenAt: "2026-08-13T08:00:00.000Z",
          failedCount: 1,
          retryableCount: 1,
          acceptedCount: 1,
        }),
    }),
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    tokenFactory: () => `edition02-retry-token-${claimIndex}-fixture-000000000000`,
    tokenHasher: (value) => createHash("sha256").update(value).digest("hex"),
    clientFactory: () => ({
      async sendEmail() {
        providerCalls += 1;
        return providerCalls === 1
          ? { status: "provider_error" as const, httpStatus: 429 }
          : { status: "accepted" as const, providerMessageId: "resend-after-429" };
      },
    }),
  });
  assert.equal(result.processedCount, 2);
  assert.deepEqual(failures, [{ errorCode: "provider_http_429", retryable: true }]);
  assert.equal(providerCalls, 2);
});

test("campaign argument parser keeps dry-run default and separates prepare-only from send", () => {
  assert.deepEqual(parseNewsletterEdition02CampaignArguments([]), {
    send: false,
    prepareOnly: false,
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
      prepareOnly: false,
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
  assert.throws(
    () =>
      parseNewsletterEdition02CampaignArguments([
        "--prepare-only",
        "--resume",
      ]),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "resume_requires_send",
  );
  assert.deepEqual(
    parseNewsletterEdition02CampaignArguments([
      "--prepare-only",
      "--confirm-edition",
      NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
      "--confirm-phrase",
      NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE,
    ]),
    {
      send: false,
      prepareOnly: true,
      resume: false,
      limit: 25,
      confirmEdition: NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
      confirmPhrase: NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE,
    },
  );
  assert.throws(
    () =>
      parseNewsletterEdition02CampaignArguments([
        "--send",
        "--prepare-only",
      ]),
    (error) =>
      error instanceof NewsletterEdition02CampaignError &&
      error.code === "send_prepare_only_conflict",
  );
});

test("Edition 02 test recipient sends one real variant with a marked subject and zero campaign writes", async () => {
  const recipient = "edition02-test@example.invalid";
  const payloads: Array<{
    from: string;
    to: readonly [string];
    replyTo: string;
    subject: string;
    html: string;
    text: string;
  }> = [];
  const result = await executeNewsletterEdition02TestSend({
    request: {
      send: true,
      to: recipient,
      confirmTo: recipient,
      confirmPhrase: NEWSLETTER_EDITION_02_TEST_CONFIRM_PHRASE,
      unsubscribeUrl: UNSUBSCRIBE_URL,
      variant: "madrid",
    },
    environment: testSendEnvironment(recipient),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    clientFactory: () => ({
      async sendEmail(payload) {
        payloads.push(payload);
        return { status: "accepted", providerMessageId: "resend-edition02-test-1" };
      },
    }),
  });
  assert.equal(result.status, "accepted");
  assert.equal(payloads.length, 1);
  assert.deepEqual(payloads[0]?.to, [recipient]);
  assert.equal(payloads[0]?.from, NEWSLETTER_EDITION_02_SENDER);
  assert.equal(payloads[0]?.replyTo, NEWSLETTER_EDITION_02_REPLY_TO);
  assert.equal(
    payloads[0]?.subject,
    newsletterEdition02TestSubject("madrid"),
  );
  assert.match(payloads[0]?.subject ?? "", /^\[PRUEBA E02 · MADRID]/);
  assert.match(payloads[0]?.html ?? "", /F4 Spain .* Jarama/);
  assert.match(payloads[0]?.text ?? "", /F4 Spain .* Jarama/);
  assert.match(payloads[0]?.html ?? "", new RegExp(UNSUBSCRIBE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(Object.hasOwn(payloads[0] ?? {}, "idempotencyKey"), false);
  assert.equal(Object.hasOwn(payloads[0] ?? {}, "cc"), false);
  assert.equal(Object.hasOwn(payloads[0] ?? {}, "bcc"), false);
});

test("Edition 02 test recipient renders every explicit variant in dry-run and rejects an omitted variant", async () => {
  let clientCalls = 0;
  const source = await sourceFixture();
  for (const variant of ["national", "madrid", "barcelona", "a-coruna"] as const) {
    const result = await executeNewsletterEdition02TestSend({
      request: {
        send: false,
        to: "edition02-test@example.invalid",
        unsubscribeUrl: UNSUBSCRIBE_URL,
        variant,
      },
      source,
      sender: NEWSLETTER_EDITION_02_SENDER,
      replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
      clientFactory: () => {
        clientCalls += 1;
        throw new Error("provider must not be configured");
      },
    });
    assert.equal(result.status, "dry_run");
    assert.equal(result.variant, variant);
  }
  assert.equal(clientCalls, 0);
  await assert.rejects(
    executeNewsletterEdition02TestSend({
      request: {
        send: false,
        to: "edition02-test@example.invalid",
        unsubscribeUrl: UNSUBSCRIBE_URL,
      },
      source,
      sender: NEWSLETTER_EDITION_02_SENDER,
      replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition02TestSendError &&
      error.code === "variant_required",
  );
});

test("Edition 02 test recipient fails closed outside the exact allowlist and send gates", async () => {
  const recipient = "edition02-test@example.invalid";
  const request = {
    send: true,
    to: recipient,
    confirmTo: recipient,
    confirmPhrase: NEWSLETTER_EDITION_02_TEST_CONFIRM_PHRASE,
    unsubscribeUrl: UNSUBSCRIBE_URL,
    variant: "barcelona" as const,
  };
  let clientCalls = 0;
  const baseOptions = {
    request,
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_02_SENDER,
    replyTo: NEWSLETTER_EDITION_02_REPLY_TO,
    clientFactory: () => {
      clientCalls += 1;
      throw new Error("must stay blocked");
    },
  };
  for (const [override, code] of [
    [{ recipientAllowlist: "someone-else@example.invalid" }, "recipient_not_allowed"],
    [{ recipientAllowlist: "*@example.invalid" }, "allowlist_invalid"],
    [{ armed: "wrong" }, "send_not_armed"],
    [{ newsletterMode: "live" }, "mode_not_test"],
    [{ mailTransport: "disabled" }, "transport_not_resend"],
    [{ ci: "true" }, "ci_blocked"],
    [{ vercel: "1" }, "vercel_blocked"],
    [{ nodeEnv: "production" }, "production_blocked"],
  ] as const) {
    await assert.rejects(
      executeNewsletterEdition02TestSend({
        ...baseOptions,
        environment: { ...testSendEnvironment(recipient), ...override },
      }),
      (error) =>
        error instanceof NewsletterEdition02TestSendError && error.code === code,
    );
  }
  await assert.rejects(
    executeNewsletterEdition02TestSend({
      ...baseOptions,
      request: { ...request, confirmTo: "other@example.invalid" },
      environment: testSendEnvironment(recipient),
    }),
    (error) =>
      error instanceof NewsletterEdition02TestSendError &&
      error.code === "recipient_confirmation_mismatch",
  );
  await assert.rejects(
    executeNewsletterEdition02TestSend({
      ...baseOptions,
      request: { ...request, to: `${recipient},other@example.invalid` },
      environment: testSendEnvironment(recipient),
    }),
    (error) =>
      error instanceof NewsletterEdition02TestSendError &&
      error.code === "single_recipient_required",
  );
  await assert.rejects(
    executeNewsletterEdition02TestSend({
      ...baseOptions,
      request: {
        ...request,
        unsubscribeUrl:
          `https://www.eventomotor.com/newsletter/unsubscribe?token=${"A".repeat(32)}.A`,
      },
      environment: testSendEnvironment(recipient),
    }),
    (error) =>
      error instanceof NewsletterEdition02TestSendError &&
      error.code === "unsubscribe_url_invalid",
  );
  assert.equal(clientCalls, 0);
  assert.equal(NEWSLETTER_EDITION_02_TEST_ARMED_VALUE, NEWSLETTER_EDITION_01_TEST_ARMED_VALUE);
});

test("Edition 02 test parser requires a supported explicit variant value", () => {
  assert.deepEqual(
    parseNewsletterEdition02TestArguments([
      "--to",
      "edition02-test@example.invalid",
      "--variant",
      "a-coruna",
      "--unsubscribe-url",
      UNSUBSCRIBE_URL,
    ]),
    {
      send: false,
      to: "edition02-test@example.invalid",
      variant: "a-coruna",
      unsubscribeUrl: UNSUBSCRIBE_URL,
    },
  );
  assert.throws(
    () => parseNewsletterEdition02TestArguments(["--variant", "galicia"]),
    (error) =>
      error instanceof NewsletterEdition02TestSendError &&
      error.code === "variant_invalid",
  );
});

test("campaign and test-recipient adapters remain server-only and CLIs import only adapters", async () => {
  const [adapter, cli, testCore, testAdapter, testCli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-02-campaign.server.ts"), "utf8"),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-02.ts"), "utf8"),
    readFile(resolve(ROOT, "lib/newsletter/edition-02-test-send.ts"), "utf8"),
    readFile(resolve(ROOT, "lib/newsletter/edition-02-test-send.server.ts"), "utf8"),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-02-test.ts"), "utf8"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /NEWSLETTER_EDITION_02_CAMPAIGN_ARMED/);
  assert.match(cli, /@\/lib\/newsletter\/edition-02-campaign\.server/);
  assert.doesNotMatch(cli, /edition-02-campaign"/);
  assert.match(cli, /process\.exitCode = 1/);
  assert.match(testAdapter, /^import "server-only";/);
  assert.match(testAdapter, /NEWSLETTER_TEST_RECIPIENT_ALLOWLIST/);
  assert.doesNotMatch(
    `${testCore}\n${testAdapter}`,
    /CampaignRepository|prepareCampaign|claimDelivery|recordAccepted|recordFailed|recordUnknown|newsletter_campaigns|newsletter_campaign_deliveries/,
  );
  assert.match(testCli, /@\/lib\/newsletter\/edition-02-test-send\.server/);
  assert.doesNotMatch(testCli, /edition-02-test-send"/);
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
