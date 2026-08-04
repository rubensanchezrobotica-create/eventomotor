import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_01_TEST_ARMED_VALUE,
  NEWSLETTER_EDITION_01_TEST_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_01_TEST_SUBJECT,
  NewsletterEdition01TestSendError,
  canonicalizeEdition01TemplateText,
  executeNewsletterEdition01TestSend as executeNewsletterEdition01TestSendNeutral,
  parseNewsletterEdition01TestArguments,
  prepareEdition01Content,
  selectNewsletterEdition01Environment,
  validateEdition01SourceIntegrity,
  validateEdition01Template,
  validateEdition01UnsubscribeUrl,
  type ExecuteNewsletterEdition01TestOptions,
  type NewsletterEdition01Client,
  type NewsletterEdition01ClientResult,
  type NewsletterEdition01EmailPayload,
  type NewsletterEdition01Source,
  type NewsletterEdition01TestEnvironment,
  type NewsletterEdition01TestRequest,
} from "../../lib/newsletter/edition-01-test-send";

const NEWSLETTER_PRODUCTION_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
const NEWSLETTER_PRODUCTION_REPLY_TO = "info@eventomotor.com";
const EDITION_VISIBLE_TEXT_SHA256 =
  "ec2cc5bc96b7e1234df7e2bfdd44717327b0c5082fd240a0e2979bab084438a0";
const EDITION_HREFS_SHA256 =
  "baafdfede056c1ddf70b43190e4838d518ab055a3383c329e29b6c7187f694c9";

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

class FakeResendClient implements NewsletterEdition01Client {
  readonly calls: NewsletterEdition01EmailPayload[] = [];
  result: NewsletterEdition01ClientResult = {
    status: "accepted",
    providerMessageId: "fake-edition-01-message-id",
  };

  async sendEmail(payload: NewsletterEdition01EmailPayload) {
    this.calls.push(structuredClone(payload));
    return this.result;
  }
}

async function loadEdition01Source(): Promise<NewsletterEdition01Source> {
  const editionDirectory = resolve(
    process.cwd(),
    "docs/newsletter/ediciones/2026-08-06",
  );
  const [html, text] = await Promise.all([
    readFile(resolve(editionDirectory, "email-production.html"), "utf8"),
    readFile(resolve(editionDirectory, "email-texto-plano.txt"), "utf8"),
  ]);
  return { html, text };
}

