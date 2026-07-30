import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  createNewsletterHttpHandler,
  evaluateNewsletterHttpGuard,
  type NewsletterHttpRuntimeEnvironment,
} from "../../lib/newsletter/http.server";
import {
  type NewsletterResendClient,
  type NewsletterResendClientResult,
  type NewsletterResendEmailPayload,
} from "../../lib/newsletter/resend-client.server";
import {
  createNewsletterProductionCanaryResendRuntime,
  evaluateNewsletterProductionCanaryResendConfiguration,
  type NewsletterProductionCanaryResendEnvironment,
} from "../../lib/newsletter/resend-config.server";
import {
  NewsletterResendTransportError,
  ResendNewsletterMailTransport,
} from "../../lib/newsletter/resend-transport.server";
import {
  NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
  NEWSLETTER_PRODUCTION_CANARY_CANONICAL_ORIGIN,
  isNewsletterProductionCanaryPageRequestAllowed,
  parseNewsletterProductionCanaryOrigin,
} from "../../lib/newsletter/r5a-guard";
import { NEWSLETTER_R4B_ARMED_VALUE } from "../../lib/newsletter/r4b-guard";
import { hashNewsletterToken } from "../../lib/newsletter/crypto.server";
import { createNewsletterService } from "../../lib/newsletter/service.server";
import type {
  NewsletterMailCommand,
  NewsletterRepository,
  NewsletterWelcomeDeliveryContext,
} from "../../lib/newsletter/service-types";

const API_KEY = `re_canary_${"a".repeat(32)}`;
const FROM = "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
const REPLY_TO = "info@eventomotor.com";
const RECIPIENT = "authorized@example.invalid";
const SECOND_RECIPIENT = "second@example.invalid";
const ORIGIN = "https://www.eventomotor.com";
const SUBSCRIBER_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONFIRMATION_TOKEN = "C".repeat(43);
const UNSUBSCRIBE_TOKEN = "U".repeat(43);
const PROJECT_ROOT = process.cwd();

const BASE_ENVIRONMENT: NewsletterProductionCanaryResendEnvironment = {
  newsletterMode: "live",
  mailTransport: "resend",
  armed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
  canaryOrigin: ORIGIN,
  apiKey: API_KEY,
  from: FROM,
  replyTo: REPLY_TO,
  recipientAllowlist: RECIPIENT,
  nodeEnv: "production",
  vercel: "1",
  vercelEnv: "production",
};

class FakeResendClient implements NewsletterResendClient {
  readonly calls: NewsletterResendEmailPayload[] = [];
  result: NewsletterResendClientResult = {
    status: "accepted",
    providerMessageId: "fake-r5a-message",
  };
  thrown: Error | null = null;

  async sendEmail(payload: NewsletterResendEmailPayload) {
    this.calls.push(structuredClone(payload));
    if (this.thrown) throw this.thrown;
    return this.result;
  }
}

