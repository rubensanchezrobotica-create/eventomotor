import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createNewsletterHttpHandler } from "../../lib/newsletter/http.server";
import {
  maskNewsletterRecipient,
  NewsletterMailCaptureStoreError,
  type NewsletterMailCapture,
  type NewsletterMailCaptureStore,
  type NewsletterMailCaptureSummary,
} from "../../lib/newsletter/mail-capture-store.server";
import { CaptureNewsletterMailTransport } from "../../lib/newsletter/mail-capture-transport.server";
import { hashNewsletterToken } from "../../lib/newsletter/crypto.server";
import { createNewsletterService } from "../../lib/newsletter/service.server";
import {
  NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
  type NewsletterRepository,
  type NewsletterWelcomeDeliveryContext,
} from "../../lib/newsletter/service-types";

const ORIGIN = "http://localhost:3000";
const SUBSCRIBER_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONFIRMATION_TOKEN = "C".repeat(43);
const UNSUBSCRIBE_TOKEN = "U".repeat(43);
const ROTATED_TOKEN = "R".repeat(43);
const NOW = new Date("2026-07-28T15:00:00.000Z");
const RECIPIENT = "internal-flow@example.invalid";

class MemoryCaptureStore implements NewsletterMailCaptureStore {
  readonly captures: NewsletterMailCapture[] = [];
  failSave = false;

  async save(capture: NewsletterMailCapture): Promise<void> {
    if (this.failSave) throw new NewsletterMailCaptureStoreError("storage_failure");
    this.captures.push(structuredClone(capture));
  }

  async list(): Promise<NewsletterMailCaptureSummary[]> {
    return this.captures.map((capture) => ({
      id: capture.id,
      mailType: capture.mailType,
      subject: capture.subject,
      capturedAt: capture.capturedAt,
      status: capture.status,
      maskedRecipient: maskNewsletterRecipient(capture.recipientEmail),
    }));
  }

  async get(id: string): Promise<NewsletterMailCapture | null> {
    return this.captures.find((capture) => capture.id === id) ?? null;
  }
}

class FlowRepository implements NewsletterRepository {
  status: "pending" | "active" | "unsubscribed" = "pending";
  confirmationHash: string | null = null;
  confirmationUsed = false;
  activeUnsubscribeHash: string | null = null;
  previousUnsubscribeHashes = new Set<string>();
  prepareCalls = 0;
  unsubscribeCalls = 0;
  failPreparation = false;

