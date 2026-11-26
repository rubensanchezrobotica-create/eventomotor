import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  NewsletterEdition17CampaignClaim,
  NewsletterEdition17CampaignIdentity,
  NewsletterEdition17CampaignRepository,
  NewsletterEdition17CampaignSummary,
  NewsletterEdition17SnapshotAudit,
} from "@/lib/newsletter/edition-17-campaign";
import { createSupabaseServerClient, type Database } from "@/lib/supabase";

type Functions = Database["public"]["Functions"];
type SummaryRow = Functions["preview_newsletter_campaign_edition_17"]["Returns"][number];
type AuditRow = Functions["audit_newsletter_campaign_edition_17"]["Returns"][number];
type ClaimRow = Functions["claim_newsletter_campaign_delivery_v2"]["Returns"][number];
type RpcResult<Row> = { data: Row[] | null; error: { message: string; code?: string } | null };

export interface NewsletterEdition17CampaignRpcGateway {
  previewCampaign(args: Functions["preview_newsletter_campaign_edition_17"]["Args"]): Promise<RpcResult<SummaryRow>>;
  prepareCampaign(args: Functions["prepare_newsletter_campaign_edition_17"]["Args"]): Promise<RpcResult<SummaryRow>>;
  auditFrozenCampaign(args: Functions["audit_newsletter_campaign_edition_17"]["Args"]): Promise<RpcResult<AuditRow>>;
  claimDelivery(args: Functions["claim_newsletter_campaign_delivery_v2"]["Args"]): Promise<RpcResult<ClaimRow>>;
  recordAccepted(args: Functions["record_newsletter_campaign_delivery_accepted"]["Args"]): Promise<RpcResult<{ outcome: string }>>;
  recordFailed(args: Functions["record_newsletter_campaign_delivery_failed"]["Args"]): Promise<RpcResult<{ outcome: string }>>;
  recordUnknown(args: Functions["record_newsletter_campaign_delivery_unknown"]["Args"]): Promise<RpcResult<{ outcome: string }>>;
}

function fail(): never {
  throw new Error("Newsletter edition 16 persistence operation failed safely.");
}

function one<Row>(result: RpcResult<Row>): Row {
  if (result.error || !result.data || result.data.length !== 1) fail();
  return result.data[0];
}

function summary(row: SummaryRow): NewsletterEdition17CampaignSummary {
  if (!["not_created", "prepared", "sending", "completed", "paused"].includes(row.campaign_status)) fail();
  return {
    campaignId: row.campaign_id,
    campaignStatus: row.campaign_status as NewsletterEdition17CampaignSummary["campaignStatus"],
    audienceFrozenAt: row.audience_frozen_at,
    eligibleCount: row.eligible_count,
    preparedCount: row.prepared_count,
    sendingCount: row.sending_count,
    acceptedCount: row.accepted_count,
    failedCount: row.failed_count,
    unknownCount: row.unknown_count,
    retryableCount: row.retryable_count,
    nationalCount: row.national_count,
    madridCount: row.madrid_count,
    excludedCount: row.excluded_count,
    duplicateCount: row.duplicate_count,
    invalidCount: row.invalid_count,
  };
}

function identityArgs(identity: NewsletterEdition17CampaignIdentity) {
  return {
    p_edition_key: identity.editionKey,
    p_subject: identity.subject,
    p_html_sha256: identity.htmlSha256,
    p_text_sha256: identity.textSha256,
    p_content_manifest_digest: identity.contentManifestDigest,
  };
}

function snapshotAudit(row: AuditRow): NewsletterEdition17SnapshotAudit {
  if (!["prepared", "sending", "completed", "paused"].includes(row.campaign_status)) fail();
  return {
    campaignId: row.campaign_id,
    campaignStatus: row.campaign_status as NewsletterEdition17SnapshotAudit["campaignStatus"],
    audienceFrozenAt: row.audience_frozen_at,
    deliveryCount: row.delivery_count,
    preparedCount: row.prepared_count,
    sendingCount: row.sending_count,
    acceptedCount: row.accepted_count,
    failedCount: row.failed_count,
    unknownCount: row.unknown_count,
    nationalCount: row.national_count,
    madridCount: row.madrid_count,
    duplicateSubscriberCount: row.duplicate_subscriber_count,
    duplicateEmailCount: row.duplicate_email_count,
    invalidVariantCount: row.invalid_variant_count,
  };
}

