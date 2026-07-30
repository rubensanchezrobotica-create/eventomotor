import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  type NewsletterResendClient,
  type NewsletterResendClientResult,
  type NewsletterResendEmailPayload,
} from "../../lib/newsletter/resend-client.server";
import {
  evaluateNewsletterResendConfiguration,
  type NewsletterResendEnvironment,
} from "../../lib/newsletter/resend-config.server";
import {
  NewsletterResendTransportError,
  ResendNewsletterMailTransport,
} from "../../lib/newsletter/resend-transport.server";
import { createNewsletterService } from "../../lib/newsletter/service.server";
import {
  NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
  type NewsletterMailCommand,
  type NewsletterRepository,
} from "../../lib/newsletter/service-types";

const API_KEY = "re_test_" + "a".repeat(32);
const FROM = "EventoMotor <agenda@news.example.invalid>";
const REPLY_TO = "info@example.invalid";
const RECIPIENT = "allowed@example.invalid";
const ORIGIN = "https://newsletter.example.invalid";
const TOKEN = "T".repeat(43);
const BASE_ENVIRONMENT: NewsletterResendEnvironment = {
  newsletterMode: "test",
  mailTransport: "resend",
  apiKey: API_KEY,
  from: FROM,
  replyTo: REPLY_TO,
  recipientAllowlist: RECIPIENT,
  nodeEnv: "test",
};
const CONFIRMATION_COMMAND: NewsletterMailCommand = {
  kind: "confirmation",
  recipientEmail: RECIPIENT,
  rawConfirmationToken: TOKEN,
  purpose: "subscribe",
  expiresAt: "2026-07-29T12:00:00.000Z",
};

class FakeResendClient implements NewsletterResendClient {
  readonly calls: NewsletterResendEmailPayload[] = [];
  result: NewsletterResendClientResult = {
    status: "accepted",
    providerMessageId: "fake-provider-message-id",
  };
  thrown: Error | null = null;

  async sendEmail(payload: NewsletterResendEmailPayload) {
    this.calls.push(structuredClone(payload));
    if (this.thrown) throw this.thrown;
    return this.result;
  }
}

function createTransport(
  client = new FakeResendClient(),
  overrides: Partial<ConstructorParameters<typeof ResendNewsletterMailTransport>[0]> = {},
) {
  return {
    client,
    transport: new ResendNewsletterMailTransport({
      client,
      from: FROM,
      replyTo: REPLY_TO,
      allowedRecipients: [RECIPIENT],
      linkOrigin: ORIGIN,
      now: () => new Date("2026-07-28T12:00:00.000Z"),
      async renderConfirmation() {
        return { html: "<p>html-exacto</p>", text: "texto exacto" };
      },
      async renderWelcome() {
        return { html: "<p>bienvenida-exacta</p>", text: "bienvenida exacta" };
      },
      ...overrides,
    }),
  };
}

test("Resend está deshabilitado por defecto", () => {
  assert.deepEqual(evaluateNewsletterResendConfiguration({}), {
    enabled: false,
    reason: "transport_not_selected",
  });
});

for (const [label, property, reason] of [
  ["API key", "apiKey", "api_key_invalid"],
  ["from", "from", "from_invalid"],
  ["Reply-To", "replyTo", "reply_to_invalid"],
  ["allowlist", "recipientAllowlist", "allowlist_invalid"],
] as const) {
  test(`configuración incompleta sin ${label} falla cerrada`, () => {
    assert.deepEqual(
      evaluateNewsletterResendConfiguration({ ...BASE_ENVIRONMENT, [property]: undefined }),
      { enabled: false, reason },
    );
  });
}

test("allowlist vacía, duplicada, inválida o con wildcard falla cerrada", () => {
  for (const recipientAllowlist of [
    "",
    "allowed@example.invalid, ALLOWED@example.invalid",
    "not-an-email",
    "*@example.invalid",
    "allowed@example.invalid,",
  ]) {
    assert.deepEqual(
      evaluateNewsletterResendConfiguration({ ...BASE_ENVIRONMENT, recipientAllowlist }),
      { enabled: false, reason: "allowlist_invalid" },
    );
  }
});

test("allowlist normaliza trim y mayúsculas para comparación exacta", () => {
  const result = evaluateNewsletterResendConfiguration({
    ...BASE_ENVIRONMENT,
    recipientAllowlist: "  ALLOWED@EXAMPLE.INVALID  ",
  });
  assert.equal(result.enabled, true);
  if (result.enabled) assert.deepEqual(result.allowedRecipients, [RECIPIENT]);
});

test("off, preview y live bloquean Resend", () => {
  for (const newsletterMode of ["off", "preview", "live"]) {
    assert.deepEqual(
      evaluateNewsletterResendConfiguration({ ...BASE_ENVIRONMENT, newsletterMode }),
      { enabled: false, reason: "mode_not_test" },
    );
  }
});

