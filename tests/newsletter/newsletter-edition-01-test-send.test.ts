import assert from "node:assert/strict";
import test from "node:test";

import {
  NEWSLETTER_EDITION_01_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_01_TEST_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_01_TEST_SUBJECT,
  NewsletterEdition01TestSendError,
  executeNewsletterEdition01TestSend,
  loadEdition01Source,
  newsletterEdition01EnvironmentFromProcess,
  parseNewsletterEdition01TestArguments,
  prepareEdition01Content,
  validateEdition01Template,
  validateEdition01UnsubscribeUrl,
  type NewsletterEdition01TestEnvironment,
  type NewsletterEdition01TestRequest,
} from "../../lib/newsletter/edition-01-test-send.server";
import type {
  NewsletterResendClient,
  NewsletterResendClientResult,
  NewsletterResendEmailPayload,
} from "../../lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "../../lib/newsletter/resend-config.server";

const RECIPIENT = "edition-test@example.invalid";
const OTHER_RECIPIENT = "other-test@example.invalid";
const TOKEN = "T".repeat(48);
const UNSUBSCRIBE_URL =
  `https://www.eventomotor.com/newsletter/unsubscribe?token=${TOKEN}`;
const API_KEY = `re_test_${"a".repeat(32)}`;
const BASE_REQUEST: NewsletterEdition01TestRequest = {
  send: false,
  to: RECIPIENT,
  unsubscribeUrl: UNSUBSCRIBE_URL,
};
const BASE_ENVIRONMENT: NewsletterEdition01TestEnvironment = {
  nodeEnv: "development",
};
const SEND_REQUEST: NewsletterEdition01TestRequest = {
  ...BASE_REQUEST,
  send: true,
  confirmTo: RECIPIENT,
  confirmPhrase: NEWSLETTER_EDITION_01_TEST_CONFIRM_PHRASE,
};
const SEND_ENVIRONMENT: NewsletterEdition01TestEnvironment = {
  ...BASE_ENVIRONMENT,
  armed: NEWSLETTER_EDITION_01_TEST_ARMED_VALUE,
  apiKey: API_KEY,
};

class FakeResendClient implements NewsletterResendClient {
  readonly calls: NewsletterResendEmailPayload[] = [];
  result: NewsletterResendClientResult = {
    status: "accepted",
    providerMessageId: "fake-edition-01-message-id",
  };

  async sendEmail(payload: NewsletterResendEmailPayload) {
    this.calls.push(structuredClone(payload));
    return this.result;
  }
}

async function expectBlocked(
  request: NewsletterEdition01TestRequest,
  environment: NewsletterEdition01TestEnvironment,
  code: string,
): Promise<void> {
  await assert.rejects(
    executeNewsletterEdition01TestSend({ request, environment }),
    (error: unknown) =>
      error instanceof NewsletterEdition01TestSendError && error.code === code,
  );
}

test("dry-run no crea ni llama al cliente Resend", async () => {
  let factoryCalls = 0;
  const logs: string[] = [];
  const result = await executeNewsletterEdition01TestSend({
    request: BASE_REQUEST,
    environment: BASE_ENVIRONMENT,
    clientFactory() {
      factoryCalls += 1;
      return new FakeResendClient();
    },
    logger: (message) => logs.push(message),
  });

  assert.equal(result.status, "dry_run");
  assert.equal(factoryCalls, 0);
  assert.equal(logs.at(-1), "Dry-run complete. No email was sent.");
});

test("la ausencia de --send prevalece incluso con armado y API key", async () => {
  const client = new FakeResendClient();
  const result = await executeNewsletterEdition01TestSend({
    request: {
      ...BASE_REQUEST,
      confirmTo: RECIPIENT,
      confirmPhrase: NEWSLETTER_EDITION_01_TEST_CONFIRM_PHRASE,
    },
    environment: SEND_ENVIRONMENT,
    clientFactory: () => client,
  });

  assert.equal(result.status, "dry_run");
  assert.equal(client.calls.length, 0);
});