function recorded(result: RpcResult<{ outcome: string }>): void {
  if (one(result).outcome !== "recorded") fail();
}

export function createNewsletterEdition17CampaignRpcGateway(client: SupabaseClient<Database>): NewsletterEdition17CampaignRpcGateway {
  return {
    async previewCampaign(args) {
      const { data, error } = await client.rpc("preview_newsletter_campaign_edition_17", args);
      return { data, error };
    },
    async prepareCampaign(args) {
      const { data, error } = await client.rpc("prepare_newsletter_campaign_edition_17", args);
      return { data, error };
    },
    async auditFrozenCampaign(args) {
      const { data, error } = await client.rpc("audit_newsletter_campaign_edition_17", args);
      return { data, error };
    },
    async claimDelivery(args) {
      const { data, error } = await client.rpc("claim_newsletter_campaign_delivery_v2", args);
      return { data, error };
    },
    async recordAccepted(args) {
      const { data, error } = await client.rpc("record_newsletter_campaign_delivery_accepted", args);
      return { data, error };
    },
    async recordFailed(args) {
      const { data, error } = await client.rpc("record_newsletter_campaign_delivery_failed", args);
      return { data, error };
    },
    async recordUnknown(args) {
      const { data, error } = await client.rpc("record_newsletter_campaign_delivery_unknown", args);
      return { data, error };
    },
  };
}

export function createNewsletterEdition17CampaignRepository(gateway: NewsletterEdition17CampaignRpcGateway): NewsletterEdition17CampaignRepository {
  return {
    async previewCampaign(identity) {
      return summary(one(await gateway.previewCampaign(identityArgs(identity))));
    },
    async prepareCampaign(identity) {
      return summary(one(await gateway.prepareCampaign(identityArgs(identity))));
    },
    async auditFrozenCampaign(identity) {
      return snapshotAudit(one(await gateway.auditFrozenCampaign(identityArgs(identity))));
    },
    async claimDelivery(input) {
      const result = await gateway.claimDelivery({
        p_campaign_id: input.campaignId,
        p_token_hash: input.tokenHash,
        p_allow_retry: false,
      });
      if (result.error || !result.data || result.data.length > 1) fail();
      if (result.data.length === 0) return null;
      const row = result.data[0];
      if (row.content_variant !== "national" && row.content_variant !== "madrid") fail();
      const claim: NewsletterEdition17CampaignClaim = {
        deliveryId: row.delivery_id,
        campaignId: row.campaign_id,
        subscriberId: row.subscriber_id,
        recipientEmail: row.recipient_email,
        claimId: row.claim_id,
        attemptCount: row.attempt_count,
        idempotencyKey: row.idempotency_key,
        contentVariant: row.content_variant,
      };
      return claim;
    },
    async recordAccepted(input) {
      recorded(await gateway.recordAccepted({
        p_delivery_id: input.deliveryId, p_claim_id: input.claimId,
        p_provider_message_id: input.providerMessageId, p_occurred_at: input.occurredAt,
      }));
    },
    async recordFailed(input) {
      recorded(await gateway.recordFailed({
        p_delivery_id: input.deliveryId, p_claim_id: input.claimId,
        p_error_code: input.errorCode, p_retryable: input.retryable,
        p_occurred_at: input.occurredAt,
      }));
    },
    async recordUnknown(input) {
      recorded(await gateway.recordUnknown({
        p_delivery_id: input.deliveryId, p_claim_id: input.claimId,
        p_error_code: input.errorCode, p_occurred_at: input.occurredAt,
      }));
    },
  };
}

export function createConfiguredNewsletterEdition17CampaignRepository(): NewsletterEdition17CampaignRepository | null {
  const client = createSupabaseServerClient();
  return client ? createNewsletterEdition17CampaignRepository(createNewsletterEdition17CampaignRpcGateway(client)) : null;
}
