import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { isNewsletterPreviewAvailable } from "../../components/newsletter/newsletter-preview-model";
import { NEWSLETTER_EMAIL_LOGO_URL } from "../../emails/newsletter/email-brand";
import { hashNewsletterToken } from "../../lib/newsletter/crypto.server";
import { evaluateNewsletterHttpGuard } from "../../lib/newsletter/http.server";
import {
  FetchNewsletterResendClient,
  type NewsletterResendClient,
  type NewsletterResendClientResult,
  type NewsletterResendEmailPayload,
} from "../../lib/newsletter/resend-client.server";
import {
  evaluateNewsletterR4BResendConfiguration,
  type NewsletterR4BResendEnvironment,
} from "../../lib/newsletter/resend-config.server";
import {
  NewsletterResendTransportError,
  ResendNewsletterMailTransport,
} from "../../lib/newsletter/resend-transport.server";
import {
  NEWSLETTER_R4B_ARMED_VALUE,
  parseNewsletterR4BLocalOrigin,
} from "../../lib/newsletter/r4b-guard";
import { createNewsletterService } from "../../lib/newsletter/service.server";
import type {
  NewsletterRepository,
  NewsletterWelcomeDeliveryContext,
} from "../../lib/newsletter/service-types";

const API_KEY = `re_fake_${"a".repeat(32)}`;
const FROM = "EventoMotor <agenda@news.eventomotor.com>";
const REPLY_TO = "reply@example.invalid";
const RECIPIENT = "one@example.invalid";
const ORIGIN = "http://localhost:3000";
const SUBSCRIBER_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONFIRMATION_TOKEN = "C".repeat(43);
const UNSUBSCRIBE_TOKEN = "U".repeat(43);

const BASE_ENVIRONMENT: NewsletterR4BResendEnvironment = {
  newsletterMode: "test",
  mailTransport: "resend",
  armed: NEWSLETTER_R4B_ARMED_VALUE,
  localOrigin: ORIGIN,
  apiKey: API_KEY,
  from: FROM,
  replyTo: REPLY_TO,
  recipientAllowlist: RECIPIENT,
  nodeEnv: "development",
};

class FakeResendClient implements NewsletterResendClient {
  readonly calls: NewsletterResendEmailPayload[] = [];
  result: NewsletterResendClientResult = {
    status: "accepted",
    providerMessageId: "fake-r4b-message",
  };
  thrown: Error | null = null;

  async sendEmail(payload: NewsletterResendEmailPayload) {
    this.calls.push(structuredClone(payload));
    if (this.thrown) throw this.thrown;
    return this.result;
  }
}

function expectBlocked(
  overrides: Partial<NewsletterR4BResendEnvironment>,
  reason: ReturnType<typeof evaluateNewsletterR4BResendConfiguration> extends infer Result
    ? Result extends { enabled: false; reason: infer Reason }
      ? Reason
      : never
    : never,
) {
  assert.deepEqual(
    evaluateNewsletterR4BResendConfiguration({ ...BASE_ENVIRONMENT, ...overrides }),
    { enabled: false, reason },
  );
}

test("la configuración R4B local completa habilita exactamente un destinatario", () => {
  const result = evaluateNewsletterR4BResendConfiguration(BASE_ENVIRONMENT);
  assert.equal(result.enabled, true);
  if (result.enabled) {
    assert.equal(result.localOrigin, ORIGIN);
    assert.deepEqual(result.allowedRecipients, [RECIPIENT]);
  }
});

test("falta de armado o valor distinto bloquea", () => {
  expectBlocked({ armed: undefined }, "r4b_not_armed");
  expectBlocked({ armed: "yes" }, "r4b_not_armed");
});

test("VERCEL, VERCEL_ENV y producción bloquean", () => {
  expectBlocked({ vercel: "1" }, "deployment_blocked");
  expectBlocked({ vercelEnv: "preview" }, "deployment_blocked");
  expectBlocked({ nodeEnv: "production" }, "deployment_blocked");
});

test("live, preview y off bloquean", () => {
  for (const newsletterMode of ["live", "preview", "off"]) {
    expectBlocked({ newsletterMode }, "mode_not_test");
  }
});

test("un transporte distinto de resend bloquea", () => {
  expectBlocked({ mailTransport: "disabled" }, "transport_not_selected");
});

test("allowlist vacía o con dos destinatarios bloquea", () => {
  expectBlocked({ recipientAllowlist: "" }, "allowlist_invalid");
  expectBlocked(
    { recipientAllowlist: `${RECIPIENT},two@example.invalid` },
    "single_recipient_required",
  );
});

test("API key, remitente y Reply-To son obligatorios", () => {
  expectBlocked({ apiKey: undefined }, "api_key_invalid");
  expectBlocked({ from: undefined }, "from_invalid");
  expectBlocked({ replyTo: undefined }, "reply_to_invalid");
});

