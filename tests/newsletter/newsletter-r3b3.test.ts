import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  evaluateNewsletterMailCaptureConfiguration,
  isNewsletterMailboxRequestAllowed,
  type ConfiguredNewsletterMailCaptureRuntime,
} from "../../lib/newsletter/mail-capture-config.server";
import {
  FileNewsletterMailCaptureStore,
  NewsletterMailCaptureStoreError,
  maskNewsletterRecipient,
  type NewsletterMailCapture,
  type NewsletterMailCaptureStore,
  type NewsletterMailCaptureSummary,
} from "../../lib/newsletter/mail-capture-store.server";
import {
  CaptureNewsletterMailTransport,
  NewsletterMailCaptureTransportError,
  parseLocalNewsletterCaptureOrigin,
} from "../../lib/newsletter/mail-capture-transport.server";
import {
  buildSafeNewsletterMailboxSrcDoc,
  listRedactedNewsletterCaptureLinks,
} from "../../lib/newsletter/mail-capture-view.server";
import type { NewsletterRepository } from "../../lib/newsletter/service-types";
import { createNewsletterService } from "../../lib/newsletter/service.server";

const RAW_TOKEN = "A".repeat(43);
const TOKEN_HASH = "b".repeat(64);
const SUBSCRIBER_ID = "123e4567-e89b-42d3-a456-426614174000";
const CAPTURE_ID = "3f8b5ec8-728b-4f30-8b31-8e746d724f0d";
const SECOND_CAPTURE_ID = "28fb7e67-a295-479e-af46-2e9be8cda8e5";
const NOW = new Date("2026-07-28T10:00:00.000Z");
const ORIGIN = "http://localhost:3000";
const REQUEST_INPUT = {
  email: "driver@example.invalid",
  source: "r3b3_test",
  consentVersion: "2026-07",
  sourcePath: "/preview/newsletter",
} as const;

class InMemoryNewsletterMailCaptureStore implements NewsletterMailCaptureStore {
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

  clear(): void {
    this.captures.length = 0;
  }
}

function confirmationCommand() {
  return {
    kind: "confirmation" as const,
    recipientEmail: "driver@example.invalid",
    rawConfirmationToken: RAW_TOKEN,
    purpose: "subscribe" as const,
    expiresAt: "2026-07-29T10:00:00.000Z",
  };
}

function captureFixture(
  overrides: Partial<NewsletterMailCapture> = {},
): NewsletterMailCapture {
  return {
    schemaVersion: 1,
    id: CAPTURE_ID,
    mailType: "confirmation",
    recipientEmail: "driver@example.invalid",
    subject: "Confirma tu suscripción a La Agenda Motor",
    html: `<html><head></head><body><a href="${ORIGIN}/preview/newsletter/confirm?token=${RAW_TOKEN}">Confirmar</a></body></html>`,
    text: `Confirmar: ${ORIGIN}/preview/newsletter/confirm?token=${RAW_TOKEN}`,
    capturedAt: NOW.toISOString(),
    status: "captured",
    metadata: { purpose: "subscribe", expiresAt: "2026-07-29T10:00:00.000Z" },
    ...overrides,
  };
}

function repositoryWithRequestOutcome(
  outcome:
    | "confirmation_required"
    | "already_active"
    | "cooldown"
    | "daily_limit"
    | "blocked" = "confirmation_required",
): NewsletterRepository {
  return {
    async requestSubscription() {
      return outcome === "confirmation_required"
        ? {
            outcome,
            subscriberId: SUBSCRIBER_ID,
            tokenPurpose: "subscribe",
          }
        : { outcome, subscriberId: null, tokenPurpose: null };
    },
    async confirmSubscription() {
      return { outcome: "confirmed", subscriberId: SUBSCRIBER_ID };
    },
    async unsubscribeSubscriber() {
      return "unsubscribed";
    },
    async recordProviderEvent() {
      return "recorded";
    },
  };
}

function createCaptureTransport(
  store: NewsletterMailCaptureStore,
  options: { id?: string; now?: Date } = {},
) {
  return new CaptureNewsletterMailTransport({
    store,
    origin: ORIGIN,
    idFactory: () => options.id ?? CAPTURE_ID,
    now: () => options.now ?? NOW,
    async renderConfirmation(props) {
      return {
        html: `<html><head></head><body><a href="${props.confirmationUrl}">Confirmar mi suscripción</a></body></html>`,
        text: `Confirmar mi suscripción: ${props.confirmationUrl}`,
      };
    },
  });
}

