import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  NEWSLETTER_EDITION_01_CAMPAIGN_ARMED_VALUE,
  NEWSLETTER_EDITION_01_CAMPAIGN_CONFIRM_PHRASE,
  NEWSLETTER_EDITION_01_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_01_CAMPAIGN_SUBJECT,
  NewsletterEdition01CampaignError,
  executeNewsletterEdition01Campaign,
  parseNewsletterEdition01CampaignArguments,
  type NewsletterEdition01CampaignClaim,
  type NewsletterEdition01CampaignClient,
  type NewsletterEdition01CampaignClientResult,
  type NewsletterEdition01CampaignEmailPayload,
  type NewsletterEdition01CampaignEnvironment,
  type NewsletterEdition01CampaignRepository,
  type NewsletterEdition01CampaignSummary,
} from "../../lib/newsletter/edition-01-campaign";
import type { NewsletterEdition01Source } from "../../lib/newsletter/edition-01-test-send";

const SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
const REPLY_TO = "info@eventomotor.com";
const API_KEY = `re_test_${"a".repeat(32)}`;
const CAMPAIGN_ID = "10000000-0000-4000-8000-000000000001";
const SUBSCRIBER_IDS = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
];
const DELIVERY_IDS = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
];
const CLAIM_IDS = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
  "40000000-0000-4000-8000-000000000003",
  "40000000-0000-4000-8000-000000000004",
];
const RECIPIENTS = [
  "campaign-one@example.invalid",
  "campaign-two@example.invalid",
  "campaign-three@example.invalid",
];
const RAW_TOKENS = ["A".repeat(43), "B".repeat(43), "C".repeat(43), "D".repeat(43)];

type DeliveryState = {
  status: "prepared" | "sending" | "accepted" | "failed" | "unknown";
  retryable: boolean;
  attemptCount: number;
};

class FakeCampaignRepository implements NewsletterEdition01CampaignRepository {
  readonly deliveries: DeliveryState[];
  readonly tokenHashes: string[] = [];
  readonly claims: NewsletterEdition01CampaignClaim[] = [];
  prepareCalls = 0;
  previewCalls = 0;
  acceptedCalls = 0;
  failedCalls = 0;
  unknownCalls = 0;
  throwOnAccepted = false;

  constructor(states: DeliveryState[] = []) {
    this.deliveries = states.map((state) => ({ ...state }));
  }

  private summary(): NewsletterEdition01CampaignSummary {
    const count = (status: DeliveryState["status"]) =>
      this.deliveries.filter((delivery) => delivery.status === status).length;
    return {
      campaignId: this.prepareCalls > 0 ? CAMPAIGN_ID : null,
      campaignStatus: this.prepareCalls > 0 ? "prepared" : "not_created",
      eligibleCount: this.deliveries.length,
      preparedCount: count("prepared"),
      sendingCount: count("sending"),
      acceptedCount: count("accepted"),
      failedCount: count("failed"),
      unknownCount: count("unknown"),
      retryableCount: this.deliveries.filter(
        (delivery) => delivery.status === "failed" && delivery.retryable,
      ).length,
    };
  }

  async previewCampaign() {
    this.previewCalls += 1;
    return this.summary();
  }

  async prepareCampaign() {
    this.prepareCalls += 1;
    return this.summary();
  }

  async claimDelivery(input: {
    campaignId: string;
    tokenHash: string;
    allowRetry: boolean;
  }) {
    assert.equal(input.campaignId, CAMPAIGN_ID);
    const index = this.deliveries.findIndex(
      (delivery) =>
        delivery.status === "prepared" ||
        (input.allowRetry && delivery.status === "failed" && delivery.retryable),
    );
    if (index < 0) return null;
    const delivery = this.deliveries[index];
    delivery.status = "sending";
    delivery.retryable = false;
    delivery.attemptCount += 1;
    this.tokenHashes.push(input.tokenHash);
    const claim: NewsletterEdition01CampaignClaim = {
      deliveryId: DELIVERY_IDS[index],
      campaignId: CAMPAIGN_ID,
      subscriberId: SUBSCRIBER_IDS[index],
      recipientEmail: RECIPIENTS[index],
      claimId: CLAIM_IDS[this.claims.length],
      attemptCount: delivery.attemptCount,
      idempotencyKey: `newsletter/${CAMPAIGN_ID}/${DELIVERY_IDS[index]}/${delivery.attemptCount}`,
    };
    this.claims.push(claim);
    return claim;
  }

  private indexFor(deliveryId: string): number {
    const index = DELIVERY_IDS.indexOf(deliveryId);
    assert.notEqual(index, -1);
    return index;
  }

