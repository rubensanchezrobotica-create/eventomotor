import { createHash } from "node:crypto";

import {
  NEWSLETTER_EDITION_01_HTML_SHA256,
  NEWSLETTER_EDITION_01_TEXT_SHA256,
  prepareEdition01Content,
  validateEdition01SourceIntegrity,
  type NewsletterEdition01Source,
} from "@/lib/newsletter/edition-01-test-send";

export const NEWSLETTER_EDITION_01_CAMPAIGN_KEY =
  "agenda_motor_2026_08_06";
export const NEWSLETTER_EDITION_01_CAMPAIGN_SUBJECT =
  "La Bañeza, rally y 4 planes más para este fin de semana";
export const NEWSLETTER_EDITION_01_CAMPAIGN_CONFIRM_PHRASE =
  "SEND-AGENDA-MOTOR-2026-08-06";
export const NEWSLETTER_EDITION_01_CAMPAIGN_ARMED_VALUE =
  "agenda-motor-2026-08-06-manual-send";
export const NEWSLETTER_EDITION_01_UNSUBSCRIBE_ORIGIN =
  "https://www.eventomotor.com";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_PROVIDER_ID_PATTERN = /^[A-Za-z0-9_./:+-]{1,200}$/;
const SAFE_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_./:-]{1,256}$/;

export type NewsletterEdition01CampaignRequest = {
  send: boolean;
  resume: boolean;
  limit: number;
  confirmEdition?: string;
  confirmPhrase?: string;
};

export type NewsletterEdition01CampaignEnvironment = {
  armed?: string;
  apiKey?: string;
  ci?: string;
  mailTransport?: string;
  newsletterMode?: string;
  nodeEnv?: string;
  publicLaunchEnabled?: string;
  vercel?: string;
  vercelEnv?: string;
};

export type NewsletterEdition01CampaignIdentity = {
  editionKey: string;
  subject: string;
  htmlSha256: string;
  textSha256: string;
};

export type NewsletterEdition01CampaignSummary = {
  campaignId: string | null;
  campaignStatus: "not_created" | "prepared" | "sending" | "completed" | "paused";
  eligibleCount: number;
  preparedCount: number;
  sendingCount: number;
  acceptedCount: number;
  failedCount: number;
  unknownCount: number;
  retryableCount: number;
};

export type NewsletterEdition01CampaignClaim = {
  deliveryId: string;
  campaignId: string;
  subscriberId: string;
  recipientEmail: string;
  claimId: string;
  attemptCount: number;
  idempotencyKey: string;
};

export interface NewsletterEdition01CampaignRepository {
  previewCampaign(
    identity: NewsletterEdition01CampaignIdentity,
  ): Promise<NewsletterEdition01CampaignSummary>;
  prepareCampaign(
    identity: NewsletterEdition01CampaignIdentity,
  ): Promise<NewsletterEdition01CampaignSummary>;
  claimDelivery(input: {
    campaignId: string;
    tokenHash: string;
    allowRetry: boolean;
  }): Promise<NewsletterEdition01CampaignClaim | null>;
  recordAccepted(input: {
    deliveryId: string;
    claimId: string;
    providerMessageId: string;
    occurredAt: string;
  }): Promise<void>;
  recordFailed(input: {
    deliveryId: string;
    claimId: string;
    errorCode: string;
    retryable: boolean;
    occurredAt: string;
  }): Promise<void>;
  recordUnknown(input: {
    deliveryId: string;
    claimId: string;
    errorCode: string;
    occurredAt: string;
  }): Promise<void>;
}

export type NewsletterEdition01CampaignEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type NewsletterEdition01CampaignClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition01CampaignClient {
  sendEmail(
    payload: NewsletterEdition01CampaignEmailPayload,
  ): Promise<NewsletterEdition01CampaignClientResult>;
}