test("dry-run no captura la API key del proceso", () => {
  const previousApiKey = process.env.NEWSLETTER_RESEND_API_KEY;
  process.env.NEWSLETTER_RESEND_API_KEY = API_KEY;
  try {
    assert.equal(newsletterEdition01EnvironmentFromProcess().apiKey, undefined);
    assert.equal(
      newsletterEdition01EnvironmentFromProcess(true).apiKey,
      API_KEY,
    );
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.NEWSLETTER_RESEND_API_KEY;
    } else {
      process.env.NEWSLETTER_RESEND_API_KEY = previousApiKey;
    }
  }
});

test("rechaza múltiples destinatarios, separadores y cc/bcc", async () => {
  for (const recipient of [
    `${RECIPIENT},${OTHER_RECIPIENT}`,
    `${RECIPIENT};${OTHER_RECIPIENT}`,
  ]) {
    await expectBlocked(
      { ...BASE_REQUEST, to: recipient },
      BASE_ENVIRONMENT,
      "single_recipient_required",
    );
  }
  for (const argument of ["--cc", "--bcc"]) {
    assert.throws(
      () => parseNewsletterEdition01TestArguments([argument, RECIPIENT]),
      (error: unknown) =>
        error instanceof NewsletterEdition01TestSendError &&
        error.code === "unknown_argument",
    );
  }
});

test("rechaza diferencias exactas entre to y confirm-to", async () => {
  await expectBlocked(
    { ...SEND_REQUEST, confirmTo: OTHER_RECIPIENT },
    SEND_ENVIRONMENT,
    "recipient_confirmation_mismatch",
  );
  await expectBlocked(
    { ...SEND_REQUEST, confirmTo: RECIPIENT.toUpperCase() },
    SEND_ENVIRONMENT,
    "recipient_confirmation_mismatch",
  );
});

test("rechaza una frase de confirmación incorrecta", async () => {
  await expectBlocked(
    { ...SEND_REQUEST, confirmPhrase: "SEND-EDITION-01" },
    SEND_ENVIRONMENT,
    "confirmation_phrase_invalid",
  );
});

test("rechaza variable de armado ausente o incorrecta", async () => {
  for (const armed of [undefined, "edition-01"] as const) {
    await expectBlocked(
      SEND_REQUEST,
      { ...SEND_ENVIRONMENT, armed },
      "send_not_armed",
    );
  }
});

test("rechaza el envío si la API key no está disponible", async () => {
  await expectBlocked(
    SEND_REQUEST,
    { ...SEND_ENVIRONMENT, apiKey: undefined },
    "api_key_unavailable",
  );
});

test("bloquea CI, Vercel y NODE_ENV production también en dry-run", async () => {
  for (const environment of [
    { ...BASE_ENVIRONMENT, ci: "true" },
    { ...BASE_ENVIRONMENT, ci: "" },
    { ...BASE_ENVIRONMENT, vercel: "1" },
    { ...BASE_ENVIRONMENT, vercelEnv: "preview" },
    { ...BASE_ENVIRONMENT, nodeEnv: "production" },
  ]) {
    await assert.rejects(
      executeNewsletterEdition01TestSend({
        request: BASE_REQUEST,
        environment,
      }),
      NewsletterEdition01TestSendError,
    );
  }
});

test("rechaza URL de baja externa, no HTTPS o con contrato incorrecto", () => {
  for (const value of [
    `http://www.eventomotor.com/newsletter/unsubscribe?token=${TOKEN}`,
    `https://eventomotor.com/newsletter/unsubscribe?token=${TOKEN}`,
    `https://www.eventomotor.com/newsletter/confirm?token=${TOKEN}`,
    `https://www.eventomotor.com/newsletter/unsubscribe?token=${TOKEN}&extra=1`,
    "https://www.eventomotor.com/newsletter/unsubscribe?token=short",
    "not-a-url",
  ]) {
    assert.throws(
      () => validateEdition01UnsubscribeUrl(value),
      NewsletterEdition01TestSendError,
    );
  }
});

