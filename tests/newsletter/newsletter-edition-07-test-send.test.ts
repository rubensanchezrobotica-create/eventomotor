import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_07_ASSET_MANIFEST,
  NEWSLETTER_EDITION_07_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_07_HTML_SHA256,
  NEWSLETTER_EDITION_07_PREHEADER,
  NEWSLETTER_EDITION_07_REPLY_TO,
  NEWSLETTER_EDITION_07_SENDER,
  NEWSLETTER_EDITION_07_SUBJECT,
  NEWSLETTER_EDITION_07_TEXT_SHA256,
  type NewsletterEdition07Source,
} from "@/lib/newsletter/edition-07-content";
import {
  NEWSLETTER_EDITION_07_SAFE_TEST_UNSUBSCRIBE_URL,
  NEWSLETTER_EDITION_07_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_07_TEST_CONFIRM_PHRASE,
  NewsletterEdition07TestSendError,
  executeNewsletterEdition07TestSend,
  parseNewsletterEdition07TestArguments,
  type NewsletterEdition07TestEmailPayload,
  type NewsletterEdition07TestEnvironment,
} from "@/lib/newsletter/edition-07-test-send";

const ROOT = process.cwd();
const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-17";
const RECIPIENT = "edition07-owner@gmail.com";
const API_KEY = "re_test_edition07_mock_key_1234567890";

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

function environment(
  overrides: Partial<NewsletterEdition07TestEnvironment> = {},
): NewsletterEdition07TestEnvironment {
  return {
    armed: NEWSLETTER_EDITION_07_TEST_ARMED_VALUE,
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
    confirmPhrase: NEWSLETTER_EDITION_07_TEST_CONFIRM_PHRASE,
    variant: "national" as const,
  };
}

async function expectBlocked(
  code: string,
  options: Parameters<typeof executeNewsletterEdition07TestSend>[0],
): Promise<void> {
  await assert.rejects(
    executeNewsletterEdition07TestSend(options),
    (error) =>
      error instanceof NewsletterEdition07TestSendError && error.code === code,
  );
}

