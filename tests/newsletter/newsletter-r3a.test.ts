import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  NullNewsletterMailTransport,
  type NewsletterMailTransport,
} from "../../lib/newsletter/mail-transport.server";
import {
  createNewsletterRepository,
  type NewsletterRpcGateway,
} from "../../lib/newsletter/repository.server";
import {
  NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
  NewsletterOperationError,
  type NewsletterMailCommand,
  type NewsletterRepository,
  type NewsletterRequestRepositoryParams,
} from "../../lib/newsletter/service-types";
import { createNewsletterService } from "../../lib/newsletter/service.server";

const SUBSCRIBER_ID = "123e4567-e89b-42d3-a456-426614174000";
const RAW_TOKEN = "A".repeat(43);
const TOKEN_HASH = "b".repeat(64);
const NOW = new Date("2026-07-21T12:00:00.000Z");
const REQUEST_INPUT = {
  email: " Person+motor@Example.COM ",
  source: "newsletter_preview",
  consentVersion: "2026-07",
  sourcePath: "/preview/newsletter",
} as const;

class CaptureNewsletterMailTransport implements NewsletterMailTransport {
  readonly availability = "ready" as const;
  readonly commands: NewsletterMailCommand[] = [];

  async send(command: NewsletterMailCommand) {
    this.commands.push(command);
    return { status: "accepted" as const };
  }
}

class CountingNullNewsletterMailTransport extends NullNewsletterMailTransport {
  calls = 0;

  override async send(command: NewsletterMailCommand) {
    this.calls += 1;
    return super.send(command);
  }
}

function createRepository(
  overrides: Partial<NewsletterRepository> = {},
): NewsletterRepository {
  return {
    async requestSubscription() {
      return {
        outcome: "confirmation_required",
        subscriberId: SUBSCRIBER_ID,
        tokenPurpose: "subscribe",
      };
    },
    async confirmSubscription() {
      return { outcome: "confirmed", subscriberId: SUBSCRIBER_ID };
    },
    async prepareWelcomeDelivery() {
      return {
        subscriberId: SUBSCRIBER_ID,
        recipientEmail: "person+motor@example.com",
        provinceSlug: "madrid",
        regionSlug: null,
        locale: "es",
      };
    },
    async unsubscribeSubscriber() {
      return "unsubscribed";
    },
    async unsubscribeByToken() {
      return "unsubscribed";
    },
    async recordProviderEvent() {
      return "recorded";
    },
    ...overrides,
  };
}

function createTestService(options: {
  repository?: NewsletterRepository | null;
  transport?: NewsletterMailTransport;
  tokenFactory?: () => string;
} = {}) {
  return createNewsletterService({
    mode: "test",
    repository: options.repository === undefined ? createRepository() : options.repository,
    mailTransport: options.transport ?? new CaptureNewsletterMailTransport(),
    now: () => NOW,
    tokenFactory: options.tokenFactory ?? (() => RAW_TOKEN),
    tokenHasher: () => TOKEN_HASH,
  });
}

test("Capture transport se acepta en test, se invoca una vez y recibe sólo el token raw", async () => {
  const repositoryCalls: NewsletterRequestRepositoryParams[] = [];
  const transport = new CaptureNewsletterMailTransport();
  const service = createTestService({
    transport,
    repository: createRepository({
      async requestSubscription(params) {
        repositoryCalls.push(params);
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "subscribe",
        };
      },
    }),
  });

  const result = await service.requestSubscription(REQUEST_INPUT);

  assert.equal(result.decision, "confirmation_required");
  assert.equal(result.mailStatus, "accepted");
  assert.deepEqual(result.publicResponse, NEWSLETTER_PUBLIC_MUTATION_RESPONSE);
  assert.equal("accepted" in result.publicResponse, false);
  assert.equal(repositoryCalls.length, 1);
  const repositoryParams = repositoryCalls[0];
  assert.ok(repositoryParams);
  assert.equal(repositoryParams.emailNormalized, "person+motor@example.com");
  assert.equal(repositoryParams.tokenHash, TOKEN_HASH);
  assert.doesNotMatch(JSON.stringify(repositoryParams), new RegExp(RAW_TOKEN));
  assert.equal(transport.commands.length, 1);
  assert.deepEqual(transport.commands[0], {
    kind: "confirmation",
    recipientEmail: "person+motor@example.com",
    rawConfirmationToken: RAW_TOKEN,
    purpose: "subscribe",
    expiresAt: "2026-07-22T12:00:00.000Z",
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(RAW_TOKEN));
});

