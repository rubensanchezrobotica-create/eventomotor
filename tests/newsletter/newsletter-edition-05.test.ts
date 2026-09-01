import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import sharp from "sharp";

import { NEWSLETTER_EDITION_01_CAMPAIGN_KEY } from "@/lib/newsletter/edition-01-campaign";
import { NEWSLETTER_EDITION_02_CAMPAIGN_KEY } from "@/lib/newsletter/edition-02-campaign";
import {
  NEWSLETTER_EDITION_05_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_05_CAMPAIGN_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_05_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_05_REPLY_TO,
  NEWSLETTER_EDITION_05_SENDER,
  NEWSLETTER_EDITION_05_SUBJECT,
  NewsletterEdition05CampaignError,
  executeNewsletterEdition05Campaign,
  parseNewsletterEdition05CampaignArguments,
  type NewsletterEdition05CampaignRepository,
  type NewsletterEdition05CampaignSummary,
} from "@/lib/newsletter/edition-05-campaign";
import {
  NEWSLETTER_EDITION_05_ASSET_MANIFEST,
  NEWSLETTER_EDITION_05_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_05_HTML_SHA256,
  NEWSLETTER_EDITION_05_PREHEADER,
  NEWSLETTER_EDITION_05_TEXT_SHA256,
  NewsletterEdition05ContentError,
  newsletterEdition05ContentManifestDigest,
  prepareEdition05Content,
  prepareEdition05PreviewContent,
  validateEdition05SourceIntegrity,
  type NewsletterEdition05ContentVariant,
  type NewsletterEdition05Source,
} from "@/lib/newsletter/edition-05-content";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-03";
const PUBLIC_ASSET_DIRECTORY = "public/newsletter/2026-09-03/assets";
const UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition05-preview-token-fixture-000000000000";
const EDITION_05_BODY_HTML_SHA256 =
  "114e03ecc1966386e7f3239ff2b43656808110c038a2a398adc784eb73e96ffa";
const EDITION_05_HREFS_SHA256 =
  "21975460c1e6205168df5dc22633ece9b44877f021e68a5a04a36c05c65493a2";
const EDITION_05_EVENT_IMAGES_SHA256 =
  "160b4889923b59f07a9998fdf04488d3e80436315597b13f51f0068373be55eb";
const EDITION_05_HEADER_ASSET_SHA256 =
  "fb18ea36f163b24e10930c55b54662b40c1f509f195c1c9a5857a441c29386a9";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function editorialBody(html: string): string {
  const canonical = canonicalize(html);
  const start = canonical.indexOf(
    '          <tr>\n            <td class="mobile-pad" bgcolor="#e6ebf0"',
  );
  const end = canonical.indexOf(
    '          <tr bgcolor="#090b0f"',
    start,
  );
  assert.ok(start >= 0);
  assert.ok(end > start);
  return canonical.slice(start, end);
}

async function sourceFixture(): Promise<NewsletterEdition05Source> {
  const [html, text, assetManifest, entries] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_05_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(entries) };
}

function summary(
  overrides: Partial<NewsletterEdition05CampaignSummary> = {},
): NewsletterEdition05CampaignSummary {
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
  overrides: Partial<NewsletterEdition05CampaignRepository> = {},
): NewsletterEdition05CampaignRepository {
  return {
    previewCampaign: async () => summary(),
    prepareCampaign: async () =>
      summary({
        campaignId: "12000000-0000-4000-8000-000000000003",
        campaignStatus: "prepared",
        audienceFrozenAt: "2026-09-03T08:00:00.000Z",
        preparedCount: 37,
      }),
    claimDelivery: async () => null,
    recordAccepted: async () => undefined,
    recordFailed: async () => undefined,
    recordUnknown: async () => undefined,
    ...overrides,
  };
}

