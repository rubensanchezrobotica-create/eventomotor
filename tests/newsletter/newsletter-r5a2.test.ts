import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { Webhook } from "svix";

import {
  createNewsletterResendWebhookHandler,
  evaluateNewsletterResendWebhookConfiguration,
  parseVerifiedResendWebhook,
} from "../../lib/newsletter/resend-webhook.server";
import { createNewsletterService } from "../../lib/newsletter/service.server";
import type {
  NewsletterRepository,
  NewsletterResendWebhookRepositoryParams,
} from "../../lib/newsletter/service-types";
import {
  NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
} from "../../lib/newsletter/r5a-guard";

const projectRoot = process.cwd();
const WEBHOOK_SECRET =
  `whsec_${Buffer.from("eventomotor-r5a2-test-secret-32b").toString("base64")}`;
const SUBSCRIBER_ID = "123e4567-e89b-42d3-a456-426614174000";
const RECIPIENT = "reader@example.invalid";

function source(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

function enabledEnvironment() {
  return {
    newsletterMode: "live",
    mailTransport: "resend",
    canaryArmed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
    webhookSecret: WEBHOOK_SECRET,
    nodeEnv: "production",
    vercel: "1",
    vercelEnv: "production",
  };
}

function event(type = "email.complained") {
  return {
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: "resend-message-r5a2",
      to: [RECIPIENT],
      ...(type === "email.bounced"
        ? { bounce: { type: "Permanent" } }
        : {}),
    },
  };
}

function signedRequest(
  payload: string,
  {
    id = "msg_r5a2",
    timestamp = new Date(),
    secret = WEBHOOK_SECRET,
  } = {},
) {
  const webhook = new Webhook(secret);
  const signature = webhook.sign(id, timestamp, payload);
  return new Request("https://www.eventomotor.com/api/newsletter/webhooks/resend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
    body: payload,
  });
}

function webhookRepository(
  outcomes: Array<"processed" | "duplicate" | "ignored" | "unmatched"> =
    ["processed"],
) {
  const calls: NewsletterResendWebhookRepositoryParams[] = [];
  const repository = {
    async processResendWebhook(params: NewsletterResendWebhookRepositoryParams) {
      calls.push(params);
      return outcomes.shift() ?? "duplicate";
    },
  } as NewsletterRepository;
  return { calls, repository };
}

