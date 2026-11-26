import assert from "node:assert/strict";
import test from "node:test";

import {
  NEWSLETTER_EDITION_17_REPLY_TO,
  NEWSLETTER_EDITION_17_SENDER,
  type NewsletterEdition17Source,
} from "./edition-17-content";
import {
  NEWSLETTER_EDITION_17_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_17_TEST_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_17_TEST_RECIPIENT,
  executeNewsletterEdition17TestSend,
} from "./edition-17-test-send";
import {
  NEWSLETTER_EDITION_17_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_17_CAMPAIGN_CONFIRM_PHRASE,
  executeNewsletterEdition17Campaign,
  parseNewsletterEdition17CampaignArguments,
  type NewsletterEdition17CampaignRepository,
} from "./edition-17-campaign";

const source: NewsletterEdition17Source = { assetManifest: "[]", assets: {} };
const dummyKey = "re_mock_not_a_real_key_123456789";

test("Ed17 test sender rejects wrong recipient, mode and confirmation before provider access", async () => {
  let calls = 0;
  const base = {
    source,
    sender: NEWSLETTER_EDITION_17_SENDER,
    replyTo: NEWSLETTER_EDITION_17_REPLY_TO,
    clientFactory: () => { calls++; throw new Error("provider must not be constructed"); },
    environment: {
      armed: NEWSLETTER_EDITION_17_TEST_ARMED_VALUE,
      apiKey: dummyKey,
      mailTransport: "resend",
      newsletterMode: "test",
      recipientAllowlist: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
    },
    request: {
      send: true,
      to: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
      confirmTo: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
      confirmPhrase: NEWSLETTER_EDITION_17_TEST_CONFIRM_PHRASE,
      variant: "madrid",
    },
  };
  await assert.rejects(executeNewsletterEdition17TestSend({
    ...base, request: { ...base.request, to: "someone@example.com" },
  }), /recipient_not_allowed/);
  await assert.rejects(executeNewsletterEdition17TestSend({
    ...base, environment: { ...base.environment, newsletterMode: "live" },
  }), /mode_not_test/);
  await assert.rejects(executeNewsletterEdition17TestSend({
    ...base, request: { ...base.request, confirmPhrase: "SEND-EDITION-15-TEST" },
  }), /confirmation_phrase_invalid/);
  await assert.rejects(executeNewsletterEdition17TestSend(base), /asset_manifest_mismatch/);
  assert.equal(calls, 0);
});

test("Ed17 campaign refuses invalid source before preview, prepare or send", async () => {
  let repositoryCalls = 0;
  const unavailable = async (): Promise<never> => {
    repositoryCalls++;
    throw new Error("repository must not be touched");
  };
  const repository = {
    previewCampaign: unavailable,
    prepareCampaign: unavailable,
    auditFrozenCampaign: unavailable,
    claimDelivery: unavailable,
    recordAccepted: unavailable,
    recordFailed: unavailable,
    recordUnknown: unavailable,
  } satisfies NewsletterEdition17CampaignRepository;
  for (const argv of [
    [],
    ["--prepare-only", "--confirm-edition", "agenda_motor_2026_11_26", "--confirm-phrase", NEWSLETTER_EDITION_17_CAMPAIGN_CONFIRM_PHRASE],
    ["--send-prepared", "--confirm-edition", "agenda_motor_2026_11_26", "--confirm-phrase", NEWSLETTER_EDITION_17_CAMPAIGN_CONFIRM_PHRASE],
  ]) {
    await assert.rejects(executeNewsletterEdition17Campaign({
      request: parseNewsletterEdition17CampaignArguments(argv),
      environment: {
        armed: NEWSLETTER_EDITION_17_CAMPAIGN_ARMED_VALUE,
        mailTransport: "resend",
        newsletterMode: "live",
        publicLaunchEnabled: "public-newsletter-live",
        apiKey: dummyKey,
      },
      source,
      repository,
      sender: NEWSLETTER_EDITION_17_SENDER,
      replyTo: NEWSLETTER_EDITION_17_REPLY_TO,
      clientFactory: () => { throw new Error("provider must not be constructed"); },
    }), /asset_manifest_mismatch/);
  }
  assert.equal(repositoryCalls, 0);
});
