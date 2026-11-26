import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { NEWSLETTER_EDITION_17_ASSET_MANIFEST, NEWSLETTER_EDITION_17_REPLY_TO, NEWSLETTER_EDITION_17_SENDER } from "./edition-17-content";
import {
  NEWSLETTER_EDITION_17_SAFE_TEST_UNSUBSCRIBE_URL,
  NEWSLETTER_EDITION_17_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_17_TEST_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_17_TEST_RECIPIENT,
  NEWSLETTER_EDITION_17_TEST_SUBJECT,
  executeNewsletterEdition17TestSend,
  type ExecuteNewsletterEdition17TestOptions,
  type NewsletterEdition17TestEmailPayload,
} from "./edition-17-test-send";

async function options(): Promise<ExecuteNewsletterEdition17TestOptions> {
  const root = resolve("docs/newsletter/ediciones/2026-11-26");
  return {
    source: {
      assetManifest: await readFile(resolve(root, "asset-manifest.json"), "utf8"),
      assets: Object.fromEntries(await Promise.all(NEWSLETTER_EDITION_17_ASSET_MANIFEST.map(async ({ file }) => [
        file, await readFile(resolve(root, "assets", file)),
      ] as const))),
    },
    sender: NEWSLETTER_EDITION_17_SENDER,
    replyTo: NEWSLETTER_EDITION_17_REPLY_TO,
    request: {
      send: true, to: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
      confirmTo: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
      confirmPhrase: NEWSLETTER_EDITION_17_TEST_CONFIRM_PHRASE,
      variant: "madrid",
    },
    environment: {
      armed: NEWSLETTER_EDITION_17_TEST_ARMED_VALUE,
      apiKey: "mock_resend_key_0000000000000000",
      mailTransport: "resend", newsletterMode: "test",
      recipientAllowlist: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
    },
  };
}

test("Ed17 protected Madrid test sends one sealed email through a simulated provider", async () => {
  const base = await options();
  let calls = 0;
  let payload: NewsletterEdition17TestEmailPayload | undefined;
  const result = await executeNewsletterEdition17TestSend({
    ...base,
    clientFactory: () => ({ async sendEmail(input) {
      calls++;
      payload = input;
      return { status: "accepted", providerMessageId: "mock-ed17-1" };
    } }),
  });
  assert.equal(result.status, "accepted");
  assert.equal(calls, 1);
  assert.ok(payload);
  assert.deepEqual(Object.keys(payload).sort(), ["from", "html", "idempotencyKey", "replyTo", "subject", "text", "to"].sort());
  assert.deepEqual(payload.to, [NEWSLETTER_EDITION_17_TEST_RECIPIENT]);
  assert.equal(payload.subject, NEWSLETTER_EDITION_17_TEST_SUBJECT);
  assert.ok(payload.html.includes("Lo próximo cerca de ti"));
  assert.ok(payload.html.includes("X-Trial: equilibrio imposible en Madrid Arena"));
  assert.ok(payload.html.includes(NEWSLETTER_EDITION_17_SAFE_TEST_UNSUBSCRIBE_URL.replaceAll("&", "&amp;")));
  assert.ok(!payload.html.includes("PREVIEW LOCAL"));
  assert.ok(!payload.html.includes("2026-11-12/assets/"));
  assert.ok(payload.text.includes("Darme de baja:"));
});

test("Ed17 protected test dry-run is provider-free; uncertain result is never retried", async () => {
  const base = await options();
  let calls = 0;
  const clientFactory = () => ({ async sendEmail() {
    calls++;
    return { status: "timeout" as const };
  } });
  const dry = await executeNewsletterEdition17TestSend({
    ...base, request: { ...base.request, send: false }, clientFactory,
  });
  assert.equal(dry.status, "dry_run");
  assert.equal(calls, 0);
  await assert.rejects(() => executeNewsletterEdition17TestSend({ ...base, clientFactory }), /provider_timeout_no_retry/);
  assert.equal(calls, 1);
});
