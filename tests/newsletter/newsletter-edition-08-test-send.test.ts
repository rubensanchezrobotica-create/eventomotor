import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_08_ASSET_MANIFEST,
  NEWSLETTER_EDITION_08_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_08_HTML_SHA256,
  NEWSLETTER_EDITION_08_PREHEADER,
  NEWSLETTER_EDITION_08_REPLY_TO,
  NEWSLETTER_EDITION_08_SENDER,
  NEWSLETTER_EDITION_08_SUBJECT,
  NEWSLETTER_EDITION_08_TEXT_SHA256,
  type NewsletterEdition08Source,
} from "@/lib/newsletter/edition-08-content";
import {
  NEWSLETTER_EDITION_08_SAFE_TEST_UNSUBSCRIBE_URL,
  NEWSLETTER_EDITION_08_ALLOWED_TEST_VARIANTS,
  NEWSLETTER_EDITION_08_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_08_TEST_CONFIRM_PHRASE,
  NewsletterEdition08TestSendError,
  executeNewsletterEdition08TestSend,
  parseNewsletterEdition08TestArguments,
  type NewsletterEdition08TestEmailPayload,
  type NewsletterEdition08TestEnvironment,
  type NewsletterEdition08TestVariant,
} from "@/lib/newsletter/edition-08-test-send";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-24";
const RECIPIENT = "edition08-owner@gmail.com";
const API_KEY = "re_test_edition08_mock_key_1234567890";

async function sourceFixture(): Promise<NewsletterEdition08Source> {
  const [html, text, assetManifest, entries] = await Promise.all([
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
  return { html, text, assetManifest, assets: Object.fromEntries(entries) };
}

function environment(
  overrides: Partial<NewsletterEdition08TestEnvironment> = {},
): NewsletterEdition08TestEnvironment {
  return {
    armed: NEWSLETTER_EDITION_08_TEST_ARMED_VALUE,
    apiKey: API_KEY,
    mailTransport: "resend",
    newsletterMode: "test",
    recipientAllowlist: RECIPIENT,
    ...overrides,
  };
}

function sendRequest(variant: NewsletterEdition08TestVariant = "national") {
  return {
    send: true,
    to: RECIPIENT,
    confirmTo: RECIPIENT,
    confirmPhrase: NEWSLETTER_EDITION_08_TEST_CONFIRM_PHRASE,
    variant,
  };
}

async function expectBlocked(
  code: string,
  options: Parameters<typeof executeNewsletterEdition08TestSend>[0],
): Promise<void> {
  await assert.rejects(
    executeNewsletterEdition08TestSend(options),
    (error) =>
      error instanceof NewsletterEdition08TestSendError && error.code === code,
  );
}

test("default dry-run validates the canonical national render without constructing a provider", async () => {
  const logs: string[] = [];
  let factories = 0;
  const request = parseNewsletterEdition08TestArguments(["--to", RECIPIENT]);
  const result = await executeNewsletterEdition08TestSend({
    request,
    environment: environment({ armed: undefined, apiKey: undefined }),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      throw new Error("provider must not be constructed in dry-run");
    },
    logger: (message) => logs.push(message),
  });

  assert.equal(request.send, false);
  assert.equal(request.variant, "national");
  assert.equal(result.status, "dry_run");
  assert.equal(result.providerCalled, false);
  assert.equal(result.allowlistCount, 1);
  assert.equal(result.subject, NEWSLETTER_EDITION_08_SUBJECT);
  assert.deepEqual(result.summary, {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 10,
  });
  assert.equal(factories, 0);
  for (const expected of [
    "AUTHORIZED_RECIPIENT_RESOLVED=YES",
    "ALLOWLIST_COUNT=1",
    "SINGLE_GMAIL=YES",
    "MODE_TEST=YES",
    "TEST_SEND_ARMED=NO",
    "VARIANT=national",
    "TARGET_RECIPIENT_COUNT=1",
    "DRY_RUN=YES",
    "PROVIDER_CALL_PLANNED=NO",
    "PROVIDER_CALLED=NO",
    "TEST_EMAILS_SENT=0",
  ]) assert.ok(logs.includes(expected), expected);
  assert.doesNotMatch(logs.join("\n"), new RegExp(RECIPIENT));
  assert.doesNotMatch(logs.join("\n"), /unsubscribe\?token=/);
});

test("TEST mode and Resend transport are mandatory even for validation", async () => {
  const source = await sourceFixture();
  const base = {
    request: { send: false, to: RECIPIENT, variant: "national" as const },
    source,
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
  };
  await expectBlocked("mode_not_test", {
    ...base,
    environment: environment({ newsletterMode: undefined }),
  });
  await expectBlocked("transport_not_resend", {
    ...base,
    environment: environment({ mailTransport: "disabled" }),
  });
});

test("send mode fails closed without explicit arming and exact confirmations", async () => {
  const source = await sourceFixture();
  let factories = 0;
  const base = {
    request: sendRequest(),
    source,
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      throw new Error("provider must remain blocked");
    },
  };
  await expectBlocked("send_not_armed", {
    ...base,
    environment: environment({ armed: undefined }),
  });
  await expectBlocked("recipient_confirmation_mismatch", {
    ...base,
    request: { ...sendRequest(), confirmTo: "other@example.invalid" },
    environment: environment(),
  });
  await expectBlocked("confirmation_phrase_invalid", {
    ...base,
    request: { ...sendRequest(), confirmPhrase: "wrong" },
    environment: environment(),
  });
  assert.equal(factories, 0);
});