  async requestSubscription(params: Parameters<NewsletterRepository["requestSubscription"]>[0]) {
    if (this.status === "active") {
      return { outcome: "already_active" as const, subscriberId: null, tokenPurpose: null };
    }
    if (this.confirmationHash && !this.confirmationUsed) {
      return { outcome: "cooldown" as const, subscriberId: null, tokenPurpose: null };
    }
    this.confirmationHash = params.tokenHash;
    this.confirmationUsed = false;
    return {
      outcome: "confirmation_required" as const,
      subscriberId: SUBSCRIBER_ID,
      tokenPurpose: this.status === "unsubscribed" ? "resubscribe" as const : "subscribe" as const,
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
    if (this.failPreparation || this.status !== "active") throw new Error("safe failure");
    if (this.activeUnsubscribeHash) {
      this.previousUnsubscribeHashes.add(this.activeUnsubscribeHash);
    }
    this.activeUnsubscribeHash = params.tokenHash;
    assert.equal(params.expiresAt, null);
    return {
      subscriberId: SUBSCRIBER_ID,
      recipientEmail: RECIPIENT,
      provinceSlug: "barcelona",
      regionSlug: "cataluna",
      locale: "es",
    };
  }

  async unsubscribeSubscriber() {
    if (this.status === "unsubscribed") return "already_unsubscribed" as const;
    this.status = "unsubscribed";
    return "unsubscribed" as const;
  }

  async unsubscribeByToken(
    params: Parameters<NewsletterRepository["unsubscribeByToken"]>[0],
  ) {
    this.unsubscribeCalls += 1;
    if (
      params.tokenHash !== this.activeUnsubscribeHash ||
      this.previousUnsubscribeHashes.has(params.tokenHash)
    ) {
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

function tokenFromMessage(message: NewsletterMailCapture, path: string): string {
  const match = message.html.match(new RegExp(`${path.replaceAll("/", "\\/")}\\?token=([^"&<]+)`));
  assert.ok(match?.[1]);
  return decodeURIComponent(match[1]);
}

function captureTransport(
  store: NewsletterMailCaptureStore,
  options: {
    failWelcomeRender?: boolean;
  } = {},
) {
  let captureNumber = 0;
  return new CaptureNewsletterMailTransport({
    store,
    origin: ORIGIN,
    now: () => new Date(NOW.getTime() + captureNumber * 1_000),
    idFactory: () => {
      captureNumber += 1;
      return captureNumber === 1
        ? "11111111-1111-4111-8111-111111111111"
        : "22222222-2222-4222-8222-222222222222";
    },
    async renderConfirmation(props) {
      return {
        html: `<a href="${props.confirmationUrl}">Confirmar</a>`,
        text: `Confirmar: ${props.confirmationUrl}`,
      };
    },
    async renderWelcome(props) {
      if (options.failWelcomeRender) throw new Error("safe render failure");
      return {
        html: `<a href="${props.eventsUrl}">Eventos</a><a href="${props.unsubscribeUrl}">Baja</a>`,
        text: `Eventos: ${props.eventsUrl}\nBaja: ${props.unsubscribeUrl}`,
      };
    },
  });
}

function sequenceFactory(tokens: string[]) {
  let index = 0;
  return () => {
    const token = tokens[index];
    index += 1;
    if (!token) throw new Error("unexpected token request");
    return token;
  };
}

function createFlowService(
  repository: FlowRepository,
  store: NewsletterMailCaptureStore,
  tokens = [CONFIRMATION_TOKEN, UNSUBSCRIBE_TOKEN],
  transportOptions: { failWelcomeRender?: boolean } = {},
) {
  return createNewsletterService({
    mode: "test",
    repository,
    mailTransport: captureTransport(store, transportOptions),
    now: () => NOW,
    tokenFactory: sequenceFactory(tokens),
    tokenHasher: hashNewsletterToken,
  });
}

test("flujo interno completa solicitud, confirmación, bienvenida y baja idempotente", async () => {
  const repository = new FlowRepository();
  const store = new MemoryCaptureStore();
  const service = createFlowService(repository, store);

  const request = await service.requestSubscription({
    email: RECIPIENT,
    provinceSlug: "barcelona",
    regionSlug: "cataluna",
    source: "r3b4_test",
    consentVersion: "2026-07",
    sourcePath: "/preview/newsletter",
  });
  assert.equal(request.decision, "confirmation_required");
  assert.equal(request.mailStatus, "accepted");
  assert.equal(store.captures.length, 1);
  const confirmationToken = tokenFromMessage(
    store.captures[0],
    "/preview/newsletter/confirm",
  );

  const confirmation = await service.confirmSubscription({ token: confirmationToken });
  assert.equal(confirmation.decision, "confirmed");
  assert.equal(confirmation.mailStatus, "accepted");
  assert.deepEqual(store.captures.map(({ mailType }) => mailType), ["confirmation", "welcome"]);
  assert.ok(store.captures.every(({ recipientEmail }) => recipientEmail === RECIPIENT));

  const welcome = store.captures[1];
  const unsubscribeToken = tokenFromMessage(welcome, "/preview/newsletter/unsubscribe");
  const unsubscribeUrl = `${ORIGIN}/preview/newsletter/unsubscribe?token=${unsubscribeToken}`;
  assert.match(welcome.html, new RegExp(unsubscribeUrl.replace(/[?]/g, "\\?")));
  assert.match(welcome.text, new RegExp(unsubscribeUrl.replace(/[?]/g, "\\?")));
  assert.doesNotMatch(unsubscribeUrl, /example\.invalid|123e4567|[0-9a-f]{64}/i);
  assert.doesNotMatch(JSON.stringify(welcome.metadata), new RegExp(unsubscribeToken));

  const firstUnsubscribe = await service.unsubscribeByToken({
    token: unsubscribeToken,
    source: "r3b4_test",
    consentVersion: "2026-07",
    sourcePath: "/api/newsletter/unsubscribe",
  });
  const repeatedUnsubscribe = await service.unsubscribeByToken({
    token: unsubscribeToken,
    source: "r3b4_test",
    consentVersion: "2026-07",
    sourcePath: "/api/newsletter/unsubscribe",
  });
  assert.equal(firstUnsubscribe.decision, "unsubscribed");
  assert.equal(repeatedUnsubscribe.decision, "already_unsubscribed");
  assert.equal(repository.status, "unsubscribed");
  assert.equal(repository.unsubscribeCalls, 2);
  assert.equal(store.captures.length, 2);
  assert.equal(store.captures.some(({ mailType }) => mailType === "weekly"), false);
});

test("cooldown, active y used_token no duplican correos", async () => {
  const repository = new FlowRepository();
  const store = new MemoryCaptureStore();
  const service = createFlowService(repository, store, [
    CONFIRMATION_TOKEN,
    CONFIRMATION_TOKEN,
    UNSUBSCRIBE_TOKEN,
    CONFIRMATION_TOKEN,
  ]);
  const input = {
    email: RECIPIENT,
    provinceSlug: "barcelona",
    source: "r3b4_test",
    consentVersion: "2026-07",
  } as const;

  await service.requestSubscription(input);
  const cooldown = await service.requestSubscription(input);
  assert.equal(cooldown.decision, "cooldown");
  assert.equal(store.captures.length, 1);
  await service.confirmSubscription({ token: CONFIRMATION_TOKEN });
  const active = await service.requestSubscription(input);
  const repeated = await service.confirmSubscription({ token: CONFIRMATION_TOKEN });
  assert.equal(active.decision, "already_active");
  assert.equal(repeated.decision, "used_token");
  assert.equal(repository.prepareCalls, 1);
  assert.deepEqual(store.captures.map(({ mailType }) => mailType), ["confirmation", "welcome"]);
});

test("dos confirmaciones concurrentes producen una sola bienvenida", async () => {
  const repository = new FlowRepository();
  repository.confirmationHash = hashNewsletterToken(CONFIRMATION_TOKEN);
  const store = new MemoryCaptureStore();
  const service = createFlowService(repository, store, [UNSUBSCRIBE_TOKEN]);

  const results = await Promise.all([
    service.confirmSubscription({ token: CONFIRMATION_TOKEN }),
    service.confirmSubscription({ token: CONFIRMATION_TOKEN }),
  ]);
  assert.deepEqual(results.map(({ decision }) => decision).sort(), ["confirmed", "used_token"]);
  assert.equal(repository.prepareCalls, 1);
  assert.equal(store.captures.length, 1);
  assert.equal(store.captures[0]?.mailType, "welcome");
});

test("rotación invalida el enlace anterior sin almacenar el token raw", async () => {
  const repository = new FlowRepository();
  repository.status = "active";
  await repository.prepareWelcomeDelivery({
    subscriberId: SUBSCRIBER_ID,
    tokenHash: hashNewsletterToken(UNSUBSCRIBE_TOKEN),
    expiresAt: null,
  });
  await repository.prepareWelcomeDelivery({
    subscriberId: SUBSCRIBER_ID,
    tokenHash: hashNewsletterToken(ROTATED_TOKEN),
    expiresAt: null,
  });

  assert.equal(
    await repository.unsubscribeByToken({
      tokenHash: hashNewsletterToken(UNSUBSCRIBE_TOKEN),
      source: "r3b4_test",
      consentVersion: "2026-07",
      sourcePath: null,
      ipHash: null,
    }),
    "invalid_or_expired",
  );
  assert.equal(repository.activeUnsubscribeHash, hashNewsletterToken(ROTATED_TOKEN));
  assert.notEqual(repository.activeUnsubscribeHash, ROTATED_TOKEN);
});

test("fallo de preparación conserva confirmed y no intenta transporte", async () => {
  const repository = new FlowRepository();
  repository.confirmationHash = hashNewsletterToken(CONFIRMATION_TOKEN);
  repository.failPreparation = true;
  const store = new MemoryCaptureStore();
  const service = createFlowService(repository, store, [UNSUBSCRIBE_TOKEN]);

  const result = await service.confirmSubscription({ token: CONFIRMATION_TOKEN });
  assert.equal(result.decision, "confirmed");
  assert.equal(result.mailStatus, "failed");
  assert.equal(result.internalErrorCategory, "persistence_error");
  assert.equal(repository.status, "active");
  assert.equal(repository.prepareCalls, 1);
  assert.equal(store.captures.length, 0);
});

for (const [label, setup] of [
  ["render", { failWelcomeRender: true, failStore: false }],
  ["store", { failWelcomeRender: false, failStore: true }],
] as const) {
  test(`fallo de ${label} conserva confirmed, no captura parcial y no reintenta`, async () => {
    const repository = new FlowRepository();
    repository.confirmationHash = hashNewsletterToken(CONFIRMATION_TOKEN);
    const store = new MemoryCaptureStore();
    store.failSave = setup.failStore;
    const service = createFlowService(
      repository,
      store,
      [UNSUBSCRIBE_TOKEN],
      { failWelcomeRender: setup.failWelcomeRender },
    );

    const result = await service.confirmSubscription({ token: CONFIRMATION_TOKEN });
    assert.equal(result.decision, "confirmed");
    assert.equal(result.mailStatus, "failed");
    assert.equal(result.internalErrorCategory, "provider_error");
    assert.equal(repository.status, "active");
    assert.equal(repository.prepareCalls, 1);
    assert.equal(store.captures.length, 0);
  });
}

test("endpoint runtime hashea el token y no acepta email o UUID", async () => {
  const received: string[] = [];
  const repository = new FlowRepository();
  repository.status = "active";
  repository.activeUnsubscribeHash = hashNewsletterToken(UNSUBSCRIBE_TOKEN);
  const service = createNewsletterService({
    mode: "test",
    repository,
    mailTransport: captureTransport(new MemoryCaptureStore()),
    tokenHasher(token) {
      received.push(token);
      return hashNewsletterToken(token);
    },
  });
  const handler = createNewsletterHttpHandler("unsubscribe", {
    environment: () => ({ mode: "test", nodeEnv: "test" }),
    createService: () => service,
  });
  const response = await handler(new Request(`${ORIGIN}/api/newsletter/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: UNSUBSCRIBE_TOKEN }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, status: "unsubscribed" });
  assert.deepEqual(received, [UNSUBSCRIBE_TOKEN]);

  const rejected = await handler(new Request(`${ORIGIN}/api/newsletter/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: RECIPIENT, subscriberId: SUBSCRIBER_ID }),
  }));
  assert.equal(rejected.status, 400);
});

test("el núcleo compartido no introduce SMTP, red directa o datos sensibles en logs", () => {
  const files = [
    "lib/newsletter/service.server.ts",
    "lib/newsletter/repository.server.ts",
    "lib/newsletter/mail-capture-transport.server.tsx",
    "database/migrations/20260721133000_newsletter_core_foundation.sql",
  ];
  const source = files.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
  const prohibitedCampaign = ["ba", "ñe", "za"].join("");
  assert.doesNotMatch(source, new RegExp(`smtp|fetch\\(|\\.env\\.local|${prohibitedCampaign}`, "i"));
  assert.doesNotMatch(source, /app[\\/]newsletter/);
  assert.match(source, /server-only/);
  assert.deepEqual(NEWSLETTER_PUBLIC_MUTATION_RESPONSE, {
    message: "Si la solicitud es válida, recibirás los próximos pasos por correo.",
  });
});
