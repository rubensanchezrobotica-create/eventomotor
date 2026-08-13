import { createHash } from "node:crypto";

import {
  NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_02_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_02_HTML_SHA256,
  NEWSLETTER_EDITION_02_REPLY_TO,
  NEWSLETTER_EDITION_02_SENDER,
  NEWSLETTER_EDITION_02_SUBJECT,
  NEWSLETTER_EDITION_02_TEXT_SHA256,
  prepareEdition02Content,
  validateEdition02SourceIntegrity,
  type NewsletterEdition02ContentVariant,
  type NewsletterEdition02Source,
} from "@/lib/newsletter/edition-02-content";

export {
  NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_02_REPLY_TO,
  NEWSLETTER_EDITION_02_SENDER,
  NEWSLETTER_EDITION_02_SUBJECT,
} from "@/lib/newsletter/edition-02-content";

export const NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE =
  "SEND-AGENDA-MOTOR-2026-08-13";
export const NEWSLETTER_EDITION_02_CAMPAIGN_ARMED_VALUE =
  "agenda-motor-2026-08-13-manual-send";
export const NEWSLETTER_EDITION_02_UNSUBSCRIBE_ORIGIN =
  "https://www.eventomotor.com";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_PROVIDER_ID_PATTERN = /^[A-Za-z0-9_./:+-]{1,200}$/;
const SAFE_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_./:-]{1,256}$/;

export type NewsletterEdition02CampaignRequest = {
  send: boolean;
  prepareOnly: boolean;
  resume: boolean;
  limit: number;
  confirmEdition?: string;
  confirmPhrase?: string;
};

