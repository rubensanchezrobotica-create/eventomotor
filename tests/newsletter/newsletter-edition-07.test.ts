import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import sharp from "sharp";

import { NEWSLETTER_EDITION_01_CAMPAIGN_KEY } from "@/lib/newsletter/edition-01-campaign";
import { NEWSLETTER_EDITION_02_CAMPAIGN_KEY } from "@/lib/newsletter/edition-02-campaign";
import {
  NEWSLETTER_EDITION_07_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_07_CAMPAIGN_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_07_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_07_REPLY_TO,
  NEWSLETTER_EDITION_07_SENDER,
  NEWSLETTER_EDITION_07_SUBJECT,
  NewsletterEdition07CampaignError,
  executeNewsletterEdition07Campaign,
  parseNewsletterEdition07CampaignArguments,
  sendPreparedNewsletterEdition07Campaign,
  type NewsletterEdition07CampaignClient,
  type NewsletterEdition07CampaignEnvironment,
  type NewsletterEdition07CampaignRequest,
  type NewsletterEdition07CampaignRepository,
  type NewsletterEdition07CampaignSummary,
  type NewsletterEdition07PreparedCampaignSeal,
} from "@/lib/newsletter/edition-07-campaign";
import {
  NEWSLETTER_EDITION_07_ASSET_MANIFEST,
  NEWSLETTER_EDITION_07_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_07_HTML_SHA256,
  NEWSLETTER_EDITION_07_PREHEADER,
  NEWSLETTER_EDITION_07_TEXT_SHA256,
  NewsletterEdition07ContentError,
  newsletterEdition07ContentManifestDigest,
  prepareEdition07Content,
  prepareEdition07PreviewContent,
  validateEdition07SourceIntegrity,
  type NewsletterEdition07ContentVariant,
  type NewsletterEdition07Source,
} from "@/lib/newsletter/edition-07-content";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-17";
const PUBLIC_ASSET_DIRECTORY = "public/newsletter/2026-09-17/assets";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition07-preview-token-fixture-000000000000";
const EDITION_07_HEADER_ASSET_SHA256 =
  "2eefc398cde203f3b7f0f1e912a97f04de51368318e941cec1d99c50236456e0";
const PREPARED_CAMPAIGN_ID = "12000000-0000-4000-8000-000000000006";
const PREPARED_CAMPAIGN_SEAL: NewsletterEdition07PreparedCampaignSeal = {
  campaignId: PREPARED_CAMPAIGN_ID,
  deliveryCount: 6,
  variantCounts: {
    national: 3,
    madrid: 1,
    "a-coruna": 1,
    barcelona: 1,
  },
};

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

async function sourceFixture(): Promise<NewsletterEdition07Source> {
  const [html, text, assetManifest, entries] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_07_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(entries) };
}

function summary(
  overrides: Partial<NewsletterEdition07CampaignSummary> = {},
): NewsletterEdition07CampaignSummary {
  return {
    campaignId: null,
    campaignStatus: "not_created",
    audienceFrozenAt: null,
    eligibleCount: 37,
    preparedCount: 0,
    sendingCount: 0,
    acceptedCount: 0,
    failedCount: 0,
    unknownCount: 0,
    retryableCount: 0,
    nationalCount: 30,
    madridCount: 4,
    aCorunaCount: 1,
    barcelonaCount: 2,
    excludedCount: 33,
    duplicateCount: 0,
    invalidCount: 0,
    ...overrides,
  };
}

function repositoryFixture(
  overrides: Partial<NewsletterEdition07CampaignRepository> = {},
): NewsletterEdition07CampaignRepository {
  return {
    previewCampaign: async () => summary(),
    prepareCampaign: async () =>
      summary({
        campaignId: "12000000-0000-4000-8000-000000000003",
        campaignStatus: "prepared",
        audienceFrozenAt: "2026-09-17T08:00:00.000Z",
        preparedCount: 37,
      }),
    claimDelivery: async () => null,
    recordAccepted: async () => undefined,
    recordFailed: async () => undefined,
    recordUnknown: async () => undefined,
    ...overrides,
  };
}

function sendPreparedRequest(
  overrides: Partial<NewsletterEdition07CampaignRequest> = {},
): NewsletterEdition07CampaignRequest {
  return {
    sendPrepared: true,
    prepareOnly: false,
    limit: PREPARED_CAMPAIGN_SEAL.deliveryCount,
    confirmEdition: NEWSLETTER_EDITION_07_CAMPAIGN_KEY,
    confirmPhrase: NEWSLETTER_EDITION_07_CAMPAIGN_CONFIRM_PHRASE,
    confirmCampaignId: PREPARED_CAMPAIGN_ID,
    ...overrides,
  };
}

function sendPreparedEnvironment(): NewsletterEdition07CampaignEnvironment {
  return {
    armed: NEWSLETTER_EDITION_07_CAMPAIGN_ARMED_VALUE,
    apiKey: "re_test_edition07_prepared_campaign_only",
    mailTransport: "resend",
    newsletterMode: "live",
    publicLaunchEnabled: "public-newsletter-live",
  };
}

function preparedVariant(index: number): NewsletterEdition07ContentVariant {
  if (index < 3) return "national";
  if (index < 4) return "madrid";
  if (index < 5) return "a-coruna";
  return "barcelona";
}

