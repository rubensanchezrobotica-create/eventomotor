import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_05_ASSET_MANIFEST,
  NEWSLETTER_EDITION_05_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_05_HTML_SHA256,
  NEWSLETTER_EDITION_05_PREHEADER,
  NEWSLETTER_EDITION_05_REPLY_TO,
  NEWSLETTER_EDITION_05_SENDER,
  NEWSLETTER_EDITION_05_SUBJECT,
  NEWSLETTER_EDITION_05_TEXT_SHA256,
  type NewsletterEdition05Source,
} from "@/lib/newsletter/edition-05-content";
import {
  NEWSLETTER_EDITION_05_SAFE_TEST_UNSUBSCRIBE_URL,
  NEWSLETTER_EDITION_05_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_05_TEST_CONFIRM_PHRASE,
  NewsletterEdition05TestSendError,
  executeNewsletterEdition05TestSend,
  parseNewsletterEdition05TestArguments,
  type NewsletterEdition05TestEmailPayload,
  type NewsletterEdition05TestEnvironment,
} from "@/lib/newsletter/edition-05-test-send";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-03";
const RECIPIENT = "edition05-owner@gmail.com";
const API_KEY = "re_test_edition05_mock_key_1234567890";

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

function environment(
  overrides: Partial<NewsletterEdition05TestEnvironment> = {},
): NewsletterEdition05TestEnvironment {
  return {
    armed: NEWSLETTER_EDITION_05_TEST_ARMED_VALUE,
    apiKey: API_KEY,
    mailTransport: "resend",
    newsletterMode: "test",
    recipientAllowlist: RECIPIENT,
    ...overrides,
  };
}

function sendRequest() {
  return {
    send: true,
    to: RECIPIENT,
    confirmTo: RECIPIENT,
    confirmPhrase: NEWSLETTER_EDITION_05_TEST_CONFIRM_PHRASE,
    variant: "national" as const,
  };
}

async function expectBlocked(
  code: string,
  options: Parameters<typeof executeNewsletterEdition05TestSend>[0],
): Promise<void> {
  await assert.rejects(
    executeNewsletterEdition05TestSend(options),
    (error) =>
      error instanceof NewsletterEdition05TestSendError && error.code === code,
  );
}