test("empty, multiple and mismatched recipient allowlists fail closed", async () => {
  const source = await sourceFixture();
  const base = {
    request: { send: false, to: RECIPIENT, variant: "national" as const },
    source,
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
  };
  await expectBlocked("allowlist_invalid", {
    ...base,
    environment: environment({ recipientAllowlist: undefined }),
  });
  await expectBlocked("single_allowlisted_recipient_required", {
    ...base,
    environment: environment({
      recipientAllowlist: `${RECIPIENT},second@example.invalid`,
    }),
  });
  await expectBlocked("recipient_not_allowed", {
    ...base,
    environment: environment({ recipientAllowlist: "other@example.invalid" }),
  });
  await expectBlocked("single_recipient_required", {
    ...base,
    request: {
      send: false,
      to: `${RECIPIENT},second@example.invalid`,
      variant: "national",
    },
    environment: environment(),
  });
});

test("one armed mock send uses the exact Edition 08 national renderer once", async () => {
  const payloads: NewsletterEdition08TestEmailPayload[] = [];
  let factories = 0;
  const result = await executeNewsletterEdition08TestSend({
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      return {
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: "resend-edition08-test-mock-1",
          };
        },
      };
    },
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.providerCalled, true);
  assert.equal(factories, 1);
  assert.equal(payloads.length, 1);
  const payload = payloads[0];
  assert.deepEqual(payload?.to, [RECIPIENT]);
  assert.equal(payload?.from, NEWSLETTER_EDITION_08_SENDER);
  assert.equal(payload?.replyTo, NEWSLETTER_EDITION_08_REPLY_TO);
  assert.equal(payload?.subject, NEWSLETTER_EDITION_08_SUBJECT);
  assert.match(payload?.html ?? "", /49º Rallye Villa de Llanes/);
  assert.match(payload?.html ?? "", /FIM Trial des Nations · Arteixo/);
  assert.match(payload?.html ?? "", /Epic NAPA Racing Weekend · Jerez/);
  assert.match(payload?.html ?? "", /Subida Internacional de Onil/);
  assert.match(payload?.html ?? "", /Festival de la Velocidad de Barcelona/);
  assert.match(payload?.html ?? "", /¿Todavía no tienes plan\?/);
  assert.match(
    payload?.html ?? "",
    /https:\/\/www\.eventomotor\.com\/newsletter\/2026-09-24\/assets\/eventomotor-header\.png/,
  );
  assert.doesNotMatch(payload?.html ?? "", /eventomotor-logo\.png/);
  assert.match(payload?.html ?? "", new RegExp(NEWSLETTER_EDITION_08_PREHEADER));
  assert.match(
    payload?.html ?? "",
    new RegExp(
      NEWSLETTER_EDITION_08_SAFE_TEST_UNSUBSCRIBE_URL.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      ),
    ),
  );
  for (const asset of [
    "01-rallye-villa-llanes-hero.webp",
    "02-trial-des-nations-arteixo.webp",
    "03-racing-weekend-jerez.webp",
    "04-subida-internacional-onil.webp",
    "05-festival-velocidad-barcelona.webp",
  ]) assert.match(payload?.html ?? "", new RegExp(asset));
  assert.doesNotMatch(
    payload?.html ?? "",
    /Xtreme Challenge Madrid|Salón del Automóvil de Lleida|Supercars \+ ROOW|Lo próximo cerca de ti/,
  );
  assert.doesNotMatch(
    payload?.html ?? "",
    /(?:href|src)="(?:https?:\/\/localhost|file:\/\/|assets\/)|https:\/\/www\.eventomotor\.com\/preview\//,
  );
  assert.equal(
    (payload?.html.match(/utm_campaign=agenda_motor_2026_09_24/g) ?? []).length,
    11,
  );
  assert.doesNotMatch(payload?.html ?? "", /agenda_motor_2026_08_13/);
  assert.equal(Object.hasOwn(payload ?? {}, "cc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "bcc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "idempotencyKey"), false);
});