test("Edition 05 has the approved independent identity", () => {
  assert.equal(NEWSLETTER_EDITION_05_CAMPAIGN_KEY, "agenda_motor_2026_09_03");
  assert.notEqual(NEWSLETTER_EDITION_05_CAMPAIGN_KEY, NEWSLETTER_EDITION_01_CAMPAIGN_KEY);
  assert.notEqual(NEWSLETTER_EDITION_05_CAMPAIGN_KEY, NEWSLETTER_EDITION_02_CAMPAIGN_KEY);
  assert.equal(
    NEWSLETTER_EDITION_05_SUBJECT,
    "Cheste, Tenerife y lo que viene este fin de semana",
  );
  assert.equal(
    NEWSLETTER_EDITION_05_PREHEADER,
    "MotoJunior en Cheste, rally raid, Tenerife y la primera F1 de MADRING ya en el horizonte.",
  );
  assert.equal(
    NEWSLETTER_EDITION_05_SENDER,
    "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>",
  );
  assert.equal(NEWSLETTER_EDITION_05_REPLY_TO, "info@eventomotor.com");
});

test("canonical HTML, text and seven assets pass fail-closed integrity", async () => {
  const source = await sourceFixture();
  assert.deepEqual(validateEdition05SourceIntegrity(source), {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 7,
  });
  assert.equal(
    newsletterEdition05ContentManifestDigest(),
    NEWSLETTER_EDITION_05_CONTENT_MANIFEST_SHA256,
  );
  assert.match(NEWSLETTER_EDITION_05_HTML_SHA256, /^[0-9a-f]{64}$/);
  assert.match(NEWSLETTER_EDITION_05_TEXT_SHA256, /^[0-9a-f]{64}$/);

  const header = Buffer.from(source.assets["eventomotor-header.png"]);
  assert.equal(sha256(header), EDITION_05_HEADER_ASSET_SHA256);
  assert.equal(header.readUInt32BE(16), 1240);
  assert.equal(header.readUInt32BE(20), 200);
  const headerStats = await sharp(header).stats();
  assert.equal(headerStats.channels[3]?.min, 255);
  assert.equal(headerStats.channels[3]?.max, 255);

  for (const asset of NEWSLETTER_EDITION_05_ASSET_MANIFEST) {
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
    () => validateEdition05SourceIntegrity({ ...source, html: `${source.html} ` }),
    (error) =>
      error instanceof NewsletterEdition05ContentError &&
      error.code === "template_digest_mismatch",
  );
  const changed = Uint8Array.from(source.assets["01-fim-motojunior-cheste-hero.webp"]);
  changed[0] = (changed[0] ?? 0) ^ 1;
  assert.throws(
    () =>
      validateEdition05SourceIntegrity({
        ...source,
        assets: { ...source.assets, "01-fim-motojunior-cheste-hero.webp": changed },
      }),
    (error) =>
      error instanceof NewsletterEdition05ContentError &&
      error.code === "asset_digest_mismatch",
  );
});