test("fallo de confirmación por transporte devuelve provider_error sin PII ni segundo intento", async () => {
  let repositoryCalls = 0;
  let transportCalls = 0;
  const transport: NewsletterMailTransport = {
    availability: "ready",
    async send(command) {
      transportCalls += 1;
      if (command.kind === "confirmation") {
        throw new Error(
          `test-only transport failure ${command.recipientEmail} ${command.rawConfirmationToken}`,
        );
      }
      throw new Error("unexpected command");
    },
  };
  const service = createTestService({
    transport,
    repository: createRepository({
      async requestSubscription() {
        repositoryCalls += 1;
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "subscribe",
        };
      },
    }),
  });

  const result = await service.requestSubscription(REQUEST_INPUT);

  assert.equal(repositoryCalls, 1);
  assert.equal(transportCalls, 1);
  assert.equal(result.decision, "confirmation_required");
  assert.equal(result.mailStatus, "failed");
  assert.equal(result.internalErrorCategory, "provider_error");
  assert.deepEqual(result.publicResponse, NEWSLETTER_PUBLIC_MUTATION_RESPONSE);
  assert.equal("accepted" in result.publicResponse, false);
  const serializedResult = JSON.stringify(result);
  assert.doesNotMatch(serializedResult, /person\+motor@example\.com/i);
  assert.doesNotMatch(serializedResult, new RegExp(RAW_TOKEN));
  assert.doesNotMatch(serializedResult, new RegExp(SUBSCRIBER_ID));
});

test("request activa no prepara correo y conserva la respuesta pública genérica", async () => {
  const transport = new CaptureNewsletterMailTransport();
  const service = createTestService({
    transport,
    repository: createRepository({
      async requestSubscription() {
        return { outcome: "already_active", subscriberId: null, tokenPurpose: null };
      },
    }),
  });

  const result = await service.requestSubscription(REQUEST_INPUT);
  assert.equal(result.decision, "already_active");
  assert.equal(result.mailStatus, "not_required");
  assert.deepEqual(result.publicResponse, NEWSLETTER_PUBLIC_MUTATION_RESPONSE);
  assert.equal(transport.commands.length, 0);
});

test("cooldown, límite y estados bloqueados no son enumerables públicamente", async () => {
  const publicResponses = [];
  for (const outcome of ["cooldown", "daily_limit", "blocked"] as const) {
    const service = createTestService({
      repository: createRepository({
        async requestSubscription() {
          return { outcome, subscriberId: null, tokenPurpose: null };
        },
      }),
    });
    const result = await service.requestSubscription(REQUEST_INPUT);
    publicResponses.push(result.publicResponse);
    assert.equal(result.mailStatus, "not_required");
  }
  assert.deepEqual(publicResponses, [
    NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
    NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
    NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
  ]);
});

test("resuscripción entrega propósito resubscribe al único comando capturado", async () => {
  const transport = new CaptureNewsletterMailTransport();
  const service = createTestService({
    transport,
    repository: createRepository({
      async requestSubscription() {
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "resubscribe",
        };
      },
    }),
  });
  await service.requestSubscription(REQUEST_INPUT);
  assert.equal(transport.commands.length, 1);
  assert.equal(transport.commands[0]?.kind, "confirmation");
  if (transport.commands[0]?.kind === "confirmation") {
    assert.equal(transport.commands[0].purpose, "resubscribe");
  }
});