test("the three territorial QA variants render only their exact regional module", async () => {
  const cases = [
    {
      variant: "comunidad-de-madrid",
      expected: ["Xtreme Challenge Madrid 2026"],
      expectedText: ["25–26 septiembre · Madrid"],
      excluded: ["Salón del Automóvil de Lleida 2026", "Supercars + ROOW"],
    },
    {
      variant: "cataluna",
      expected: [
        "Salón del Automóvil de Lleida 2026",
      ],
      expectedText: [],
      excluded: ["Xtreme Challenge Madrid 2026", "Supercars + ROOW"],
    },
    {
      variant: "comunidad-valenciana",
      expected: ["Supercars + ROOW"],
      expectedText: [],
      excluded: [
        "Xtreme Challenge Madrid 2026",
        "Salón del Automóvil de Lleida 2026",
      ],
    },
  ] as const;

  for (const testCase of cases) {
    const payloads: NewsletterEdition08TestEmailPayload[] = [];
    const result = await executeNewsletterEdition08TestSend({
      request: sendRequest(testCase.variant),
      environment: environment(),
      source: await sourceFixture(),
      sender: NEWSLETTER_EDITION_08_SENDER,
      replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
      clientFactory: () => ({
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: `resend-edition08-${testCase.variant}`,
          };
        },
      }),
    });

    assert.equal(result.status, "accepted");
    assert.equal(result.variant, testCase.variant);
    assert.equal(payloads.length, 1);
    const html = payloads[0]?.html ?? "";
    const text = payloads[0]?.text ?? "";
    assert.ok(html.includes("Lo próximo cerca de ti"));
    assert.ok(text.includes("LO PRÓXIMO CERCA DE TI"));
    for (const expected of testCase.expected) assert.ok(html.includes(expected), expected);
    for (const expected of testCase.expectedText) assert.ok(text.includes(expected), expected);
    for (const excluded of testCase.excluded) assert.ok(!html.includes(excluded), excluded);
  }
});

test("a provider rejection is attempted once and never retried", async () => {
  let calls = 0;
  await expectBlocked("provider_provider_error", {
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    clientFactory: () => ({
      async sendEmail() {
        calls += 1;
        return { status: "provider_error", httpStatus: 503 };
      },
    }),
  });
  assert.equal(calls, 1);
});