test("el remitente debe pertenecer exactamente a news.eventomotor.com", () => {
  expectBlocked(
    { from: "EventoMotor <agenda@eventomotor.com>" },
    "sender_domain_invalid",
  );
  expectBlocked(
    { from: "EventoMotor <agenda@news.eventomotor.com.evil.invalid>" },
    "sender_domain_invalid",
  );
});

test("la allowlist se normaliza a una coincidencia exacta", () => {
  const result = evaluateNewsletterR4BResendConfiguration({
    ...BASE_ENVIRONMENT,
    recipientAllowlist: "  ONE@EXAMPLE.INVALID ",
  });
  assert.equal(result.enabled, true);
  if (result.enabled) assert.deepEqual(result.allowedRecipients, [RECIPIENT]);
});

test("localhost y 127.0.0.1 son los únicos orígenes HTTP aceptados", () => {
  assert.equal(parseNewsletterR4BLocalOrigin("http://localhost:3000")?.origin, ORIGIN);
  assert.equal(
    parseNewsletterR4BLocalOrigin("http://127.0.0.1:4310")?.origin,
    "http://127.0.0.1:4310",
  );
  for (const value of [
    undefined,
    "",
    "https://localhost:3000",
    "https://eventomotor.com",
    "http://eventomotor.com",
    "http://192.168.1.10:3000",
    "http://[::1]:3000",
    "http://user:password@localhost:3000",
    "http://localhost:3000/path",
    "http://localhost:3000?query=1",
    "http://localhost:3000#fragment",
    " http://localhost:3000",
    "http://localhost:3000/",
    "not a url",
  ]) {
    assert.equal(parseNewsletterR4BLocalOrigin(value), null, String(value));
  }
});

test("origen local ausente o público bloquea la configuración de transporte", () => {
  expectBlocked({ localOrigin: undefined }, "local_endpoint_invalid");
  expectBlocked({ localOrigin: "https://eventomotor.com" }, "local_endpoint_invalid");
});

test("el transporte acepta sólo el destinatario exacto y genera enlaces loopback", async () => {
  const client = new FakeResendClient();
  const rendered: string[] = [];
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    now: () => new Date("2026-07-29T00:00:00.000Z"),
    async renderConfirmation(props) {
      assert.equal(props.logoUrl, NEWSLETTER_EMAIL_LOGO_URL);
      rendered.push(props.confirmationUrl);
      return { html: props.confirmationUrl, text: props.confirmationUrl };
    },
    async renderWelcome(props) {
      assert.equal(props.logoUrl, NEWSLETTER_EMAIL_LOGO_URL);
      rendered.push(props.unsubscribeUrl);
      return { html: props.unsubscribeUrl, text: props.unsubscribeUrl };
    },
  });

  await transport.send({
    kind: "confirmation",
    recipientEmail: "ONE@EXAMPLE.INVALID",
    rawConfirmationToken: CONFIRMATION_TOKEN,
    purpose: "subscribe",
    expiresAt: "2026-07-30T00:00:00.000Z",
  });
  await transport.send({
    kind: "welcome",
    recipientEmail: RECIPIENT,
    rawUnsubscribeToken: UNSUBSCRIBE_TOKEN,
    provinceSlug: "madrid",
    regionSlug: null,
    locale: "es",
  });

  assert.equal(client.calls.length, 2);
  assert.ok(client.calls.every(({ to }) => to.length === 1 && to[0] === RECIPIENT));
  assert.deepEqual(rendered, [
    `${ORIGIN}/preview/newsletter/confirm?token=${CONFIRMATION_TOKEN}`,
    `${ORIGIN}/preview/newsletter/unsubscribe?token=${UNSUBSCRIBE_TOKEN}`,
  ]);
});

test("destinatario no permitido falla antes de invocar al cliente", async () => {
  const client = new FakeResendClient();
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
  });
  await assert.rejects(
    transport.send({
      kind: "confirmation",
      recipientEmail: "other@example.invalid",
      rawConfirmationToken: CONFIRMATION_TOKEN,
      purpose: "subscribe",
      expiresAt: "2026-07-30T00:00:00.000Z",
    }),
    (error) =>
      error instanceof NewsletterResendTransportError &&
      error.category === "resend_recipient_not_allowed",
  );
  assert.equal(client.calls.length, 0);
});