function source(path: string): string {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

function expectBlocked(
  overrides: Partial<NewsletterProductionCanaryResendEnvironment>,
  reason: string,
) {
  assert.deepEqual(
    evaluateNewsletterProductionCanaryResendConfiguration({
      ...BASE_ENVIRONMENT,
      ...overrides,
    }),
    { enabled: false, reason },
  );
}

test("el canario sólo se habilita con la matriz de producción completa", () => {
  const configuration =
    evaluateNewsletterProductionCanaryResendConfiguration(BASE_ENVIRONMENT);
  assert.equal(configuration.enabled, true);
  if (configuration.enabled) {
    assert.equal(configuration.canonicalEndpoint, ORIGIN);
    assert.deepEqual(configuration.allowedRecipients, [RECIPIENT]);
  }

  expectBlocked({ newsletterMode: "off" }, "mode_not_live");
  expectBlocked({ newsletterMode: "test" }, "mode_not_live");
  expectBlocked({ armed: undefined }, "canary_not_armed");
  expectBlocked({ armed: "yes" }, "canary_not_armed");
  expectBlocked({ vercel: undefined }, "vercel_required");
  expectBlocked(
    { vercelEnv: "preview" },
    "production_environment_required",
  );
  expectBlocked(
    { vercelEnv: "development" },
    "production_environment_required",
  );
  expectBlocked(
    { nodeEnv: "development" },
    "production_environment_required",
  );
  expectBlocked({ mailTransport: "disabled" }, "transport_not_selected");
});

test("el origen canario exige el origen HTTPS canónico exacto", () => {
  assert.equal(
    parseNewsletterProductionCanaryOrigin(ORIGIN)?.origin,
    NEWSLETTER_PRODUCTION_CANARY_CANONICAL_ORIGIN,
  );

  for (const canaryOrigin of [
    undefined,
    "",
    "http://www.eventomotor.com",
    "http://localhost:3000",
    "https://eventomotor.com",
    "https://preview.eventomotor.com",
    "https://www.eventomotor.com.evil.invalid",
    "https://user:password@www.eventomotor.com",
    "https://www.eventomotor.com/",
    "https://www.eventomotor.com/newsletter",
    "https://www.eventomotor.com?canary=1",
    "https://www.eventomotor.com#canary",
    " https://www.eventomotor.com",
  ]) {
    expectBlocked({ canaryOrigin }, "canary_endpoint_invalid");
  }
});

test("la allowlist canaria valida, normaliza y limita entre una y diez direcciones", () => {
  expectBlocked({ recipientAllowlist: "" }, "allowlist_invalid");
  expectBlocked({ recipientAllowlist: "not-an-email" }, "allowlist_invalid");
  expectBlocked(
    { recipientAllowlist: `${RECIPIENT}, AUTHORIZED@EXAMPLE.INVALID` },
    "allowlist_invalid",
  );
  expectBlocked(
    {
      recipientAllowlist: Array.from(
        { length: 11 },
        (_, index) => `canary-${index}@example.invalid`,
      ).join(","),
    },
    "allowlist_invalid",
  );

  const normalized = evaluateNewsletterProductionCanaryResendConfiguration({
    ...BASE_ENVIRONMENT,
    recipientAllowlist: "  AUTHORIZED@EXAMPLE.INVALID  ",
  });
  assert.equal(normalized.enabled, true);
  if (normalized.enabled) {
    assert.deepEqual(normalized.allowedRecipients, [RECIPIENT]);
  }

  const tenRecipients = evaluateNewsletterProductionCanaryResendConfiguration({
    ...BASE_ENVIRONMENT,
    recipientAllowlist: Array.from(
      { length: 10 },
      (_, index) => `canary-${index}@example.invalid`,
    ).join(","),
  });
  assert.equal(tenRecipients.enabled, true);
});

test("API key, remitente y Reply-To legales exactos son obligatorios", () => {
  expectBlocked({ apiKey: undefined }, "api_key_invalid");
  expectBlocked({ from: undefined }, "from_invalid");
  expectBlocked(
    { from: "EventoMotor <agenda@eventomotor.com>" },
    "from_invalid",
  );
  expectBlocked(
    { from: "EventoMotor <agenda@news.eventomotor.com.evil.invalid>" },
    "from_invalid",
  );
  expectBlocked(
    { from: "EventoMotor <agenda@news.eventomotor.com>" },
    "from_invalid",
  );
  expectBlocked({ replyTo: undefined }, "reply_to_invalid");
  expectBlocked({ replyTo: "newsletter@eventomotor.com" }, "reply_to_invalid");
});

test("la factoría R5A inyecta el cliente y configura el servicio en live sin red global", () => {
  const fakeClient = new FakeResendClient();
  let factoryCalls = 0;
  const runtime = createNewsletterProductionCanaryResendRuntime(
    BASE_ENVIRONMENT,
    (apiKey) => {
      factoryCalls += 1;
      assert.equal(apiKey, API_KEY);
      return fakeClient;
    },
  );

  assert.equal(runtime?.serviceMode, "live");
  assert.equal(runtime?.transport.availability, "ready");
  assert.equal(factoryCalls, 1);
  assert.equal(fakeClient.calls.length, 0);
});

test("confirmación y bienvenida usan exclusivamente las rutas públicas canarias", async () => {
  const client = new FakeResendClient();
  const rendered: string[] = [];
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    linkProfile: "production-canary",
    now: () => new Date("2026-07-29T00:00:00.000Z"),
    async renderConfirmation(props) {
      rendered.push(props.confirmationUrl);
      return { html: props.confirmationUrl, text: props.confirmationUrl };
    },
    async renderWelcome(props) {
      rendered.push(props.unsubscribeUrl);
      return { html: props.unsubscribeUrl, text: props.unsubscribeUrl };
    },
  });

  await transport.send({
    kind: "confirmation",
    recipientEmail: RECIPIENT,
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

  assert.deepEqual(rendered, [
    `${ORIGIN}/newsletter/confirm?token=${CONFIRMATION_TOKEN}`,
    `${ORIGIN}/newsletter/unsubscribe?token=${UNSUBSCRIBE_TOKEN}`,
  ]);
  assert.equal(client.calls.length, 2);
  assert.ok(
    client.calls.every(
      (call) =>
        call.to.length === 1 &&
        call.to[0] === RECIPIENT &&
        !("cc" in call) &&
        !("bcc" in call) &&
        !("tracking" in call),
    ),
  );
});

test("destinatarios no permitidos, múltiples, CC y BCC se bloquean antes de red", async () => {
  const client = new FakeResendClient();
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    linkProfile: "production-canary",
  });
  for (const recipientEmail of [
    SECOND_RECIPIENT,
    `${RECIPIENT},${SECOND_RECIPIENT}`,
    `${RECIPIENT};${SECOND_RECIPIENT}`,
  ]) {
    await assert.rejects(
      transport.send({
        kind: "confirmation",
        recipientEmail,
        rawConfirmationToken: CONFIRMATION_TOKEN,
        purpose: "subscribe",
        expiresAt: "2026-07-30T00:00:00.000Z",
      }),
      (error) =>
        error instanceof NewsletterResendTransportError &&
        error.category === "resend_recipient_not_allowed",
    );
  }
  assert.equal(client.calls.length, 0);

  const clientSource = source("lib/newsletter/resend-client.server.ts");
  assert.match(clientSource, /!Object\.hasOwn\(candidate, "cc"\)/);
  assert.match(clientSource, /!Object\.hasOwn\(candidate, "bcc"\)/);
});