async function assertNullTransportNotInvokedInDisabledMode(mode: "off" | "preview") {
  let generated = 0;
  const transport = new CountingNullNewsletterMailTransport();
  const service = createNewsletterService({
    mode,
    repository: null,
    mailTransport: transport,
    tokenFactory: () => {
      generated += 1;
      return RAW_TOKEN;
    },
  });
  await assert.rejects(
    service.requestSubscription(REQUEST_INPUT),
    (error) =>
      error instanceof NewsletterOperationError &&
      error.category === "configuration_error" &&
      error.code === "mutations_disabled",
  );
  assert.equal(generated, 0);
  assert.equal(transport.calls, 0);
}

test("Null transport no se invoca en off", async () => {
  await assertNullTransportNotInvokedInDisabledMode("off");
});

test("Null transport no se invoca en preview", async () => {
  await assertNullTransportNotInvokedInDisabledMode("preview");
});

async function assertNullTransportRejectedInEnabledMode(mode: "test" | "live") {
  let repositoryCalls = 0;
  let generated = 0;
  const transport = new CountingNullNewsletterMailTransport();
  const service = createNewsletterService({
    mode,
    repository: createRepository({
      async requestSubscription() {
        repositoryCalls += 1;
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "subscribe",
        };
      },
    }),
    mailTransport: transport,
    tokenFactory: () => {
      generated += 1;
      return RAW_TOKEN;
    },
  });
  await assert.rejects(
    service.requestSubscription(REQUEST_INPUT),
    (error) =>
      error instanceof NewsletterOperationError &&
      error.category === "configuration_error" &&
      error.code === "mail_transport_unavailable",
  );
  assert.equal(generated, 0);
  assert.equal(repositoryCalls, 0);
  assert.equal(transport.calls, 0);
}

test("Null transport se rechaza en test", async () => {
  await assertNullTransportRejectedInEnabledMode("test");
});

test("Null transport se rechaza en live", async () => {
  await assertNullTransportRejectedInEnabledMode("live");
});

test("transporte omitido se trata como Null y se rechaza en test", async () => {
  let repositoryCalls = 0;
  const service = createNewsletterService({
    mode: "test",
    repository: createRepository({
      async requestSubscription() {
        repositoryCalls += 1;
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "subscribe",
        };
      },
    }),
  });
  await assert.rejects(
    service.requestSubscription(REQUEST_INPUT),
    (error) =>
      error instanceof NewsletterOperationError && error.code === "mail_transport_unavailable",
  );
  assert.equal(repositoryCalls, 0);
});

test("un transporte ready que devuelve skipped produce configuration_error", async () => {
  let repositoryCalls = 0;
  let transportCalls = 0;
  const service = createTestService({
    repository: createRepository({
      async requestSubscription() {
        repositoryCalls += 1;
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "subscribe",
        };
      },
    }),
    transport: {
      availability: "ready",
      async send() {
        transportCalls += 1;
        return { status: "skipped" };
      },
    },
  });
  await assert.rejects(
    service.requestSubscription(REQUEST_INPUT),
    (error) =>
      error instanceof NewsletterOperationError &&
      error.category === "configuration_error" &&
      error.code === "mail_transport_unavailable",
  );
  assert.equal(repositoryCalls, 1);
  assert.equal(transportCalls, 1);
});

test("test/live requieren persistencia configurada antes de generar un token", async () => {
  let generated = 0;
  const service = createNewsletterService({
    mode: "test",
    repository: null,
    tokenFactory: () => {
      generated += 1;
      return RAW_TOKEN;
    },
  });
  await assert.rejects(
    service.requestSubscription(REQUEST_INPUT),
    (error) =>
      error instanceof NewsletterOperationError && error.code === "persistence_unavailable",
  );
  assert.equal(generated, 0);
});

test("confirmación válida hashea el token y prepara bienvenida sin devolver identificadores", async () => {
  let receivedHash = "";
  const transport = new CaptureNewsletterMailTransport();
  const service = createTestService({
    transport,
    repository: createRepository({
      async confirmSubscription(tokenHash) {
        receivedHash = tokenHash;
        return { outcome: "confirmed", subscriberId: SUBSCRIBER_ID };
      },
    }),
  });
  const result = await service.confirmSubscription({ token: RAW_TOKEN });
  assert.equal(receivedHash, TOKEN_HASH);
  assert.equal(result.decision, "confirmed");
  assert.equal(result.mailStatus, "accepted");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(SUBSCRIBER_ID));
  assert.deepEqual(transport.commands, [{
    kind: "welcome",
    recipientEmail: "person+motor@example.com",
    rawUnsubscribeToken: RAW_TOKEN,
    provinceSlug: "madrid",
    regionSlug: null,
    locale: "es",
  }]);
});