test("cliente rechaza dos destinatarios, CC y BCC sin red", async () => {
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = async () => {
    networkAttempts += 1;
    throw new Error("network forbidden");
  };
  const client = new FetchNewsletterResendClient({ apiKey: API_KEY });
  const basePayload: NewsletterResendEmailPayload = {
    from: FROM,
    to: [RECIPIENT],
    replyTo: REPLY_TO,
    subject: "R4B",
    html: "<p>R4B</p>",
    text: "R4B",
  };
  try {
    for (const unsafe of [
      { ...basePayload, to: [RECIPIENT, "two@example.invalid"] },
      { ...basePayload, cc: "two@example.invalid" },
      { ...basePayload, bcc: "two@example.invalid" },
    ]) {
      assert.deepEqual(
        await client.sendEmail(unsafe as unknown as NewsletterResendEmailPayload),
        { status: "provider_error", httpStatus: null },
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(networkAttempts, 0);
});

class FlowRepository implements NewsletterRepository {
  confirmationHash: string | null = null;
  confirmationUsed = false;
  activeUnsubscribeHash: string | null = null;
  status: "pending" | "active" | "unsubscribed" = "pending";
  prepareCalls = 0;

  async requestSubscription(params: Parameters<NewsletterRepository["requestSubscription"]>[0]) {
    this.confirmationHash = params.tokenHash;
    return {
      outcome: "confirmation_required" as const,
      subscriberId: SUBSCRIBER_ID,
      tokenPurpose: "subscribe" as const,
    };
  }

  async confirmSubscription(tokenHash: string) {
    if (tokenHash !== this.confirmationHash) {
      return { outcome: "invalid_token" as const, subscriberId: null };
    }
    if (this.confirmationUsed) {
      return { outcome: "used_token" as const, subscriberId: null };
    }
    this.confirmationUsed = true;
    this.status = "active";
    return { outcome: "confirmed" as const, subscriberId: SUBSCRIBER_ID };
  }

  async prepareWelcomeDelivery(
    params: Parameters<NewsletterRepository["prepareWelcomeDelivery"]>[0],
  ): Promise<NewsletterWelcomeDeliveryContext> {
    this.prepareCalls += 1;
    this.activeUnsubscribeHash = params.tokenHash;
    return {
      subscriberId: SUBSCRIBER_ID,
      recipientEmail: RECIPIENT,
      provinceSlug: "madrid",
      regionSlug: null,
      locale: "es",
    };
  }

  async unsubscribeSubscriber() {
    return "not_found" as const;
  }

  async unsubscribeByToken(
    params: Parameters<NewsletterRepository["unsubscribeByToken"]>[0],
  ) {
    if (params.tokenHash !== this.activeUnsubscribeHash) {
      return "invalid_or_expired" as const;
    }
    if (this.status === "unsubscribed") return "already_unsubscribed" as const;
    this.status = "unsubscribed";
    return "unsubscribed" as const;
  }

  async recordProviderEvent() {
    return "recorded" as const;
  }
}

test("flujo controlado envía confirmación y una sola bienvenida, con baja idempotente", async () => {
  const client = new FakeResendClient();
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    now: () => new Date("2026-07-29T00:00:00.000Z"),
    async renderConfirmation(props) {
      return { html: props.confirmationUrl, text: props.confirmationUrl };
    },
    async renderWelcome(props) {
      return { html: props.unsubscribeUrl, text: props.unsubscribeUrl };
    },
  });
  const repository = new FlowRepository();
  const tokens = [CONFIRMATION_TOKEN, UNSUBSCRIBE_TOKEN];
  const service = createNewsletterService({
    mode: "test",
    repository,
    mailTransport: transport,
    tokenFactory: () => {
      const token = tokens.shift();
      if (!token) throw new Error("unexpected token request");
      return token;
    },
    tokenHasher: hashNewsletterToken,
    now: () => new Date("2026-07-29T00:00:00.000Z"),
  });

  const requested = await service.requestSubscription({
    email: RECIPIENT,
    provinceSlug: "madrid",
    source: "r4b_test",
    consentVersion: "2026-07",
  });
  assert.equal(requested.mailStatus, "accepted");
  assert.equal(client.calls.length, 1);

  const confirmed = await service.confirmSubscription({ token: CONFIRMATION_TOKEN });
  const repeated = await service.confirmSubscription({ token: CONFIRMATION_TOKEN });
  assert.equal(confirmed.decision, "confirmed");
  assert.equal(repeated.decision, "used_token");
  assert.equal(repository.prepareCalls, 1);
  assert.equal(client.calls.length, 2);

  const first = await service.unsubscribeByToken({
    token: UNSUBSCRIBE_TOKEN,
    source: "r4b_test",
    consentVersion: "2026-07",
  });
  const second = await service.unsubscribeByToken({
    token: UNSUBSCRIBE_TOKEN,
    source: "r4b_test",
    consentVersion: "2026-07",
  });
  assert.equal(first.decision, "unsubscribed");
  assert.equal(second.decision, "already_unsubscribed");
  assert.equal(client.calls.length, 2);
});

test("preview y endpoints sólo aceptan el origen R4B local exacto", () => {
  const r4b = {
    armed: NEWSLETTER_R4B_ARMED_VALUE,
    localOrigin: ORIGIN,
    requestUrl: `${ORIGIN}/preview/newsletter`,
    requestOrigin: ORIGIN,
    requestHost: "localhost:3000",
  };
  assert.equal(isNewsletterPreviewAvailable("test", undefined, "development", r4b), true);
  assert.equal(
    isNewsletterPreviewAvailable("test", "preview", "development", r4b),
    false,
  );
  assert.equal(
    isNewsletterPreviewAvailable("test", undefined, "development", {
      ...r4b,
      requestHost: "127.0.0.1:3000",
    }),
    false,
  );
  assert.deepEqual(
    evaluateNewsletterHttpGuard({
      mode: "test",
      nodeEnv: "development",
      r4bArmed: NEWSLETTER_R4B_ARMED_VALUE,
      r4bLocalOrigin: ORIGIN,
      requestUrl: `${ORIGIN}/api/newsletter/request`,
      origin: ORIGIN,
      host: "localhost:3000",
    }),
    { allowed: true, mode: "test" },
  );
  assert.equal(
    evaluateNewsletterHttpGuard({
      mode: "test",
      nodeEnv: "development",
      r4bArmed: NEWSLETTER_R4B_ARMED_VALUE,
      r4bLocalOrigin: ORIGIN,
      requestUrl: `${ORIGIN}/api/newsletter/request`,
      origin: "http://attacker.invalid",
      host: "localhost:3000",
    }).allowed,
    false,
  );
});

test("errores y logs no exponen API key, destinatario ni token", async () => {
  const client = new FakeResendClient();
  client.thrown = new Error(`${API_KEY} ${RECIPIENT} ${CONFIRMATION_TOKEN}`);
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    async renderConfirmation() {
      return { html: "safe", text: "safe" };
    },
  });
  const logs: unknown[][] = [];
  const originalError = console.error;
  const originalLog = console.log;
  console.error = (...args: unknown[]) => logs.push(args);
  console.log = (...args: unknown[]) => logs.push(args);
  let error: unknown;
  try {
    error = await transport.send({
      kind: "confirmation",
      recipientEmail: RECIPIENT,
      rawConfirmationToken: CONFIRMATION_TOKEN,
      purpose: "subscribe",
      expiresAt: "2026-07-30T00:00:00.000Z",
    }).catch((caught: unknown) => caught);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
  assert.ok(error instanceof NewsletterResendTransportError);
  assert.doesNotMatch(error.message, new RegExp(`${API_KEY}|${RECIPIENT}|${CONFIRMATION_TOKEN}`));
  assert.deepEqual(logs, []);
});