test("agenda semanal y tipos desconocidos no son comandos transaccionales permitidos", async () => {
  const client = new FakeResendClient();
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    linkProfile: "production-canary",
  });

  for (const kind of ["weekly", "campaign", "arbitrary"]) {
    await assert.rejects(
      transport.send({
        kind,
        recipientEmail: RECIPIENT,
      } as unknown as NewsletterMailCommand),
      (error) =>
        error instanceof NewsletterResendTransportError &&
        error.category === "resend_configuration_invalid",
    );
  }
  assert.equal(client.calls.length, 0);
});

class CanaryFlowRepository implements NewsletterRepository {
  confirmationHash: string | null = null;
  confirmationUsed = false;
  activeUnsubscribeHash: string | null = null;
  status: "pending" | "active" | "unsubscribed" = "pending";
  requestCalls = 0;
  prepareCalls = 0;

  async requestSubscription(
    params: Parameters<NewsletterRepository["requestSubscription"]>[0],
  ) {
    this.requestCalls += 1;
    if (this.status === "active") {
      return {
        outcome: "already_active" as const,
        subscriberId: null,
        tokenPurpose: null,
      };
    }
    if (this.requestCalls > 1) {
      return {
        outcome: "cooldown" as const,
        subscriberId: null,
        tokenPurpose: null,
      };
    }
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
    if (this.status === "unsubscribed") {
      return "already_unsubscribed" as const;
    }
    this.status = "unsubscribed";
    return "unsubscribed" as const;
  }