export type NewsletterEdition02CampaignEnvironment = {
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

export type NewsletterEdition02CampaignIdentity = {
  editionKey: string;
  subject: string;
  htmlSha256: string;
  textSha256: string;
  contentManifestDigest: string;
};

export type NewsletterEdition02CampaignSummary = {
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
  aCorunaCount: number;
  barcelonaCount: number;
  excludedCount: number;
  duplicateCount: number;
  invalidCount: number;
};

export type NewsletterEdition02CampaignClaim = {
  deliveryId: string;
  campaignId: string;
  subscriberId: string;
  recipientEmail: string;
  claimId: string;
  attemptCount: number;
  idempotencyKey: string;
  contentVariant: NewsletterEdition02ContentVariant;
};

export interface NewsletterEdition02CampaignRepository {
  previewCampaign(
    identity: NewsletterEdition02CampaignIdentity,
  ): Promise<NewsletterEdition02CampaignSummary>;
  prepareCampaign(
    identity: NewsletterEdition02CampaignIdentity,
  ): Promise<NewsletterEdition02CampaignSummary>;
  claimDelivery(input: {
    campaignId: string;
    tokenHash: string;
    allowRetry: boolean;
  }): Promise<NewsletterEdition02CampaignClaim | null>;
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

export type NewsletterEdition02CampaignEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type NewsletterEdition02CampaignClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition02CampaignClient {
  sendEmail(
    payload: NewsletterEdition02CampaignEmailPayload,
  ): Promise<NewsletterEdition02CampaignClientResult>;
}

export type ExecuteNewsletterEdition02CampaignOptions = {
  request: NewsletterEdition02CampaignRequest;
  environment?: NewsletterEdition02CampaignEnvironment;
  source: NewsletterEdition02Source;
  repository: NewsletterEdition02CampaignRepository;
  sender: string;
  replyTo: string;
  clientFactory?: (apiKey: string) => NewsletterEdition02CampaignClient;
  tokenFactory?: () => string;
  tokenHasher?: (token: string) => string;
  now?: () => Date;
  logger?: (message: string) => void;
};

export type NewsletterEdition02CampaignResult = {
  status: "dry_run" | "prepared" | "completed";
  identity: NewsletterEdition02CampaignIdentity;
  digest: string;
  processedCount: number;
  summary: NewsletterEdition02CampaignSummary;
};

export class NewsletterEdition02CampaignError extends Error {
  constructor(readonly code: string) {
    super(`Edition 02 campaign blocked: ${code}.`);
    this.name = "NewsletterEdition02CampaignError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition02CampaignError(code);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function newsletterEdition02CampaignIdentity(): NewsletterEdition02CampaignIdentity {
  return {
    editionKey: NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_02_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_02_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_02_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_02_CONTENT_MANIFEST_SHA256,
  };
}

export function newsletterEdition02CampaignDigest(
  identity: NewsletterEdition02CampaignIdentity,
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
  environment: NewsletterEdition02CampaignEnvironment,
): void {
  if (environment.ci !== undefined) fail("ci_blocked");
  if (environment.vercel !== undefined || environment.vercelEnv !== undefined) {
    fail("vercel_blocked");
  }
  if (environment.nodeEnv === "production") fail("production_runtime_blocked");
}

function assertMutationGates(
  request: NewsletterEdition02CampaignRequest,
  environment: NewsletterEdition02CampaignEnvironment,
): void {
  if (request.confirmEdition !== NEWSLETTER_EDITION_02_CAMPAIGN_KEY) {
    fail("edition_confirmation_invalid");
  }
  if (request.confirmPhrase !== NEWSLETTER_EDITION_02_CAMPAIGN_CONFIRM_PHRASE) {
    fail("confirmation_phrase_invalid");
  }
  if (environment.armed !== NEWSLETTER_EDITION_02_CAMPAIGN_ARMED_VALUE) {
    fail("send_not_armed");
  }
  if (environment.newsletterMode !== "live") fail("mode_not_live");
  if (environment.mailTransport !== "resend") fail("transport_not_resend");
  if (environment.publicLaunchEnabled !== "public-newsletter-live") {
    fail("public_launch_not_armed");
  }
}

function requireResendApiKey(
  environment: NewsletterEdition02CampaignEnvironment,
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

function assertRequestMode(request: NewsletterEdition02CampaignRequest): void {
  if (request.send && request.prepareOnly) fail("send_prepare_only_conflict");
  if (request.resume && !request.send) fail("resume_requires_send");
}

function assertSummary(summary: NewsletterEdition02CampaignSummary): void {
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
    summary.aCorunaCount,
    summary.barcelonaCount,
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
      summary.aCorunaCount +
      summary.barcelonaCount !==
      summary.eligibleCount
  ) {
    fail("repository_contract_invalid");
  }
}

function assertClaim(claim: NewsletterEdition02CampaignClaim): void {
  if (
    !UUID_PATTERN.test(claim.deliveryId) ||
    !UUID_PATTERN.test(claim.campaignId) ||
    !UUID_PATTERN.test(claim.subscriberId) ||
    !UUID_PATTERN.test(claim.claimId) ||
    !Number.isInteger(claim.attemptCount) ||
    claim.attemptCount < 1 ||
    !SAFE_IDEMPOTENCY_KEY_PATTERN.test(claim.idempotencyKey) ||
    !claim.recipientEmail.includes("@") ||
    !["national", "madrid", "a-coruna", "barcelona"].includes(
      claim.contentVariant,
    )
  ) {
    fail("repository_contract_invalid");
  }
}

function unsubscribeUrl(rawToken: string): string {
  const url = new URL(
    "/newsletter/unsubscribe",
    NEWSLETTER_EDITION_02_UNSUBSCRIBE_ORIGIN,
  );
  url.searchParams.set("token", rawToken);
  return url.toString();
}

function safeProviderFailure(result: NewsletterEdition02CampaignClientResult): {
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
  identity: NewsletterEdition02CampaignIdentity,
  digest: string,
  summary: NewsletterEdition02CampaignSummary,
): void {
  logger(`Campaign: ${identity.editionKey}`);
  logger(`Campaign ID: ${summary.campaignId ?? "not-created"}`);
  logger(`Campaign status: ${summary.campaignStatus}`);
  logger(`Digest: ${digest}`);
  logger(`Content manifest: ${identity.contentManifestDigest}`);
  logger(`Subject: ${identity.subject}`);
  logger(`Eligible audience: ${summary.eligibleCount}`);
  logger(`National: ${summary.nationalCount}`);
  logger(`Madrid: ${summary.madridCount}`);
  logger(`A Coruña: ${summary.aCorunaCount}`);
  logger(`Barcelona: ${summary.barcelonaCount}`);
  logger(`Excluded: ${summary.excludedCount}`);
  logger(`Duplicates: ${summary.duplicateCount}`);
  logger(`Invalid: ${summary.invalidCount}`);
  logger(`Audience frozen at: ${summary.audienceFrozenAt ?? "not-frozen"}`);
  logger(`Prepared: ${summary.preparedCount}`);
  logger(`Previously accepted: ${summary.acceptedCount}`);
  logger(`Failed: ${summary.failedCount}`);
  logger(`Unknown: ${summary.unknownCount}`);
  logger(`Pending claims: ${summary.preparedCount + summary.retryableCount}`);
}

async function recordUnknownAndStop(
  repository: NewsletterEdition02CampaignRepository,
  claim: NewsletterEdition02CampaignClaim,
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

export async function executeNewsletterEdition02Campaign(
  options: ExecuteNewsletterEdition02CampaignOptions,
): Promise<NewsletterEdition02CampaignResult> {
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  const identity = newsletterEdition02CampaignIdentity();
  const digest = newsletterEdition02CampaignDigest(identity);
  assertRequestMode(options.request);
  assertSafeEnvironment(environment);
  if (
    options.sender !== NEWSLETTER_EDITION_02_SENDER ||
    options.replyTo !== NEWSLETTER_EDITION_02_REPLY_TO
  ) {
    fail("mail_identity_invalid");
  }
  validateEdition02SourceIntegrity(options.source);
  if (identity.subject.startsWith("[PRUEBA]")) fail("test_subject_blocked");

  if (!options.request.send && !options.request.prepareOnly) {
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

  assertMutationGates(options.request, environment);
  const apiKey = options.request.send ? requireResendApiKey(environment) : null;
  const preparedSummary = await options.repository.prepareCampaign(identity);
  assertSummary(preparedSummary);
  if (!preparedSummary.campaignId || !preparedSummary.audienceFrozenAt) {
    fail("campaign_not_frozen");
  }
  logSummary(logger, identity, digest, preparedSummary);

  if (options.request.prepareOnly) {
    logger("Prepare-only complete. Audience frozen; no delivery was claimed and no email was sent.");
    return {
      status: "prepared",
      identity,
      digest,
      processedCount: 0,
      summary: preparedSummary,
    };
  }

  if (
    preparedSummary.campaignStatus === "paused" ||
    preparedSummary.unknownCount > 0
  ) {
    fail("campaign_paused_unknown");
  }
  if (!options.clientFactory || !options.tokenFactory || !options.tokenHasher) {
    fail("server_dependencies_unavailable");
  }
  if (!apiKey) fail("api_key_unavailable");

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

    const content = prepareEdition02Content(
      options.source,
      claim.contentVariant,
      unsubscribeUrl(rawToken),
    );
    const payload: NewsletterEdition02CampaignEmailPayload = {
      from: options.sender,
      to: [claim.recipientEmail],
      replyTo: options.replyTo,
      subject: identity.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: claim.idempotencyKey,
    };
    const occurredAt = now().toISOString();
    let providerResult: NewsletterEdition02CampaignClientResult | null = null;
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

export function parseNewsletterEdition02CampaignArguments(
  argv: readonly string[],
): NewsletterEdition02CampaignRequest {
  const request: NewsletterEdition02CampaignRequest = {
    send: false,
    prepareOnly: false,
    resume: false,
    limit: DEFAULT_LIMIT,
  };
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      argument === "--send" ||
      argument === "--prepare-only" ||
      argument === "--resume"
    ) {
      if (seen.has(argument)) fail("duplicate_argument");
      seen.add(argument);
      if (argument === "--send") request.send = true;
      if (argument === "--prepare-only") request.prepareOnly = true;
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
  if (request.send && request.prepareOnly) fail("send_prepare_only_conflict");
  if (request.resume && !request.send) fail("resume_requires_send");
  return request;
}