async function withTemporaryWorkspace(
  run: (workspaceRoot: string) => Promise<void>,
): Promise<void> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "eventomotor-r3b3-"));
  try {
    await run(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

test("el transporte captura exactamente un correo de confirmación renderizado", async () => {
  const store = new InMemoryNewsletterMailCaptureStore();
  const transport = createCaptureTransport(store);

  const result = await transport.send(confirmationCommand());

  assert.deepEqual(result, { status: "accepted" });
  assert.equal(store.captures.length, 1);
  const capture = store.captures[0];
  assert.equal(capture.recipientEmail, "driver@example.invalid");
  assert.equal(capture.mailType, "confirmation");
  assert.equal(capture.status, "captured");
  assert.match(capture.subject, /Confirma tu suscripción/);
  assert.match(capture.html, /Confirmar mi suscripción/);
  assert.match(capture.text, /Confirmar mi suscripción/);
  assert.match(capture.html, new RegExp(`/preview/newsletter/confirm\\?token=${RAW_TOKEN}`));
  assert.match(capture.text, new RegExp(`/preview/newsletter/confirm\\?token=${RAW_TOKEN}`));
});

test("el token sólo queda dentro del contenido del mensaje", async () => {
  const store = new InMemoryNewsletterMailCaptureStore();
  await createCaptureTransport(store).send(confirmationCommand());
  const capture = store.captures[0];
  const outsideContent = JSON.stringify({
    id: capture.id,
    recipientEmail: capture.recipientEmail,
    subject: capture.subject,
    capturedAt: capture.capturedAt,
    metadata: capture.metadata,
  });

  assert.doesNotMatch(outsideContent, new RegExp(RAW_TOKEN));
  assert.doesNotMatch(capture.id, /driver|example|token/i);
});

test("el transporte no usa red ni registra destinatario, body o token", async () => {
  const store = new InMemoryNewsletterMailCaptureStore();
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  let networkCalls = 0;
  const logs: unknown[][] = [];
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("network must not be used");
  };
  console.log = (...args: unknown[]) => logs.push(args);
  console.error = (...args: unknown[]) => logs.push(args);
  try {
    await createCaptureTransport(store).send(confirmationCommand());
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }

  assert.equal(networkCalls, 0);
  assert.deepEqual(logs, []);
});

test("el transporte rechaza payload inválido y bienvenida sin datos suficientes", async () => {
  const transport = createCaptureTransport(new InMemoryNewsletterMailCaptureStore());
  await assert.rejects(
    transport.send({ ...confirmationCommand(), recipientEmail: "invalid" }),
    NewsletterMailCaptureTransportError,
  );
  await assert.rejects(
    transport.send({ kind: "welcome", subscriberId: SUBSCRIBER_ID }),
    NewsletterMailCaptureTransportError,
  );
});

test("sólo se aceptan orígenes HTTP estrictamente locales", () => {
  assert.equal(parseLocalNewsletterCaptureOrigin(ORIGIN)?.origin, ORIGIN);
  assert.equal(parseLocalNewsletterCaptureOrigin("http://127.0.0.1:3010")?.hostname, "127.0.0.1");
  assert.equal(parseLocalNewsletterCaptureOrigin("https://localhost:3000"), null);
  assert.equal(parseLocalNewsletterCaptureOrigin("https://example.invalid"), null);
  assert.equal(parseLocalNewsletterCaptureOrigin("http://localhost:3000/path"), null);
  assert.equal(parseLocalNewsletterCaptureOrigin("http://user:pass@localhost:3000"), null);
});

test("store de archivos guarda, lista, enmascara y obtiene por ID aleatorio", async () => {
  await withTemporaryWorkspace(async (workspaceRoot) => {
    const store = new FileNewsletterMailCaptureStore({
      workspaceRoot,
      dependencies: { now: () => NOW },
    });
    await store.save(captureFixture());

    const summaries = await store.list();
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].maskedRecipient, "dr***@example.invalid");
    assert.doesNotMatch(JSON.stringify(summaries), /driver@example\.invalid|token=/i);
    assert.deepEqual(await store.get(CAPTURE_ID), captureFixture());
    assert.equal(await store.get("../outside"), null);
  });
});

