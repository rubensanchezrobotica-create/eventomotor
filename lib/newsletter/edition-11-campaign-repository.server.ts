import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  NewsletterEdition11CampaignClaim,
  NewsletterEdition11CampaignIdentity,
  NewsletterEdition11CampaignRepository,
  NewsletterEdition11CampaignSummary,
} from "@/lib/newsletter/edition-11-campaign";
import {
  createSupabaseServerClient,
  type Database,
} from "@/lib/supabase";

type Functions = Database["public"]["Functions"];
type SummaryRow =
  Functions["preview_newsletter_campaign_edition_11"]["Returns"][number];
type ClaimRow = Functions["claim_newsletter_campaign_delivery_v2"]["Returns"][number];
type RpcError = { message: string; code?: string };
type RpcResult<Row> = { data: Row[] | null; error: RpcError | null };

export interface NewsletterEdition11CampaignRpcGateway {
  previewCampaign(
    args: Functions["preview_newsletter_campaign_edition_11"]["Args"],
  ): Promise<RpcResult<SummaryRow>>;
  prepareCampaign(
    args: Functions["prepare_newsletter_campaign_edition_11"]["Args"],
  ): Promise<RpcResult<SummaryRow>>;
  claimDelivery(
    args: Functions["claim_newsletter_campaign_delivery_v2"]["Args"],
  ): Promise<RpcResult<ClaimRow>>;
  recordAccepted(
    args: Functions["record_newsletter_campaign_delivery_accepted"]["Args"],
  ): Promise<RpcResult<{ outcome: string }>>;
  recordFailed(
    args: Functions["record_newsletter_campaign_delivery_failed"]["Args"],
  ): Promise<RpcResult<{ outcome: string }>>;
  recordUnknown(
    args: Functions["record_newsletter_campaign_delivery_unknown"]["Args"],
  ): Promise<RpcResult<{ outcome: string }>>;
}

function persistenceFailure(): Error {
  return new Error("Newsletter edition 10 persistence operation failed safely.");
}

function singleRow<Row>(result: RpcResult<Row>): Row {
  if (result.error || !result.data || result.data.length !== 1) {
    throw persistenceFailure();
  }
  return result.data[0];
}

function summaryFromRow(row: SummaryRow): NewsletterEdition11CampaignSummary {
  if (
    !["not_created", "prepared", "sending", "completed", "paused"].includes(
      row.campaign_status,
    )
  ) {
    throw persistenceFailure();
  }
  return {
    campaignId: row.campaign_id,
    campaignStatus:
      row.campaign_status as NewsletterEdition11CampaignSummary["campaignStatus"],
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

function identityArgs(identity: NewsletterEdition11CampaignIdentity) {
  return {
    p_edition_key: identity.editionKey,
    p_subject: identity.subject,
    p_html_sha256: identity.htmlSha256,
    p_text_sha256: identity.textSha256,
    p_content_manifest_digest: identity.contentManifestDigest,
  };
}

function assertRecorded(result: RpcResult<{ outcome: string }>): void {
  const row = singleRow(result);
  if (row.outcome !== "recorded") throw persistenceFailure();
}

export function createNewsletterEdition11CampaignRpcGateway(
  client: SupabaseClient<Database>,
): NewsletterEdition11CampaignRpcGateway {
  return {
    async previewCampaign(args) {
      const { data, error } = await client.rpc(
        "preview_newsletter_campaign_edition_11",
        args,
      );
      return { data, error };
    },
    async prepareCampaign(args) {
      const { data, error } = await client.rpc(
        "prepare_newsletter_campaign_edition_11",
        args,
      );
      return { data, error };
    },
    async claimDelivery(args) {
      const { data, error } = await client.rpc(
        "claim_newsletter_campaign_delivery_v2",
        args,
      );
      return { data, error };
    },
    async recordAccepted(args) {
      const { data, error } = await client.rpc(
        "record_newsletter_campaign_delivery_accepted",
        args,
      );
      return { data, error };
    },
    async recordFailed(args) {
      const { data, error } = await client.rpc(
        "record_newsletter_campaign_delivery_failed",
        args,
      );
      return { data, error };
    },
    async recordUnknown(args) {
      const { data, error } = await client.rpc(
        "record_newsletter_campaign_delivery_unknown",
        args,
      );
      return { data, error };
    },
  };
}

export function createNewsletterEdition11CampaignRepository(
  gateway: NewsletterEdition11CampaignRpcGateway,
): NewsletterEdition11CampaignRepository {
  return {
    async previewCampaign(identity) {
      return summaryFromRow(
        singleRow(await gateway.previewCampaign(identityArgs(identity))),
      );
    },
    async prepareCampaign(identity) {
      return summaryFromRow(
        singleRow(await gateway.prepareCampaign(identityArgs(identity))),
      );
    },
    async claimDelivery(input) {
      const result = await gateway.claimDelivery({
        p_campaign_id: input.campaignId,
        p_token_hash: input.tokenHash,
        p_allow_retry: input.allowRetry,
      });
      if (result.error || !result.data) throw persistenceFailure();
      if (result.data.length === 0) return null;
      if (result.data.length !== 1) throw persistenceFailure();
      const row = result.data[0];
      if (
        !["national", "madrid"].includes(row.content_variant)
      ) {
        throw persistenceFailure();
      }
      const claim: NewsletterEdition11CampaignClaim = {
        deliveryId: row.delivery_id,
        campaignId: row.campaign_id,
        subscriberId: row.subscriber_id,
        recipientEmail: row.recipient_email,
        claimId: row.claim_id,
        attemptCount: row.attempt_count,
        idempotencyKey: row.idempotency_key,
        contentVariant:
          row.content_variant as NewsletterEdition11CampaignClaim["contentVariant"],
      };
      return claim;
    },
    async recordAccepted(input) {
      assertRecorded(
        await gateway.recordAccepted({
          p_delivery_id: input.deliveryId,
          p_claim_id: input.claimId,
          p_provider_message_id: input.providerMessageId,
          p_occurred_at: input.occurredAt,
        }),
      );
    },
    async recordFailed(input) {
      assertRecorded(
        await gateway.recordFailed({
          p_delivery_id: input.deliveryId,
          p_claim_id: input.claimId,
          p_error_code: input.errorCode,
          p_retryable: input.retryable,
          p_occurred_at: input.occurredAt,
        }),
      );
    },
    async recordUnknown(input) {
      assertRecorded(
        await gateway.recordUnknown({
          p_delivery_id: input.deliveryId,
          p_claim_id: input.claimId,
          p_error_code: input.errorCode,
          p_occurred_at: input.occurredAt,
        }),
      );
    },
  };
}

export function createConfiguredNewsletterEdition11CampaignRepository(): NewsletterEdition11CampaignRepository | null {
  const client = createSupabaseServerClient();
  return client
    ? createNewsletterEdition11CampaignRepository(
        createNewsletterEdition11CampaignRpcGateway(client),
      )
    : null;
}
