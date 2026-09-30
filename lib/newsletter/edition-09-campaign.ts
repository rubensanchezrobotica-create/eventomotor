import { createHash } from "node:crypto";

import {
  NEWSLETTER_EDITION_09_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_09_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_09_HTML_SHA256,
  NEWSLETTER_EDITION_09_REPLY_TO,
  NEWSLETTER_EDITION_09_SENDER,
  NEWSLETTER_EDITION_09_SUBJECT,
  NEWSLETTER_EDITION_09_TEXT_SHA256,
  prepareEdition09Content,
  validateEdition09SourceIntegrity,
  type NewsletterEdition09ContentVariant,
  type NewsletterEdition09Source,
} from "@/lib/newsletter/edition-09-content";

export {
  NEWSLETTER_EDITION_09_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_09_REPLY_TO,
  NEWSLETTER_EDITION_09_SENDER,
  NEWSLETTER_EDITION_09_SUBJECT,
} from "@/lib/newsletter/edition-09-content";

export const NEWSLETTER_EDITION_09_CAMPAIGN_CONFIRM_PHRASE =
  "SEND-AGENDA-MOTOR-2026-10-01";
export const NEWSLETTER_EDITION_09_CAMPAIGN_ARMED_VALUE =
  "agenda-motor-2026-10-01-manual-send";
export const NEWSLETTER_EDITION_09_UNSUBSCRIBE_ORIGIN =
  "https://www.eventomotor.com";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_PROVIDER_ID_PATTERN = /^[A-Za-z0-9_./:+-]{1,200}$/;
const SAFE_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_./:-]{1,256}$/;

export type NewsletterEdition09CampaignRequest = {
  sendPrepared: boolean;
  prepareOnly: boolean;
  limit: number;
  confirmEdition?: string;
  confirmPhrase?: string;
  confirmCampaignId?: string;
};

export type NewsletterEdition09PreparedCampaignSeal = {
  campaignId: string;
  deliveryCount: number;
  variantCounts: Readonly<Record<NewsletterEdition09ContentVariant, number>>;
};

// Intentionally empty until a separate, human-controlled prepare/freeze step
// has produced and reviewed the immutable campaign snapshot.
export const NEWSLETTER_EDITION_09_PREPARED_CAMPAIGN_SEAL: NewsletterEdition09PreparedCampaignSeal | null =
  null;

