import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_10_ASSET_MANIFEST,
  NEWSLETTER_EDITION_10_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_10_HTML_SHA256,
  NEWSLETTER_EDITION_10_PREHEADER,
  NEWSLETTER_EDITION_10_REPLY_TO,
  NEWSLETTER_EDITION_10_SENDER,
  NEWSLETTER_EDITION_10_SUBJECT,
  NEWSLETTER_EDITION_10_TEXT_SHA256,
  type NewsletterEdition10Source,
} from "@/lib/newsletter/edition-10-content";
import {
  NEWSLETTER_EDITION_10_SAFE_TEST_UNSUBSCRIBE_URL,
  NEWSLETTER_EDITION_10_ALLOWED_TEST_VARIANTS,
  NEWSLETTER_EDITION_10_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_10_TEST_CONFIRM_PHRASE,
  NewsletterEdition10TestSendError,
  executeNewsletterEdition10TestSend,
  parseNewsletterEdition10TestArguments,
  type NewsletterEdition10TestEmailPayload,
  type NewsletterEdition10TestEnvironment,
  type NewsletterEdition10TestVariant,
} from "@/lib/newsletter/edition-10-test-send";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-08";
const RECIPIENT = "edition10-owner@gmail.com";
const API_KEY = "re_test_edition10_mock_key_1234567890";

