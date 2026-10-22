import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_12_ASSET_MANIFEST,
  NEWSLETTER_EDITION_12_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_12_HTML_SHA256,
  NEWSLETTER_EDITION_12_PREHEADER,
  NEWSLETTER_EDITION_12_REPLY_TO,
  NEWSLETTER_EDITION_12_SENDER,
  NEWSLETTER_EDITION_12_SUBJECT,
  NEWSLETTER_EDITION_12_TEXT_SHA256,
  prepareEdition12Content,
  type NewsletterEdition12Source,
} from "@/lib/newsletter/edition-12-content";
import {
  NEWSLETTER_EDITION_12_SAFE_TEST_UNSUBSCRIBE_URL,
  NEWSLETTER_EDITION_12_ALLOWED_TEST_VARIANTS,
  NEWSLETTER_EDITION_12_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_12_TEST_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_12_TEST_SUBJECT,
  NewsletterEdition12TestSendError,
  executeNewsletterEdition12TestSend,
  parseNewsletterEdition12TestArguments,
  type NewsletterEdition12TestEmailPayload,
  type NewsletterEdition12TestEnvironment,
  type NewsletterEdition12TestVariant,
} from "@/lib/newsletter/edition-12-test-send";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-22";
const RECIPIENT = "edition12-owner@gmail.com";
const API_KEY = "re_test_edition12_mock_key_1234567890";
const APPROVED_PRODUCTION_SUBJECT =
  "Barcelona cierra el GT Open: un fin de semana de finales";

test("Edition 12 uses an exclusive confirmation and prefixes only the protected-test subject", () => {
  assert.equal(NEWSLETTER_EDITION_12_TEST_CONFIRM_PHRASE, "SEND-EDITION-12-TEST");
  assert.equal(NEWSLETTER_EDITION_12_SUBJECT, APPROVED_PRODUCTION_SUBJECT);
  assert.equal(
    NEWSLETTER_EDITION_12_TEST_SUBJECT,
    `[PRUEBA] ${APPROVED_PRODUCTION_SUBJECT}`,
  );
});