test("store conserva el orden cronológico de captura", async () => {
  await withTemporaryWorkspace(async (workspaceRoot) => {
    const store = new FileNewsletterMailCaptureStore({
      workspaceRoot,
      dependencies: { now: () => new Date("2026-07-28T12:00:00.000Z") },
    });
    await store.save(
      captureFixture({
        id: SECOND_CAPTURE_ID,
        capturedAt: "2026-07-28T11:00:00.000Z",
      }),
    );
    await store.save(captureFixture({ capturedAt: "2026-07-28T10:00:00.000Z" }));
    assert.deepEqual(
      (await store.list()).map((capture) => capture.id),
      [CAPTURE_ID, SECOND_CAPTURE_ID],
    );
  });
});

test("store aplica límite de registros sin sobrescribir capturas", async () => {
  await withTemporaryWorkspace(async (workspaceRoot) => {
    const store = new FileNewsletterMailCaptureStore({
      workspaceRoot,
      limits: { maxRecords: 1 },
      dependencies: { now: () => NOW },
    });
    await store.save(captureFixture());
    await assert.rejects(
      store.save(captureFixture({ id: SECOND_CAPTURE_ID })),
      (error) =>
        error instanceof NewsletterMailCaptureStoreError && error.code === "record_limit",
    );
    assert.equal((await store.list()).length, 1);
  });
});

test("store rechaza tamaño excedido sin truncar HTML o texto", async () => {
  await withTemporaryWorkspace(async (workspaceRoot) => {
    const store = new FileNewsletterMailCaptureStore({
      workspaceRoot,
      limits: { maxHtmlBytes: 20 },
      dependencies: { now: () => NOW },
    });
    await assert.rejects(
      store.save(captureFixture()),
      (error) =>
        error instanceof NewsletterMailCaptureStoreError &&
        error.code === "capture_too_large",
    );
    assert.deepEqual(await store.list(), []);
  });
});

test("store falla de forma atómica y no deja JSON parcial", async () => {
  await withTemporaryWorkspace(async (workspaceRoot) => {
    const store = new FileNewsletterMailCaptureStore({
      workspaceRoot,
      dependencies: {
        now: () => NOW,
        linkFile: async () => {
          throw new Error("simulated atomic link failure");
        },
      },
    });
    await assert.rejects(
      store.save(captureFixture()),
      (error) =>
        error instanceof NewsletterMailCaptureStoreError &&
        error.code === "storage_failure",
    );
    assert.deepEqual(await readdir(store.rootDirectory), []);
  });
});

test("store bloquea raíces fuera de .tmp/newsletter-mail-capture", () => {
  assert.throws(
    () =>
      new FileNewsletterMailCaptureStore({
        workspaceRoot: "C:/safe-workspace",
        rootDirectory: "C:/outside",
      }),
    (error) =>
      error instanceof NewsletterMailCaptureStoreError && error.code === "unsafe_root",
  );
});

test("retención elimina únicamente capturas caducadas al leer", async () => {
  await withTemporaryWorkspace(async (workspaceRoot) => {
    const store = new FileNewsletterMailCaptureStore({
      workspaceRoot,
      limits: { retentionMs: 60 * 60 * 1000 },
      dependencies: { now: () => new Date("2026-07-28T12:00:00.000Z") },
    });
    await store.save(
      captureFixture({ capturedAt: "2026-07-28T11:30:00.000Z" }),
    );
    assert.equal((await store.list()).length, 1);
  });
});

test("la configuración sólo activa capture con perfil local explícito completo", () => {
  const enabled = evaluateNewsletterMailCaptureConfiguration({
    newsletterMode: "preview",
    mailTransport: "capture",
    captureOrigin: ORIGIN,
    nodeEnv: "development",
    supabaseUrl: "http://127.0.0.1:54321",
    serviceRoleConfigured: true,
  });
  assert.deepEqual(enabled, { enabled: true, origin: ORIGIN });

  const base = {
    newsletterMode: "preview",
    mailTransport: "capture",
    captureOrigin: ORIGIN,
    nodeEnv: "development",
    supabaseUrl: "http://127.0.0.1:54321",
    serviceRoleConfigured: true,
  };
  for (const override of [
    { newsletterMode: "off" },
    { newsletterMode: "live" },
    { mailTransport: undefined },
    { captureOrigin: undefined },
    { nodeEnv: "production" },
    { vercelEnv: "preview" },
    { supabaseUrl: "https://project.supabase.co" },
    { serviceRoleConfigured: false },
  ]) {
    assert.deepEqual(
      evaluateNewsletterMailCaptureConfiguration({ ...base, ...override }),
      { enabled: false },
    );
  }
});