test("producción y cualquier Vercel bloquean Resend, incluida Preview", () => {
  assert.deepEqual(
    evaluateNewsletterResendConfiguration({ ...BASE_ENVIRONMENT, nodeEnv: "production" }),
    { enabled: false, reason: "deployment_blocked" },
  );
  for (const vercelEnv of ["preview", "production", "development"]) {
    assert.deepEqual(
      evaluateNewsletterResendConfiguration({ ...BASE_ENVIRONMENT, vercelEnv }),
      { enabled: false, reason: "deployment_blocked" },
    );
  }
});

test("test explícito con configuración completa habilita Resend", () => {
  const result = evaluateNewsletterResendConfiguration(BASE_ENVIRONMENT);
  assert.equal(result.enabled, true);
});

test("coincidencia exacta llama una vez y conserva el payload sin CC, BCC ni tracking", async () => {
  const { client, transport } = createTransport();
  const result = await transport.send(CONFIRMATION_COMMAND);
  assert.deepEqual(result, {
    status: "accepted",
    providerMessageId: "fake-provider-message-id",
  });
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0], {
    from: FROM,
    to: [RECIPIENT],
    replyTo: REPLY_TO,
    subject: "Confirma tu suscripción a La Agenda Motor",
    html: "<p>html-exacto</p>",
    text: "texto exacto",
  });
  assert.equal("cc" in client.calls[0], false);
  assert.equal("bcc" in client.calls[0], false);
  assert.equal("tracking" in client.calls[0], false);
});

test("destinatario permitido compara sin distinguir mayúsculas", async () => {
  const { client, transport } = createTransport();
  await transport.send({ ...CONFIRMATION_COMMAND, recipientEmail: "ALLOWED@EXAMPLE.INVALID" });
  assert.deepEqual(client.calls[0]?.to, [RECIPIENT]);
});

test("destinatario bloqueado produce provider_error interno y respuesta pública genérica", async () => {
  const { client, transport } = createTransport();
  const repository: NewsletterRepository = {
    async requestSubscription() {
      return {
        outcome: "confirmation_required",
        subscriberId: "123e4567-e89b-42d3-a456-426614174000",
        tokenPurpose: "subscribe",
      };
    },
    async confirmSubscription() {
      return { outcome: "invalid_token", subscriberId: null };
    },
    async prepareWelcomeDelivery() {
      throw new Error("not used");
    },
    async unsubscribeSubscriber() {
      return "not_found";
    },
    async unsubscribeByToken() {
      return "invalid_or_expired";
    },
    async recordProviderEvent() {
      return "recorded";
    },
  };
  const service = createNewsletterService({
    mode: "test",
    repository,
    mailTransport: transport,
    now: () => new Date("2026-07-28T12:00:00.000Z"),
    tokenFactory: () => TOKEN,
    tokenHasher: () => "a".repeat(64),
  });
  const result = await service.requestSubscription({
    email: "blocked@example.invalid",
    provinceSlug: "madrid",
    source: "r4a_test",
    consentVersion: "2026-07",
  });
  assert.equal(result.mailStatus, "failed");
  assert.equal(result.internalErrorCategory, "provider_error");
  assert.deepEqual(result.publicResponse, NEWSLETTER_PUBLIC_MUTATION_RESPONSE);
  assert.equal(client.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /blocked@example\.invalid|T{43}/);
});

for (const recipientEmail of [
  "allowed@example.invalid.evil.invalid",
  "other@another.invalid",
  "other@example.invalid",
  "allowed@example.invalid,other@example.invalid",
  "allowed@example.invalid;other@example.invalid",
]) {
  test(`destinatario no autorizado '${recipientEmail}' no llama al cliente`, async () => {
    const { client, transport } = createTransport();
    await assert.rejects(
      transport.send({ ...CONFIRMATION_COMMAND, recipientEmail }),
      (error) =>
        error instanceof NewsletterResendTransportError &&
        error.category === "resend_recipient_not_allowed",
    );
    assert.equal(client.calls.length, 0);
  });
}

test("respuesta inválida, error, excepción y timeout nunca producen accepted ni retry", async () => {
  for (const scenario of [
    { result: { status: "invalid_response", httpStatus: 200 } as const, category: "resend_response_invalid" },
    { result: { status: "provider_error", httpStatus: 429 } as const, category: "resend_provider_error" },
    { result: { status: "timeout" } as const, category: "resend_timeout" },
  ]) {
    const { client, transport } = createTransport();
    client.result = scenario.result;
    await assert.rejects(
      transport.send(CONFIRMATION_COMMAND),
      (error) =>
        error instanceof NewsletterResendTransportError &&
        error.category === scenario.category,
    );
    assert.equal(client.calls.length, 1);
  }
  const { client, transport } = createTransport();
  client.thrown = new Error(`sensitive ${RECIPIENT} ${TOKEN}`);
  const error = await transport.send(CONFIRMATION_COMMAND).catch((caught: unknown) => caught);
  assert.ok(error instanceof NewsletterResendTransportError);
  assert.equal(client.calls.length, 1);
  assert.doesNotMatch(error.message, new RegExp(`${RECIPIENT}|${TOKEN}`));
});