async function loadEdition01Preview(): Promise<string> {
  return readFile(
    resolve(
      process.cwd(),
      "docs/newsletter/ediciones/2026-08-06/preview-local.html",
    ),
    "utf8",
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function executeNewsletterEdition01TestSend(
  options: Omit<
    ExecuteNewsletterEdition01TestOptions,
    "source" | "sender" | "replyTo"
  >,
) {
  return executeNewsletterEdition01TestSendNeutral({
    ...options,
    source: await loadEdition01Source(),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
  });
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
  assert.equal(
    selectNewsletterEdition01Environment({ apiKey: API_KEY }).apiKey,
    undefined,
  );
  assert.equal(
    selectNewsletterEdition01Environment({ apiKey: API_KEY }, true).apiKey,
    API_KEY,
  );
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

test("producción y preview declaran un esquema exclusivamente oscuro", async () => {
  const source = await loadEdition01Source();
  const preview = await loadEdition01Preview();

  for (const html of [source.html, preview]) {
    assert.match(html, /<meta name="color-scheme" content="dark">/);
    assert.match(
      html,
      /<meta name="supported-color-schemes" content="dark">/,
    );
    assert.match(
      html,
      /:root \{ color-scheme:dark; supported-color-schemes:dark; \}/,
    );
    assert.match(html, /@media \(prefers-color-scheme:dark\)/);
    assert.match(html, /<body class="body"/);
  }
});

test("los fondos principales conservan las tres capas de color", async () => {
  const source = await loadEdition01Source();
  const preview = await loadEdition01Preview();
  const surfaces = [
    ["body", "#080a0e", 1],
    ["email-bg", "#080a0e", 1],
    ["email-shell", "#0d1015", 1],
    ["email-header", "#050608", 1],
    ["intro-surface", "#0d1015", 1],
    ["email-card", "#11141a", 5],
    ["final-cta", "#171b22", 1],
    ["email-footer", "#080a0e", 1],
    ["logo-protect", "#050608", 1],
  ] as const;

  for (const html of [source.html, preview]) {
    for (const [className, color, expectedCount] of surfaces) {
      const tags = [
        ...html.matchAll(
          new RegExp(
            `<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>`,
            "g",
          ),
        ),
      ].map((match) => match[0]);
      assert.equal(tags.length, expectedCount, className);
      for (const tag of tags) {
        assert.match(tag, new RegExp(`bgcolor="${color}"`));
        assert.match(tag, new RegExp(`background-color:${color}`));
        assert.match(
          tag,
          new RegExp(`background-image:linear-gradient\\(${color},${color}\\)`),
        );
      }
    }
  }
});

test("la defensa Gmail iOS limita los blends a grupos de texto", async () => {
  const source = await loadEdition01Source();
  const preview = await loadEdition01Preview();

  for (const html of [source.html, preview]) {
    assert.match(html, /u \+ \.body \.gmail-blend-screen/);
    assert.match(html, /mix-blend-mode:screen/);
    assert.match(html, /u \+ \.body \.gmail-blend-difference/);
    assert.match(html, /mix-blend-mode:difference/);
    const screenWrappers = [
      ...html.matchAll(/<[^>]+class="gmail-blend-screen"[^>]*>/g),
    ].map((match) => match[0]);
    const differenceWrappers = [
      ...html.matchAll(/<[^>]+class="gmail-blend-difference"[^>]*>/g),
    ].map((match) => match[0]);
    assert.equal(screenWrappers.length, 11);
    assert.equal(differenceWrappers.length, 11);
    assert.equal(screenWrappers.every((tag) => tag.startsWith("<div")), true);
    assert.equal(
      differenceWrappers.every((tag) => tag.startsWith("<div")),
      true,
    );
  }
});

test("botones y logo mantienen contraste protegido", async () => {
  const source = await loadEdition01Source();
  const preview = await loadEdition01Preview();

  for (const html of [source.html, preview]) {
    const buttons = [
      ...html.matchAll(/<a[^>]+class="orange-button"[^>]*>/g),
    ].map((match) => match[0]);
    assert.equal(buttons.length, 2);
    for (const button of buttons) {
      assert.match(button, /background-color:#ff5a0a/);
      assert.match(
        button,
        /background-image:linear-gradient\(#ff5a0a,#ff5a0a\)/,
      );
      assert.match(button, /color:#ffffff/);
    }
    assert.match(
      html,
      /<table class="logo-protect"[\s\S]*?<img[^>]+eventomotor-logo\.png[\s\S]*?<\/table>/,
    );
  }
});

test("texto, enlaces, UTMs y baja permanecen idénticos", async () => {
  const source = await loadEdition01Source();
  const preview = await loadEdition01Preview();

  for (const html of [source.html, preview]) {
    const visibleText = html
      .slice(html.indexOf("<body"))
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const hrefs = [...html.matchAll(/\bhref="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.equal(sha256(visibleText), EDITION_VISIBLE_TEXT_SHA256);
    assert.equal(sha256(JSON.stringify(hrefs)), EDITION_HREFS_SHA256);
    assert.equal(hrefs.length, 16);
    assert.equal(
      html.split("utm_campaign=agenda_motor_2026_08_06").length - 1,
      13,
    );
    assert.equal(html.split("{{unsubscribe_url}}").length - 1, 1);
  }
});

test("la integridad canónica acepta la plantilla con LF", async () => {
  const source = await loadEdition01Source();
  const lfSource = {
    html: canonicalizeEdition01TemplateText(source.html),
    text: canonicalizeEdition01TemplateText(source.text),
  };

  assert.doesNotThrow(() => validateEdition01SourceIntegrity(lfSource));
});

test("la integridad canónica acepta el mismo contenido con CRLF", async () => {
  const source = await loadEdition01Source();
  const crlfSource = {
    html: canonicalizeEdition01TemplateText(source.html).replace(/\n/g, "\r\n"),
    text: canonicalizeEdition01TemplateText(source.text).replace(/\n/g, "\r\n"),
  };

  assert.doesNotThrow(() => validateEdition01SourceIntegrity(crlfSource));
});

test("la integridad canónica acepta el mismo contenido con CR", async () => {
  const source = await loadEdition01Source();
  const crSource = {
    html: canonicalizeEdition01TemplateText(source.html).replace(/\n/g, "\r"),
    text: canonicalizeEdition01TemplateText(source.text).replace(/\n/g, "\r"),
  };

  assert.doesNotThrow(() => validateEdition01SourceIntegrity(crSource));
});

test("la integridad rechaza palabras, enlaces, UTMs y placeholders alterados", async () => {
  const source = await loadEdition01Source();
  const canonicalSource = {
    html: canonicalizeEdition01TemplateText(source.html),
    text: canonicalizeEdition01TemplateText(source.text),
  };
  const mutations: NewsletterEdition01Source[] = [
    {
      ...canonicalSource,
      text: canonicalSource.text.replace("rally", "rallye"),
    },
    {
      ...canonicalSource,
      html: canonicalSource.html.replace(
        "https://www.eventomotor.com/newsletter/2026-08-06/assets/",
        "https://www.eventomotor.com/newsletter/2026-08-06/other/",
      ),
    },
    {
      ...canonicalSource,
      html: canonicalSource.html.replace(
        "utm_campaign=agenda_motor_2026_08_06",
        "utm_campaign=agenda_motor_changed",
      ),
    },
    {
      ...canonicalSource,
      html: canonicalSource.html.replace(
        "{{unsubscribe_url}}",
        "{{unsubscribe_link}}",
      ),
    },
  ];

  for (const mutation of mutations) {
    assert.throws(
      () => validateEdition01SourceIntegrity(mutation),
      (error: unknown) =>
        error instanceof NewsletterEdition01TestSendError &&
        error.code === "template_digest_mismatch",
    );
  }
});

test("la canonicalización conserva espacios y extremos sin aplicar trim", () => {
  assert.equal(
    canonicalizeEdition01TemplateText("  A  B \r\n C \rD  "),
    "  A  B \n C \nD  ",
  );
});

test("el test usa núcleo neutral y la CLI conserva el adaptador server-only", async () => {
  const [testSource, neutralSource, serverSource, scriptSource] =
    await Promise.all([
      readFile(
        resolve(
          process.cwd(),
          "tests/newsletter/newsletter-edition-01-test-send.test.ts",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          process.cwd(),
          "lib/newsletter/edition-01-test-send.ts",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          process.cwd(),
          "lib/newsletter/edition-01-test-send.server.ts",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          process.cwd(),
          "scripts/send-newsletter-edition-01-test.ts",
        ),
        "utf8",
      ),
    ]);

  const testNewsletterImports = testSource
    .split("\n")
    .filter((line) => line.includes("from \"../../lib/newsletter/"))
    .join("\n");
  assert.doesNotMatch(testNewsletterImports, /edition-01-test-send\.server/);
  assert.doesNotMatch(testNewsletterImports, /resend-client\.server/);
  assert.doesNotMatch(testNewsletterImports, /resend-config\.server/);
  assert.match(testNewsletterImports, /edition-01-test-send"/);
  assert.doesNotMatch(neutralSource, /import\s+["']server-only["']/);
  assert.doesNotMatch(neutralSource, /process\.env/);
  assert.doesNotMatch(neutralSource, /FetchNewsletterResendClient/);
  assert.match(serverSource, /^import "server-only";/);
  assert.match(serverSource, /FetchNewsletterResendClient/);
  assert.match(serverSource, /NEWSLETTER_PRODUCTION_SENDER/);
  assert.match(serverSource, /NEWSLETTER_PRODUCTION_REPLY_TO/);
  assert.match(scriptSource, /edition-01-test-send\.server/);
});