function fixtureUuid(prefix: number, index: number): string {
  return `${prefix.toString().padStart(8, "0")}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

test("Edition 07 has the approved independent identity", () => {
  assert.equal(NEWSLETTER_EDITION_07_CAMPAIGN_KEY, "agenda_motor_2026_09_17");
  assert.notEqual(NEWSLETTER_EDITION_07_CAMPAIGN_KEY, NEWSLETTER_EDITION_01_CAMPAIGN_KEY);
  assert.notEqual(NEWSLETTER_EDITION_07_CAMPAIGN_KEY, NEWSLETTER_EDITION_02_CAMPAIGN_KEY);
  assert.equal(
    NEWSLETTER_EDITION_07_SUBJECT,
    "A Coruña, Barcelona y lo que viene este fin de semana",
  );
  assert.equal(
    NEWSLETTER_EDITION_07_PREHEADER,
    "EcoRally FIA, 24H de Barcelona, TrialGP en España y Jaizkibel para cerrar otro fin de semana muy cargado.",
  );
  assert.equal(
    NEWSLETTER_EDITION_07_SENDER,
    "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>",
  );
  assert.equal(NEWSLETTER_EDITION_07_REPLY_TO, "info@eventomotor.com");
});

test("canonical HTML, text and eight assets pass fail-closed integrity", async () => {
  const source = await sourceFixture();
  assert.deepEqual(validateEdition07SourceIntegrity(source), {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 8,
  });
  assert.equal(
    newsletterEdition07ContentManifestDigest(),
    NEWSLETTER_EDITION_07_CONTENT_MANIFEST_SHA256,
  );
  assert.match(NEWSLETTER_EDITION_07_HTML_SHA256, /^[0-9a-f]{64}$/);
  assert.match(NEWSLETTER_EDITION_07_TEXT_SHA256, /^[0-9a-f]{64}$/);

  const header = Buffer.from(source.assets["eventomotor-header.png"]);
  assert.equal(sha256(header), EDITION_07_HEADER_ASSET_SHA256);
  assert.equal(header.readUInt32BE(16), 1240);
  assert.equal(header.readUInt32BE(20), 200);
  const headerStats = await sharp(header).stats();
  assert.equal(headerStats.channels[3]?.min, 255);
  assert.equal(headerStats.channels[3]?.max, 255);

  for (const asset of NEWSLETTER_EDITION_07_ASSET_MANIFEST) {
    assert.ok(asset.bytes <= 300_000);
    assert.deepEqual(
      source.assets[asset.file],
      await readFile(resolve(ROOT, PUBLIC_ASSET_DIRECTORY, asset.file)),
    );
  }
});

test("canonical content and asset changes fail closed", async () => {
  const source = await sourceFixture();
  assert.throws(
    () => validateEdition07SourceIntegrity({ ...source, html: `${source.html} ` }),
    (error) =>
      error instanceof NewsletterEdition07ContentError &&
      error.code === "template_digest_mismatch",
  );
  const changed = Uint8Array.from(source.assets["01-ecorally-a-coruna-hero.webp"]);
  changed[0] = (changed[0] ?? 0) ^ 1;
  assert.throws(
    () =>
      validateEdition07SourceIntegrity({
        ...source,
        assets: { ...source.assets, "01-ecorally-a-coruna-hero.webp": changed },
      }),
    (error) =>
      error instanceof NewsletterEdition07ContentError &&
      error.code === "asset_digest_mismatch",
  );
});

test("Madrid alone receives the approved territorial module", async () => {
  const source = await sourceFixture();
  const national = prepareEdition07Content(source, "national", UNSUBSCRIBE_URL);
  const madrid = prepareEdition07Content(source, "madrid", UNSUBSCRIBE_URL);
  const aCoruna = prepareEdition07Content(source, "a-coruna", UNSUBSCRIBE_URL);
  const barcelona = prepareEdition07Content(source, "barcelona", UNSUBSCRIBE_URL);

  assert.notEqual(madrid.html, national.html);
  assert.notEqual(madrid.text, national.text);
  assert.equal(aCoruna.html, national.html);
  assert.equal(aCoruna.text, national.text);
  assert.equal(barcelona.html, national.html);
  assert.equal(barcelona.text, national.text);
  assert.equal((national.html.match(/<img\b/gi) ?? []).length, 6);
  assert.equal((madrid.html.match(/<img\b/gi) ?? []).length, 7);
  assert.match(madrid.html, /Lo próximo cerca de ti/);
  assert.match(madrid.html, /Hot Wheels Legends Tour España 2026/);
  assert.match(madrid.html, /19–20 septiembre<\/strong> · Circuito de Madrid Jarama-RACE/);
  assert.match(madrid.text, /LO PRÓXIMO CERCA DE TI/);
  assert.match(madrid.text, /Hot Wheels Legends Tour España 2026/);
  for (const rendered of [national, aCoruna, barcelona]) {
    assert.doesNotMatch(rendered.html, /Lo próximo cerca de ti|Hot Wheels Legends Tour/);
    assert.doesNotMatch(rendered.text, /LO PRÓXIMO CERCA DE TI|Hot Wheels Legends Tour/);
  }

  for (const rendered of [national, madrid, aCoruna, barcelona]) {
    assert.match(
      rendered.html,
      /Este fin de semana la agenda vuelve a venir muy cargada\./,
    );
    assert.match(rendered.html, />10º REPSOL EcoRally A Coruña<\/h2>/);
    assert.match(
      rendered.html,
      /El EcoRally A Coruña mezcla movilidad eléctrica, regularidad y recorrido de fondo/,
    );
    assert.match(
      rendered.html,
      /La gran cita de resistencia del fin de semana llega a Montmeló/,
    );
    assert.match(
      rendered.html,
      /España acoge una de las grandes citas del trial mundial/,
    );
    assert.match(
      rendered.html,
      /Jaizkibel es una de esas pruebas con nombre propio dentro del automovilismo de montaña/,
    );
    assert.match(
      rendered.html,
      /25–26 septiembre<\/strong> · Llanes, Asturias/,
    );
    assert.match(rendered.text, /EVENTO DESTACADO · ECO RALLY/);
    assert.match(rendered.text, /24H de Barcelona de Automovilismo/);
    assert.match(rendered.text, /TrialGP de España · Pobladura/);
    assert.match(rendered.text, /XLVIII Subida a Jaizkibel/);
    assert.match(rendered.text, /49º Rallye Villa de Llanes/);
  }

  for (const content of [
    "ecorally_a_coruna",
    "24h_barcelona",
    "trialgp_espana",
    "subida_jaizkibel",
    "rallye_villa_llanes",
  ]) {
    const urls = [...national.html.matchAll(new RegExp(`href="([^"]+utm_content=${content})"`, "g"))]
      .map((match) => match[1]);
    assert.equal(urls.length, 2);
    assert.equal(urls[0], urls[1]);
  }
  assert.equal(
    [...national.html.matchAll(/href="([^"]+utm_content=agenda_completa)"/g)].length,
    1,
  );
  assert.equal(
    [...madrid.html.matchAll(/href="([^"]+utm_content=hot_wheels_jarama_madrid)"/g)].length,
    2,
  );
});