test("sustituye exactamente los placeholders de HTML y texto", async () => {
  const source = await loadEdition01Source();
  const prepared = prepareEdition01Content(source, UNSUBSCRIBE_URL);

  assert.equal(prepared.htmlPlaceholderCount, 1);
  assert.equal(prepared.textPlaceholderCount, 1);
  assert.equal(prepared.html.includes("{{unsubscribe_url}}"), false);
  assert.equal(prepared.text.includes("{{unsubscribe_url}}"), false);
  assert.equal(prepared.html.includes(UNSUBSCRIBE_URL), true);
  assert.equal(prepared.text.includes(UNSUBSCRIBE_URL), true);
});

test("API key, token, URL y email completo no aparecen en logs", async () => {
  const client = new FakeResendClient();
  const logs: string[] = [];
  await executeNewsletterEdition01TestSend({
    request: SEND_REQUEST,
    environment: SEND_ENVIRONMENT,
    clientFactory: () => client,
    logger: (message) => logs.push(message),
  });
  const output = logs.join("\n");

  assert.doesNotMatch(output, new RegExp(API_KEY));
  assert.doesNotMatch(output, new RegExp(TOKEN));
  assert.equal(output.includes(UNSUBSCRIBE_URL), false);
  assert.equal(output.includes(RECIPIENT), false);
  assert.match(output, /ed\*\*\*@ex\*\*\*\.invalid/);
});

test("payload contiene un único to y nunca cc o bcc", async () => {
  const client = new FakeResendClient();
  await executeNewsletterEdition01TestSend({
    request: SEND_REQUEST,
    environment: SEND_ENVIRONMENT,
    clientFactory: () => client,
  });

  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0]?.to, [RECIPIENT]);
  assert.equal(Object.hasOwn(client.calls[0] ?? {}, "cc"), false);
  assert.equal(Object.hasOwn(client.calls[0] ?? {}, "bcc"), false);
});

test("sender, reply-to y asunto de prueba permanecen exactos", async () => {
  const client = new FakeResendClient();
  await executeNewsletterEdition01TestSend({
    request: SEND_REQUEST,
    environment: SEND_ENVIRONMENT,
    clientFactory: () => client,
  });
  const payload = client.calls[0];

  assert.equal(payload?.from, NEWSLETTER_PRODUCTION_SENDER);
  assert.equal(payload?.replyTo, NEWSLETTER_PRODUCTION_REPLY_TO);
  assert.equal(payload?.subject, NEWSLETTER_EDITION_01_TEST_SUBJECT);
  assert.match(payload?.subject ?? "", /^\[PRUEBA\]/);
});

test("aceptación simulada informa providerMessageId sin segundo envío", async () => {
  const client = new FakeResendClient();
  const logs: string[] = [];
  const result = await executeNewsletterEdition01TestSend({
    request: SEND_REQUEST,
    environment: SEND_ENVIRONMENT,
    clientFactory: () => client,
    logger: (message) => logs.push(message),
  });

  assert.deepEqual(result, {
    status: "accepted",
    recipient: "ed***@ex***.invalid",
    providerMessageId: "fake-edition-01-message-id",
    summary: {
      imageCount: 7,
      htmlCampaignCount: 13,
      htmlPlaceholderCount: 1,
      textPlaceholderCount: 1,
    },
  });
  assert.equal(client.calls.length, 1);
  assert.match(logs.at(-1) ?? "", /fake-edition-01-message-id/);
});

test("dry-run por defecto no usa fetch global ni realiza red", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Network must not be used by this test.");
  };
  try {
    await executeNewsletterEdition01TestSend({
      request: BASE_REQUEST,
      environment: BASE_ENVIRONMENT,
    });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("la plantilla real supera integridad, imágenes, UTMs y codificación", async () => {
  const source = await loadEdition01Source();
  assert.deepEqual(validateEdition01Template(source), {
    imageCount: 7,
    htmlCampaignCount: 13,
    htmlPlaceholderCount: 1,
    textPlaceholderCount: 1,
  });
  assert.equal(source.html.includes('<img src="assets/'), false);
  for (const marker of ["\u00c3", "\u00c2", "\u00e2\u20ac", "\ufffd"]) {
    assert.equal(source.html.includes(marker), false);
    assert.equal(source.text.includes(marker), false);
  }
});