  async recordAccepted(input: { deliveryId: string }) {
    this.acceptedCalls += 1;
    if (this.throwOnAccepted) throw new Error("simulated persistence loss");
    this.deliveries[this.indexFor(input.deliveryId)].status = "accepted";
  }

  async recordFailed(input: {
    deliveryId: string;
    retryable: boolean;
  }) {
    this.failedCalls += 1;
    const delivery = this.deliveries[this.indexFor(input.deliveryId)];
    delivery.status = "failed";
    delivery.retryable = input.retryable;
  }

  async recordUnknown(input: { deliveryId: string }) {
    this.unknownCalls += 1;
    this.deliveries[this.indexFor(input.deliveryId)].status = "unknown";
  }
}

class FakeCampaignClient implements NewsletterEdition01CampaignClient {
  readonly calls: NewsletterEdition01CampaignEmailPayload[] = [];
  readonly results: NewsletterEdition01CampaignClientResult[];

  constructor(results: NewsletterEdition01CampaignClientResult[]) {
    this.results = [...results];
  }

  async sendEmail(payload: NewsletterEdition01CampaignEmailPayload) {
    this.calls.push(structuredClone(payload));
    return (
      this.results.shift() ?? {
        status: "accepted",
        providerMessageId: `provider-${this.calls.length}`,
      }
    );
  }
}

async function loadSource(): Promise<NewsletterEdition01Source> {
  const directory = resolve(
    process.cwd(),
    "docs/newsletter/ediciones/2026-08-06",
  );
  const [html, text] = await Promise.all([
    readFile(resolve(directory, "email-production.html"), "utf8"),
    readFile(resolve(directory, "email-texto-plano.txt"), "utf8"),
  ]);
  return { html, text };
}

const SEND_ENVIRONMENT: NewsletterEdition01CampaignEnvironment = {
  armed: NEWSLETTER_EDITION_01_CAMPAIGN_ARMED_VALUE,
  apiKey: API_KEY,
  mailTransport: "resend",
  newsletterMode: "live",
  nodeEnv: "development",
  publicLaunchEnabled: "public-newsletter-live",
};

function sendRequest(
  overrides: Partial<ReturnType<typeof parseNewsletterEdition01CampaignArguments>> = {},
) {
  return {
    send: true,
    resume: false,
    limit: 25,
    confirmEdition: NEWSLETTER_EDITION_01_CAMPAIGN_KEY,
    confirmPhrase: NEWSLETTER_EDITION_01_CAMPAIGN_CONFIRM_PHRASE,
    ...overrides,
  };
}

async function execute(input: {
  repository: FakeCampaignRepository;
  client?: FakeCampaignClient;
  request?: ReturnType<typeof sendRequest>;
  environment?: NewsletterEdition01CampaignEnvironment;
  logger?: (message: string) => void;
}) {
  let tokenIndex = 0;
  return executeNewsletterEdition01Campaign({
    request: input.request ?? sendRequest(),
    environment: input.environment ?? SEND_ENVIRONMENT,
    source: await loadSource(),
    repository: input.repository,
    sender: SENDER,
    replyTo: REPLY_TO,
    clientFactory: () => input.client ?? new FakeCampaignClient([]),
    tokenFactory: () => RAW_TOKENS[tokenIndex++],
    tokenHasher: (token) =>
      createHash("sha256").update(token, "utf8").digest("hex"),
    now: () => new Date("2026-08-04T12:00:00.000Z"),
    logger: input.logger,
  });
}

test("dry-run es el modo por defecto, sólo previsualiza agregados y no crea cliente", async () => {
  const repository = new FakeCampaignRepository([
    { status: "prepared", retryable: false, attemptCount: 0 },
  ]);
  let clientFactories = 0;
  const logs: string[] = [];
  const result = await executeNewsletterEdition01Campaign({
    request: parseNewsletterEdition01CampaignArguments([]),
    environment: { nodeEnv: "development" },
    source: await loadSource(),
    repository,
    sender: SENDER,
    replyTo: REPLY_TO,
    clientFactory() {
      clientFactories += 1;
      return new FakeCampaignClient([]);
    },
    logger: (message) => logs.push(message),
  });
  assert.equal(result.status, "dry_run");
  assert.equal(repository.previewCalls, 1);
  assert.equal(repository.prepareCalls, 0);
  assert.equal(clientFactories, 0);
  assert.match(logs.at(-1) ?? "", /No campaign was prepared and no email was sent/);
});