  async recordProviderEvent() {
    return "recorded" as const;
  }

  async checkDeliveryEligibility() {
    return "allowed" as const;
  }

  async registerOutboundDelivery() {
    return "recorded" as const;
  }
}

test("cooldown, confirmación repetida y baja repetida no duplican entregas", async () => {
  const client = new FakeResendClient();
  const repository = new CanaryFlowRepository();
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    linkProfile: "production-canary",
    now: () => new Date("2026-07-29T00:00:00.000Z"),
    async renderConfirmation(props) {
      return { html: props.confirmationUrl, text: props.confirmationUrl };
    },
    async renderWelcome(props) {
      return { html: props.unsubscribeUrl, text: props.unsubscribeUrl };
    },
  });
  const tokens = [
    CONFIRMATION_TOKEN,
    "R".repeat(43),
    UNSUBSCRIBE_TOKEN,
    "A".repeat(43),
  ];
  const service = createNewsletterService({
    mode: "live",
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
  const request = {
    email: RECIPIENT,
    provinceSlug: "madrid",
    source: "r5a_test",
    consentVersion: "2026-07",
  };

  const firstRequest = await service.requestSubscription(request);
  const repeatedRequest = await service.requestSubscription(request);
  assert.equal(firstRequest.mailStatus, "accepted");
  assert.equal(repeatedRequest.decision, "cooldown");
  assert.equal(repeatedRequest.mailStatus, "not_required");
  assert.equal(client.calls.length, 1);

  const confirmed = await service.confirmSubscription({
    token: CONFIRMATION_TOKEN,
  });
  const repeatedConfirmation = await service.confirmSubscription({
    token: CONFIRMATION_TOKEN,
  });
  assert.equal(confirmed.decision, "confirmed");
  assert.equal(repeatedConfirmation.decision, "used_token");
  assert.equal(repository.prepareCalls, 1);
  assert.equal(client.calls.length, 2);

  const activeRequest = await service.requestSubscription(request);
  assert.equal(activeRequest.decision, "already_active");
  assert.equal(activeRequest.mailStatus, "not_required");
  assert.equal(client.calls.length, 2);

  const firstUnsubscribe = await service.unsubscribeByToken({
    token: UNSUBSCRIBE_TOKEN,
    source: "r5a_test",
    consentVersion: "2026-07",
  });
  const repeatedUnsubscribe = await service.unsubscribeByToken({
    token: UNSUBSCRIBE_TOKEN,
    source: "r5a_test",
    consentVersion: "2026-07",
  });
  assert.equal(firstUnsubscribe.decision, "unsubscribed");
  assert.equal(repeatedUnsubscribe.decision, "already_unsubscribed");
  assert.equal(client.calls.length, 2);

  const migration = source(
    "database/migrations/20260721133000_newsletter_core_foundation.sql",
  );
  assert.match(
    migration,
    /last_confirmation_requested_at > v_now - interval '15 minutes'/,
  );
  assert.match(migration, /for update/);
});

function liveHttpEnvironment(): NewsletterHttpRuntimeEnvironment {
  return {
    mode: "live",
    mailTransport: "resend",
    apiKey: API_KEY,
    from: FROM,
    replyTo: REPLY_TO,
    recipientAllowlist: RECIPIENT,
    armed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
    canaryOrigin: ORIGIN,
    nodeEnv: "production",
    vercel: "1",
    vercelEnv: "production",
  };
}