test("only the four explicit QA variants and the synthetic unsubscribe context are accepted", async () => {
  const source = await sourceFixture();
  let factories = 0;
  const base = {
    request: { send: false, to: RECIPIENT, variant: "national" as const },
    environment: environment(),
    source,
    sender: NEWSLETTER_EDITION_08_SENDER,
    replyTo: NEWSLETTER_EDITION_08_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      throw new Error("provider must remain blocked");
    },
  };
  for (const variant of [
    "andalucia",
    "galicia",
    "sin-region",
    "",
    null,
    "unknown",
    "arbitrary-value",
  ] as const) {
    await expectBlocked("variant_not_allowed", {
      ...base,
      request: {
        ...base.request,
        variant: variant as NewsletterEdition08TestVariant,
      },
    });
  }
  assert.equal(factories, 0);
  await expectBlocked("unsubscribe_url_invalid", {
    ...base,
    request: {
      ...base.request,
      unsubscribeUrl:
        "https://www.eventomotor.com/newsletter/unsubscribe?token=not-the-safe-test-fixture-000000000000",
    },
  });
  for (const variant of NEWSLETTER_EDITION_08_ALLOWED_TEST_VARIANTS) {
    assert.equal(
      parseNewsletterEdition08TestArguments(["--variant", variant]).variant,
      variant,
    );
  }
  assert.throws(
    () => parseNewsletterEdition08TestArguments(["--variant", "unknown"]),
    (error) =>
      error instanceof NewsletterEdition08TestSendError &&
      error.code === "variant_not_allowed",
  );
});

test("the test-send remains isolated from campaigns, deliveries, databases and subscriber state", async () => {
  const [core, adapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-08-test-send.ts"), "utf8"),
    readFile(
      resolve(ROOT, "lib/newsletter/edition-08-test-send.server.ts"),
      "utf8",
    ),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-08-test.ts"), "utf8"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /NEWSLETTER_TEST_RECIPIENT_ALLOWLIST/);
  assert.match(cli, /@\/lib\/newsletter\/edition-08-test-send\.server/);
  assert.match(cli, /request\.send/);
  assert.doesNotMatch(
    `${core}\n${adapter}\n${cli}`,
    /CampaignRepository|prepareCampaign|prepare_newsletter_campaign_v2|claimDelivery|recordAccepted|recordFailed|recordUnknown|newsletter_campaigns|newsletter_deliveries|newsletter_subscribers|supabase/i,
  );
  assert.equal(NEWSLETTER_EDITION_08_HTML_SHA256, "f7f8735a2dfed386be6400ae4d2e354109a30930b72f7342de2585e745d67f1d");
  assert.equal(NEWSLETTER_EDITION_08_TEXT_SHA256, "75c740d5bbfd24bca41fe874ce9ae426fef195c610963e35bb22e8622e9868f1");
  assert.equal(NEWSLETTER_EDITION_08_CONTENT_MANIFEST_SHA256, "027cbe6dcd0d99cc31fd7e857e9839312b182e2148e6915a4ca9a9d21e160fd4");
});

test("the CLI parser is dry-run by default and rejects unsafe recipient shapes", () => {
  assert.deepEqual(parseNewsletterEdition08TestArguments([]), {
    send: false,
    variant: "national",
  });
  assert.deepEqual(
    parseNewsletterEdition08TestArguments(["--to", RECIPIENT]),
    { send: false, variant: "national", to: RECIPIENT },
  );
  assert.throws(
    () =>
      parseNewsletterEdition08TestArguments([
        "--to",
        RECIPIENT,
        "--to",
        "other@example.invalid",
      ]),
    (error) =>
      error instanceof NewsletterEdition08TestSendError &&
      error.code === "duplicate_argument",
  );
});