export type ExecuteNewsletterEdition01CampaignOptions = {
  request: NewsletterEdition01CampaignRequest;
  environment?: NewsletterEdition01CampaignEnvironment;
  source: NewsletterEdition01Source;
  repository: NewsletterEdition01CampaignRepository;
  sender: string;
  replyTo: string;
  clientFactory?: (apiKey: string) => NewsletterEdition01CampaignClient;
  tokenFactory?: () => string;
  tokenHasher?: (token: string) => string;
  now?: () => Date;
  logger?: (message: string) => void;
};

export type NewsletterEdition01CampaignResult = {
  status: "dry_run" | "completed";
  identity: NewsletterEdition01CampaignIdentity;
  digest: string;
  processedCount: number;
  summary: NewsletterEdition01CampaignSummary;
};

export class NewsletterEdition01CampaignError extends Error {
  constructor(readonly code: string) {
    super(`Edition 01 campaign blocked: ${code}.`);
    this.name = "NewsletterEdition01CampaignError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition01CampaignError(code);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function campaignIdentity(): NewsletterEdition01CampaignIdentity {
  return {
    editionKey: NEWSLETTER_EDITION_01_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_01_CAMPAIGN_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_01_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_01_TEXT_SHA256,
  };
}

export function newsletterEdition01CampaignDigest(
  identity: NewsletterEdition01CampaignIdentity,
): string {
  return sha256(
    [
      identity.editionKey,
      identity.subject,
      identity.htmlSha256,
      identity.textSha256,
    ].join("\u0000"),
  );
}

function assertSafeEnvironment(
  environment: NewsletterEdition01CampaignEnvironment,
): void {
  if (environment.ci !== undefined) fail("ci_blocked");
  if (
    environment.vercel !== undefined ||
    environment.vercelEnv !== undefined
  ) {
    fail("vercel_blocked");
  }
  if (environment.nodeEnv === "production") fail("production_runtime_blocked");
}

function assertSendGates(
  request: NewsletterEdition01CampaignRequest,
  environment: NewsletterEdition01CampaignEnvironment,
): string {
  if (request.confirmEdition !== NEWSLETTER_EDITION_01_CAMPAIGN_KEY) {
    fail("edition_confirmation_invalid");
  }
  if (request.confirmPhrase !== NEWSLETTER_EDITION_01_CAMPAIGN_CONFIRM_PHRASE) {
    fail("confirmation_phrase_invalid");
  }
  if (environment.armed !== NEWSLETTER_EDITION_01_CAMPAIGN_ARMED_VALUE) {
    fail("send_not_armed");
  }
  if (environment.newsletterMode !== "live") fail("mode_not_live");
  if (environment.mailTransport !== "resend") fail("transport_not_resend");
  if (environment.publicLaunchEnabled !== "public-newsletter-live") {
    fail("public_launch_not_armed");
  }
  if (
    !environment.apiKey ||
    environment.apiKey.length < 20 ||
    environment.apiKey.length > 500 ||
    environment.apiKey !== environment.apiKey.trim() ||
    /[\s\u0000-\u001f\u007f]/.test(environment.apiKey)
  ) {
    fail("api_key_unavailable");
  }
  return environment.apiKey;
}

function assertSummary(summary: NewsletterEdition01CampaignSummary): void {
  const values = [
    summary.eligibleCount,
    summary.preparedCount,
    summary.sendingCount,
    summary.acceptedCount,
    summary.failedCount,
    summary.unknownCount,
    summary.retryableCount,
  ];
  if (
    values.some((value) => !Number.isInteger(value) || value < 0) ||
    (summary.campaignId !== null && !UUID_PATTERN.test(summary.campaignId))
  ) {
    fail("repository_contract_invalid");
  }
}

function assertClaim(claim: NewsletterEdition01CampaignClaim): void {
  if (
    !UUID_PATTERN.test(claim.deliveryId) ||
    !UUID_PATTERN.test(claim.campaignId) ||
    !UUID_PATTERN.test(claim.subscriberId) ||
    !UUID_PATTERN.test(claim.claimId) ||
    !Number.isInteger(claim.attemptCount) ||
    claim.attemptCount < 1 ||
    !SAFE_IDEMPOTENCY_KEY_PATTERN.test(claim.idempotencyKey) ||
    !claim.recipientEmail.includes("@")
  ) {
    fail("repository_contract_invalid");
  }
}

function unsubscribeUrl(rawToken: string): string {
  const url = new URL("/newsletter/unsubscribe", NEWSLETTER_EDITION_01_UNSUBSCRIBE_ORIGIN);
  url.searchParams.set("token", rawToken);
  return url.toString();
}

function safeProviderFailure(result: NewsletterEdition01CampaignClientResult): {
  errorCode: string;
  retryable: boolean;
  unknown: boolean;
} {
  if (result.status === "timeout") {
    return { errorCode: "provider_timeout", retryable: false, unknown: true };
  }
  if (result.status === "invalid_response") {
    return { errorCode: "provider_response_unknown", retryable: false, unknown: true };
  }
  if (result.status === "provider_error" && result.httpStatus === null) {
    return { errorCode: "provider_connection_unknown", retryable: false, unknown: true };
  }
  if (result.status !== "provider_error") fail("provider_result_invalid");
  const status = result.httpStatus;
  if (status === null || !Number.isInteger(status) || status < 100 || status > 599) {
    fail("provider_result_invalid");
  }
  if (status === 408 || status >= 500) {
    return {
      errorCode: `provider_http_${status}_unknown`,
      retryable: false,
      unknown: true,
    };
  }
  return {
    errorCode: `provider_http_${status}`,
    retryable: status === 429,
    unknown: false,
  };
}

function logSummary(
  logger: (message: string) => void,
  identity: NewsletterEdition01CampaignIdentity,
  digest: string,
  summary: NewsletterEdition01CampaignSummary,
): void {
  logger(`Campaign: ${identity.editionKey}`);
  logger(`Digest: ${digest}`);
  logger(`Subject: ${identity.subject}`);
  logger(`Eligible audience: ${summary.eligibleCount}`);
  logger(`Prepared: ${summary.preparedCount}`);
  logger(`Previously accepted: ${summary.acceptedCount}`);
  logger(`Failed: ${summary.failedCount}`);
  logger(`Unknown: ${summary.unknownCount}`);
  logger(`Pending claims: ${summary.preparedCount + summary.retryableCount}`);
}

async function recordUnknownSafely(
  repository: NewsletterEdition01CampaignRepository,
  claim: NewsletterEdition01CampaignClaim,
  errorCode: string,
  occurredAt: string,
): Promise<void> {
  try {
    await repository.recordUnknown({
      deliveryId: claim.deliveryId,
      claimId: claim.claimId,
      errorCode,
      occurredAt,
    });
  } catch {
    // The delivery intentionally remains sending. A later claim operation
    // converts a stale sending lease to unknown and never retries it.
  }
}

export async function executeNewsletterEdition01Campaign(
  options: ExecuteNewsletterEdition01CampaignOptions,
): Promise<NewsletterEdition01CampaignResult> {
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  const identity = campaignIdentity();
  const digest = newsletterEdition01CampaignDigest(identity);
  assertSafeEnvironment(environment);
  validateEdition01SourceIntegrity(options.source);
  if (identity.subject.startsWith("[PRUEBA]")) fail("test_subject_blocked");

  if (!options.request.send) {
    const summary = await options.repository.previewCampaign(identity);
    assertSummary(summary);
    logSummary(logger, identity, digest, summary);
    logger("Dry-run complete. No campaign was prepared and no email was sent.");
    return {
      status: "dry_run",
      identity,
      digest,
      processedCount: 0,
      summary,
    };
  }

  const apiKey = assertSendGates(options.request, environment);
  if (!options.clientFactory || !options.tokenFactory || !options.tokenHasher) {
    fail("server_dependencies_unavailable");
  }

  const preparedSummary = await options.repository.prepareCampaign(identity);
  assertSummary(preparedSummary);
  if (!preparedSummary.campaignId) fail("campaign_not_persisted");

  const client = options.clientFactory(apiKey);
  const now = options.now ?? (() => new Date());
  let processedCount = 0;

  while (processedCount < options.request.limit) {
    const rawToken = options.tokenFactory();
    const tokenHash = options.tokenHasher(rawToken);
    if (!HASH_PATTERN.test(tokenHash)) fail("token_hash_invalid");

    const claim = await options.repository.claimDelivery({
      campaignId: preparedSummary.campaignId,
      tokenHash,
      allowRetry: options.request.resume,
    });
    if (!claim) break;
    assertClaim(claim);
    if (claim.campaignId !== preparedSummary.campaignId) {
      fail("repository_contract_invalid");
    }

    const content = prepareEdition01Content(options.source, unsubscribeUrl(rawToken));
    const payload: NewsletterEdition01CampaignEmailPayload = {
      from: options.sender,
      to: [claim.recipientEmail],
      replyTo: options.replyTo,
      subject: identity.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: claim.idempotencyKey,
    };
    const occurredAt = now().toISOString();
    let providerResult: NewsletterEdition01CampaignClientResult;
    try {
      providerResult = await client.sendEmail(payload);
    } catch {
      await recordUnknownSafely(
        options.repository,
        claim,
        "provider_connection_unknown",
        occurredAt,
      );
      processedCount += 1;
      continue;
    }

    if (providerResult.status === "accepted") {
      if (!SAFE_PROVIDER_ID_PATTERN.test(providerResult.providerMessageId)) {
        await recordUnknownSafely(
          options.repository,
          claim,
          "provider_response_unknown",
          occurredAt,
        );
        processedCount += 1;
        continue;
      }
      try {
        await options.repository.recordAccepted({
          deliveryId: claim.deliveryId,
          claimId: claim.claimId,
          providerMessageId: providerResult.providerMessageId,
          occurredAt,
        });
      } catch {
        await recordUnknownSafely(
          options.repository,
          claim,
          "accepted_persistence_unknown",
          occurredAt,
        );
        fail("accepted_persistence_unknown");
      }
    } else {
      const failure = safeProviderFailure(providerResult);
      if (failure.unknown) {
        await options.repository.recordUnknown({
          deliveryId: claim.deliveryId,
          claimId: claim.claimId,
          errorCode: failure.errorCode,
          occurredAt,
        });
      } else {
        await options.repository.recordFailed({
          deliveryId: claim.deliveryId,
          claimId: claim.claimId,
          errorCode: failure.errorCode,
          retryable: failure.retryable,
          occurredAt,
        });
      }
    }
    processedCount += 1;
  }

  const summary = await options.repository.previewCampaign(identity);
  assertSummary(summary);
  logSummary(logger, identity, digest, summary);
  logger(`Processed in this execution: ${processedCount}`);
  return {
    status: "completed",
    identity,
    digest,
    processedCount,
    summary,
  };
}

export function parseNewsletterEdition01CampaignArguments(
  argv: readonly string[],
): NewsletterEdition01CampaignRequest {
  const request: NewsletterEdition01CampaignRequest = {
    send: false,
    resume: false,
    limit: DEFAULT_LIMIT,
  };
  const seen = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--send" || argument === "--resume") {
      if (seen.has(argument)) fail("duplicate_argument");
      seen.add(argument);
      if (argument === "--send") request.send = true;
      if (argument === "--resume") request.resume = true;
      continue;
    }
    if (
      argument !== "--limit" &&
      argument !== "--confirm-edition" &&
      argument !== "--confirm-phrase"
    ) {
      fail("unknown_argument");
    }
    if (seen.has(argument)) fail("duplicate_argument");
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail("argument_value_missing");
    index += 1;

    if (argument === "--limit") {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        fail("limit_invalid");
      }
      request.limit = limit;
    }
    if (argument === "--confirm-edition") request.confirmEdition = value;
    if (argument === "--confirm-phrase") request.confirmPhrase = value;
  }

  if (request.resume && !request.send) fail("resume_requires_send");
  return request;
}