test("el modo real exige edición, frase, armado, live, Resend y lanzamiento público", async () => {
  const cases: Array<[Partial<ReturnType<typeof sendRequest>>, Partial<NewsletterEdition01CampaignEnvironment>, string]> = [
    [{ confirmEdition: "other" }, {}, "edition_confirmation_invalid"],
    [{ confirmPhrase: "other" }, {}, "confirmation_phrase_invalid"],
    [{}, { armed: "other" }, "send_not_armed"],
    [{}, { newsletterMode: "off" }, "mode_not_live"],
    [{}, { mailTransport: "disabled" }, "transport_not_resend"],
    [{}, { publicLaunchEnabled: "off" }, "public_launch_not_armed"],
  ];
  for (const [requestOverride, environmentOverride, code] of cases) {
    await assert.rejects(
      execute({
        repository: new FakeCampaignRepository([]),
        request: sendRequest(requestOverride),
        environment: { ...SEND_ENVIRONMENT, ...environmentOverride },
      }),
      (error: unknown) =>
        error instanceof NewsletterEdition01CampaignError && error.code === code,
    );
  }
});

test("CI, Vercel y runtime production están bloqueados incluso antes del cliente", async () => {
  for (const environment of [
    { ...SEND_ENVIRONMENT, ci: "1" },
    { ...SEND_ENVIRONMENT, vercel: "1" },
    { ...SEND_ENVIRONMENT, vercelEnv: "preview" },
    { ...SEND_ENVIRONMENT, nodeEnv: "production" },
  ]) {
    await assert.rejects(
      execute({ repository: new FakeCampaignRepository([]), environment }),
      NewsletterEdition01CampaignError,
    );
  }
});

test("envía secuencialmente, con asunto real, remitente fijo e idempotencia sin PII", async () => {
  const repository = new FakeCampaignRepository([
    { status: "prepared", retryable: false, attemptCount: 0 },
    { status: "prepared", retryable: false, attemptCount: 0 },
  ]);
  const client = new FakeCampaignClient([
    { status: "accepted", providerMessageId: "message-one" },
    { status: "accepted", providerMessageId: "message-two" },
  ]);
  const result = await execute({ repository, client });
  assert.equal(result.processedCount, 2);
  assert.equal(repository.acceptedCalls, 2);
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].subject, NEWSLETTER_EDITION_01_CAMPAIGN_SUBJECT);
  assert.doesNotMatch(client.calls[0].subject, /\[PRUEBA\]/);
  assert.equal(client.calls[0].from, SENDER);
  assert.equal(client.calls[0].replyTo, REPLY_TO);
  assert.match(client.calls[0].idempotencyKey, /^newsletter\/[0-9a-f-]+\/[0-9a-f-]+\/1$/);
  assert.doesNotMatch(client.calls[0].idempotencyKey, /@|campaign-one/);
});

test("cada entrega recibe token distinto y el repositorio sólo recibe hashes", async () => {
  const repository = new FakeCampaignRepository([
    { status: "prepared", retryable: false, attemptCount: 0 },
    { status: "prepared", retryable: false, attemptCount: 0 },
  ]);
  const client = new FakeCampaignClient([]);
  await execute({ repository, client });
  assert.equal(new Set(repository.tokenHashes).size, 2);
  assert.ok(repository.tokenHashes.every((hash) => /^[0-9a-f]{64}$/.test(hash)));
  assert.ok(repository.tokenHashes.every((hash) => !RAW_TOKENS.includes(hash)));
  assert.match(client.calls[0].html, /token=A{43}/);
  assert.match(client.calls[1].html, /token=B{43}/);
  assert.doesNotMatch(client.calls[0].html, /\{\{unsubscribe_url\}\}/);
  assert.doesNotMatch(client.calls[0].text, /\{\{unsubscribe_url\}\}/);
});

test("un fallo parcial inequívoco no impide continuar con las entregas restantes", async () => {
  const repository = new FakeCampaignRepository([
    { status: "prepared", retryable: false, attemptCount: 0 },
    { status: "prepared", retryable: false, attemptCount: 0 },
  ]);
  const client = new FakeCampaignClient([
    { status: "provider_error", httpStatus: 429 },
    { status: "accepted", providerMessageId: "message-two" },
  ]);
  const result = await execute({ repository, client });
  assert.equal(result.processedCount, 2);
  assert.equal(repository.failedCalls, 1);
  assert.equal(repository.acceptedCalls, 1);
  assert.deepEqual(
    repository.deliveries.map((delivery) => [delivery.status, delivery.retryable]),
    [["failed", true], ["accepted", false]],
  );
});