async function sourceFixture(): Promise<NewsletterEdition12Source> {
  const [html, text, assetManifest, entries] = await Promise.all([
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
  return { html, text, assetManifest, assets: Object.fromEntries(entries) };
}

function environment(
  overrides: Partial<NewsletterEdition12TestEnvironment> = {},
): NewsletterEdition12TestEnvironment {
  return {
    armed: NEWSLETTER_EDITION_12_TEST_ARMED_VALUE,
    apiKey: API_KEY,
    mailTransport: "resend",
    newsletterMode: "test",
    recipientAllowlist: RECIPIENT,
    ...overrides,
  };
}

function sendRequest(variant: NewsletterEdition12TestVariant = "national") {
  return {
    send: true,
    to: RECIPIENT,
    confirmTo: RECIPIENT,
    confirmPhrase: NEWSLETTER_EDITION_12_TEST_CONFIRM_PHRASE,
    variant,
  };
}

async function expectBlocked(
  code: string,
  options: Parameters<typeof executeNewsletterEdition12TestSend>[0],
): Promise<void> {
  await assert.rejects(
    executeNewsletterEdition12TestSend(options),
    (error) =>
      error instanceof NewsletterEdition12TestSendError && error.code === code,
  );
}

test("default dry-run validates the canonical national render without constructing a provider", async () => {
  const logs: string[] = [];
  let factories = 0;
  const request = parseNewsletterEdition12TestArguments(["--to", RECIPIENT]);
  const result = await executeNewsletterEdition12TestSend({
    request,
    environment: environment({ armed: undefined, apiKey: undefined }),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
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
  assert.equal(result.subject, NEWSLETTER_EDITION_12_TEST_SUBJECT);
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
    `SUBJECT=${NEWSLETTER_EDITION_12_TEST_SUBJECT}`,
  ]) assert.ok(logs.includes(expected), expected);
  assert.doesNotMatch(logs.join("\n"), new RegExp(RECIPIENT));
  assert.doesNotMatch(logs.join("\n"), /unsubscribe\?token=/);
});

test("TEST mode and Resend transport are mandatory even for validation", async () => {
  const source = await sourceFixture();
  const base = {
    request: { send: false, to: RECIPIENT, variant: "national" as const },
    source,
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
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
  await expectBlocked("confirmation_phrase_invalid", {
    ...base,
    request: { ...sendRequest(), confirmPhrase: "SEND-EDITION-11-TEST" },
    environment: environment(),
  });
  assert.equal(factories, 0);
});

test("empty, multiple and mismatched recipient allowlists fail closed", async () => {
  const source = await sourceFixture();
  const base = {
    request: { send: false, to: RECIPIENT, variant: "national" as const },
    source,
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
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

test("one armed mock send uses the exact Edition 12 national renderer once", async () => {
  const payloads: NewsletterEdition12TestEmailPayload[] = [];
  let factories = 0;
  const source = await sourceFixture();
  const result = await executeNewsletterEdition12TestSend({
    request: sendRequest(),
    environment: environment(),
    source,
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      return {
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: "resend-edition12-test-mock-1",
          };
        },
      };
    },
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.subject, NEWSLETTER_EDITION_12_TEST_SUBJECT);
  assert.equal(result.providerCalled, true);
  assert.equal(factories, 1);
  assert.equal(payloads.length, 1);
  const payload = payloads[0];
  assert.deepEqual(payload?.to, [RECIPIENT]);
  assert.equal(payload?.from, NEWSLETTER_EDITION_12_SENDER);
  assert.equal(payload?.replyTo, NEWSLETTER_EDITION_12_REPLY_TO);
  assert.equal(payload?.subject, NEWSLETTER_EDITION_12_TEST_SUBJECT);
  const expected = prepareEdition12Content(
    source,
    "national",
    NEWSLETTER_EDITION_12_SAFE_TEST_UNSUBSCRIBE_URL,
  );
  assert.equal(payload?.html, expected.html);
  assert.equal(payload?.text, expected.text);
  assert.match(payload?.html ?? "", /International GT Open · Gran Final de Barcelona/);
  assert.match(payload?.html ?? "", /MotorLand Classic Festival 2026/);
  assert.match(payload?.html ?? "", /Rallye Ciudad de Valencia/);
  assert.match(payload?.html ?? "", /Campeonato de España de Motocross · Talavera/);
  assert.match(payload?.html ?? "", /XXIII Rally Costa Brava Històric/);
  assert.match(payload?.html ?? "", /¿Todavía no tienes plan\?/);
  assert.match(
    payload?.html ?? "",
    /https:\/\/www\.eventomotor\.com\/newsletter\/2026-10-22\/assets\/eventomotor-header\.png/,
  );
  assert.doesNotMatch(payload?.html ?? "", /eventomotor-logo\.png/);
  assert.match(payload?.html ?? "", new RegExp(NEWSLETTER_EDITION_12_PREHEADER));
  assert.match(
    payload?.html ?? "",
    new RegExp(
      NEWSLETTER_EDITION_12_SAFE_TEST_UNSUBSCRIBE_URL.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      ),
    ),
  );
  for (const asset of [
    "01-gt-open-barcelona-hero.webp",
    "02-motorland-classic-festival.webp",
    "03-rallye-ciudad-de-valencia.webp",
    "04-motocross-talavera.webp",
    "05-rally-costa-brava-historic.webp",
  ]) assert.match(payload?.html ?? "", new RegExp(asset));
  assert.doesNotMatch(
    payload?.html ?? "",
    /Campeonato RACE de Velocidad \+ GR Cup Spain|Lo próximo cerca de ti/,
  );
  assert.doesNotMatch(
    payload?.html ?? "",
    /(?:href|src)="(?:https?:\/\/localhost|file:\/\/|assets\/)|https:\/\/www\.eventomotor\.com\/preview\//,
  );
  assert.equal(
    (payload?.html.match(/utm_campaign=agenda_motor_2026_10_22/g) ?? []).length,
    11,
  );
  assert.doesNotMatch(payload?.html ?? "", /agenda_motor_2026_08_13/);
  assert.doesNotMatch(
    payload?.html ?? "",
    /2026-10-15\/assets\/|FIA WEC · 6 Horas de Barcelona|WorldSBK · Pirelli Spanish Round|BMW Motorrad Days · Peñíscola/,
  );
  assert.equal(Object.hasOwn(payload ?? {}, "cc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "bcc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "idempotencyKey"), false);
});

test("the Madrid QA variant maps explicitly and renders Jarama exactly once", async () => {
  const cases = [
    {
      variant: "comunidad-de-madrid",
      expected: ["Campeonato RACE de Velocidad + GR Cup Spain"],
      expectedText: ["24 octubre · Circuito de Madrid Jarama – RACE"],
      excluded: [],
    },
  ] as const;

  for (const testCase of cases) {
    const payloads: NewsletterEdition12TestEmailPayload[] = [];
    const source = await sourceFixture();
    const result = await executeNewsletterEdition12TestSend({
      request: sendRequest(testCase.variant),
      environment: environment(),
      source,
      sender: NEWSLETTER_EDITION_12_SENDER,
      replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
      clientFactory: () => ({
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: `resend-edition12-${testCase.variant}`,
          };
        },
      }),
    });

    assert.equal(result.status, "accepted");
    assert.equal(result.variant, testCase.variant);
    assert.equal(result.subject, NEWSLETTER_EDITION_12_TEST_SUBJECT);
    assert.equal(payloads.length, 1);
    const html = payloads[0]?.html ?? "";
    const text = payloads[0]?.text ?? "";
    assert.equal(payloads[0]?.subject, NEWSLETTER_EDITION_12_TEST_SUBJECT);
    const expected = prepareEdition12Content(
      source,
      "madrid",
      NEWSLETTER_EDITION_12_SAFE_TEST_UNSUBSCRIBE_URL,
    );
    assert.equal(html, expected.html);
    assert.equal(text, expected.text);
    assert.ok(html.includes("Lo próximo cerca de ti"));
    assert.ok(text.includes("LO PRÓXIMO CERCA DE TI"));
    for (const expected of testCase.expected) assert.ok(html.includes(expected), expected);
    for (const expected of testCase.expectedText) assert.ok(text.includes(expected), expected);
    for (const excluded of testCase.excluded) assert.ok(!html.includes(excluded), excluded);
    assert.equal((html.match(/Campeonato RACE de Velocidad \+ GR Cup Spain/g) ?? []).length, 1);
    assert.doesNotMatch(html, /2026-10-15\/assets\/|XXVII Jornada de Puertas Abiertas · Fundación RACE/);
  }
});

test("a provider rejection is attempted once and never retried", async () => {
  let calls = 0;
  await expectBlocked("provider_provider_error", {
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_12_SENDER,
    replyTo: NEWSLETTER_EDITION_12_REPLY_TO,
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
        variant: variant as NewsletterEdition12TestVariant,
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
  for (const variant of NEWSLETTER_EDITION_12_ALLOWED_TEST_VARIANTS) {
    assert.equal(
      parseNewsletterEdition12TestArguments(["--variant", variant]).variant,
      variant,
    );
  }
  assert.throws(
    () => parseNewsletterEdition12TestArguments(["--variant", "unknown"]),
    (error) =>
      error instanceof NewsletterEdition12TestSendError &&
      error.code === "variant_not_allowed",
  );
});

test("the test-send remains isolated from campaigns, deliveries, databases and subscriber state", async () => {
  const [core, adapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-12-test-send.ts"), "utf8"),
    readFile(
      resolve(ROOT, "lib/newsletter/edition-12-test-send.server.ts"),
      "utf8",
    ),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-12-test.ts"), "utf8"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /NEWSLETTER_TEST_RECIPIENT_ALLOWLIST/);
  assert.match(cli, /@\/lib\/newsletter\/edition-12-test-send\.server/);
  assert.match(cli, /request\.send/);
  assert.doesNotMatch(
    `${core}\n${adapter}\n${cli}`,
    /CampaignRepository|prepareCampaign|prepare_newsletter_campaign_v2|claimDelivery|recordAccepted|recordFailed|recordUnknown|newsletter_campaigns|newsletter_deliveries|newsletter_subscribers|supabase/i,
  );
  assert.equal(NEWSLETTER_EDITION_12_HTML_SHA256, "4175a13778b08b86246013f20e069229dc78842db8a6dd6ac2e1f4a1292b7540");
  assert.equal(NEWSLETTER_EDITION_12_TEXT_SHA256, "77944105d13e2f7aec85242adbddb21d841878b2ec1230b0e14a4a2dfd7c795f");
  assert.equal(NEWSLETTER_EDITION_12_CONTENT_MANIFEST_SHA256, "f8505100a2f8d44fa5d4c35a8d69f6e11a59a24f0d3a0dd39c49392d58b6dd5c");
});

test("the CLI parser is dry-run by default and rejects unsafe recipient shapes", () => {
  assert.deepEqual(parseNewsletterEdition12TestArguments([]), {
    send: false,
    variant: "national",
  });
  assert.deepEqual(
    parseNewsletterEdition12TestArguments(["--to", RECIPIENT]),
    { send: false, variant: "national", to: RECIPIENT },
  );
  assert.throws(
    () =>
      parseNewsletterEdition12TestArguments([
        "--to",
        RECIPIENT,
        "--to",
        "other@example.invalid",
      ]),
    (error) =>
      error instanceof NewsletterEdition12TestSendError &&
      error.code === "duplicate_argument",
  );
});