test("el guard HTTP live exige host y Origin canónicos y bloquea Preview", () => {
  const pageConfiguration =
    evaluateNewsletterProductionCanaryResendConfiguration(BASE_ENVIRONMENT);
  assert.equal(
    isNewsletterProductionCanaryPageRequestAllowed(
      pageConfiguration,
      "www.eventomotor.com",
      "https",
    ),
    true,
  );
  assert.equal(
    isNewsletterProductionCanaryPageRequestAllowed(
      pageConfiguration,
      "eventomotor.com",
      "https",
    ),
    false,
  );
  assert.equal(
    isNewsletterProductionCanaryPageRequestAllowed(
      pageConfiguration,
      "www.eventomotor.com",
      "http",
    ),
    false,
  );

  const allowed = evaluateNewsletterHttpGuard({
    ...liveHttpEnvironment(),
    requestUrl: `${ORIGIN}/api/newsletter/request`,
    origin: ORIGIN,
    host: "www.eventomotor.com",
  });
  assert.equal(allowed.allowed, true);
  if (allowed.allowed) assert.equal(allowed.mode, "live");

  for (const input of [
    { origin: null, host: "www.eventomotor.com" },
    { origin: "https://attacker.invalid", host: "www.eventomotor.com" },
    { origin: ORIGIN, host: "eventomotor.com" },
  ]) {
    assert.equal(
      evaluateNewsletterHttpGuard({
        ...liveHttpEnvironment(),
        requestUrl: `${ORIGIN}/api/newsletter/request`,
        ...input,
      }).allowed,
      false,
    );
  }
  assert.equal(
    evaluateNewsletterHttpGuard({
      ...liveHttpEnvironment(),
      vercelEnv: "preview",
      requestUrl:
        "https://branch.example.vercel.app/api/newsletter/request",
      origin: "https://branch.example.vercel.app",
      host: "branch.example.vercel.app",
    }).allowed,
    false,
  );
});

test("alta fuera de allowlist devuelve la misma respuesta neutral sin servicio ni red", async () => {
  let serviceCreations = 0;
  const handler = createNewsletterHttpHandler("request", {
    environment: liveHttpEnvironment,
    createService() {
      serviceCreations += 1;
      throw new Error("service must not be created");
    },
  });
  const response = await handler(
    new Request(`${ORIGIN}/api/newsletter/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Host: "www.eventomotor.com",
      },
      body: JSON.stringify({
        email: SECOND_RECIPIENT,
        province: "madrid",
        consentVersion: "2026-07",
      }),
    }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, status: "accepted" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(serviceCreations, 0);
});

test("canario apagado responde 404 y no crea el servicio", async () => {
  let serviceCreations = 0;
  const handler = createNewsletterHttpHandler("request", {
    environment: () => ({
      ...liveHttpEnvironment(),
      mode: "off",
    }),
    createService() {
      serviceCreations += 1;
      throw new Error("service must not be created");
    },
  });
  const response = await handler(
    new Request(`${ORIGIN}/api/newsletter/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Host: "www.eventomotor.com",
      },
      body: "{}",
    }),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: "not_found" });
  assert.equal(serviceCreations, 0);
});