test("la ruta R5A.2 expone exclusivamente POST y lee el body raw", async () => {
  const route = source("app/api/newsletter/webhooks/resend/route.ts");
  const implementation = source("lib/newsletter/resend-webhook.server.ts");
  assert.match(route, /export const POST/);
  assert.doesNotMatch(route, /export const (GET|PUT|PATCH|DELETE)/);
  assert.match(implementation, /rawBody = await request\.text\(\)/);
  assert.ok(
    implementation.indexOf("request.text()") <
      implementation.indexOf("verifier.verify("),
  );

  const rawBody = '{ "created_at":"' + new Date().toISOString() +
    '","type":"email.opened","data":{} }';
  let verifiedBody = "";
  const { repository, calls } = webhookRepository(["ignored"]);
  const handler = createNewsletterResendWebhookHandler({
    environment: enabledEnvironment,
    verifier: {
      verify(payload) {
        verifiedBody = payload;
        return JSON.parse(payload);
      },
    },
    repository: () => repository,
  });
  const response = await handler(
    new Request("https://www.eventomotor.com/api/newsletter/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": "msg_raw",
        "svix-timestamp": "1",
        "svix-signature": "v1,test",
      },
      body: rawBody,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(verifiedBody, rawBody);
  assert.equal(calls[0]?.recipientEmailNormalized, null);
  assert.equal(calls[0]?.providerMessageId, null);
});

test("la firma Svix oficial acepta el body intacto y rechaza manipulación", async () => {
  const payload = JSON.stringify(event("email.complained"));
  const { repository, calls } = webhookRepository();
  const handler = createNewsletterResendWebhookHandler({
    environment: enabledEnvironment,
    repository: () => repository,
  });
  assert.equal((await handler(signedRequest(payload))).status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.eventType, "email.complained");

  const tampered = signedRequest(payload);
  const headers = new Headers(tampered.headers);
  const response = await handler(
    new Request(tampered.url, {
      method: "POST",
      headers,
      body: payload.replace("complained", "suppressed"),
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(calls.length, 1);
});

test("cabeceras, firma y timestamp inválidos fallan sin persistencia", async () => {
  const payload = JSON.stringify(event());
  const { repository, calls } = webhookRepository();
  const handler = createNewsletterResendWebhookHandler({
    environment: enabledEnvironment,
    repository: () => repository,
  });
  assert.equal(
    (await handler(new Request("https://www.eventomotor.com", {
      method: "POST",
      body: payload,
    }))).status,
    400,
  );
  const invalid = signedRequest(payload);
  const invalidHeaders = new Headers(invalid.headers);
  invalidHeaders.set("svix-signature", "v1,invalid");
  assert.equal(
    (await handler(new Request(invalid.url, {
      method: "POST",
      headers: invalidHeaders,
      body: payload,
    }))).status,
    400,
  );
  assert.equal(
    (await handler(signedRequest(payload, {
      id: "msg_old",
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
    }))).status,
    400,
  );
  assert.equal(calls.length, 0);
});

test("el guard bloquea secreto ausente, preview y development", async () => {
  for (const environment of [
    { ...enabledEnvironment(), webhookSecret: undefined },
    { ...enabledEnvironment(), vercelEnv: "preview" },
    { ...enabledEnvironment(), nodeEnv: "development" },
  ]) {
    assert.deepEqual(evaluateNewsletterResendWebhookConfiguration(environment), {
      enabled: false,
    });
    const handler = createNewsletterResendWebhookHandler({
      environment: () => environment,
      repository: () => {
        throw new Error("repository must not be created");
      },
    });
    assert.equal(
      (await handler(signedRequest(JSON.stringify(event())))).status,
      404,
    );
  }
});

test("duplicados e ignorados válidos devuelven 200 estable", async () => {
  const { repository, calls } = webhookRepository(["processed", "duplicate"]);
  const handler = createNewsletterResendWebhookHandler({
    environment: enabledEnvironment,
    verifier: { verify: (payload) => JSON.parse(payload) },
    repository: () => repository,
  });
  const payload = JSON.stringify(event("email.suppressed"));
  for (let index = 0; index < 2; index += 1) {
    const response = await handler(
      new Request("https://www.eventomotor.com", {
        method: "POST",
        headers: {
          "svix-id": "msg_duplicate",
          "svix-timestamp": "1",
          "svix-signature": "v1,test",
        },
        body: payload,
      }),
    );
    assert.equal(response.status, 200);
  }
  assert.equal(calls.length, 2);

  for (const type of ["email.opened", "email.clicked", "email.unknown"]) {
    const parsed = parseVerifiedResendWebhook(event(type), `msg_${type}`);
    assert.equal(parsed?.providerMessageId, null);
    assert.equal(parsed?.recipientEmailNormalized, null);
  }
});

test("el mapeo diferencia supresiones permanentes de eventos temporales", () => {
  assert.equal(
    parseVerifiedResendWebhook(event("email.bounced"), "msg_bounce")
      ?.isPermanent,
    true,
  );
  assert.equal(
    parseVerifiedResendWebhook(event("email.delivery_delayed"), "msg_delay")
      ?.isPermanent,
    false,
  );
  for (const type of [
    "email.complained",
    "email.suppressed",
    "email.delivery_delayed",
    "email.failed",
  ]) {
    assert.equal(
      parseVerifiedResendWebhook(event(type), `msg_${type}`)?.eventType,
      type,
    );
  }
});

test("un fallo transitorio de persistencia permite retry sin filtrar datos", async () => {
  const payload = JSON.stringify(event());
  const handler = createNewsletterResendWebhookHandler({
    environment: enabledEnvironment,
    verifier: { verify: () => event() },
    repository: () => ({
      async processResendWebhook() {
        throw new Error(`${payload} ${WEBHOOK_SECRET} ${RECIPIENT}`);
      },
    } as unknown as NewsletterRepository),
  });
  const logs: unknown[][] = [];
  const originalError = console.error;
  const originalLog = console.log;
  console.error = (...args: unknown[]) => logs.push(args);
  console.log = (...args: unknown[]) => logs.push(args);
  try {
    const response = await handler(
      new Request("https://www.eventomotor.com", {
        method: "POST",
        headers: {
          "svix-id": "msg_retry",
          "svix-timestamp": "1",
          "svix-signature": "v1,test",
        },
        body: payload,
      }),
    );
    assert.equal(response.status, 503);
    assert.equal(
      JSON.stringify(await response.json()).includes(RECIPIENT),
      false,
    );
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
  assert.deepEqual(logs, []);
});

test("el servicio consulta la supresión antes de invocar el transporte", async () => {
  let sends = 0;
  const repository = {
    async requestSubscription() {
      return {
        outcome: "confirmation_required",
        subscriberId: SUBSCRIBER_ID,
        tokenPurpose: "subscribe",
      };
    },
    async checkDeliveryEligibility() {
      return "blocked";
    },
  } as unknown as NewsletterRepository;
  const service = createNewsletterService({
    mode: "live",
    repository,
    mailTransport: {
      availability: "ready",
      async send() {
        sends += 1;
        return { status: "accepted", providerMessageId: "must-not-send" };
      },
    },
    tokenFactory: () => "T".repeat(43),
    tokenHasher: () => "a".repeat(64),
  });
  const result = await service.requestSubscription({
    email: RECIPIENT,
    source: "r5a2_test",
    consentVersion: "2026-07",
  });
  assert.equal(result.mailStatus, "failed");
  assert.equal(result.internalErrorCategory, "blocked_state");
  assert.equal(sends, 0);

  const welcomeService = createNewsletterService({
    mode: "live",
    repository: {
      async confirmSubscription() {
        return { outcome: "confirmed", subscriberId: SUBSCRIBER_ID };
      },
      async prepareWelcomeDelivery() {
        return {
          subscriberId: SUBSCRIBER_ID,
          recipientEmail: RECIPIENT,
          provinceSlug: null,
          regionSlug: null,
          locale: "es",
        };
      },
      async checkDeliveryEligibility() {
        return "blocked";
      },
    } as unknown as NewsletterRepository,
    mailTransport: {
      availability: "ready",
      async send() {
        sends += 1;
        return { status: "accepted", providerMessageId: "must-not-send" };
      },
    },
    tokenFactory: () => "U".repeat(43),
    tokenHasher: () => "b".repeat(64),
  });
  const confirmation = await welcomeService.confirmSubscription({
    token: "T".repeat(43),
  });
  assert.equal(confirmation.mailStatus, "failed");
  assert.equal(confirmation.internalErrorCategory, "blocked_state");
  assert.equal(sends, 0);
});

test("el payload Resend no activa tracking ni reescribe enlaces", () => {
  const client = source("lib/newsletter/resend-client.server.ts");
  const transport = source("lib/newsletter/resend-transport.server.tsx");
  const emails = [
    "emails/newsletter/ConfirmSubscriptionEmail.tsx",
    "emails/newsletter/WelcomeEmail.tsx",
    "emails/newsletter/WeeklyAgendaEmail.tsx",
  ].map(source).join("\n");
  assert.doesNotMatch(client, /openTracking|clickTracking|tracking[_-]domain/i);
  assert.doesNotMatch(transport, /openTracking|clickTracking|tracking[_-]domain/i);
  assert.doesNotMatch(emails, /1x1|tracking[_-]pixel|transparent.*pixel/i);
  assert.doesNotMatch(transport, /redirect.*url|utm_|click[_-]id/i);
  assert.match(source(".env.example"), /^NEWSLETTER_RESEND_WEBHOOK_SECRET=$/m);
});