test("el guard del buzón exige host local idéntico al origen configurado", () => {
  const runtime = {
    origin: ORIGIN,
  } as ConfiguredNewsletterMailCaptureRuntime;
  assert.equal(isNewsletterMailboxRequestAllowed(runtime, "localhost:3000"), true);
  assert.equal(isNewsletterMailboxRequestAllowed(runtime, "localhost:3001"), false);
  assert.equal(isNewsletterMailboxRequestAllowed(runtime, "preview.example.invalid"), false);
  assert.equal(isNewsletterMailboxRequestAllowed(runtime, null), false);
});

test("solicitud nueva captura una sola confirmación mediante el servicio real", async () => {
  const store = new InMemoryNewsletterMailCaptureStore();
  const service = createNewsletterService({
    mode: "test",
    repository: repositoryWithRequestOutcome(),
    mailTransport: createCaptureTransport(store),
    tokenFactory: () => RAW_TOKEN,
    tokenHasher: () => TOKEN_HASH,
    now: () => NOW,
  });

  const result = await service.requestSubscription(REQUEST_INPUT);

  assert.equal(result.decision, "confirmation_required");
  assert.equal(result.mailStatus, "accepted");
  assert.equal(store.captures.length, 1);
  assert.equal(store.captures[0].recipientEmail, REQUEST_INPUT.email);
});

test("cooldown, activo y bloqueados no crean duplicados", async () => {
  for (const outcome of ["cooldown", "already_active", "blocked"] as const) {
    const store = new InMemoryNewsletterMailCaptureStore();
    const service = createNewsletterService({
      mode: "test",
      repository: repositoryWithRequestOutcome(outcome),
      mailTransport: createCaptureTransport(store),
      tokenFactory: () => RAW_TOKEN,
      tokenHasher: () => TOKEN_HASH,
      now: () => NOW,
    });
    const result = await service.requestSubscription(REQUEST_INPUT);
    assert.equal(result.mailStatus, "not_required");
    assert.equal(store.captures.length, 0);
  }
});

test("bounced, complained y suppressed conservan el bloqueo sin captura", async () => {
  for (const blockedStatus of ["bounced", "complained", "suppressed"] as const) {
    const store = new InMemoryNewsletterMailCaptureStore();
    const service = createNewsletterService({
      mode: "test",
      repository: repositoryWithRequestOutcome("blocked"),
      mailTransport: createCaptureTransport(store),
      tokenFactory: () => RAW_TOKEN,
      tokenHasher: () => TOKEN_HASH,
      now: () => NOW,
    });
    const result = await service.requestSubscription({
      ...REQUEST_INPUT,
      sourceDetail: blockedStatus,
    });
    assert.equal(result.decision, "blocked");
    assert.equal(result.mailStatus, "not_required");
    assert.equal(store.captures.length, 0);
  }
});

test("fallo del store conserva provider_error, un intento y respuesta genérica", async () => {
  const store = new InMemoryNewsletterMailCaptureStore();
  store.failSave = true;
  let repositoryCalls = 0;
  const repository = repositoryWithRequestOutcome();
  const service = createNewsletterService({
    mode: "test",
    repository: {
      ...repository,
      async requestSubscription(params) {
        repositoryCalls += 1;
        return repository.requestSubscription(params);
      },
    },
    mailTransport: createCaptureTransport(store),
    tokenFactory: () => RAW_TOKEN,
    tokenHasher: () => TOKEN_HASH,
    now: () => NOW,
  });

  const result = await service.requestSubscription(REQUEST_INPUT);

  assert.equal(repositoryCalls, 1);
  assert.equal(result.mailStatus, "failed");
  assert.equal(result.internalErrorCategory, "provider_error");
  assert.equal(store.captures.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /driver@example\.invalid|A{20}|subscriber/i);
});

test("bienvenida ya se solicita, pero capture falla cerrado por contrato insuficiente", async () => {
  const store = new InMemoryNewsletterMailCaptureStore();
  const service = createNewsletterService({
    mode: "test",
    repository: repositoryWithRequestOutcome(),
    mailTransport: createCaptureTransport(store),
    tokenHasher: () => TOKEN_HASH,
  });

  const result = await service.confirmSubscription({ token: RAW_TOKEN });

  assert.equal(result.decision, "confirmed");
  assert.equal(result.mailStatus, "failed");
  assert.equal(result.internalErrorCategory, "provider_error");
  assert.equal(store.captures.length, 0);
});