test("confirmación inválida no prepara correo", async () => {
  const transport = new CaptureNewsletterMailTransport();
  const service = createTestService({
    transport,
    repository: createRepository({
      async confirmSubscription() {
        return { outcome: "invalid_token", subscriberId: null };
      },
    }),
  });
  const result = await service.confirmSubscription({ token: RAW_TOKEN });
  assert.equal(result.decision, "invalid_token");
  assert.equal(result.mailStatus, "not_required");
  assert.equal(transport.commands.length, 0);
});

test("el fallo del transporte no revierte una confirmación ya persistida", async () => {
  let confirmed = 0;
  const service = createTestService({
    repository: createRepository({
      async confirmSubscription() {
        confirmed += 1;
        return { outcome: "confirmed", subscriberId: SUBSCRIBER_ID };
      },
    }),
    transport: {
      availability: "ready",
      async send() {
        throw new Error("test transport failure");
      },
    },
  });
  const result = await service.confirmSubscription({ token: RAW_TOKEN });
  assert.equal(confirmed, 1);
  assert.equal(result.decision, "confirmed");
  assert.equal(result.mailStatus, "failed");
  assert.equal(result.internalErrorCategory, "provider_error");
});

test("baja valida y registra una sola operación de repositorio", async () => {
  let calls = 0;
  const service = createTestService({
    repository: createRepository({
      async unsubscribeSubscriber(params) {
        calls += 1;
        assert.equal(params.subscriberId, SUBSCRIBER_ID);
        return "unsubscribed";
      },
    }),
  });
  const result = await service.unsubscribeSubscriber({
    subscriberId: SUBSCRIBER_ID,
    source: "signed_action",
    consentVersion: "2026-07",
  });
  assert.equal(calls, 1);
  assert.equal(result.decision, "unsubscribed");
});

test("evento provider-neutral valida y delega sin payload abierto", async () => {
  let calls = 0;
  const service = createTestService({
    repository: createRepository({
      async recordProviderEvent(params) {
        calls += 1;
        assert.equal(params.eventType, "delivered");
        return "recorded";
      },
    }),
  });
  const result = await service.recordProviderEvent({
    provider: "test-provider",
    providerEventId: "event-1",
    subscriberId: SUBSCRIBER_ID,
    eventType: "delivered",
    isPermanent: false,
    occurredAt: NOW.toISOString(),
  });
  assert.equal(calls, 1);
  assert.equal(result.decision, "recorded");
});

test("errores de validación y persistencia no contienen PII, token ni SQL", async () => {
  const sensitiveEmail = "private.person@example.com";
  const validationError = await createTestService()
    .requestSubscription({ ...REQUEST_INPUT, email: sensitiveEmail.replace("@", "") })
    .catch((error: unknown) => error);
  assert.ok(validationError instanceof NewsletterOperationError);
  assert.doesNotMatch(validationError.message, /private|example|select|token/i);

  const gateway: NewsletterRpcGateway = {
    async requestSubscription() {
      return { data: null, error: { message: `SQL failed for ${sensitiveEmail}` } };
    },
    async confirmSubscription() {
      return { data: null, error: null };
    },
    async prepareWelcomeDelivery() {
      return { data: null, error: null };
    },
    async unsubscribeSubscriber() {
      return { data: null, error: null };
    },
    async unsubscribeByToken() {
      return { data: null, error: null };
    },
    async recordProviderEvent() {
      return { data: null, error: null };
    },
  };
  const repositoryError = await createNewsletterRepository(gateway)
    .requestSubscription({
      email: sensitiveEmail,
      emailNormalized: sensitiveEmail,
      tokenHash: TOKEN_HASH,
      tokenExpiresAt: NOW.toISOString(),
      source: "test",
      consentVersion: "test",
      sourcePath: null,
      sourceDetail: null,
      languageCode: "es",
      countryCode: "ES",
      provinceSlug: null,
      regionSlug: null,
      ipHash: null,
    })
    .catch((error: unknown) => error);
  assert.ok(repositoryError instanceof NewsletterOperationError);
  assert.doesNotMatch(repositoryError.message, /private|example|select|payload/i);
});

