import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  createNewsletterHttpHandler,
  evaluateNewsletterHttpGuard,
  NEWSLETTER_HTTP_MAX_BODY_BYTES,
  type NewsletterHttpHandlerDependencies,
  type NewsletterHttpOperation,
  type NewsletterSafeLogEvent,
} from "@/lib/newsletter/http.server";
import {
  NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
  NewsletterOperationError,
  type NewsletterConfirmServiceResult,
  type NewsletterRequestServiceResult,
  type NewsletterService,
  type NewsletterUnsubscribeServiceResult,
} from "@/lib/newsletter/service-types";

const VALID_TOKEN = "a".repeat(43);
const SUBSCRIBER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-23T12:00:00.000Z");

function createService(overrides: Partial<NewsletterService> = {}): NewsletterService {
  return {
    async requestSubscription(): Promise<NewsletterRequestServiceResult> {
      return {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "confirmation_required",
        mailStatus: "accepted",
      };
    },
    async confirmSubscription(): Promise<NewsletterConfirmServiceResult> {
      return {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "confirmed",
        mailStatus: "accepted",
      };
    },
    async unsubscribeSubscriber(): Promise<NewsletterUnsubscribeServiceResult> {
      return {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "unsubscribed",
      };
    },
    async recordProviderEvent() {
      return { decision: "recorded" };
    },
    ...overrides,
  };
}

