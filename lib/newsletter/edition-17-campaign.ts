import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";
import {
  NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_17_SUBJECT,
} from "@/lib/newsletter/edition-17-editorial";
import {
  NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256,
  NEWSLETTER_EDITION_17_HTML_SHA256,
  NEWSLETTER_EDITION_17_REPLY_TO,
  NEWSLETTER_EDITION_17_SENDER,
  NEWSLETTER_EDITION_17_TEXT_SHA256,
  prepareEdition17Content,
  validateEdition17SourceIntegrity,
  type NewsletterEdition17Source,
} from "@/lib/newsletter/edition-17-content";
import type { NewsletterEdition17ContentVariant } from "@/lib/newsletter/edition-17-territorial";

export const NEWSLETTER_EDITION_17_CAMPAIGN_CONFIRM_PHRASE =
  "SEND-AGENDA-MOTOR-2026-11-26";
export const NEWSLETTER_EDITION_17_CAMPAIGN_ARMED_VALUE =
  "agenda-motor-2026-11-26-manual-send";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const PROVIDER_ID = /^[A-Za-z0-9_./:+-]{1,200}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_./:-]{1,256}$/;

export type NewsletterEdition17CampaignRequest = {
  prepareOnly: boolean;
  sendPrepared: boolean;
  limit: number;
  confirmEdition?: string;
  confirmPhrase?: string;
  confirmCampaignId?: string;
};