test("Edition 07 reuses the sealed Edition 06 visual shell and 42/58 cards", async () => {
  const source = await sourceFixture();
  const national = prepareEdition07Content(source, "national", UNSUBSCRIBE_URL).html;
  const madrid = prepareEdition07Content(source, "madrid", UNSUBSCRIBE_URL).html;
  const barcelona = prepareEdition07Content(source, "barcelona", UNSUBSCRIBE_URL).html;
  const imageColumn =
    'class="stack-column" width="42%" valign="top" style="padding:0;"';
  const contentColumn =
    'class="stack-column" width="58%" valign="middle" style="padding:18px;box-sizing:border-box;overflow-wrap:break-word;"';
  const stackRule =
    ".stack-column { display:block !important; width:100% !important; max-width:100% !important; box-sizing:border-box !important; }";
  const outerBackground =
    '<body bgcolor="#cfd6de" style="margin:0;padding:0;background-color:#cfd6de;">';
  const contentShell =
    'style="width:100%;max-width:620px;background-color:#dde3e9;border-radius:18px;overflow:hidden;"';
  const openingBackground =
    'bgcolor="#e6ebf0" style="padding:27px 28px 20px;background-color:#e6ebf0;"';
  const standardCard =
    'bgcolor="#f1f3f5" style="border:1px solid #c4ccd5;border-radius:14px;background-color:#f1f3f5;overflow:hidden;"';
  const closingBlock =
    'bgcolor="#d6dde4" style="background-color:#d6dde4;border:1px solid #c4ccd5;border-radius:14px;"';
  const footerBackground =
    '<tr bgcolor="#090b0f" style="background-color:#090b0f;">';

  assert.equal(national.split(imageColumn).length - 1, 4);
  assert.equal(national.split(contentColumn).length - 1, 4);
  assert.equal(barcelona.split(imageColumn).length - 1, 4);
  assert.equal(barcelona.split(contentColumn).length - 1, 4);
  assert.equal(madrid.split(imageColumn).length - 1, 5);
  assert.equal(madrid.split(contentColumn).length - 1, 5);
  assert.equal(national.split(standardCard).length - 1, 4);
  assert.equal(barcelona.split(standardCard).length - 1, 4);
  assert.equal(madrid.split(standardCard).length - 1, 5);
  assert.ok(national.includes(stackRule));
  assert.ok(national.includes(outerBackground));
  assert.ok(national.includes(contentShell));
  assert.match(national, /class="email-shell"[^>]+bgcolor="#dde3e9"/);
  assert.ok(national.includes(openingBackground));
  assert.ok(national.includes(closingBlock));
  assert.ok(national.includes(footerBackground));
  assert.match(national, /@media only screen and \(max-width:700px\)/);
  assert.match(
    national,
    /class="email-header"[^>]+bgcolor="#050608"[^>]*>[\s\S]*?class="email-header-table"[^>]+bgcolor="#050608"[^>]*>[\s\S]*?<img[^>]+eventomotor-header\.png[^>]+width="620"/,
  );
  assert.match(
    national,
    /alt="EventoMotor · La Agenda Motor · Edición 07 · 18–20 septiembre 2026"/,
  );
  assert.doesNotMatch(national, /eventomotor-logo\.png/);
  assert.match(national, /La selección de esta semana/);
  assert.match(
    national,
    /01-ecorally-a-coruna-hero\.webp" width="564"[^>]+border-radius:14px;/,
  );
  assert.match(national, /<div style="padding:18px 2px 0;">/);
  assert.match(national, /Evento destacado · Eco Rally/);
  assert.match(national, /Más planes para este fin de semana/);
  assert.match(national, /<h2[^>]+>¿Todavía no tienes plan\?<\/h2>/);
  assert.match(
    national,
    /Consulta la agenda completa y encuentra eventos por fecha, disciplina o zona\./,
  );
  assert.match(
    national,
    /La información puede sufrir modificaciones\. Antes de desplazarte, revisa la ficha y los canales oficiales del evento/,
  );
  assert.match(national, /La Agenda Motor · EventoMotor · info@eventomotor\.com/);
  assert.match(
    national,
    /Reserva fecha<\/div>[\s\S]*49º Rallye Villa de Llanes/,
  );
  assert.doesNotMatch(
    national,
    /mobile-card|mobile-card-gap|display\s*:\s*(?:grid|flex)|\bgap\s*:|object-fit|aspect-ratio|bgcolor="#111827"|background:#111827|#fff4ed|#ffcfb7|#e34900/,
  );
  assert.doesNotMatch(
    national,
    /Estos son nuestros destacados|Recibes La Agenda Motor porque confirmaste/,
  );

  const orderedTitles = [
    "10º REPSOL EcoRally A Coruña",
    "24H de Barcelona de Automovilismo",
    "TrialGP de España · Pobladura",
    "XLVIII Subida a Jaizkibel",
    "49º Rallye Villa de Llanes",
  ];
  let previousIndex = -1;
  for (const title of orderedTitles) {
    const index = national.indexOf(title);
    assert.ok(index > previousIndex, title);
    previousIndex = index;
  }
});