export type NewsletterEdition09CampaignEnvironment = {
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

export type NewsletterEdition09CampaignIdentity = {
  editionKey: string;
  subject: string;
  htmlSha256: string;
  textSha256: string;
  contentManifestDigest: string;
};

export type NewsletterEdition09CampaignSummary = {
  campaignId: string | null;
  campaignStatus: "not_created" | "prepared" | "sending" | "completed" | "paused";
  audienceFrozenAt: string | null;
  eligibleCount: number;
  preparedCount: number;
  sendingCount: number;
  acceptedCount: number;
  failedCount: number;
  unknownCount: number;
  retryableCount: number;
  nationalCount: number;
  madridCount: number;
  catalunaCount: number;
  comunidadValencianaCount: number;
  excludedCount: number;
  duplicateCount: number;
  invalidCount: number;
};

export type NewsletterEdition09CampaignClaim = {
  deliveryId: string;
  campaignId: string;
  subscriberId: string;
  recipientEmail: string;
  claimId: string;
  attemptCount: number;
  idempotencyKey: string;
  contentVariant: NewsletterEdition09ContentVariant;
};

export interface NewsletterEdition09CampaignRepository {
  previewCampaign(
    identity: NewsletterEdition09CampaignIdentity,
  ): Promise<NewsletterEdition09CampaignSummary>;
  prepareCampaign(
    identity: NewsletterEdition09CampaignIdentity,
  ): Promise<NewsletterEdition09CampaignSummary>;
  claimDelivery(input: {
    campaignId: string;
    tokenHash: string;
    allowRetry: boolean;
  }): Promise<NewsletterEdition09CampaignClaim | null>;
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

export type NewsletterEdition09CampaignEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type NewsletterEdition09CampaignClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition09CampaignClient {
  sendEmail(
    payload: NewsletterEdition09CampaignEmailPayload,
  ): Promise<NewsletterEdition09CampaignClientResult>;
}

export type ExecuteNewsletterEdition09CampaignOptions = {
  request: NewsletterEdition09CampaignRequest;
  environment?: NewsletterEdition09CampaignEnvironment;
  source: NewsletterEdition09Source;
  repository: NewsletterEdition09CampaignRepository;
  sender: string;
  replyTo: string;
  clientFactory?: (apiKey: string) => NewsletterEdition09CampaignClient;
  tokenFactory?: () => string;
  tokenHasher?: (token: string) => string;
  now?: () => Date;
  logger?: (message: string) => void;
  preparedCampaignSeal?: NewsletterEdition09PreparedCampaignSeal | null;
};

export type NewsletterEdition09CampaignResult = {
  status: "dry_run" | "prepared" | "prepared_sent";
  identity: NewsletterEdition09CampaignIdentity;
  digest: string;
  processedCount: number;
  summary: NewsletterEdition09CampaignSummary | null;
  campaignId?: string;
  processedVariantCounts?: Readonly<Record<NewsletterEdition09ContentVariant, number>>;
};

export class NewsletterEdition09CampaignError extends Error {
  constructor(readonly code: string) {
    super(`Edition 09 campaign blocked: ${code}.`);
    this.name = "NewsletterEdition09CampaignError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition09CampaignError(code);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function newsletterEdition09CampaignIdentity(): NewsletterEdition09CampaignIdentity {
  return {
    editionKey: NEWSLETTER_EDITION_09_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_09_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_09_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_09_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_09_CONTENT_MANIFEST_SHA256,
  };
}

export function newsletterEdition09CampaignDigest(
  identity: NewsletterEdition09CampaignIdentity,
): string {
  return sha256(
    [
      identity.editionKey,
      identity.subject,
      identity.htmlSha256,
      identity.textSha256,
      identity.contentManifestDigest,
    ].join("\u0000"),
  );
}

function assertSafeEnvironment(
  environment: NewsletterEdition09CampaignEnvironment,
): void {
  if (environment.ci !== undefined) fail("ci_blocked");
  if (environment.vercel !== undefined || environment.vercelEnv !== undefined) {
    fail("vercel_blocked");
  }
  if (environment.nodeEnv === "production") fail("production_runtime_blocked");
}

function assertMutationGates(
  request: NewsletterEdition09CampaignRequest,
  environment: NewsletterEdition09CampaignEnvironment,
): void {
  if (request.confirmEdition !== NEWSLETTER_EDITION_09_CAMPAIGN_KEY) {
    fail("edition_confirmation_invalid");
  }
  if (request.confirmPhrase !== NEWSLETTER_EDITION_09_CAMPAIGN_CONFIRM_PHRASE) {
    fail("confirmation_phrase_invalid");
  }
  if (environment.armed !== NEWSLETTER_EDITION_09_CAMPAIGN_ARMED_VALUE) {
    fail("send_not_armed");
  }
  if (environment.newsletterMode !== "live") fail("mode_not_live");
  if (environment.mailTransport !== "resend") fail("transport_not_resend");
  if (environment.publicLaunchEnabled !== "public-newsletter-live") {
    fail("public_launch_not_armed");
  }
}

function requireResendApiKey(
  environment: NewsletterEdition09CampaignEnvironment,
): string {
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

function assertRequestMode(request: NewsletterEdition09CampaignRequest): void {
  if (request.sendPrepared && request.prepareOnly) {
    fail("send_prepared_mode_conflict");
  }
  if (request.confirmCampaignId !== undefined && !request.sendPrepared) {
    fail("campaign_id_confirmation_unexpected");
  }
}

function assertPreparedCampaignSeal(
  seal: NewsletterEdition09PreparedCampaignSeal | null,
): asserts seal is NewsletterEdition09PreparedCampaignSeal {
  if (!seal) fail("prepared_campaign_not_sealed");
  const counts = Object.values(seal.variantCounts);
  if (
    !UUID_PATTERN.test(seal.campaignId) ||
    !Number.isInteger(seal.deliveryCount) ||
    seal.deliveryCount < 1 ||
    seal.deliveryCount > MAX_LIMIT ||
    counts.some((count) => !Number.isInteger(count) || count < 0) ||
    counts.reduce((total, count) => total + count, 0) !== seal.deliveryCount
  ) {
    fail("prepared_campaign_seal_invalid");
  }
}

function assertSummary(summary: NewsletterEdition09CampaignSummary): void {
  const values = [
    summary.eligibleCount,
    summary.preparedCount,
    summary.sendingCount,
    summary.acceptedCount,
    summary.failedCount,
    summary.unknownCount,
    summary.retryableCount,
    summary.nationalCount,
    summary.madridCount,
    summary.catalunaCount,
    summary.comunidadValencianaCount,
    summary.excludedCount,
    summary.duplicateCount,
    summary.invalidCount,
  ];
  if (
    values.some((value) => !Number.isInteger(value) || value < 0) ||
    (summary.campaignId !== null && !UUID_PATTERN.test(summary.campaignId)) ||
    (summary.audienceFrozenAt !== null &&
      !Number.isFinite(Date.parse(summary.audienceFrozenAt))) ||
    summary.nationalCount +
      summary.madridCount +
      summary.catalunaCount +
      summary.comunidadValencianaCount !==
      summary.eligibleCount ||
    summary.madridCount !== 0 ||
    summary.catalunaCount !== 0 ||
    summary.comunidadValencianaCount !== 0
  ) {
    fail("repository_contract_invalid");
  }
}

function assertClaim(claim: NewsletterEdition09CampaignClaim): void {
  if (
    !UUID_PATTERN.test(claim.deliveryId) ||
    !UUID_PATTERN.test(claim.campaignId) ||
    !UUID_PATTERN.test(claim.subscriberId) ||
    !UUID_PATTERN.test(claim.claimId) ||
    !Number.isInteger(claim.attemptCount) ||
    claim.attemptCount < 1 ||
    !SAFE_IDEMPOTENCY_KEY_PATTERN.test(claim.idempotencyKey) ||
    !claim.recipientEmail.includes("@") ||
    claim.contentVariant !== "national"
  ) {
    fail("repository_contract_invalid");
  }
}

function unsubscribeUrl(rawToken: string): string {
  const url = new URL(
    "/newsletter/unsubscribe",
    NEWSLETTER_EDITION_09_UNSUBSCRIBE_ORIGIN,
  );
  url.searchParams.set("token", rawToken);
  return url.toString();
}

function safeProviderFailure(result: NewsletterEdition09CampaignClientResult): {
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
    return {
      errorCode: "provider_connection_unknown",
      retryable: false,
      unknown: true,
    };
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
  identity: NewsletterEdition09CampaignIdentity,
  digest: string,
  summary: NewsletterEdition09CampaignSummary,
): void {
  logger(`Campaign: ${identity.editionKey}`);
  logger("Edition: 09");
  logger(`Campaign ID: ${summary.campaignId ?? "not-created"}`);
  logger(`Campaign status: ${summary.campaignStatus}`);
  logger(`Digest: ${digest}`);
  logger(`Subject: ${identity.subject}`);
  logger(`HTML digest: ${identity.htmlSha256}`);
  logger(`Text digest: ${identity.textSha256}`);
  logger(`Manifest digest: ${identity.contentManifestDigest}`);
  logger(`Eligible audience: ${summary.eligibleCount}`);
  logger(`Variant national: ${summary.nationalCount}`);
  logger(`Variant madrid: ${summary.madridCount}`);
  logger(`Variant cataluna: ${summary.catalunaCount}`);
  logger(`Variant comunidad-valenciana: ${summary.comunidadValencianaCount}`);
  logger(`Excluded: ${summary.excludedCount}`);
  logger(`Duplicates: ${summary.duplicateCount}`);
  logger(`Invalid: ${summary.invalidCount}`);
  logger(`Audience frozen: ${summary.audienceFrozenAt ?? "not-frozen"}`);
  logger(`Prepared: ${summary.preparedCount}`);
  logger(`Previously accepted: ${summary.acceptedCount}`);
  logger(`Failed: ${summary.failedCount}`);
  logger(`Unknown: ${summary.unknownCount}`);
  logger(`Pending claims: ${summary.preparedCount + summary.retryableCount}`);
}

async function recordUnknownAndStop(
  repository: NewsletterEdition09CampaignRepository,
  claim: NewsletterEdition09CampaignClaim,
  errorCode: string,
  occurredAt: string,
): Promise<never> {
  try {
    await repository.recordUnknown({
      deliveryId: claim.deliveryId,
      claimId: claim.claimId,
      errorCode,
      occurredAt,
    });
  } catch {
    fail("unknown_persistence_failed");
  }
  fail("provider_result_unknown");
}

type NewsletterEdition09ProcessedBatch = {
  processedCount: number;
  variantCounts: Record<NewsletterEdition09ContentVariant, number>;
};

async function sendClaimedNewsletterEdition09Deliveries(
  options: ExecuteNewsletterEdition09CampaignOptions,
  campaignId: string,
  apiKey: string,
): Promise<NewsletterEdition09ProcessedBatch> {
  if (!options.clientFactory || !options.tokenFactory || !options.tokenHasher) {
    fail("server_dependencies_unavailable");
  }
  const client = options.clientFactory(apiKey);
  const now = options.now ?? (() => new Date());
  let processedCount = 0;
  const variantCounts: Record<NewsletterEdition09ContentVariant, number> = {
    national: 0,
  };
  while (processedCount < options.request.limit) {
    const rawToken = options.tokenFactory();
    const tokenHash = options.tokenHasher(rawToken);
    if (!HASH_PATTERN.test(tokenHash)) fail("token_hash_invalid");

    const claim = await options.repository.claimDelivery({
      campaignId,
      tokenHash,
      allowRetry: false,
    });
    if (!claim) break;
    assertClaim(claim);
    if (claim.campaignId !== campaignId) {
      fail("repository_contract_invalid");
    }

    const content = prepareEdition09Content(
      options.source,
      claim.contentVariant,
      unsubscribeUrl(rawToken),
    );
    const payload: NewsletterEdition09CampaignEmailPayload = {
      from: options.sender,
      to: [claim.recipientEmail],
      replyTo: options.replyTo,
      subject: NEWSLETTER_EDITION_09_SUBJECT,
      html: content.html,
      text: content.text,
      idempotencyKey: claim.idempotencyKey,
    };
    const occurredAt = now().toISOString();
    let providerResult: NewsletterEdition09CampaignClientResult | null = null;
    try {
      providerResult = await client.sendEmail(payload);
    } catch {
      await recordUnknownAndStop(
        options.repository,
        claim,
        "provider_connection_unknown",
        occurredAt,
      );
    }
    if (!providerResult) fail("provider_result_invalid");

    if (providerResult.status === "accepted") {
      if (!SAFE_PROVIDER_ID_PATTERN.test(providerResult.providerMessageId)) {
        await recordUnknownAndStop(
          options.repository,
          claim,
          "provider_response_unknown",
          occurredAt,
        );
      }
      try {
        await options.repository.recordAccepted({
          deliveryId: claim.deliveryId,
          claimId: claim.claimId,
          providerMessageId: providerResult.providerMessageId,
          occurredAt,
        });
      } catch {
        try {
          await options.repository.recordUnknown({
            deliveryId: claim.deliveryId,
            claimId: claim.claimId,
            errorCode: "accepted_persistence_unknown",
            occurredAt,
          });
        } catch {
          fail("unknown_persistence_failed");
        }
        fail("accepted_persistence_unknown");
      }
    } else {
      const failure = safeProviderFailure(providerResult);
      if (failure.unknown) {
        await recordUnknownAndStop(
          options.repository,
          claim,
          failure.errorCode,
          occurredAt,
        );
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
    variantCounts[claim.contentVariant] += 1;
    processedCount += 1;
  }
  return { processedCount, variantCounts };
}

export async function sendPreparedNewsletterEdition09Campaign(
  options: ExecuteNewsletterEdition09CampaignOptions,
): Promise<NewsletterEdition09CampaignResult> {
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  const identity = newsletterEdition09CampaignIdentity();
  const digest = newsletterEdition09CampaignDigest(identity);
  assertRequestMode(options.request);
  assertSafeEnvironment(environment);
  if (options.request.sendPrepared !== true) fail("send_prepared_mode_required");
  if (
    options.sender !== NEWSLETTER_EDITION_09_SENDER ||
    options.replyTo !== NEWSLETTER_EDITION_09_REPLY_TO
  ) {
    fail("mail_identity_invalid");
  }
  validateEdition09SourceIntegrity(options.source);
  if (identity.subject.startsWith("[PRUEBA]")) fail("test_subject_blocked");
  assertMutationGates(options.request, environment);
  const preparedCampaignSeal =
    options.preparedCampaignSeal ?? NEWSLETTER_EDITION_09_PREPARED_CAMPAIGN_SEAL;
  assertPreparedCampaignSeal(preparedCampaignSeal);
  if (options.request.confirmCampaignId !== preparedCampaignSeal.campaignId) {
    fail("prepared_campaign_confirmation_invalid");
  }
  if (options.request.limit !== preparedCampaignSeal.deliveryCount) {
    fail("prepared_delivery_limit_invalid");
  }
  const apiKey = requireResendApiKey(environment);
  const batch = await sendClaimedNewsletterEdition09Deliveries(
    options,
    preparedCampaignSeal.campaignId,
    apiKey,
  );
  if (batch.processedCount !== preparedCampaignSeal.deliveryCount) {
    fail("frozen_delivery_count_mismatch");
  }
  for (const variant of ["national"] as const) {
    if (
      batch.variantCounts[variant] !==
      preparedCampaignSeal.variantCounts[variant]
    ) {
      fail("frozen_variant_count_mismatch");
    }
  }
  logger(`Campaign: ${identity.editionKey}`);
  logger("Edition: 09");
  logger(`Prepared campaign ID: ${preparedCampaignSeal.campaignId}`);
  logger(`Digest: ${digest}`);
  logger(`Processed frozen deliveries: ${batch.processedCount}`);
  logger(`Processed variant national: ${batch.variantCounts.national}`);
  logger("NO CAMPAIGN PREPARE WAS CALLED");
  return {
    status: "prepared_sent",
    identity,
    digest,
    processedCount: batch.processedCount,
    summary: null,
    campaignId: preparedCampaignSeal.campaignId,
    processedVariantCounts: batch.variantCounts,
  };
}

export async function executeNewsletterEdition09Campaign(
  options: ExecuteNewsletterEdition09CampaignOptions,
): Promise<NewsletterEdition09CampaignResult> {
  if (options.request.sendPrepared === true) {
    return sendPreparedNewsletterEdition09Campaign(options);
  }
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  const identity = newsletterEdition09CampaignIdentity();
  const digest = newsletterEdition09CampaignDigest(identity);
  assertRequestMode(options.request);
  assertSafeEnvironment(environment);
  if (
    options.sender !== NEWSLETTER_EDITION_09_SENDER ||
    options.replyTo !== NEWSLETTER_EDITION_09_REPLY_TO
  ) {
    fail("mail_identity_invalid");
  }
  validateEdition09SourceIntegrity(options.source);
  if (identity.subject.startsWith("[PRUEBA]")) fail("test_subject_blocked");

  if (!options.request.prepareOnly) {
    const summary = await options.repository.previewCampaign(identity);
    assertSummary(summary);
    logSummary(logger, identity, digest, summary);
    logger("NO CAMPAIGN WAS PREPARED");
    logger("NO EMAIL WAS SENT");
    return {
      status: "dry_run",
      identity,
      digest,
      processedCount: 0,
      summary,
    };
  }

  assertMutationGates(options.request, environment);
  const preparedSummary = await options.repository.prepareCampaign(identity);
  assertSummary(preparedSummary);
  if (!preparedSummary.campaignId || !preparedSummary.audienceFrozenAt) {
    fail("campaign_not_frozen");
  }
  logSummary(logger, identity, digest, preparedSummary);

  logger("Prepare-only complete. Audience frozen; no delivery was claimed and no email was sent.");
  return {
    status: "prepared",
    identity,
    digest,
    processedCount: 0,
    summary: preparedSummary,
  };
}

export function parseNewsletterEdition09CampaignArguments(
  argv: readonly string[],
): NewsletterEdition09CampaignRequest {
  const request: NewsletterEdition09CampaignRequest = {
    sendPrepared: false,
    prepareOnly: false,
    limit: DEFAULT_LIMIT,
  };
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      argument === "--send-prepared" ||
      argument === "--prepare-only"
    ) {
      if (seen.has(argument)) fail("duplicate_argument");
      seen.add(argument);
      if (argument === "--send-prepared") request.sendPrepared = true;
      if (argument === "--prepare-only") request.prepareOnly = true;
      continue;
    }
    if (
      argument !== "--limit" &&
      argument !== "--confirm-edition" &&
      argument !== "--confirm-phrase" &&
      argument !== "--confirm-campaign-id"
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
    if (argument === "--confirm-campaign-id") request.confirmCampaignId = value;
  }
  assertRequestMode(request);
  return request;
}