test("all four technical variants render identical national content", async () => {
  const source = await sourceFixture();
  const national = prepareEdition05Content(source, "national", UNSUBSCRIBE_URL);
  const madrid = prepareEdition05Content(source, "madrid", UNSUBSCRIBE_URL);
  const aCoruna = prepareEdition05Content(source, "a-coruna", UNSUBSCRIBE_URL);
  const barcelona = prepareEdition05Content(source, "barcelona", UNSUBSCRIBE_URL);

  assert.equal(madrid.html, national.html);
  assert.equal(madrid.text, national.text);
  assert.equal(aCoruna.html, national.html);
  assert.equal(aCoruna.text, national.text);
  assert.equal(barcelona.html, national.html);
  assert.equal(barcelona.text, national.text);
  assert.equal((national.html.match(/<img\b/gi) ?? []).length, 6);
  for (const rendered of [national, madrid, aCoruna, barcelona]) {
    assert.doesNotMatch(rendered.html, /Lo próximo cerca de ti|Motor Extremo Montmeló/);
    assert.match(
      rendered.html,
      /Septiembre empieza con una agenda especialmente cargada\. Nos quedamos con cuatro citas muy diferentes para este fin de semana y una más que conviene tener ya localizada para el siguiente\./,
    );
    assert.match(rendered.html, />FIM MotoJunior World Championship · Cheste<\/h2>/);
    assert.match(
      rendered.html,
      /MotoJunior llega a Cheste con categorías como Moto3 Junior, Moto2 European Championship, Moto4 European Cup y Stock European Championship, además de siete carreras previstas durante el fin de semana\./,
    );
    assert.match(
      rendered.html,
      /La última cita del Campeonato de España de Rallyes Todo Terreno reúne coches y motos alrededor de Zaragoza/,
    );
    assert.match(
      rendered.html,
      /Dos etapas, nueve tramos cronometrados y alrededor de 100 kilómetros contra el reloj/,
    );
    assert.match(
      rendered.html,
      /El Campeonato RACE llega a Monteblanco con categorías como Saxo Trophy, GTI Trophy y Campeonato RACE de Turismos/,
    );
    assert.match(
      rendered.html,
      /La Fórmula 1 estrena MADRING con actividad desde el viernes y el primer Gran Premio de España celebrado en el nuevo trazado madrileño\./,
    );
    assert.match(rendered.text, /FIM MOTOJUNIOR WORLD CHAMPIONSHIP · CHESTE/);
    assert.match(rendered.text, /CIERZO RALLYE EJÉRCITO DE TIERRA/);
    assert.match(rendered.text, /52º RALLYE ORVECAME ISLA TENERIFE/);
    assert.match(rendered.text, /CAMPEONATO RACE DE VELOCIDAD · MONTEBLANCO/);
    assert.match(rendered.text, /FÓRMULA 1 · GRAN PREMIO DE ESPAÑA · MADRING/);
    assert.match(
      rendered.text,
      /Nos quedamos con cuatro citas muy diferentes para este fin de semana y una más que conviene tener ya localizada para el siguiente\./,
    );
    assert.doesNotMatch(
      rendered.text,
      /LO PRÓXIMO CERCA DE TI|Motor Extremo Montmeló/,
    );
  }

  for (const content of [
    "fim_motojunior_cheste",
    "cierzo_rallye",
    "rallye_isla_tenerife",
    "race_monteblanco",
    "f1_madring",
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
});

test("Edition 05 reuses the sealed Edition 04 visual shell and 42/58 cards", async () => {
  const source = await sourceFixture();
  const national = prepareEdition05Content(source, "national", UNSUBSCRIBE_URL).html;
  const barcelona = prepareEdition05Content(source, "barcelona", UNSUBSCRIBE_URL).html;
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
  assert.equal(national.split(standardCard).length - 1, 4);
  assert.equal(barcelona.split(standardCard).length - 1, 4);
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
    /alt="EventoMotor · La Agenda Motor · Edición 05 · 4–6 septiembre 2026"/,
  );
  assert.doesNotMatch(national, /eventomotor-logo\.png/);
  assert.match(national, /La selección de esta semana/);
  assert.match(
    national,
    /01-fim-motojunior-cheste-hero\.webp" width="564"[^>]+border-radius:14px;/,
  );
  assert.match(national, /<div style="padding:18px 2px 0;">/);
  assert.match(national, /Evento destacado · Moto/);
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
    /Reserva fecha<\/div>[\s\S]*Fórmula 1 · Gran Premio de España · MADRING/,
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
    "FIM MotoJunior World Championship · Cheste",
    "Cierzo Rallye Ejército de Tierra",
    "52º Rallye Orvecame Isla Tenerife",
    "Campeonato RACE de Velocidad · Monteblanco",
    "Fórmula 1 · Gran Premio de España · MADRING",
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
  const national = prepareEdition05Content(source, "national", UNSUBSCRIBE_URL).html;

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

  assert.equal(sha256(editorialBody(source.html)), EDITION_05_BODY_HTML_SHA256);
  const hrefs = [...source.html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(
    (match) => match[1] ?? "",
  );
  assert.equal(sha256(JSON.stringify(hrefs)), EDITION_05_HREFS_SHA256);
  const eventImages = [
    ...source.html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g),
  ]
    .map((match) => match[1] ?? "")
    .filter((src) => !/eventomotor-(?:header|logo)\.png$/.test(src));
  assert.equal(
    sha256(JSON.stringify(eventImages)),
    EDITION_05_EVENT_IMAGES_SHA256,
  );
  assert.equal(
    sha256(canonicalize(source.text)),
    NEWSLETTER_EDITION_05_TEXT_SHA256,
  );
});

test("all four previews are exact outputs of the runtime renderer", async () => {
  const source = await sourceFixture();
  const variants: readonly NewsletterEdition05ContentVariant[] = [
    "national",
    "madrid",
    "a-coruna",
    "barcelona",
  ];
  for (const variant of variants) {
    const expected = prepareEdition05PreviewContent(source, variant, UNSUBSCRIBE_URL);
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
  const result = await executeNewsletterEdition05Campaign({
    request: { send: false, prepareOnly: false, resume: false, limit: 25 },
    source,
    repository: repositoryFixture({
      prepareCampaign: async () => {
        prepared += 1;
        return summary();
      },
    }),
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
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

test("mutation modes retain Edition 05-specific fail-closed gates", async () => {
  const source = await sourceFixture();
  await assert.rejects(
    executeNewsletterEdition05Campaign({
      request: {
        send: false,
        prepareOnly: true,
        resume: false,
        limit: 25,
        confirmEdition: NEWSLETTER_EDITION_05_CAMPAIGN_KEY,
        confirmPhrase: NEWSLETTER_EDITION_05_CAMPAIGN_CONFIRM_PHRASE,
      },
      environment: {
        armed: "wrong",
        mailTransport: "resend",
        newsletterMode: "live",
        publicLaunchEnabled: "public-newsletter-live",
      },
      source,
      repository: repositoryFixture(),
      sender: NEWSLETTER_EDITION_05_SENDER,
      replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
    }),
    (error) =>
      error instanceof NewsletterEdition05CampaignError &&
      error.code === "send_not_armed",
  );
  assert.notEqual(
    NEWSLETTER_EDITION_05_CAMPAIGN_ARMED_VALUE,
    "agenda-motor-2026-08-13-manual-send",
  );
});

test("campaign parser is dry-run by default and rejects unsafe combinations", () => {
  assert.deepEqual(parseNewsletterEdition05CampaignArguments([]), {
    send: false,
    prepareOnly: false,
    resume: false,
    limit: 25,
  });
  assert.throws(
    () => parseNewsletterEdition05CampaignArguments(["--resume"]),
    (error) =>
      error instanceof NewsletterEdition05CampaignError &&
      error.code === "resume_requires_send",
  );
  assert.throws(
    () => parseNewsletterEdition05CampaignArguments(["--send", "--prepare-only"]),
    (error) =>
      error instanceof NewsletterEdition05CampaignError &&
      error.code === "send_prepare_only_conflict",
  );
});

test("server boundaries remain explicit and the CLI imports only the server adapter", async () => {
  const [serverAdapter, repositoryAdapter, sourceAdapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-05-campaign.server.ts"), "utf8"),
    readFile(resolve(ROOT, "lib/newsletter/edition-05-campaign-repository.server.ts"), "utf8"),
    readFile(resolve(ROOT, "lib/newsletter/edition-05-source.server.ts"), "utf8"),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-05.ts"), "utf8"),
  ]);
  for (const adapter of [serverAdapter, repositoryAdapter, sourceAdapter]) {
    assert.ok(adapter.startsWith('import "server-only";'));
  }
  assert.match(cli, /edition-05-campaign\.server/);
  assert.doesNotMatch(cli, /resend-client|supabase|service-role/);
});