test("cliente real fija origen, endpoint, redirect y timeout sin aceptar fetch u origen", () => {
  const source = readFileSync(
    join(process.cwd(), "lib/newsletter/resend-client.server.ts"),
    "utf8",
  );
  assert.match(source, /const RESEND_API_BASE_URL = "https:\/\/api\.resend\.com"/);
  assert.match(source, /const RESEND_EMAIL_PATH = "\/emails"/);
  assert.match(source, /redirect: "error"/);
  assert.match(source, /DEFAULT_RESEND_TIMEOUT_MS = 10_000/);
  assert.match(source, /new AbortController\(\)/);
  assert.equal((source.match(/globalThis\.fetch\(/g) ?? []).length, 1);
  assert.doesNotMatch(
    source,
    /process\.env|baseUrl|origin\s*[?:]|fetchImpl|proxy|http:\/\/|RESEND_BASE_URL/,
  );
});

test("suite usa fake inyectado y demuestra cero fetch global", async () => {
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = async () => {
    networkAttempts += 1;
    throw new Error("Network is forbidden in R4A tests.");
  };
  try {
    const { client, transport } = createTransport();
    await transport.send(CONFIRMATION_COMMAND);
    assert.equal(client.calls.length, 1);
    assert.equal(networkAttempts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("errores del cliente y transporte no escriben PII, token, body ni API key en logs", async () => {
  const originalError = console.error;
  const originalLog = console.log;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => logs.push(args);
  console.log = (...args: unknown[]) => logs.push(args);
  try {
    const client = new FakeResendClient();
    client.thrown = new Error(`${API_KEY} ${RECIPIENT} ${TOKEN}`);
    const transport = new ResendNewsletterMailTransport({
      client,
      from: FROM,
      replyTo: REPLY_TO,
      allowedRecipients: [RECIPIENT],
      linkOrigin: ORIGIN,
      now: () => new Date("2026-07-28T12:00:00.000Z"),
      async renderConfirmation() {
        return { html: "<p>html-exacto</p>", text: "texto exacto" };
      },
      async renderWelcome() {
        return { html: "<p>bienvenida-exacta</p>", text: "bienvenida exacta" };
      },
    });
    await assert.rejects(transport.send(CONFIRMATION_COMMAND));
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
  assert.deepEqual(logs, []);
});

test("configuración y cliente permanecen server-only y la composición es única", () => {
  const paths = [
    "lib/newsletter/resend-client.server.ts",
    "lib/newsletter/resend-config.server.ts",
    "lib/newsletter/resend-transport.server.tsx",
    "lib/newsletter/mail-transport-config.server.ts",
  ];
  const source = paths
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
  assert.equal((source.match(/import "server-only"/g) ?? []).length, paths.length);
  const service = readFileSync(join(process.cwd(), "lib/newsletter/service.server.ts"), "utf8");
  assert.match(service, /createConfiguredNewsletterMailRuntime/);
  assert.doesNotMatch(service, /FetchNewsletterResendClient|ResendNewsletterMailTransport/);
});

test(".env.example sólo contiene variables vacías y ningún secreto real", () => {
  const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
  for (const name of [
    "NEWSLETTER_RESEND_API_KEY",
    "NEWSLETTER_RESEND_FROM",
    "NEWSLETTER_RESEND_REPLY_TO",
    "NEWSLETTER_TEST_RECIPIENT_ALLOWLIST",
  ]) {
    assert.match(example, new RegExp(`^${name}=$`, "m"));
    assert.doesNotMatch(example, new RegExp(`^${name}=.+$`, "m"));
  }
  assert.doesNotMatch(example, /NEWSLETTER_RESEND_ORIGIN/);
  assert.doesNotMatch(example, /re_[A-Za-z0-9]{20,}/i);
});

test("configuración runtime no lee ni expone NEWSLETTER_RESEND_ORIGIN", () => {
  const source = readFileSync(
    join(process.cwd(), "lib/newsletter/resend-config.server.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /NEWSLETTER_RESEND_ORIGIN|origin\??:|origin_invalid/);
});

test("R4A no crea rutas, SQL, migraciones, SDK, SMTP ni dependencias nuevas", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  assert.equal(packageJson.dependencies.resend, undefined);
  const source = [
    "lib/newsletter/resend-client.server.ts",
    "lib/newsletter/resend-config.server.ts",
    "lib/newsletter/resend-transport.server.tsx",
    "lib/newsletter/mail-transport-config.server.ts",
  ].map((path) => readFileSync(join(process.cwd(), path), "utf8")).join("\n");
  assert.doesNotMatch(source, /supabase|smtp|nodemailer|webhook|campaign|RESEND_BASE_URL/i);
  assert.doesNotMatch(source, /app[\\/](api|newsletter)/i);
});