test("default dry-run validates the canonical national render without constructing a provider", async () => {
  const logs: string[] = [];
  let factories = 0;
  const request = parseNewsletterEdition05TestArguments(["--to", RECIPIENT]);
  const result = await executeNewsletterEdition05TestSend({
    request,
    environment: environment({ armed: undefined, apiKey: undefined }),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
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
  assert.equal(result.subject, NEWSLETTER_EDITION_05_SUBJECT);
  assert.deepEqual(result.summary, {
    imageCount: 6,
    linkCount: 14,
    htmlCampaignCount: 11,
    htmlUnsubscribePlaceholderCount: 1,
    textUnsubscribePlaceholderCount: 1,
    htmlTerritorialPlaceholderCount: 1,
    textTerritorialPlaceholderCount: 1,
    assetCount: 7,
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
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
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

test("one armed mock send uses the exact Edition 05 national renderer once", async () => {
  const payloads: NewsletterEdition05TestEmailPayload[] = [];
  let factories = 0;
  const result = await executeNewsletterEdition05TestSend({
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      return {
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: "resend-edition05-test-mock-1",
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
  assert.equal(payload?.from, NEWSLETTER_EDITION_05_SENDER);
  assert.equal(payload?.replyTo, NEWSLETTER_EDITION_05_REPLY_TO);
  assert.equal(payload?.subject, NEWSLETTER_EDITION_05_SUBJECT);
  assert.match(payload?.html ?? "", /FIM MotoJunior World Championship · Cheste/);
  assert.match(payload?.html ?? "", /Cierzo Rallye Ejército de Tierra/);
  assert.match(payload?.html ?? "", /52º Rallye Orvecame Isla Tenerife/);
  assert.match(payload?.html ?? "", /Campeonato RACE de Velocidad · Monteblanco/);
  assert.match(payload?.html ?? "", /Fórmula 1 · Gran Premio de España · MADRING/);
  assert.match(payload?.html ?? "", /¿Todavía no tienes plan\?/);
  assert.match(
    payload?.html ?? "",
    /https:\/\/www\.eventomotor\.com\/newsletter\/2026-09-03\/assets\/eventomotor-header\.png/,
  );
  assert.doesNotMatch(payload?.html ?? "", /eventomotor-logo\.png/);
  assert.match(payload?.html ?? "", new RegExp(NEWSLETTER_EDITION_05_PREHEADER));
  assert.match(
    payload?.html ?? "",
    new RegExp(
      NEWSLETTER_EDITION_05_SAFE_TEST_UNSUBSCRIBE_URL.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      ),
    ),
  );
  for (const asset of [
    "01-fim-motojunior-cheste-hero.webp",
    "02-cierzo-rallye-ejercito-tierra.webp",
    "03-rallye-orvecame-isla-tenerife.webp",
    "04-race-monteblanco.webp",
    "05-f1-madring.webp",
  ]) assert.match(payload?.html ?? "", new RegExp(asset));
  assert.doesNotMatch(payload?.html ?? "", /Motor Extremo Montmeló|Lo próximo cerca de ti/);
  assert.doesNotMatch(
    payload?.html ?? "",
    /(?:href|src)="(?:https?:\/\/localhost|file:\/\/|assets\/)|https:\/\/www\.eventomotor\.com\/preview\//,
  );
  assert.equal(
    (payload?.html.match(/utm_campaign=agenda_motor_2026_09_03/g) ?? []).length,
    11,
  );
  assert.doesNotMatch(payload?.html ?? "", /agenda_motor_2026_08_13/);
  assert.equal(Object.hasOwn(payload ?? {}, "cc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "bcc"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "idempotencyKey"), false);
});

test("a provider rejection is attempted once and never retried", async () => {
  let calls = 0;
  await expectBlocked("provider_provider_error", {
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
    clientFactory: () => ({
      async sendEmail() {
        calls += 1;
        return { status: "provider_error", httpStatus: 503 };
      },
    }),
  });
  assert.equal(calls, 1);
});

test("only the national variant and the synthetic unsubscribe context are accepted", async () => {
  const source = await sourceFixture();
  const base = {
    request: { send: false, to: RECIPIENT, variant: "national" as const },
    environment: environment(),
    source,
    sender: NEWSLETTER_EDITION_05_SENDER,
    replyTo: NEWSLETTER_EDITION_05_REPLY_TO,
  };
  await expectBlocked("variant_not_allowed", {
    ...base,
    request: { ...base.request, variant: "barcelona" },
  });
  await expectBlocked("unsubscribe_url_invalid", {
    ...base,
    request: {
      ...base.request,
      unsubscribeUrl:
        "https://www.eventomotor.com/newsletter/unsubscribe?token=not-the-safe-test-fixture-000000000000",
    },
  });
  assert.throws(
    () => parseNewsletterEdition05TestArguments(["--variant", "barcelona"]),
    (error) =>
      error instanceof NewsletterEdition05TestSendError &&
      error.code === "variant_not_allowed",
  );
});

test("the test-send remains isolated from campaigns, deliveries, databases and subscriber state", async () => {
  const [core, adapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-05-test-send.ts"), "utf8"),
    readFile(
      resolve(ROOT, "lib/newsletter/edition-05-test-send.server.ts"),
      "utf8",
    ),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-05-test.ts"), "utf8"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /NEWSLETTER_TEST_RECIPIENT_ALLOWLIST/);
  assert.match(cli, /@\/lib\/newsletter\/edition-05-test-send\.server/);
  assert.match(cli, /request\.send/);
  assert.doesNotMatch(
    `${core}\n${adapter}\n${cli}`,
    /CampaignRepository|prepareCampaign|prepare_newsletter_campaign_v2|claimDelivery|recordAccepted|recordFailed|recordUnknown|newsletter_campaigns|newsletter_deliveries|newsletter_subscribers|supabase/i,
  );
  assert.equal(NEWSLETTER_EDITION_05_HTML_SHA256, "94bd543ab743265ca3f9d4a47f922e1a1f30e35ca6c3111cd08fe6e65f8897c7");
  assert.equal(NEWSLETTER_EDITION_05_TEXT_SHA256, "02b1f7912cddae76418a4b44d7ac9a45d70f25a5798c1ea03a19cc477287d587");
  assert.equal(NEWSLETTER_EDITION_05_CONTENT_MANIFEST_SHA256, "923b13b5b485d9a5549217c181a8b2899c7357ab6772ac089e2325970224a5d1");
});

test("the CLI parser is dry-run by default and rejects unsafe recipient shapes", () => {
  assert.deepEqual(parseNewsletterEdition05TestArguments([]), {
    send: false,
    variant: "national",
  });
  assert.deepEqual(
    parseNewsletterEdition05TestArguments(["--to", RECIPIENT]),
    { send: false, variant: "national", to: RECIPIENT },
  );
  assert.throws(
    () =>
      parseNewsletterEdition05TestArguments([
        "--to",
        RECIPIENT,
        "--to",
        "other@example.invalid",
      ]),
    (error) =>
      error instanceof NewsletterEdition05TestSendError &&
      error.code === "duplicate_argument",
  );
});