test("el repositorio ejecuta exactamente una RPC por operación y valida sus contratos", async () => {
  const calls: string[] = [];
  const gateway: NewsletterRpcGateway = {
    async requestSubscription() {
      calls.push("request");
      return {
        data: [{ outcome: "confirmation_required", subscriber_id: SUBSCRIBER_ID, token_purpose: "subscribe" }],
        error: null,
      };
    },
    async confirmSubscription() {
      calls.push("confirm");
      return { data: [{ outcome: "confirmed", subscriber_id: SUBSCRIBER_ID }], error: null };
    },
    async prepareWelcomeDelivery() {
      calls.push("prepare_welcome");
      return {
        data: [{
          subscriber_id: SUBSCRIBER_ID,
          recipient_email: "person+motor@example.com",
          preferred_province: "madrid",
          preferred_region: null,
          locale: "es",
        }],
        error: null,
      };
    },
    async unsubscribeSubscriber() {
      calls.push("unsubscribe");
      return { data: [{ outcome: "unsubscribed" }], error: null };
    },
    async unsubscribeByToken() {
      calls.push("unsubscribe_token");
      return { data: [{ outcome: "unsubscribed" }], error: null };
    },
    async recordProviderEvent() {
      calls.push("provider");
      return { data: [{ outcome: "recorded" }], error: null };
    },
  };
  const repository = createNewsletterRepository(gateway);
  await repository.requestSubscription({
    email: REQUEST_INPUT.email.trim(),
    emailNormalized: "person+motor@example.com",
    tokenHash: TOKEN_HASH,
    tokenExpiresAt: "2026-07-22T12:00:00.000Z",
    source: REQUEST_INPUT.source,
    consentVersion: REQUEST_INPUT.consentVersion,
    sourcePath: REQUEST_INPUT.sourcePath,
    sourceDetail: null,
    languageCode: "es",
    countryCode: "ES",
    provinceSlug: null,
    regionSlug: null,
    ipHash: null,
  });
  await repository.confirmSubscription(TOKEN_HASH);
  await repository.prepareWelcomeDelivery({
    subscriberId: SUBSCRIBER_ID,
    tokenHash: TOKEN_HASH,
    expiresAt: null,
  });
  await repository.unsubscribeSubscriber({
    subscriberId: SUBSCRIBER_ID,
    source: "test",
    consentVersion: "test",
    sourcePath: null,
    ipHash: null,
  });
  await repository.unsubscribeByToken({
    tokenHash: TOKEN_HASH,
    source: "test",
    consentVersion: "test",
    sourcePath: null,
    ipHash: null,
  });
  await repository.recordProviderEvent({
    provider: "test",
    providerEventId: "event-1",
    providerMessageId: null,
    subscriberId: SUBSCRIBER_ID,
    eventType: "delivered",
    isPermanent: false,
    occurredAt: NOW.toISOString(),
  });
  assert.deepEqual(calls, [
    "request",
    "confirm",
    "prepare_welcome",
    "unsubscribe",
    "unsubscribe_token",
    "provider",
  ]);
});

test("la capa R3A no crea consultas multipaso, endpoints, acciones o adaptadores Resend", () => {
  const repositorySource = readFileSync(
    join(process.cwd(), "lib/newsletter/repository.server.ts"),
    "utf8",
  );
  const serviceSource = readFileSync(join(process.cwd(), "lib/newsletter/service.server.ts"), "utf8");
  assert.equal((repositorySource.match(/client\.rpc\(/g) ?? []).length, 6);
  assert.doesNotMatch(repositorySource, /\.from\s*\(|insert\s*\(|update\s*\(|delete\s*\(/i);
  assert.doesNotMatch(`${repositorySource}\n${serviceSource}`, /resend|localStorage|console\.|\bRequest\b|\bResponse\b|use server/i);
});