test("Gmail iPhone header and footer reuse the historical opaque email-safe hardening", async () => {
  const source = await sourceFixture();
  const national = prepareEdition07Content(source, "national", UNSUBSCRIBE_URL).html;

  assert.match(
    national,
    /<tr bgcolor="#050608" style="background-color:#050608;">[\s\S]*?class="email-header"[^>]+bgcolor="#050608"[^>]*>[\s\S]*?class="email-header-table"[^>]+bgcolor="#050608"[^>]*>[\s\S]*?<tr bgcolor="#050608" style="background-color:#050608;">[\s\S]*?<td align="center" bgcolor="#050608" style="padding:0;background-color:#050608;">/,
  );
  assert.match(
    national,
    /eventomotor-header\.png" width="620"[\s\S]*?display:block;width:100%;max-width:620px;height:auto;border:0;margin:0;background-color:#050608/,
  );
  assert.ok((national.match(/bgcolor="#050608"/g)?.length ?? 0) >= 5);
  assert.ok((national.match(/background-color:#050608/g)?.length ?? 0) >= 6);

  assert.match(
    national,
    /class="email-footer"[^>]+bgcolor="#090b0f"[^>]*>[\s\S]*?class="email-footer-table"[^>]+bgcolor="#090b0f"/,
  );
  assert.ok((national.match(/bgcolor="#090b0f"/g)?.length ?? 0) >= 5);
  assert.ok((national.match(/background-color:#090b0f/g)?.length ?? 0) >= 5);
  assert.equal(
    national.match(/color:#cbd0d8 !important;text-decoration:underline/g)?.length,
    3,
  );
  assert.doesNotMatch(
    national,
    /mix-blend-mode|u\s*\+\s*\.body|linear-gradient|color-scheme|prefers-color-scheme/i,
  );

  assert.match(
    source.html,
    /https:\/\/www\.eventomotor\.com\/newsletter\/2026-09-17\/assets\/eventomotor-header\.png/,
  );
  assert.equal(
    sha256(canonicalize(source.html)),
    NEWSLETTER_EDITION_07_HTML_SHA256,
  );
  assert.equal(
    sha256(canonicalize(source.text)),
    NEWSLETTER_EDITION_07_TEXT_SHA256,
  );
});

test("all four previews are exact outputs of the runtime renderer", async () => {
  const source = await sourceFixture();
  const variants: readonly NewsletterEdition07ContentVariant[] = [
    "national",
    "madrid",
    "a-coruna",
    "barcelona",
  ];
  for (const variant of variants) {
    const expected = prepareEdition07PreviewContent(source, variant, UNSUBSCRIBE_URL);
    const actual = await readFile(
      resolve(ROOT, EDITION_DIRECTORY, `preview-${variant}.html`),
      "utf8",
    );
    assert.equal(actual, expected.html);
    assert.doesNotMatch(actual, /\{\{(?:territorial_block|unsubscribe_url)\}\}/);
    assert.doesNotMatch(actual, /localhost|file:\/\/|data:|\/_next\/image/);
  }
});

test("dry-run is aggregate-only and constructs no provider client", async () => {
  const source = await sourceFixture();
  const messages: string[] = [];
  let prepared = 0;
  let clients = 0;
  const result = await executeNewsletterEdition07Campaign({
    request: { sendPrepared: false, prepareOnly: false, limit: 25 },
    source,
    repository: repositoryFixture({
      prepareCampaign: async () => {
        prepared += 1;
        return summary();
      },
    }),
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
    clientFactory: () => {
      clients += 1;
      throw new Error("provider client must not be constructed in dry-run");
    },
    logger: (message) => messages.push(message),
  });
  assert.equal(result.status, "dry_run");
  assert.equal(prepared, 0);
  assert.equal(clients, 0);
  for (const label of [
    "Campaign:", "Edition:", "Subject:", "HTML digest:", "Text digest:",
    "Manifest digest:", "Eligible audience:", "Variant national:",
    "Variant madrid:", "Variant a-coruna:", "Variant barcelona:", "Excluded:",
    "Duplicates:", "Invalid:", "Audience frozen:", "Prepared:",
    "Previously accepted:", "Failed:", "Unknown:", "Pending claims:",
  ]) assert.ok(messages.some((message) => message.startsWith(label)), label);
  assert.ok(messages.includes("NO CAMPAIGN WAS PREPARED"));
  assert.ok(messages.includes("NO EMAIL WAS SENT"));
});

test("mutation modes retain Edition 07-specific fail-closed gates", async () => {
  const source = await sourceFixture();
  await assert.rejects(
    executeNewsletterEdition07Campaign({
      request: {
        sendPrepared: false,
        prepareOnly: true,
        limit: 25,
        confirmEdition: NEWSLETTER_EDITION_07_CAMPAIGN_KEY,
        confirmPhrase: NEWSLETTER_EDITION_07_CAMPAIGN_CONFIRM_PHRASE,
      },
      environment: {
        armed: "wrong",
        mailTransport: "resend",
        newsletterMode: "live",
        publicLaunchEnabled: "public-newsletter-live",
      },
      source,
      repository: repositoryFixture(),
      sender: NEWSLETTER_EDITION_07_SENDER,
      replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "send_not_armed",
  );
  assert.notEqual(
    NEWSLETTER_EDITION_07_CAMPAIGN_ARMED_VALUE,
    "agenda-motor-2026-08-13-manual-send",
  );
});

test("prepare-only freezes once without claiming deliveries or constructing a provider", async () => {
  const source = await sourceFixture();
  let prepareCalls = 0;
  let claimCalls = 0;
  let clientCalls = 0;
  const result = await executeNewsletterEdition07Campaign({
    request: {
      sendPrepared: false,
      prepareOnly: true,
      limit: 25,
      confirmEdition: NEWSLETTER_EDITION_07_CAMPAIGN_KEY,
      confirmPhrase: NEWSLETTER_EDITION_07_CAMPAIGN_CONFIRM_PHRASE,
    },
    environment: {
      armed: NEWSLETTER_EDITION_07_CAMPAIGN_ARMED_VALUE,
      mailTransport: "resend",
      newsletterMode: "live",
      publicLaunchEnabled: "public-newsletter-live",
    },
    source,
    repository: repositoryFixture({
      prepareCampaign: async () => {
        prepareCalls += 1;
        return summary({
          campaignId: PREPARED_CAMPAIGN_ID,
          campaignStatus: "prepared",
          audienceFrozenAt: "2026-09-17T08:00:00.000Z",
          preparedCount: 37,
        });
      },
      claimDelivery: async () => {
        claimCalls += 1;
        return null;
      },
    }),
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
    clientFactory: () => {
      clientCalls += 1;
      throw new Error("prepare-only must not construct a provider");
    },
  });
  assert.equal(result.status, "prepared");
  assert.equal(prepareCalls, 1);
  assert.equal(claimCalls, 0);
  assert.equal(clientCalls, 0);
});

test("send-prepared is fail-closed until a reviewed frozen snapshot is sealed", async () => {
  const source = await sourceFixture();
  let previewCalls = 0;
  let prepareCalls = 0;
  let claimCalls = 0;
  let providerCalls = 0;
  await assert.rejects(
    sendPreparedNewsletterEdition07Campaign({
      request: sendPreparedRequest(),
      environment: sendPreparedEnvironment(),
      source,
      repository: repositoryFixture({
        previewCampaign: async () => {
          previewCalls += 1;
          return summary();
        },
        prepareCampaign: async () => {
          prepareCalls += 1;
          return summary();
        },
        claimDelivery: async () => {
          claimCalls += 1;
          return null;
        },
      }),
      sender: NEWSLETTER_EDITION_07_SENDER,
      replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
      clientFactory: () => ({
        sendEmail: async () => {
          providerCalls += 1;
          return { status: "accepted", providerMessageId: "unexpected" };
        },
      }),
      tokenFactory: () => Buffer.alloc(32, 1).toString("base64url"),
      tokenHasher: (token) => sha256(token),
    }),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "prepared_campaign_not_sealed",
  );
  assert.equal(previewCalls, 0);
  assert.equal(prepareCalls, 0);
  assert.equal(claimCalls, 0);
  assert.equal(providerCalls, 0);
});

test("send-prepared rejects an incoherent sealed snapshot before provider or repository calls", async () => {
  const source = await sourceFixture();
  let claimCalls = 0;
  let providerCalls = 0;
  await assert.rejects(
    sendPreparedNewsletterEdition07Campaign({
      request: sendPreparedRequest(),
      environment: sendPreparedEnvironment(),
      source,
      repository: repositoryFixture({
        claimDelivery: async () => {
          claimCalls += 1;
          return null;
        },
      }),
      sender: NEWSLETTER_EDITION_07_SENDER,
      replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
      clientFactory: () => ({
        sendEmail: async () => {
          providerCalls += 1;
          return { status: "accepted", providerMessageId: "unexpected" };
        },
      }),
      tokenFactory: () => Buffer.alloc(32, 1).toString("base64url"),
      tokenHasher: (token) => sha256(token),
      preparedCampaignSeal: {
        ...PREPARED_CAMPAIGN_SEAL,
        variantCounts: { ...PREPARED_CAMPAIGN_SEAL.variantCounts, national: 2 },
      },
    }),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "prepared_campaign_seal_invalid",
  );
  assert.equal(claimCalls, 0);
  assert.equal(providerCalls, 0);
});

test("send-prepared consumes exactly the frozen deliveries without preview or prepare", async () => {
  const source = await sourceFixture();
  let claimIndex = 0;
  let previewCalls = 0;
  let prepareCalls = 0;
  let providerCalls = 0;
  let acceptedCalls = 0;
  let tokenIndex = 0;
  const payloads: Array<{ html: string; text: string; subject: string }> = [];
  const repository = repositoryFixture({
    previewCampaign: async () => {
      previewCalls += 1;
      throw new Error("live audience preview must not run");
    },
    prepareCampaign: async () => {
      prepareCalls += 1;
      throw new Error("prepare must not run");
    },
    claimDelivery: async (input) => {
      assert.equal(input.campaignId, PREPARED_CAMPAIGN_ID);
      assert.equal(input.allowRetry, false);
      const index = claimIndex;
      claimIndex += 1;
      return {
        deliveryId: fixtureUuid(1, index),
        campaignId: PREPARED_CAMPAIGN_ID,
        subscriberId: fixtureUuid(2, index),
        recipientEmail: `edition07-${index}@example.invalid`,
        claimId: fixtureUuid(3, index),
        attemptCount: 1,
        idempotencyKey: `newsletter/${PREPARED_CAMPAIGN_ID}/${fixtureUuid(1, index)}/1`,
        contentVariant: preparedVariant(index),
      };
    },
    recordAccepted: async () => {
      acceptedCalls += 1;
    },
  });
  const client: NewsletterEdition07CampaignClient = {
    sendEmail: async (payload) => {
      providerCalls += 1;
      payloads.push(payload);
      return {
        status: "accepted",
        providerMessageId: `edition07-prepared-${providerCalls}`,
      };
    },
  };

  const result = await sendPreparedNewsletterEdition07Campaign({
    request: sendPreparedRequest(),
    environment: sendPreparedEnvironment(),
    source,
    repository,
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
    clientFactory: () => client,
    tokenFactory: () => {
      tokenIndex += 1;
      return Buffer.alloc(32, tokenIndex).toString("base64url");
    },
    tokenHasher: (token) => sha256(token),
    preparedCampaignSeal: PREPARED_CAMPAIGN_SEAL,
  });

  assert.equal(result.status, "prepared_sent");
  assert.equal(result.campaignId, PREPARED_CAMPAIGN_ID);
  assert.equal(result.processedCount, PREPARED_CAMPAIGN_SEAL.deliveryCount);
  assert.deepEqual(
    result.processedVariantCounts,
    PREPARED_CAMPAIGN_SEAL.variantCounts,
  );
  assert.equal(previewCalls, 0);
  assert.equal(prepareCalls, 0);
  assert.equal(claimIndex, PREPARED_CAMPAIGN_SEAL.deliveryCount);
  assert.equal(providerCalls, PREPARED_CAMPAIGN_SEAL.deliveryCount);
  assert.equal(acceptedCalls, PREPARED_CAMPAIGN_SEAL.deliveryCount);
  assert.equal(payloads[0]?.subject, NEWSLETTER_EDITION_07_SUBJECT);
  assert.match(payloads[0]?.html ?? "", /utm_campaign=agenda_motor_2026_09_17/);
  assert.match(payloads[0]?.html ?? "", /newsletter\/unsubscribe\?token=/);
  assert.doesNotMatch(payloads[0]?.html ?? "", /\{\{unsubscribe_url\}\}/);
  assert.doesNotMatch(payloads[0]?.text ?? "", /\{\{unsubscribe_url\}\}/);
  assert.doesNotMatch(payloads[0]?.html ?? "", /Hot Wheels Legends Tour España 2026/);
  assert.match(payloads[3]?.html ?? "", /Hot Wheels Legends Tour España 2026/);
  assert.doesNotMatch(payloads[4]?.html ?? "", /Hot Wheels Legends Tour España 2026/);
  assert.doesNotMatch(payloads[5]?.html ?? "", /Hot Wheels Legends Tour España 2026/);
});

test("send-prepared processes a sealed 116-delivery snapshot in one logical run", async () => {
  const source = await sourceFixture();
  const seal: NewsletterEdition07PreparedCampaignSeal = {
    campaignId: PREPARED_CAMPAIGN_ID,
    deliveryCount: 116,
    variantCounts: { national: 89, madrid: 20, "a-coruna": 1, barcelona: 6 },
  };
  let previewCalls = 0;
  let prepareCalls = 0;
  let claimCalls = 0;
  let clientFactoryCalls = 0;
  let mockProviderCalls = 0;
  let acceptedCalls = 0;

  const result = await sendPreparedNewsletterEdition07Campaign({
    request: sendPreparedRequest({ limit: seal.deliveryCount }),
    environment: sendPreparedEnvironment(),
    source,
    repository: repositoryFixture({
      previewCampaign: async () => {
        previewCalls += 1;
        throw new Error("live audience must not be recalculated");
      },
      prepareCampaign: async () => {
        prepareCalls += 1;
        throw new Error("a second prepare must not run");
      },
      claimDelivery: async ({ campaignId, allowRetry }) => {
        assert.equal(campaignId, PREPARED_CAMPAIGN_ID);
        assert.equal(allowRetry, false);
        const index = claimCalls;
        claimCalls += 1;
        const contentVariant: NewsletterEdition07ContentVariant =
          index < 89 ? "national" :
          index < 109 ? "madrid" :
          index < 110 ? "a-coruna" : "barcelona";
        return {
          deliveryId: fixtureUuid(1, index),
          campaignId: PREPARED_CAMPAIGN_ID,
          subscriberId: fixtureUuid(2, index),
          recipientEmail: `edition07-${index}@example.invalid`,
          claimId: fixtureUuid(3, index),
          attemptCount: 1,
          idempotencyKey: `newsletter/${PREPARED_CAMPAIGN_ID}/${fixtureUuid(1, index)}/1`,
          contentVariant,
        };
      },
      recordAccepted: async () => {
        acceptedCalls += 1;
      },
    }),
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
    clientFactory: () => {
      clientFactoryCalls += 1;
      return {
        sendEmail: async () => {
          mockProviderCalls += 1;
          return {
            status: "accepted",
            providerMessageId: `edition07-fixture-${mockProviderCalls}`,
          };
        },
      };
    },
    tokenFactory: () => Buffer.alloc(32, claimCalls + 1).toString("base64url"),
    tokenHasher: (token) => sha256(token),
    preparedCampaignSeal: seal,
  });

  assert.equal(result.status, "prepared_sent");
  assert.equal(result.processedCount, 116);
  assert.deepEqual(result.processedVariantCounts, seal.variantCounts);
  assert.equal(clientFactoryCalls, 1);
  assert.equal(previewCalls, 0);
  assert.equal(prepareCalls, 0);
  assert.equal(claimCalls, 116);
  assert.equal(mockProviderCalls, 116);
  assert.equal(acceptedCalls, 116);
});

test("prepared seal accepts 500 and rejects 501 before claiming", async () => {
  const source = await sourceFixture();
  let claimCalls = 0;
  let mockProviderCalls = 0;
  const options = {
    environment: sendPreparedEnvironment(),
    source,
    repository: repositoryFixture({
      previewCampaign: async () => { throw new Error("unexpected preview"); },
      prepareCampaign: async () => { throw new Error("unexpected prepare"); },
      claimDelivery: async () => {
        claimCalls += 1;
        return null;
      },
    }),
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
    clientFactory: () => ({
      sendEmail: async () => {
        mockProviderCalls += 1;
        throw new Error("no claim must reach the mock provider");
      },
    }),
    tokenFactory: () => Buffer.alloc(32, 1).toString("base64url"),
    tokenHasher: (token: string) => sha256(token),
  };

  await assert.rejects(
    sendPreparedNewsletterEdition07Campaign({
      ...options,
      request: sendPreparedRequest({ limit: 500 }),
      preparedCampaignSeal: {
        campaignId: PREPARED_CAMPAIGN_ID,
        deliveryCount: 500,
        variantCounts: { national: 500, madrid: 0, "a-coruna": 0, barcelona: 0 },
      },
    }),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "frozen_delivery_count_mismatch",
  );
  assert.equal(claimCalls, 1, "a 500-delivery seal passes validation and reaches the claim boundary");
  assert.equal(mockProviderCalls, 0);

  await assert.rejects(
    sendPreparedNewsletterEdition07Campaign({
      ...options,
      request: sendPreparedRequest({ limit: 501 }),
      preparedCampaignSeal: {
        campaignId: PREPARED_CAMPAIGN_ID,
        deliveryCount: 501,
        variantCounts: { national: 501, madrid: 0, "a-coruna": 0, barcelona: 0 },
      },
    }),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "prepared_campaign_seal_invalid",
  );
  assert.equal(claimCalls, 1, "a 501-delivery seal is rejected before claiming");
  assert.equal(mockProviderCalls, 0);
});

test("send-prepared fails before provider when the frozen campaign is unavailable", async () => {
  const source = await sourceFixture();
  for (const claimDelivery of [
    async () => null,
    async () => {
      throw new Error("campaign missing or audience not frozen");
    },
  ]) {
    let providerCalls = 0;
    const repository = repositoryFixture({
      previewCampaign: async () => {
        throw new Error("live audience preview must not run");
      },
      prepareCampaign: async () => {
        throw new Error("prepare must not run");
      },
      claimDelivery,
    });
    await assert.rejects(
      sendPreparedNewsletterEdition07Campaign({
        request: sendPreparedRequest(),
        environment: sendPreparedEnvironment(),
        source,
        repository,
        sender: NEWSLETTER_EDITION_07_SENDER,
        replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
        clientFactory: () => ({
          sendEmail: async () => {
            providerCalls += 1;
            return { status: "accepted", providerMessageId: "unexpected" };
          },
        }),
        tokenFactory: () => Buffer.alloc(32, 1).toString("base64url"),
        tokenHasher: (token) => sha256(token),
        preparedCampaignSeal: PREPARED_CAMPAIGN_SEAL,
      }),
    );
    assert.equal(providerCalls, 0);
  }
});

test("send-prepared rejects edition and campaign identity mismatches before claiming", async () => {
  const source = await sourceFixture();
  let claimCalls = 0;
  let providerCalls = 0;
  const repository = repositoryFixture({
    claimDelivery: async () => {
      claimCalls += 1;
      return null;
    },
  });
  for (const request of [
    sendPreparedRequest({ confirmEdition: "agenda_motor_2026_08_27" }),
    sendPreparedRequest({ confirmCampaignId: "401dab00-cb04-4a83-a0bd-fe63fd0e7000" }),
  ]) {
    await assert.rejects(
      sendPreparedNewsletterEdition07Campaign({
        request,
        environment: sendPreparedEnvironment(),
        source,
        repository,
        sender: NEWSLETTER_EDITION_07_SENDER,
        replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
        clientFactory: () => ({
          sendEmail: async () => {
            providerCalls += 1;
            return { status: "accepted", providerMessageId: "unexpected" };
          },
        }),
        tokenFactory: () => Buffer.alloc(32, 1).toString("base64url"),
        tokenHasher: (token) => sha256(token),
        preparedCampaignSeal: PREPARED_CAMPAIGN_SEAL,
      }),
      NewsletterEdition07CampaignError,
    );
  }
  assert.equal(claimCalls, 0);
  assert.equal(providerCalls, 0);
});

test("send-prepared requires the exact sealed count and cannot fall back to prepare", async () => {
  const source = await sourceFixture();
  let prepareCalls = 0;
  let providerCalls = 0;
  await assert.rejects(
    sendPreparedNewsletterEdition07Campaign({
      request: sendPreparedRequest({ limit: 5 }),
      environment: sendPreparedEnvironment(),
      source,
      repository: repositoryFixture({
        prepareCampaign: async () => {
          prepareCalls += 1;
          return summary();
        },
      }),
      sender: NEWSLETTER_EDITION_07_SENDER,
      replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
      clientFactory: () => ({
        sendEmail: async () => {
          providerCalls += 1;
          return { status: "accepted", providerMessageId: "unexpected" };
        },
      }),
      tokenFactory: () => Buffer.alloc(32, 1).toString("base64url"),
      tokenHasher: (token) => sha256(token),
      preparedCampaignSeal: PREPARED_CAMPAIGN_SEAL,
    }),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "prepared_delivery_limit_invalid",
  );
  assert.equal(prepareCalls, 0);
  assert.equal(providerCalls, 0);
});

test("campaign parser is dry-run by default and rejects unsafe combinations", () => {
  assert.deepEqual(parseNewsletterEdition07CampaignArguments([]), {
    sendPrepared: false,
    prepareOnly: false,
    limit: 25,
  });
  assert.throws(
    () => parseNewsletterEdition07CampaignArguments(["--resume"]),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "unknown_argument",
  );
  assert.throws(
    () => parseNewsletterEdition07CampaignArguments(["--send"]),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "unknown_argument",
  );
  assert.deepEqual(
    parseNewsletterEdition07CampaignArguments([
      "--send-prepared",
      "--limit",
      "6",
      "--confirm-edition",
      NEWSLETTER_EDITION_07_CAMPAIGN_KEY,
      "--confirm-phrase",
      NEWSLETTER_EDITION_07_CAMPAIGN_CONFIRM_PHRASE,
      "--confirm-campaign-id",
      PREPARED_CAMPAIGN_ID,
    ]),
    sendPreparedRequest(),
  );
  assert.throws(
    () =>
      parseNewsletterEdition07CampaignArguments([
        "--send-prepared",
        "--prepare-only",
      ]),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "send_prepared_mode_conflict",
  );
});

test("campaign parser keeps a bounded Edition 07 safety cap of 500", () => {
  for (const limit of [100, 116, 500]) {
    assert.equal(
      parseNewsletterEdition07CampaignArguments(["--limit", String(limit)]).limit,
      limit,
    );
  }
  assert.throws(
    () => parseNewsletterEdition07CampaignArguments(["--limit", "501"]),
    (error) =>
      error instanceof NewsletterEdition07CampaignError &&
      error.code === "limit_invalid",
  );
});

test("server boundaries remain explicit and the CLI imports only the server adapter", async () => {
  const [serverAdapter, repositoryAdapter, sourceAdapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-07-campaign.server.ts"), "utf8"),
    readFile(resolve(ROOT, "lib/newsletter/edition-07-campaign-repository.server.ts"), "utf8"),
    readFile(resolve(ROOT, "lib/newsletter/edition-07-source.server.ts"), "utf8"),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-07.ts"), "utf8"),
  ]);
  for (const adapter of [serverAdapter, repositoryAdapter, sourceAdapter]) {
    assert.ok(adapter.startsWith('import "server-only";'));
  }
  assert.match(cli, /edition-07-campaign\.server/);
  assert.doesNotMatch(cli, /resend-client|supabase|service-role/);
  assert.match(serverAdapter, /NEWSLETTER_EDITION_07_PREPARED_CAMPAIGN_ID/);
  assert.match(serverAdapter, /NEWSLETTER_EDITION_07_PREPARED_DELIVERY_COUNT/);
  assert.match(serverAdapter, /NEWSLETTER_EDITION_07_PREPARED_NATIONAL_COUNT/);
  assert.match(serverAdapter, /NEWSLETTER_EDITION_07_PREPARED_MADRID_COUNT/);
  assert.match(serverAdapter, /NEWSLETTER_EDITION_07_PREPARED_A_CORUNA_COUNT/);
  assert.match(serverAdapter, /NEWSLETTER_EDITION_07_PREPARED_BARCELONA_COUNT/);
});