export type NewsletterEdition17CampaignEnvironment = {
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

export type NewsletterEdition17CampaignIdentity = {
  editionKey: string;
  subject: string;
  htmlSha256: string;
  textSha256: string;
  contentManifestDigest: string;
};

export type NewsletterEdition17CampaignSummary = {
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
  excludedCount: number;
  duplicateCount: number;
  invalidCount: number;
};

export type NewsletterEdition17SnapshotAudit = {
  campaignId: string;
  campaignStatus: "prepared" | "sending" | "completed" | "paused";
  audienceFrozenAt: string;
  deliveryCount: number;
  preparedCount: number;
  sendingCount: number;
  acceptedCount: number;
  failedCount: number;
  unknownCount: number;
  nationalCount: number;
  madridCount: number;
  duplicateSubscriberCount: number;
  duplicateEmailCount: number;
  invalidVariantCount: number;
};

export type NewsletterEdition17PreparedCampaignSeal = {
  campaignId: string;
  deliveryCount: number;
  variantCounts: Readonly<Record<NewsletterEdition17ContentVariant, number>>;
};

export type NewsletterEdition17CampaignClaim = {
  deliveryId: string;
  campaignId: string;
  subscriberId: string;
  recipientEmail: string;
  claimId: string;
  attemptCount: number;
  idempotencyKey: string;
  contentVariant: NewsletterEdition17ContentVariant;
};

export interface NewsletterEdition17CampaignRepository {
  previewCampaign(identity: NewsletterEdition17CampaignIdentity): Promise<NewsletterEdition17CampaignSummary>;
  prepareCampaign(identity: NewsletterEdition17CampaignIdentity): Promise<NewsletterEdition17CampaignSummary>;
  auditFrozenCampaign(identity: NewsletterEdition17CampaignIdentity): Promise<NewsletterEdition17SnapshotAudit>;
  claimDelivery(input: { campaignId: string; tokenHash: string; allowRetry: false }): Promise<NewsletterEdition17CampaignClaim | null>;
  recordAccepted(input: { deliveryId: string; claimId: string; providerMessageId: string; occurredAt: string }): Promise<void>;
  recordFailed(input: { deliveryId: string; claimId: string; errorCode: string; retryable: boolean; occurredAt: string }): Promise<void>;
  recordUnknown(input: { deliveryId: string; claimId: string; errorCode: string; occurredAt: string }): Promise<void>;
}

export type NewsletterEdition17CampaignEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type NewsletterEdition17CampaignClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition17CampaignClient {
  sendEmail(payload: NewsletterEdition17CampaignEmailPayload): Promise<NewsletterEdition17CampaignClientResult>;
}

export type ExecuteNewsletterEdition17CampaignOptions = {
  request: NewsletterEdition17CampaignRequest;
  environment?: NewsletterEdition17CampaignEnvironment;
  source: NewsletterEdition17Source;
  repository: NewsletterEdition17CampaignRepository;
  sender: string;
  replyTo: string;
  clientFactory?: (apiKey: string) => NewsletterEdition17CampaignClient;
  tokenFactory?: () => string;
  tokenHasher?: (token: string) => string;
  now?: () => Date;
  logger?: (message: string) => void;
  preparedCampaignSeal?: NewsletterEdition17PreparedCampaignSeal | null;
};

export type NewsletterEdition17CampaignResult = {
  status: "dry_run" | "prepared" | "prepared_sent";
  identity: NewsletterEdition17CampaignIdentity;
  digest: string;
  processedCount: number;
  summary: NewsletterEdition17CampaignSummary | null;
  campaignId?: string;
};

export class NewsletterEdition17CampaignError extends Error {
  constructor(readonly code: string) {
    super(`Edition 17 campaign blocked: ${code}.`);
    this.name = "NewsletterEdition17CampaignError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition17CampaignError(code);
}

export function newsletterEdition17CampaignIdentity(): NewsletterEdition17CampaignIdentity {
  return {
    editionKey: NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_17_SUBJECT,
    htmlSha256: NEWSLETTER_EDITION_17_HTML_SHA256,
    textSha256: NEWSLETTER_EDITION_17_TEXT_SHA256,
    contentManifestDigest: NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256,
  };
}

export function newsletterEdition17CampaignDigest(identity: NewsletterEdition17CampaignIdentity): string {
  return createHash("sha256").update([
    identity.editionKey, identity.subject, identity.htmlSha256,
    identity.textSha256, identity.contentManifestDigest,
  ].join("\u0000"), "utf8").digest("hex");
}

function assertSafeEnvironment(environment: NewsletterEdition17CampaignEnvironment): void {
  if (environment.ci !== undefined) fail("ci_blocked");
  if (environment.vercel !== undefined || environment.vercelEnv !== undefined) fail("vercel_blocked");
  if (environment.nodeEnv === "production") fail("production_runtime_blocked");
}

function assertMutationGates(request: NewsletterEdition17CampaignRequest, environment: NewsletterEdition17CampaignEnvironment): void {
  if (request.confirmEdition !== NEWSLETTER_EDITION_17_CAMPAIGN_KEY) fail("edition_confirmation_invalid");
  if (request.confirmPhrase !== NEWSLETTER_EDITION_17_CAMPAIGN_CONFIRM_PHRASE) fail("confirmation_phrase_invalid");
  if (environment.armed !== NEWSLETTER_EDITION_17_CAMPAIGN_ARMED_VALUE) fail("send_not_armed");
  if (environment.newsletterMode !== "live") fail("mode_not_live");
  if (environment.mailTransport !== "resend") fail("transport_not_resend");
  if (environment.publicLaunchEnabled !== "public-newsletter-live") fail("public_launch_not_armed");
}

function assertSummary(summary: NewsletterEdition17CampaignSummary): void {
  const counts = [
    summary.eligibleCount, summary.preparedCount, summary.sendingCount,
    summary.acceptedCount, summary.failedCount, summary.unknownCount,
    summary.retryableCount, summary.nationalCount, summary.madridCount,
    summary.excludedCount, summary.duplicateCount, summary.invalidCount,
  ];
  if (
    counts.some((value) => !Number.isInteger(value) || value < 0) ||
    (summary.campaignId !== null && !UUID.test(summary.campaignId)) ||
    (summary.audienceFrozenAt !== null && !Number.isFinite(Date.parse(summary.audienceFrozenAt))) ||
    summary.nationalCount + summary.madridCount !== summary.eligibleCount
  ) fail("repository_contract_invalid");
}

function assertFreshPreview(summary: NewsletterEdition17CampaignSummary): void {
  assertSummary(summary);
  if (
    summary.campaignStatus !== "not_created" || summary.campaignId !== null ||
    summary.audienceFrozenAt !== null || summary.eligibleCount < 1 ||
    summary.eligibleCount > MAX_LIMIT || summary.duplicateCount !== 0 ||
    summary.invalidCount !== 0 || summary.preparedCount !== 0 ||
    summary.sendingCount !== 0 || summary.acceptedCount !== 0 ||
    summary.failedCount !== 0 || summary.unknownCount !== 0
  ) fail("preview_gate_failed");
}

function assertFrozenSummary(before: NewsletterEdition17CampaignSummary, after: NewsletterEdition17CampaignSummary): void {
  assertSummary(after);
  if (
    after.campaignStatus !== "prepared" || !after.campaignId ||
    !after.audienceFrozenAt || after.eligibleCount !== before.eligibleCount ||
    after.nationalCount !== before.nationalCount || after.madridCount !== before.madridCount ||
    after.preparedCount !== before.eligibleCount || after.sendingCount !== 0 ||
    after.acceptedCount !== 0 || after.failedCount !== 0 || after.unknownCount !== 0 ||
    after.duplicateCount !== 0 || after.invalidCount !== 0
  ) fail("frozen_snapshot_mismatch");
}

function assertSnapshotAudit(audit: NewsletterEdition17SnapshotAudit): void {
  const counts = [
    audit.deliveryCount, audit.preparedCount, audit.sendingCount,
    audit.acceptedCount, audit.failedCount, audit.unknownCount,
    audit.nationalCount, audit.madridCount, audit.duplicateSubscriberCount,
    audit.duplicateEmailCount, audit.invalidVariantCount,
  ];
  if (
    !UUID.test(audit.campaignId) || !Number.isFinite(Date.parse(audit.audienceFrozenAt)) ||
    counts.some((value) => !Number.isInteger(value) || value < 0) ||
    audit.deliveryCount < 1 || audit.deliveryCount > MAX_LIMIT ||
    audit.nationalCount + audit.madridCount !== audit.deliveryCount ||
    audit.preparedCount + audit.sendingCount + audit.acceptedCount +
      audit.failedCount + audit.unknownCount !== audit.deliveryCount ||
    audit.duplicateSubscriberCount !== 0 || audit.duplicateEmailCount !== 0 ||
    audit.invalidVariantCount !== 0
  ) fail("frozen_snapshot_audit_invalid");
}

function assertPreparedSeal(seal: NewsletterEdition17PreparedCampaignSeal | null | undefined): asserts seal is NewsletterEdition17PreparedCampaignSeal {
  if (
    !seal || !UUID.test(seal.campaignId) ||
    !Number.isInteger(seal.deliveryCount) || seal.deliveryCount < 1 || seal.deliveryCount > MAX_LIMIT ||
    !Number.isInteger(seal.variantCounts.national) || seal.variantCounts.national < 0 ||
    !Number.isInteger(seal.variantCounts.madrid) || seal.variantCounts.madrid < 0 ||
    seal.variantCounts.national + seal.variantCounts.madrid !== seal.deliveryCount
  ) fail("prepared_campaign_seal_invalid");
}

function assertClaim(claim: NewsletterEdition17CampaignClaim, campaignId: string): void {
  if (
    !UUID.test(claim.deliveryId) || !UUID.test(claim.campaignId) ||
    !UUID.test(claim.subscriberId) || !UUID.test(claim.claimId) ||
    claim.campaignId !== campaignId || claim.attemptCount !== 1 ||
    !IDEMPOTENCY_KEY.test(claim.idempotencyKey) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claim.recipientEmail) ||
    !["national", "madrid"].includes(claim.contentVariant)
  ) fail("repository_contract_invalid");
}

async function recordUnknownAndStop(
  repository: NewsletterEdition17CampaignRepository,
  claim: NewsletterEdition17CampaignClaim,
  errorCode: string,
  occurredAt: string,
): Promise<never> {
  try {
    await repository.recordUnknown({ deliveryId: claim.deliveryId, claimId: claim.claimId, errorCode, occurredAt });
  } catch {
    fail("unknown_persistence_failed");
  }
  fail("provider_result_unknown");
}

function requireApiKey(environment: NewsletterEdition17CampaignEnvironment): string {
  if (
    !environment.apiKey || environment.apiKey.length < 20 || environment.apiKey.length > 500 ||
    environment.apiKey !== environment.apiKey.trim() || /[\s\u0000-\u001f\u007f]/.test(environment.apiKey)
  ) fail("api_key_unavailable");
  return environment.apiKey;
}

function unsubscribeUrl(token: string): string {
  const url = new URL("/newsletter/unsubscribe", "https://www.eventomotor.com");
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendPrepared(options: ExecuteNewsletterEdition17CampaignOptions, identity: NewsletterEdition17CampaignIdentity, digest: string): Promise<NewsletterEdition17CampaignResult> {
  const environment = options.environment ?? {};
  assertMutationGates(options.request, environment);
  const seal = options.preparedCampaignSeal;
  assertPreparedSeal(seal);
  if (options.request.confirmCampaignId !== seal.campaignId) fail("prepared_campaign_confirmation_invalid");
  if (options.request.limit !== seal.deliveryCount) fail("prepared_delivery_limit_invalid");
  const before = await options.repository.auditFrozenCampaign(identity);
  assertSnapshotAudit(before);
  if (
    before.campaignId !== seal.campaignId || before.campaignStatus !== "prepared" ||
    before.deliveryCount !== seal.deliveryCount ||
    before.nationalCount !== seal.variantCounts.national ||
    before.madridCount !== seal.variantCounts.madrid ||
    before.preparedCount !== seal.deliveryCount || before.sendingCount !== 0 ||
    before.acceptedCount !== 0 || before.failedCount !== 0 || before.unknownCount !== 0
  ) fail("prepared_snapshot_mismatch");
  if (!options.clientFactory || !options.tokenFactory || !options.tokenHasher) fail("server_dependencies_unavailable");
  const client = options.clientFactory(requireApiKey(environment));
  const counts: Record<NewsletterEdition17ContentVariant, number> = { national: 0, madrid: 0 };
  const now = options.now ?? (() => new Date());
  let processedCount = 0;
  while (processedCount < seal.deliveryCount) {
    const token = options.tokenFactory();
    if (!isValidNewsletterActionTokenShape(token)) fail("token_shape_invalid");
    const tokenHash = options.tokenHasher(token);
    if (!HASH.test(tokenHash)) fail("token_hash_invalid");
    const claim = await options.repository.claimDelivery({
      campaignId: seal.campaignId, tokenHash, allowRetry: false,
    });
    if (!claim) fail("frozen_delivery_count_mismatch");
    assertClaim(claim, seal.campaignId);
    const content = prepareEdition17Content(options.source, claim.contentVariant, unsubscribeUrl(token));
    const occurredAt = now().toISOString();
    let result: NewsletterEdition17CampaignClientResult | null = null;
    try {
      result = await client.sendEmail({
        from: options.sender, to: [claim.recipientEmail], replyTo: options.replyTo,
        subject: NEWSLETTER_EDITION_17_SUBJECT, html: content.html,
        text: content.text, idempotencyKey: claim.idempotencyKey,
      });
    } catch {
      await recordUnknownAndStop(options.repository, claim, "provider_connection_unknown", occurredAt);
    }
    if (!result) fail("provider_result_invalid");
    if (result.status === "accepted") {
      if (!PROVIDER_ID.test(result.providerMessageId)) {
        await recordUnknownAndStop(options.repository, claim, "provider_response_unknown", occurredAt);
      }
      try {
        await options.repository.recordAccepted({
          deliveryId: claim.deliveryId, claimId: claim.claimId,
          providerMessageId: result.providerMessageId, occurredAt,
        });
      } catch {
        await recordUnknownAndStop(options.repository, claim, "accepted_persistence_unknown", occurredAt);
      }
    } else if (result.status === "provider_error" && result.httpStatus !== null && result.httpStatus >= 400 && result.httpStatus < 500 && result.httpStatus !== 408) {
      await options.repository.recordFailed({
        deliveryId: claim.deliveryId, claimId: claim.claimId,
        errorCode: `provider_http_${result.httpStatus}`,
        retryable: result.httpStatus === 429, occurredAt,
      });
      fail("provider_rejected_no_retry");
    } else {
      await recordUnknownAndStop(options.repository, claim, "provider_result_unknown", occurredAt);
    }
    counts[claim.contentVariant] += 1;
    processedCount += 1;
  }
  if (
    counts.national !== seal.variantCounts.national ||
    counts.madrid !== seal.variantCounts.madrid
  ) fail("frozen_variant_count_mismatch");
  const after = await options.repository.auditFrozenCampaign(identity);
  assertSnapshotAudit(after);
  if (
    after.campaignId !== seal.campaignId || after.campaignStatus !== "completed" ||
    after.deliveryCount !== seal.deliveryCount || after.acceptedCount !== seal.deliveryCount ||
    after.preparedCount !== 0 || after.sendingCount !== 0 ||
    after.failedCount !== 0 || after.unknownCount !== 0 ||
    after.nationalCount !== seal.variantCounts.national ||
    after.madridCount !== seal.variantCounts.madrid
  ) fail("post_send_snapshot_mismatch");
  options.logger?.(`Edition: 17; campaign: ${identity.editionKey}; processed frozen deliveries: ${processedCount}; no prepare called`);
  return { status: "prepared_sent", identity, digest, processedCount, summary: null, campaignId: seal.campaignId };
}

export async function executeNewsletterEdition17Campaign(options: ExecuteNewsletterEdition17CampaignOptions): Promise<NewsletterEdition17CampaignResult> {
  const request = options.request;
  const environment = options.environment ?? {};
  const identity = newsletterEdition17CampaignIdentity();
  const digest = newsletterEdition17CampaignDigest(identity);
  if (request.prepareOnly && request.sendPrepared) fail("request_mode_conflict");
  if (request.confirmCampaignId && !request.sendPrepared) fail("campaign_id_confirmation_unexpected");
  assertSafeEnvironment(environment);
  if (options.sender !== NEWSLETTER_EDITION_17_SENDER || options.replyTo !== NEWSLETTER_EDITION_17_REPLY_TO) fail("mail_identity_invalid");
  validateEdition17SourceIntegrity(options.source);
  if (identity.subject.startsWith("[PRUEBA]")) fail("test_subject_blocked");
  if (request.sendPrepared) return sendPrepared(options, identity, digest);
  if (!request.prepareOnly) {
    const summary = await options.repository.previewCampaign(identity);
    assertSummary(summary);
    options.logger?.(`Edition: 17; campaign: ${identity.editionKey}; status: ${summary.campaignStatus}; eligible: ${summary.eligibleCount}; national: ${summary.nationalCount}; madrid: ${summary.madridCount}; duplicates: ${summary.duplicateCount}; invalid: ${summary.invalidCount}; no prepare or provider call`);
    return { status: "dry_run", identity, digest, processedCount: 0, summary };
  }
  assertMutationGates(request, environment);
  const preview = await options.repository.previewCampaign(identity);
  assertFreshPreview(preview);
  const summary = await options.repository.prepareCampaign(identity);
  assertFrozenSummary(preview, summary);
  const audit = await options.repository.auditFrozenCampaign(identity);
  assertSnapshotAudit(audit);
  if (
    audit.campaignId !== summary.campaignId || audit.campaignStatus !== "prepared" ||
    audit.deliveryCount !== summary.eligibleCount || audit.preparedCount !== summary.eligibleCount ||
    audit.nationalCount !== summary.nationalCount || audit.madridCount !== summary.madridCount ||
    audit.sendingCount !== 0 || audit.acceptedCount !== 0 ||
    audit.failedCount !== 0 || audit.unknownCount !== 0
  ) fail("frozen_snapshot_mismatch");
  options.logger?.(`Edition: 17; campaign: ${identity.editionKey}; frozen: ${summary.eligibleCount}; national: ${summary.nationalCount}; madrid: ${summary.madridCount}; no provider call`);
  return { status: "prepared", identity, digest, processedCount: 0, summary };
}

export function parseNewsletterEdition17CampaignArguments(argv: readonly string[]): NewsletterEdition17CampaignRequest {
  const request: NewsletterEdition17CampaignRequest = { prepareOnly: false, sendPrepared: false, limit: DEFAULT_LIMIT };
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || seen.has(arg)) fail("duplicate_or_empty_argument");
    seen.add(arg);
    if (arg === "--prepare-only") { request.prepareOnly = true; continue; }
    if (arg === "--send-prepared") { request.sendPrepared = true; continue; }
    if (!["--limit", "--confirm-edition", "--confirm-phrase", "--confirm-campaign-id"].includes(arg)) fail("unknown_argument");
    const value = argv[++index];
    if (!value || value.startsWith("--")) fail("argument_value_missing");
    if (arg === "--limit") {
      request.limit = Number(value);
      if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > MAX_LIMIT) fail("limit_invalid");
    }
    if (arg === "--confirm-edition") request.confirmEdition = value;
    if (arg === "--confirm-phrase") request.confirmPhrase = value;
    if (arg === "--confirm-campaign-id") request.confirmCampaignId = value;
  }
  if (request.prepareOnly && request.sendPrepared) fail("request_mode_conflict");
  if (request.confirmCampaignId && !request.sendPrepared) fail("campaign_id_confirmation_unexpected");
  return request;
}