test("cliente aplica timeout, bloquea redirects y no reintenta", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: string; redirect: RequestRedirect | undefined }> = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input: String(input), redirect: init?.redirect });
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });
  }) as typeof fetch;
  try {
    const client = new FetchNewsletterResendClient({ apiKey: API_KEY, timeoutMs: 5 });
    const result = await client.sendEmail({
      from: FROM,
      to: [RECIPIENT],
      replyTo: REPLY_TO,
      subject: "R4B timeout",
      html: "<p>R4B timeout</p>",
      text: "R4B timeout",
    });
    assert.deepEqual(result, { status: "timeout" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls, [
    {
      input: "https://api.resend.com/emails",
      redirect: "error",
    },
  ]);
});

test("R4B conserva endpoint fijo, redirect bloqueado, timeout y cero retries", () => {
  const clientSource = readFileSync(
    join(process.cwd(), "lib/newsletter/resend-client.server.ts"),
    "utf8",
  );
  assert.match(clientSource, /https:\/\/api\.resend\.com/);
  assert.match(clientSource, /redirect: "error"/);
  assert.match(clientSource, /DEFAULT_RESEND_TIMEOUT_MS = 10_000/);
  assert.equal((clientSource.match(/globalThis\.fetch\(/g) ?? []).length, 1);
  assert.doesNotMatch(clientSource, /retry|redirect: "follow"/i);
});

test("variables R4B permanecen server-only y .env.example no contiene secretos", () => {
  const serverSource = [
    "lib/newsletter/resend-config.server.ts",
    "lib/newsletter/http.server.ts",
    "app/preview/newsletter/layout.tsx",
  ].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
  assert.match(serverSource, /NEWSLETTER_R4B_ARMED/);
  assert.match(serverSource, /NEWSLETTER_R4B_LOCAL_ORIGIN/);
  const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
  assert.match(example, /^NEWSLETTER_R4B_ARMED=$/m);
  assert.match(example, /^NEWSLETTER_R4B_LOCAL_ORIGIN=$/m);
  assert.doesNotMatch(example, /re_[A-Za-z0-9]{20,}|@eventomotor\.com/i);
});