test("las rutas R5A reutilizan R4C, son noindex/no-store y GET no muta", () => {
  const layout = source("app/newsletter/layout.tsx");
  const page = source("app/newsletter/page.tsx");
  const confirmation = source("app/newsletter/confirm/page.tsx");
  const unsubscribe = source("app/newsletter/unsubscribe/page.tsx");
  const tokenAction = source(
    "components/newsletter/NewsletterTokenAction.tsx",
  );
  const routes = ["request", "confirm", "unsubscribe"].map((operation) =>
    source(`app/api/newsletter/${operation}/route.ts`),
  );

  assert.match(layout, /evaluateNewsletterProductionCanaryResendConfiguration/);
  assert.match(layout, /notFound\(\)/);
  assert.match(layout, /await connection\(\)/);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
  assert.match(page, /NewsletterPreviewPage/);
  assert.match(
    page,
    /experience=\{publicConfiguration\.enabled \? "public" : "production-canary"\}/,
  );
  assert.match(confirmation, /kind="confirm"/);
  assert.match(unsubscribe, /kind="unsubscribe"/);
  assert.match(tokenAction, /cleanVisibleTokenUrl\(\)/);
  assert.doesNotMatch(
    tokenAction.slice(
      tokenAction.indexOf("useEffect(() => {"),
      tokenAction.indexOf("}, [kind]);"),
    ),
    /confirmNewsletterSubscription\(|unsubscribeNewsletterSubscription\(/,
  );
  for (const route of routes) {
    assert.match(route, /export const POST/);
    assert.doesNotMatch(route, /export const GET/);
  }
  assert.doesNotMatch(source("app/sitemap.ts"), /newsletter/);
});

test("R4B local sigue aislado y sus enlaces conservan /preview/newsletter", async () => {
  const client = new FakeResendClient();
  let renderedUrl = "";
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: "http://localhost:3000",
    async renderConfirmation(props) {
      renderedUrl = props.confirmationUrl;
      return { html: props.confirmationUrl, text: props.confirmationUrl };
    },
  });
  await transport.send({
    kind: "confirmation",
    recipientEmail: RECIPIENT,
    rawConfirmationToken: CONFIRMATION_TOKEN,
    purpose: "subscribe",
    expiresAt: "2026-07-30T00:00:00.000Z",
  });
  assert.equal(
    renderedUrl,
    `http://localhost:3000/preview/newsletter/confirm?token=${CONFIRMATION_TOKEN}`,
  );
  assert.equal(NEWSLETTER_R4B_ARMED_VALUE, "local-one-recipient");
});

test("errores R5A no registran API key, email ni token y no reintentan", async () => {
  const client = new FakeResendClient();
  client.thrown = new Error(`${API_KEY} ${RECIPIENT} ${CONFIRMATION_TOKEN}`);
  const transport = new ResendNewsletterMailTransport({
    client,
    from: FROM,
    replyTo: REPLY_TO,
    allowedRecipients: [RECIPIENT],
    linkOrigin: ORIGIN,
    linkProfile: "production-canary",
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
    error = await transport
      .send({
        kind: "confirmation",
        recipientEmail: RECIPIENT,
        rawConfirmationToken: CONFIRMATION_TOKEN,
        purpose: "subscribe",
        expiresAt: "2026-07-30T00:00:00.000Z",
      })
      .catch((caught: unknown) => caught);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
  assert.ok(error instanceof NewsletterResendTransportError);
  assert.doesNotMatch(
    error.message,
    new RegExp(`${API_KEY}|${RECIPIENT}|${CONFIRMATION_TOKEN}`),
  );
  assert.deepEqual(logs, []);
  assert.equal(client.calls.length, 1);

  const clientSource = source("lib/newsletter/resend-client.server.ts");
  assert.match(clientSource, /DEFAULT_RESEND_TIMEOUT_MS = 10_000/);
  assert.match(clientSource, /redirect: "error"/);
  assert.equal((clientSource.match(/globalThis\.fetch\(/g) ?? []).length, 1);
  assert.doesNotMatch(clientSource, /retry|redirect: "follow"/i);
});

test("variables R5A son server-only y el ejemplo no contiene valores reales", () => {
  const serverSource = [
    "lib/newsletter/http.server.ts",
    "lib/newsletter/resend-config.server.ts",
    "app/newsletter/layout.tsx",
  ]
    .map(source)
    .join("\n");
  for (const variable of [
    "NEWSLETTER_PRODUCTION_CANARY_ARMED",
    "NEWSLETTER_PRODUCTION_CANARY_ORIGIN",
    "NEWSLETTER_PRODUCTION_CANARY_ALLOWLIST",
  ]) {
    assert.match(serverSource, new RegExp(variable));
    assert.match(source(".env.example"), new RegExp(`^${variable}=$`, "m"));
  }
  assert.doesNotMatch(
    source(".env.example"),
    /production-double-opt-in-canary|re_[A-Za-z0-9]{20,}|^NEWSLETTER_RESEND_FROM=.+$/m,
  );
});