test("token ya usado no intenta capturar bienvenida", async () => {
  const store = new InMemoryNewsletterMailCaptureStore();
  const repository = repositoryWithRequestOutcome();
  const service = createNewsletterService({
    mode: "test",
    repository: {
      ...repository,
      async confirmSubscription() {
        return { outcome: "used_token", subscriberId: null };
      },
    },
    mailTransport: createCaptureTransport(store),
    tokenHasher: () => TOKEN_HASH,
  });
  const result = await service.confirmSubscription({ token: RAW_TOKEN });
  assert.equal(result.mailStatus, "not_required");
  assert.equal(store.captures.length, 0);
});

test("la vista aísla HTML, bloquea recursos y redacta valores de query", () => {
  const unsafe = `<html><head></head><body><script>alert(1)</script><img src="https://tracker.invalid/pixel"><a href="${ORIGIN}/preview/newsletter/confirm?token=${RAW_TOKEN}">Confirmar</a></body></html>`;
  const safe = buildSafeNewsletterMailboxSrcDoc(unsafe);
  assert.doesNotMatch(safe, /<script/i);
  assert.match(safe, /default-src 'none'/);
  assert.match(safe, /img-src data:/);
  assert.deepEqual(listRedactedNewsletterCaptureLinks(unsafe, ORIGIN), [
    "/preview/newsletter/confirm?token=[oculto]",
  ]);
});

test("buzón es server-only, sin API, con metadata y aislamiento estrictos", () => {
  const listPage = readFileSync(
    join(process.cwd(), "app/preview/newsletter/mailbox/page.tsx"),
    "utf8",
  );
  const detailPage = readFileSync(
    join(process.cwd(), "app/preview/newsletter/mailbox/[id]/page.tsx"),
    "utf8",
  );
  const analytics = readFileSync(
    join(process.cwd(), "components/analytics/GoogleAnalytics.tsx"),
    "utf8",
  );
  assert.match(listPage, /isNewsletterMailboxRequestAllowed/);
  assert.match(detailPage, /sandbox=""/);
  assert.match(detailPage, /referrerPolicy="no-referrer"/);
  assert.match(detailPage, /buildSafeNewsletterMailboxSrcDoc/);
  assert.doesNotMatch(`${listPage}\n${detailPage}`, /dangerouslySetInnerHTML|use client/i);
  assert.match(analytics, /\/preview\/newsletter\/mailbox/);
});

test("R3B.3 permanece server-only y no introduce proveedor, SMTP o rutas públicas", () => {
  const files = [
    "lib/newsletter/mail-capture-store.server.ts",
    "lib/newsletter/mail-capture-transport.server.tsx",
    "lib/newsletter/mail-capture-config.server.ts",
    "lib/newsletter/mail-capture-view.server.ts",
  ];
  const combined = files
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
  const unrelatedCampaignTerm = ["la ", "ba", "\u00f1", "eza"].join("");
  assert.match(combined, /import "server-only"/);
  assert.doesNotMatch(
    combined,
    new RegExp(
      `resend|nodemailer|smtp|createClient|localStorage|sessionStorage|${unrelatedCampaignTerm}`,
      "i",
    ),
  );
  assert.equal(
    readFileSync(join(process.cwd(), ".gitignore"), "utf8").includes(
      "/.tmp/newsletter-mail-capture/",
    ),
    true,
  );
});

test("ningún cliente importa store, transporte o configuración de captura", () => {
  const clientFiles = [
    "components/newsletter/NewsletterSignupForm.tsx",
    "components/newsletter/NewsletterTokenAction.tsx",
    "lib/newsletter/http-client.ts",
  ];
  for (const path of clientFiles) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.doesNotMatch(source, /mail-capture|service\.server|repository\.server|service[_-]?role/i);
  }
});

test("el renderer parametrizado conserva la fuente única React Email", () => {
  const renderer = readFileSync(
    join(process.cwd(), "emails/newsletter/email-renderer.tsx"),
    "utf8",
  );
  assert.match(renderer, /renderNewsletterEmailContent/);
  assert.equal((renderer.match(/createElement\(/g) ?? []).length, 3);
  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML|<!doctype/i);
});