test("default dry-run validates the canonical national render without constructing a provider", async () => {
  const logs: string[] = [];
  let factories = 0;
  const request = parseNewsletterEdition07TestArguments(["--to", RECIPIENT]);
  const result = await executeNewsletterEdition07TestSend({
    request,
    environment: environment({ armed: undefined, apiKey: undefined }),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
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
  assert.equal(result.subject, NEWSLETTER_EDITION_07_SUBJECT);
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
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
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

test("one armed mock send uses the exact Edition 07 national renderer once", async () => {
  const payloads: NewsletterEdition07TestEmailPayload[] = [];
  let factories = 0;
  const result = await executeNewsletterEdition07TestSend({
    request: sendRequest(),
    environment: environment(),
    source: await sourceFixture(),
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
    clientFactory: () => {
      factories += 1;
      return {
        async sendEmail(payload) {
          payloads.push(payload);
          return {
            status: "accepted",
            providerMessageId: "resend-edition07-test-mock-1",
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
  assert.equal(payload?.from, NEWSLETTER_EDITION_07_SENDER);
  assert.equal(payload?.replyTo, NEWSLETTER_EDITION_07_REPLY_TO);
  assert.equal(payload?.subject, NEWSLETTER_EDITION_07_SUBJECT);
  assert.match(payload?.html ?? "", /10º REPSOL EcoRally A Coruña/);
  assert.match(payload?.html ?? "", /24H de Barcelona de Automovilismo/);
  assert.match(payload?.html ?? "", /TrialGP de España · Pobladura/);
  assert.match(payload?.html ?? "", /XLVIII Subida a Jaizkibel/);
  assert.match(payload?.html ?? "", /49º Rallye Villa de Llanes/);
  assert.match(payload?.html ?? "", /¿Todavía no tienes plan\?/);
  assert.match(
    payload?.html ?? "",
    /https:\/\/www\.eventomotor\.com\/newsletter\/2026-09-17\/assets\/eventomotor-header\.png/,
  );
  assert.doesNotMatch(payload?.html ?? "", /eventomotor-logo\.png/);
  assert.match(payload?.html ?? "", new RegExp(NEWSLETTER_EDITION_07_PREHEADER));
  assert.match(
    payload?.html ?? "",
    new RegExp(
      NEWSLETTER_EDITION_07_SAFE_TEST_UNSUBSCRIBE_URL.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      ),
    ),
  );
  for (const asset of [
    "01-ecorally-a-coruna-hero.webp",
    "02-24h-barcelona.webp",
    "03-trialgp-espana-pobladura.webp",
    "04-subida-jaizkibel.webp",
    "05-rallye-villa-de-llanes.webp",
  ]) assert.match(payload?.html ?? "", new RegExp(asset));
  assert.doesNotMatch(payload?.html ?? "", /Hot Wheels Legends Tour|Lo próximo cerca de ti/);
  assert.doesNotMatch(
    payload?.html ?? "",
    /(?:href|src)="(?:https?:\/\/localhost|file:\/\/|assets\/)|https:\/\/www\.eventomotor\.com\/preview\//,
  );
  assert.equal(
    (payload?.html.match(/utm_campaign=agenda_motor_2026_09_17/g) ?? []).length,
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
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
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
    sender: NEWSLETTER_EDITION_07_SENDER,
    replyTo: NEWSLETTER_EDITION_07_REPLY_TO,
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
    () => parseNewsletterEdition07TestArguments(["--variant", "barcelona"]),
    (error) =>
      error instanceof NewsletterEdition07TestSendError &&
      error.code === "variant_not_allowed",
  );
});

test("the test-send remains isolated from campaigns, deliveries, databases and subscriber state", async () => {
  const [core, adapter, cli] = await Promise.all([
    readFile(resolve(ROOT, "lib/newsletter/edition-07-test-send.ts"), "utf8"),
    readFile(
      resolve(ROOT, "lib/newsletter/edition-07-test-send.server.ts"),
      "utf8",
    ),
    readFile(resolve(ROOT, "scripts/send-newsletter-edition-07-test.ts"), "utf8"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /NEWSLETTER_TEST_RECIPIENT_ALLOWLIST/);
  assert.match(cli, /@\/lib\/newsletter\/edition-07-test-send\.server/);
  assert.match(cli, /request\.send/);
  assert.doesNotMatch(
    `${core}\n${adapter}\n${cli}`,
    /CampaignRepository|prepareCampaign|prepare_newsletter_campaign_v2|claimDelivery|recordAccepted|recordFailed|recordUnknown|newsletter_campaigns|newsletter_deliveries|newsletter_subscribers|supabase/i,
  );
  assert.equal(NEWSLETTER_EDITION_07_HTML_SHA256, "c0345e6138fb08566f71ae3ecc7ce82a0c41e1fef09bfb2591a1185bce355194");
  assert.equal(NEWSLETTER_EDITION_07_TEXT_SHA256, "d6b1bec2281583985d59288b933ceccbdd4f204a17ce5f20e8f3d4ae1875ca5d");
  assert.equal(NEWSLETTER_EDITION_07_CONTENT_MANIFEST_SHA256, "32dadec0d2a9c75c2c6b3a7f93761cad4a40d0fd104fedd92c69d42f9f3977ba");
});

test("the CLI parser is dry-run by default and rejects unsafe recipient shapes", () => {
  assert.deepEqual(parseNewsletterEdition07TestArguments([]), {
    send: false,
    variant: "national",
  });
  assert.deepEqual(
    parseNewsletterEdition07TestArguments(["--to", RECIPIENT]),
    { send: false, variant: "national", to: RECIPIENT },
  );
  assert.throws(
    () =>
      parseNewsletterEdition07TestArguments([
        "--to",
        RECIPIENT,
        "--to",
        "other@example.invalid",
      ]),
    (error) =>
      error instanceof NewsletterEdition07TestSendError &&
      error.code === "duplicate_argument",
  );
});