async function sourceFixture(): Promise<NewsletterEdition10Source> {
  const [html, text, assetManifest, entries] = await Promise.all([
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-production.html"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "email-texto-plano.txt"), "utf8"),
    readFile(resolve(ROOT, EDITION_DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_10_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(ROOT, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return { html, text, assetManifest, assets: Object.fromEntries(entries) };
}

function environment(
  overrides: Partial<NewsletterEdition10TestEnvironment> = {},
): NewsletterEdition10TestEnvironment {
  return {
    armed: NEWSLETTER_EDITION_10_TEST_ARMED_VALUE,
    apiKey: API_KEY,
    mailTransport: "resend",
    newsletterMode: "test",
    recipientAllowlist: RECIPIENT,
    ...overrides,
  };
}

function sendRequest(variant: NewsletterEdition10TestVariant = "national") {
  return {
    send: true,
    to: RECIPIENT,
    confirmTo: RECIPIENT,
    confirmPhrase: NEWSLETTER_EDITION_10_TEST_CONFIRM_PHRASE,
    variant,
  };
}

async function expectBlocked(
  code: string,
  options: Parameters<typeof executeNewsletterEdition10TestSend>[0],
): Promise<void> {
  await assert.rejects(
    executeNewsletterEdition10TestSend(options),
    (error) =>
      error instanceof NewsletterEdition10TestSendError && error.code === code,
  );
}

test("default dry-run validates the canonical national render without constructing a provider", async () => {
  const logs: string[] = [];
  let factories = 0;
  const request = parseNewsletterEdition10TestArguments(["--to", RECIPIENT]);
  const result = await executeNewsletterEdition10TestSend({
    request,
    environment: environment({ armed: undefined, apiKey: undefined }),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_10_SENDER,
    replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
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
  assert.equal(result.subject, NEWSLETTER_EDITION_10_SUBJECT);
  assert.deepEqual(result.summary, {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 8,
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
    sender: NEWSLETTER_EDITION_10_SENDER,
    replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_10_SENDER,
    replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_10_SENDER,
    replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
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

test("one armed mock send uses the exact Edition 10 national renderer once", async () => {
  const payloads: NewsletterEdition10TestEmailPayload[] = [];
  let factories = 0;
  const result = await executeNewsletterEdition10TestSend({
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_10_SENDER,
    replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      return {
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: "resend-edition10-test-mock-1",
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
  assert.equal(payload?.from, NEWSLETTER_EDITION_10_SENDER);
  assert.equal(payload?.replyTo, NEWSLETTER_EDITION_10_REPLY_TO);
  assert.equal(payload?.subject, NEWSLETTER_EDITION_10_SUBJECT);
  assert.match(payload?.html ?? "", /EPIC Racing Weekend · Navarra/);
  assert.match(payload?.html ?? "", /FIA European Autocross &amp; Cross Car · Mollerussa/);
  assert.match(payload?.html ?? "", /8º EcoRally de Canarias/);
  assert.match(payload?.html ?? "", /RFME Mototurismo Touring Challenge · Copa de Rutas/);
  assert.match(payload?.html ?? "", /61º RallyRACC Catalunya–Costa Daurada/);
  assert.match(payload?.html ?? "", /¿Todavía no tienes plan\?/);
  assert.match(
    payload?.html ?? "",
    /https:\/\/www\.eventomotor\.com\/newsletter\/2026-10-08\/assets\/eventomotor-header\.png/,
  );
  assert.doesNotMatch(payload?.html ?? "", /eventomotor-logo\.png/);
  assert.match(payload?.html ?? "", new RegExp(NEWSLETTER_EDITION_10_PREHEADER));
  assert.match(
    payload?.html ?? "",
    new RegExp(
      NEWSLETTER_EDITION_10_SAFE_TEST_UNSUBSCRIBE_URL.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      ),
    ),
  );
  for (const asset of [
    "01-racing-weekend-navarra-hero.webp",
    "02-autocross-cross-car-mollerussa.webp",
    "03-ecorally-canarias.webp",
    "04-mototurismo-avila.webp",
    "05-rallyracc-catalunya-costa-daurada.webp",
  ]) assert.match(payload?.html ?? "", new RegExp(asset));
  assert.doesNotMatch(
    payload?.html ?? "",
    /II Rallye Comunidad de Madrid · El Molar|Lo próximo cerca de ti/,
  );
  assert.doesNotMatch(
    payload?.html ?? "",
    /(?:href|src)="(?:https?:\/\/localhost|file:\/\/|assets\/)|https:\/\/www\.eventomotor\.com\/preview\//,
  );
  assert.equal(
    (payload?.html.match(/utm_campaign=agenda_motor_2026_10_08/g) ?? []).length,
    11,
  );
  assert.doesNotMatch(payload?.html ?? "", /agenda_motor_2026_08_13/);
  assert.equal(Object.hasOwn(payload ?? {}, "cc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "bcc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "idempotencyKey"), false);
});

test("the Madrid QA variant maps explicitly and renders El Molar exactly once", async () => {
  const cases = [
    {
      variant: "comunidad-de-madrid",
      expected: ["II Rallye Comunidad de Madrid · El Molar"],
      expectedText: ["9–10 octubre · El Molar, Madrid"],
      excluded: [],
    },
  ] as const;

  for (const testCase of cases) {
    const payloads: NewsletterEdition10TestEmailPayload[] = [];
    const result = await executeNewsletterEdition10TestSend({
      request: sendRequest(testCase.variant),
      environment: environment(),
      source: await sourceFixture(),
      sender: NEWSLETTER_EDITION_10_SENDER,
      replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
      clientFactory: () => ({
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: `resend-edition10-${testCase.variant}`,
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
    assert.equal((html.match(/II Rallye Comunidad de Madrid · El Molar/g) ?? []).length, 1);
  }
});

test("a provider rejection is attempted once and never retried", async () => {
  let calls = 0;
  await expectBlocked("provider_provider_error", {
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_10_SENDER,
    replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
    clientFactory: () => ({
      async sendEmail() {
        calls += 1;
        return { status: "provider_error", httpStatus: 503 };
      },
    }),
  });
  assert.equal(calls, 1);
});

test("only national and comunidad-de-madrid QA variants plus the synthetic unsubscribe context are accepted", async () => {
  const source = await sourceFixture();
  let factories = 0;
  const base = {
    request: { send: false, to: RECIPIENT, variant: "national" as const },
    environment: environment(),
    source,
    sender: NEWSLETTER_EDITION_10_SENDER,
    replyTo: NEWSLETTER_EDITION_10_REPLY_TO,
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
        variant: variant as NewsletterEdition10TestVariant,
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
  for (const variant of NEWSLETTER_EDITION_10_ALLOWED_TEST_VARIANTS) {
    assert.equal(
      parseNewsletterEdition10TestArguments(["--variant", variant]).variant,
      variant,
    );
  }
  assert.throws(
    () => parseNewsletterEdition10TestArguments(["--variant", "unknown"]),
    (error) =>
      error instanceof NewsletterEdition10TestSendError &&
      error.code === "variant_not_allowed",
  );
});

test("the test-send remains isolated from campaigns, deliveries, databases and subscriber state", async () => {
  const [core, adapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-10-test-send.ts"), "utf8"),
    readFile(
      resolve(ROOT, "lib/newsletter/edition-10-test-send.server.ts"),
      "utf8",
    ),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-10-test.ts"), "utf8"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /NEWSLETTER_TEST_RECIPIENT_ALLOWLIST/);
  assert.match(cli, /@\/lib\/newsletter\/edition-10-test-send\.server/);
  assert.match(cli, /request\.send/);
  assert.doesNotMatch(
    `${core}\n${adapter}\n${cli}`,
    /CampaignRepository|prepareCampaign|prepare_newsletter_campaign_v2|claimDelivery|recordAccepted|recordFailed|recordUnknown|newsletter_campaigns|newsletter_deliveries|newsletter_subscribers|supabase/i,
  );
  assert.equal(NEWSLETTER_EDITION_10_HTML_SHA256, "5311980ff79ce9a02577ab6322bf52738848564bfe50d14a8d76c686a96767b0");
  assert.equal(NEWSLETTER_EDITION_10_TEXT_SHA256, "0f43f8d40078cb4c352ba739c0f1326c5cbf2aae741f7a89a98b7bae841d4639");
  assert.equal(NEWSLETTER_EDITION_10_CONTENT_MANIFEST_SHA256, "5ba42d26aa17c46480a37c8df2d839d885df6c7b15d956887efdb8734b67f76b");
});

test("the CLI parser is dry-run by default and rejects unsafe recipient shapes", () => {
  assert.deepEqual(parseNewsletterEdition10TestArguments([]), {
    send: false,
    variant: "national",
  });
  assert.deepEqual(
    parseNewsletterEdition10TestArguments(["--to", RECIPIENT]),
    { send: false, variant: "national", to: RECIPIENT },
  );
  assert.throws(
    () =>
      parseNewsletterEdition10TestArguments([
        "--to",
        RECIPIENT,
        "--to",
        "other@example.invalid",
      ]),
    (error) =>
      error instanceof NewsletterEdition10TestSendError &&
      error.code === "duplicate_argument",
  );
});