function makeRequest(
  operation: NewsletterHttpOperation,
  body: string | object,
  options: {
    contentType?: string | null;
    origin?: string;
    host?: string;
    contentLength?: string;
  } = {},
): Request {
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/json; charset=utf-8");
  }
  if (options.origin) headers.set("origin", options.origin);
  if (options.host) headers.set("host", options.host);
  if (options.contentLength) headers.set("content-length", options.contentLength);
  return new Request(`http://localhost/api/newsletter/${operation}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

function createTestHandler(
  operation: NewsletterHttpOperation,
  options: NewsletterHttpHandlerDependencies = {},
): {
  handler: (request: Request) => Promise<Response>;
  logs: NewsletterSafeLogEvent[];
} {
  const logs: NewsletterSafeLogEvent[] = [];
  const handler = createNewsletterHttpHandler(operation, {
    environment: () => ({ mode: "test", nodeEnv: "test" }),
    createService: () => createService(),
    resolveUnsubscribeToken: async () => ({ status: "valid", subscriberId: SUBSCRIBER_ID }),
    logger: { error: (event) => logs.push(event) },
    requestIdFactory: () => "request-id-1",
    now: () => NOW,
    ...options,
  });
  return { handler, logs };
}

test("guard HTTP bloquea off, configuración ausente, live y toda producción", () => {
  const base = {
    requestUrl: "http://localhost/api/newsletter/request",
    origin: "http://localhost",
    host: "localhost",
  };
  for (const environment of [
    {},
    { mode: "off", nodeEnv: "development" },
    { mode: "invalid", nodeEnv: "development" },
    { mode: "live", nodeEnv: "development" },
    { mode: "live", nodeEnv: "production", vercelEnv: "production" },
    { mode: "preview", nodeEnv: "production" },
    { mode: "test", nodeEnv: "production", vercelEnv: "production" },
  ]) {
    assert.equal(evaluateNewsletterHttpGuard({ ...base, ...environment }).allowed, false);
  }
});

test("preview exige contexto interno, Origin same-origin y host coherente", () => {
  const base = {
    mode: "preview",
    nodeEnv: "development",
    requestUrl: "http://localhost:3000/api/newsletter/request",
    host: "localhost:3000",
  };
  assert.deepEqual(
    evaluateNewsletterHttpGuard({ ...base, origin: "http://localhost:3000" }),
    { allowed: true, mode: "preview" },
  );
  assert.equal(evaluateNewsletterHttpGuard({ ...base, origin: null }).allowed, false);
  assert.equal(
    evaluateNewsletterHttpGuard({ ...base, origin: "https://attacker.invalid" }).allowed,
    false,
  );
  assert.equal(
    evaluateNewsletterHttpGuard({
      ...base,
      host: "other.invalid",
      origin: "http://localhost:3000",
    }).allowed,
    false,
  );
});

test("preview de Vercel se permite y Vercel production se bloquea", () => {
  const base = {
    mode: "preview",
    nodeEnv: "production",
    requestUrl: "https://branch.example.vercel.app/api/newsletter/request",
    origin: "https://branch.example.vercel.app",
    host: "branch.example.vercel.app",
  };
  assert.equal(
    evaluateNewsletterHttpGuard({ ...base, vercelEnv: "preview" }).allowed,
    true,
  );
  assert.equal(
    evaluateNewsletterHttpGuard({ ...base, vercelEnv: "production" }).allowed,
    false,
  );
});

test("test sólo se permite en NODE_ENV=test y admite clientes sin Origin", () => {
  const base = {
    mode: "test",
    requestUrl: "http://localhost/api/newsletter/request",
    origin: null,
    host: "localhost",
  };
  assert.deepEqual(evaluateNewsletterHttpGuard({ ...base, nodeEnv: "test" }), {
    allowed: true,
    mode: "test",
  });
  assert.equal(
    evaluateNewsletterHttpGuard({ ...base, nodeEnv: "development" }).allowed,
    false,
  );
  assert.equal(
    evaluateNewsletterHttpGuard({
      ...base,
      nodeEnv: "test",
      origin: "https://attacker.invalid",
    }).allowed,
    false,
  );
});

test("un endpoint bloqueado responde 404 estable sin crear el servicio", async () => {
  let serviceCreated = 0;
  const handler = createNewsletterHttpHandler("request", {
    environment: () => ({ mode: "off", nodeEnv: "development" }),
    createService: () => {
      serviceCreated += 1;
      return createService();
    },
  });
  const response = await handler(
    makeRequest("request", {
      email: "driver@example.invalid",
      province: "madrid",
      consentVersion: "2026-07",
    }),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await responseJson(response), { ok: false, error: "not_found" });
  assert.equal(serviceCreated, 0);
});

test("request válido devuelve 202 genérico y delega datos mínimos al servicio", async () => {
  let calls = 0;
  const { handler } = createTestHandler("request", {
    createService: () =>
      createService({
        async requestSubscription(input) {
          calls += 1;
          assert.equal(input.email, " Driver+motor@Example.invalid ");
          assert.equal(input.provinceSlug, "madrid");
          assert.equal(input.source, "internal_http");
          assert.equal(input.sourcePath, "/api/newsletter/request");
          return {
            publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
            decision: "confirmation_required",
            mailStatus: "accepted",
          };
        },
      }),
  });
  const response = await handler(
    makeRequest("request", {
      email: " Driver+motor@Example.invalid ",
      province: "madrid",
      consentVersion: "2026-07",
    }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await responseJson(response), { ok: true, status: "accepted" });
  assert.equal(calls, 1);
});

test("request no permite enumerar outcomes internos ni estados bloqueados", async (context) => {
  const scenarios: Array<{
    label: string;
    result: NewsletterRequestServiceResult;
  }> = [
    {
      label: "new",
      result: {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "confirmation_required",
        mailStatus: "accepted",
      },
    },
    {
      label: "pending",
      result: {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "cooldown",
        mailStatus: "not_required",
        internalErrorCategory: "cooldown",
      },
    },
    {
      label: "active",
      result: {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "already_active",
        mailStatus: "not_required",
      },
    },
    {
      label: "daily_limit",
      result: {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "daily_limit",
        mailStatus: "not_required",
        internalErrorCategory: "cooldown",
      },
    },
    ...["bounced", "complained", "suppressed"].map((label) => ({
      label,
      result: {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: "blocked" as const,
        mailStatus: "not_required" as const,
        internalErrorCategory: "blocked_state" as const,
      },
    })),
  ];
  for (const scenario of scenarios) {
    await context.test(scenario.label, async () => {
      const { handler } = createTestHandler("request", {
        createService: () =>
          createService({ requestSubscription: async () => scenario.result }),
      });
      const response = await handler(
        makeRequest("request", {
          email: "same@example.invalid",
          province: "barcelona",
          consentVersion: "2026-07",
        }),
      );
      assert.equal(response.status, 202);
      assert.deepEqual(await responseJson(response), { ok: true, status: "accepted" });
    });
  }
});

test("request rechaza email, provincia, consentimiento y campos inesperados", async () => {
  const invalidBodies = [
    { email: "invalid", province: "madrid", consentVersion: "2026-07" },
    { email: "driver@example.invalid", province: "unknown", consentVersion: "2026-07" },
    { email: "driver@example.invalid", province: "madrid", consentVersion: "old" },
    {
      email: "driver@example.invalid",
      province: "madrid",
      consentVersion: "2026-07",
      subscriberId: SUBSCRIBER_ID,
    },
  ];
  for (const body of invalidBodies) {
    let calls = 0;
    const { handler } = createTestHandler("request", {
      createService: () =>
        createService({
          async requestSubscription() {
            calls += 1;
            throw new Error("must not run");
          },
        }),
    });
    const response = await handler(makeRequest("request", body));
    assert.equal(response.status, 400);
    assert.deepEqual(await responseJson(response), { ok: false, error: "invalid_request" });
    assert.equal(calls, 0);
  }
});

test("request diferencia errores de transporte HTTP sin filtrar detalles", async () => {
  const { handler } = createTestHandler("request");
  const invalidJson = await handler(makeRequest("request", "{"));
  assert.equal(invalidJson.status, 400);

  const wrongType = await handler(
    makeRequest("request", "{}", { contentType: "text/plain" }),
  );
  assert.equal(wrongType.status, 415);
  assert.deepEqual(await responseJson(wrongType), {
    ok: false,
    error: "unsupported_media_type",
  });

  const tooLarge = await handler(
    makeRequest("request", JSON.stringify({ data: "x".repeat(NEWSLETTER_HTTP_MAX_BODY_BYTES) })),
  );
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(await responseJson(tooLarge), {
    ok: false,
    error: "payload_too_large",
  });

  const declaredTooLarge = await handler(
    makeRequest("request", "{}", {
      contentLength: String(NEWSLETTER_HTTP_MAX_BODY_BYTES + 1),
    }),
  );
  assert.equal(declaredTooLarge.status, 413);
});

test("request sanitiza errores internos y nunca devuelve PII ni secretos", async () => {
  const email = "private.person@example.invalid";
  const token = "secret-token-value";
  const { handler, logs } = createTestHandler("request", {
    createService: () =>
      createService({
        async requestSubscription() {
          throw new Error(`SQL failed for ${email} using ${token}`);
        },
      }),
  });
  const response = await handler(
    makeRequest("request", {
      email,
      province: "madrid",
      consentVersion: "2026-07",
    }),
  );
  assert.equal(response.status, 503);
  const serialized = JSON.stringify(await responseJson(response));
  assert.doesNotMatch(serialized, /private|example|secret|sql|subscriber|token/i);
  assert.deepEqual(logs, [
    {
      operation: "request",
      category: "unexpected_error",
      requestId: "request-id-1",
      mode: "test",
      timestamp: NOW.toISOString(),
    },
  ]);
});

test("confirm mapea token válido, usado, inválido, caducado y bloqueado", async (context) => {
  const cases = [
    ["confirmed", "confirmed"],
    ["used_token", "already_confirmed"],
    ["invalid_token", "invalid_or_expired"],
    ["expired_token", "invalid_or_expired"],
    ["blocked", "invalid_or_expired"],
  ] as const;
  for (const [decision, publicStatus] of cases) {
    await context.test(decision, async () => {
      const { handler } = createTestHandler("confirm", {
        createService: () =>
          createService({
            async confirmSubscription() {
              return {
                publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
                decision,
                mailStatus: decision === "confirmed" ? "accepted" : "not_required",
              };
            },
          }),
      });
      const response = await handler(makeRequest("confirm", { token: VALID_TOKEN }));
      assert.equal(response.status, 200);
      assert.deepEqual(await responseJson(response), { ok: true, status: publicStatus });
    });
  }
});

test("confirm rechaza token vacío, formato incorrecto y campos inesperados", async () => {
  const { handler } = createTestHandler("confirm");
  for (const body of [
    { token: "" },
    { token: "short" },
    { token: `${VALID_TOKEN}.invalid` },
    { token: VALID_TOKEN, email: "person@example.invalid" },
  ]) {
    const response = await handler(makeRequest("confirm", body));
    assert.equal(response.status, 400);
    assert.deepEqual(await responseJson(response), { ok: false, error: "invalid_request" });
  }
});

test("confirm conserva una confirmación local aunque falle bienvenida y registra sólo categoría", async () => {
  const { handler, logs } = createTestHandler("confirm", {
    createService: () =>
      createService({
        async confirmSubscription() {
          return {
            publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
            decision: "confirmed",
            mailStatus: "failed",
            internalErrorCategory: "provider_error",
          };
        },
      }),
  });
  const response = await handler(makeRequest("confirm", { token: VALID_TOKEN }));
  assert.deepEqual(await responseJson(response), { ok: true, status: "confirmed" });
  assert.equal(logs[0]?.category, "provider_error");
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(VALID_TOKEN));
});

test("confirm sanitiza errores del servicio", async () => {
  const { handler, logs } = createTestHandler("confirm", {
    createService: () =>
      createService({
        async confirmSubscription() {
          throw new NewsletterOperationError("persistence_error", "rpc_failed");
        },
      }),
  });
  const response = await handler(makeRequest("confirm", { token: VALID_TOKEN }));
  assert.equal(response.status, 503);
  assert.deepEqual(await responseJson(response), {
    ok: false,
    error: "temporarily_unavailable",
  });
  assert.equal(logs[0]?.category, "persistence_error");
});

test("unsubscribe autentica el token mediante resolver antes de delegar el subscriber", async () => {
  let receivedSubscriberId = "";
  let resolvedToken = "";
  const { handler } = createTestHandler("unsubscribe", {
    resolveUnsubscribeToken: async (token) => {
      resolvedToken = token;
      return { status: "valid", subscriberId: SUBSCRIBER_ID };
    },
    createService: () =>
      createService({
        async unsubscribeSubscriber(input) {
          receivedSubscriberId = input.subscriberId;
          return {
            publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
            decision: "unsubscribed",
          };
        },
      }),
  });
  const response = await handler(makeRequest("unsubscribe", { token: VALID_TOKEN }));
  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), { ok: true, status: "unsubscribed" });
  assert.equal(resolvedToken, VALID_TOKEN);
  assert.equal(receivedSubscriberId, SUBSCRIBER_ID);
});

test("unsubscribe es idempotente y no distingue estados no enviables", async (context) => {
  for (const decision of ["already_unsubscribed", "already_not_sendable"] as const) {
    await context.test(decision, async () => {
      const { handler } = createTestHandler("unsubscribe", {
        createService: () =>
          createService({
            async unsubscribeSubscriber() {
              return { publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE, decision };
            },
          }),
      });
      const response = await handler(makeRequest("unsubscribe", { token: VALID_TOKEN }));
      assert.deepEqual(await responseJson(response), {
        ok: true,
        status: "already_unsubscribed",
      });
    });
  }
});

test("unsubscribe unifica token inválido o caducado sin invocar el servicio", async () => {
  let serviceCreated = 0;
  const { handler } = createTestHandler("unsubscribe", {
    resolveUnsubscribeToken: async () => ({ status: "invalid_or_expired" }),
    createService: () => {
      serviceCreated += 1;
      return createService();
    },
  });
  const response = await handler(makeRequest("unsubscribe", { token: VALID_TOKEN }));
  assert.deepEqual(await responseJson(response), {
    ok: true,
    status: "invalid_or_expired",
  });
  assert.equal(serviceCreated, 0);
});

test("unsubscribe configurado permanece fail-closed sin autoridad de token", async () => {
  let serviceCreated = 0;
  const { handler, logs } = createTestHandler("unsubscribe", {
    resolveUnsubscribeToken: undefined,
    createService: () => {
      serviceCreated += 1;
      return createService();
    },
  });
  const response = await handler(makeRequest("unsubscribe", { token: VALID_TOKEN }));
  assert.equal(response.status, 503);
  assert.deepEqual(await responseJson(response), {
    ok: false,
    error: "temporarily_unavailable",
  });
  assert.equal(logs[0]?.category, "configuration_error");
  assert.equal(serviceCreated, 0);
});

test("unsubscribe no acepta email ni payloads que permitan bajas arbitrarias", async () => {
  let resolved = 0;
  const { handler } = createTestHandler("unsubscribe", {
    resolveUnsubscribeToken: async () => {
      resolved += 1;
      return { status: "valid", subscriberId: SUBSCRIBER_ID };
    },
  });
  for (const body of [
    { email: "victim@example.invalid" },
    { token: VALID_TOKEN, email: "victim@example.invalid" },
    { token: "" },
  ]) {
    const response = await handler(makeRequest("unsubscribe", body));
    assert.equal(response.status, 400);
  }
  assert.equal(resolved, 0);
});

test("unsubscribe sanitiza errores y no registra token ni subscriberId", async () => {
  const { handler, logs } = createTestHandler("unsubscribe", {
    createService: () =>
      createService({
        async unsubscribeSubscriber() {
          throw new Error(`${VALID_TOKEN}:${SUBSCRIBER_ID}`);
        },
      }),
  });
  const response = await handler(makeRequest("unsubscribe", { token: VALID_TOKEN }));
  assert.equal(response.status, 503);
  const evidence = `${JSON.stringify(await responseJson(response))}${JSON.stringify(logs)}`;
  assert.doesNotMatch(evidence, new RegExp(VALID_TOKEN));
  assert.doesNotMatch(evidence, new RegExp(SUBSCRIBER_ID));
});

test("el punto de extensión de abuso puede bloquear sin simular un rate limiter", async () => {
  let serviceCreated = 0;
  const { handler } = createTestHandler("request", {
    checkAbuse: async ({ operation, requestId }) => {
      assert.equal(operation, "request");
      assert.equal(requestId, "request-id-1");
      return false;
    },
    createService: () => {
      serviceCreated += 1;
      return createService();
    },
  });
  const response = await handler(
    makeRequest("request", {
      email: "driver@example.invalid",
      province: "madrid",
      consentVersion: "2026-07",
    }),
  );
  assert.equal(response.status, 429);
  assert.deepEqual(await responseJson(response), { ok: false, error: "rate_limited" });
  assert.equal(serviceCreated, 0);
});

test("los Route Handlers exponen sólo POST y no mutan mediante otros métodos", () => {
  for (const operation of ["request", "confirm", "unsubscribe"]) {
    const source = readFileSync(
      join(process.cwd(), "app", "api", "newsletter", operation, "route.ts"),
      "utf8",
    );
    assert.match(source, /export const POST = createNewsletterHttpHandler/);
    assert.doesNotMatch(source, /export (?:async function|const) (?:GET|PUT|PATCH|DELETE|HEAD)\b/);
    assert.doesNotMatch(source, /searchParams|query|subscriberId|email|token/);
  }
});

test("la implementación sensible sigue server-only y no crea rutas productivas alternativas", () => {
  const httpSource = readFileSync(
    join(process.cwd(), "lib", "newsletter", "http.server.ts"),
    "utf8",
  );
  assert.match(httpSource, /^import "server-only";/);
  assert.doesNotMatch(httpSource, /resend|\.env\.local|--linked|supabase\s+link|supabase\s+db\s+push/i);
  assert.doesNotMatch(httpSource, /localStorage|use client|NEXT_PUBLIC_/i);
  assert.doesNotMatch(httpSource, /console\.(?:log|info|debug|warn)/);
  assert.match(httpSource, /createConfiguredNewsletterService/);
});

test("ningún componente cliente importa repositorio, crypto, service role o handlers HTTP", () => {
  function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
    });
  }

  for (const file of sourceFiles(join(process.cwd(), "components"))) {
    const source = readFileSync(file, "utf8");
    if (!source.match(/^["']use client["'];?/m)) continue;
    assert.doesNotMatch(
      source,
      /repository\.server|crypto\.server|service\.server|http\.server|SUPABASE_SERVICE_ROLE_KEY/,
    );
  }
});