test("resume procesa sólo fallos retryable y una segunda ejecución no reenvía accepted", async () => {
  const repository = new FakeCampaignRepository([
    { status: "accepted", retryable: false, attemptCount: 1 },
    { status: "failed", retryable: true, attemptCount: 1 },
    { status: "failed", retryable: false, attemptCount: 1 },
  ]);
  const client = new FakeCampaignClient([
    { status: "accepted", providerMessageId: "retry-message" },
  ]);
  const result = await execute({
    repository,
    client,
    request: sendRequest({ resume: true }),
  });
  assert.equal(result.processedCount, 1);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].to[0], RECIPIENTS[1]);
  assert.equal(repository.deliveries[0].status, "accepted");
  assert.equal(repository.deliveries[2].status, "failed");
});

test("unknown nunca se reclama automáticamente, incluso con --resume", async () => {
  const repository = new FakeCampaignRepository([
    { status: "unknown", retryable: false, attemptCount: 1 },
  ]);
  const client = new FakeCampaignClient([]);
  const result = await execute({
    repository,
    client,
    request: sendRequest({ resume: true }),
  });
  assert.equal(result.processedCount, 0);
  assert.equal(client.calls.length, 0);
});

test("timeout, respuesta ambigua y excepción quedan unknown, sin segundo envío", async () => {
  for (const outcome of [
    { status: "timeout" } as const,
    { status: "invalid_response", httpStatus: 200 } as const,
    { status: "provider_error", httpStatus: null } as const,
    { status: "provider_error", httpStatus: 500 } as const,
  ]) {
    const repository = new FakeCampaignRepository([
      { status: "prepared", retryable: false, attemptCount: 0 },
    ]);
    const client = new FakeCampaignClient([outcome]);
    await execute({ repository, client });
    assert.equal(client.calls.length, 1);
    assert.equal(repository.unknownCalls, 1);
    assert.equal(repository.deliveries[0].status, "unknown");
  }
});

test("aceptación sin persistencia confirmada falla cerrada y marca unknown si aún puede", async () => {
  const repository = new FakeCampaignRepository([
    { status: "prepared", retryable: false, attemptCount: 0 },
  ]);
  repository.throwOnAccepted = true;
  const client = new FakeCampaignClient([
    { status: "accepted", providerMessageId: "accepted-before-db-loss" },
  ]);
  await assert.rejects(
    execute({ repository, client }),
    (error: unknown) =>
      error instanceof NewsletterEdition01CampaignError &&
      error.code === "accepted_persistence_unknown",
  );
  assert.equal(client.calls.length, 1);
  assert.equal(repository.unknownCalls, 1);
  assert.equal(repository.deliveries[0].status, "unknown");
});

test("logs agregados no contienen emails, tokens, API key ni payloads", async () => {
  const repository = new FakeCampaignRepository([
    { status: "prepared", retryable: false, attemptCount: 0 },
  ]);
  const logs: string[] = [];
  await execute({ repository, logger: (message) => logs.push(message) });
  const output = logs.join("\n");
  assert.doesNotMatch(output, /campaign-one@example\.invalid/);
  assert.doesNotMatch(output, /A{43}/);
  assert.doesNotMatch(output, /re_test_/);
  assert.doesNotMatch(output, /unsubscribe\?token=/);
});

test("parser no admite destinatarios manuales, exige send para resume y limita lotes", () => {
  assert.deepEqual(parseNewsletterEdition01CampaignArguments([]), {
    send: false,
    resume: false,
    limit: 25,
  });
  for (const args of [
    ["--to", "someone@example.invalid"],
    ["--resume"],
    ["--limit", "0"],
    ["--limit", "101"],
  ]) {
    assert.throws(
      () => parseNewsletterEdition01CampaignArguments(args),
      NewsletterEdition01CampaignError,
    );
  }
});

test("adaptador y CLI conservan la frontera server-only y no cargan .env.local", async () => {
  const [adapter, script] = await Promise.all([
    readFile(
      resolve(process.cwd(), "lib/newsletter/edition-01-campaign.server.ts"),
      "utf8",
    ),
    readFile(
      resolve(process.cwd(), "scripts/send-newsletter-edition-01.ts"),
      "utf8",
    ),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /FetchNewsletterResendClient/);
  assert.match(adapter, /createConfiguredNewsletterEdition01CampaignRepository/);
  assert.match(script, /edition-01-campaign\.server/);
  assert.doesNotMatch(`${adapter}\n${script}`, /loadEnvConfig|\.env\.local/);
});
