import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  type Database,
} from "@/lib/supabase";
import {
  NewsletterOperationError,
  type NewsletterConfirmRepositoryResult,
  type NewsletterPrepareWelcomeRepositoryParams,
  type NewsletterProviderEventRepositoryParams,
  type NewsletterRepository,
  type NewsletterRequestRepositoryResult,
  type NewsletterTokenUnsubscribeRepositoryParams,
  type NewsletterUnsubscribeRepositoryParams,
  type NewsletterWelcomeDeliveryContext,
} from "@/lib/newsletter/service-types";
import { isValidEmail } from "@/lib/newsletter/schemas";
import type {
  NewsletterConfirmationOutcome,
  NewsletterSubscriptionOutcome,
  NewsletterTokenUnsubscribeOutcome,
  NewsletterTokenPurpose,
  NewsletterUnsubscribeOutcome,
} from "@/lib/newsletter/types";

type Functions = Database["public"]["Functions"];
type RequestArgs = Functions["request_newsletter_subscription"]["Args"];
type RequestRow = Functions["request_newsletter_subscription"]["Returns"][number];
type ConfirmArgs = Functions["confirm_newsletter_subscription"]["Args"];
type ConfirmRow = Functions["confirm_newsletter_subscription"]["Returns"][number];
type PrepareWelcomeArgs = Functions["prepare_newsletter_welcome_delivery"]["Args"];
type PrepareWelcomeRow = Functions["prepare_newsletter_welcome_delivery"]["Returns"][number];
type UnsubscribeArgs = Functions["unsubscribe_newsletter_subscriber"]["Args"];
type UnsubscribeRow = Functions["unsubscribe_newsletter_subscriber"]["Returns"][number];
type UnsubscribeByTokenArgs = Functions["unsubscribe_newsletter_by_token"]["Args"];
type UnsubscribeByTokenRow = Functions["unsubscribe_newsletter_by_token"]["Returns"][number];
type ProviderEventArgs = Functions["record_newsletter_provider_event"]["Args"];
type ProviderEventRow = Functions["record_newsletter_provider_event"]["Returns"][number];
type DeliveryEligibilityArgs = Functions["check_newsletter_delivery_eligibility"]["Args"];
type DeliveryEligibilityRow = Functions["check_newsletter_delivery_eligibility"]["Returns"][number];
type RegisterOutboundArgs = Functions["register_newsletter_outbound_delivery"]["Args"];
type RegisterOutboundRow = Functions["register_newsletter_outbound_delivery"]["Returns"][number];
type ProcessResendWebhookArgs = Functions["process_newsletter_resend_webhook"]["Args"];
type ProcessResendWebhookRow = Functions["process_newsletter_resend_webhook"]["Returns"][number];

type RpcError = { message: string; code?: string };
type RpcResult<Row> = { data: Row[] | null; error: RpcError | null };

export interface NewsletterRpcGateway {
  requestSubscription(args: RequestArgs): Promise<RpcResult<RequestRow>>;
  confirmSubscription(args: ConfirmArgs): Promise<RpcResult<ConfirmRow>>;
  prepareWelcomeDelivery(args: PrepareWelcomeArgs): Promise<RpcResult<PrepareWelcomeRow>>;
  unsubscribeSubscriber(args: UnsubscribeArgs): Promise<RpcResult<UnsubscribeRow>>;
  unsubscribeByToken(args: UnsubscribeByTokenArgs): Promise<RpcResult<UnsubscribeByTokenRow>>;
  recordProviderEvent(args: ProviderEventArgs): Promise<RpcResult<ProviderEventRow>>;
  checkDeliveryEligibility?(
    args: DeliveryEligibilityArgs,
  ): Promise<RpcResult<DeliveryEligibilityRow>>;
  registerOutboundDelivery?(
    args: RegisterOutboundArgs,
  ): Promise<RpcResult<RegisterOutboundRow>>;
  processResendWebhook?(
    args: ProcessResendWebhookArgs,
  ): Promise<RpcResult<ProcessResendWebhookRow>>;
}

const SUBSCRIPTION_OUTCOMES: readonly NewsletterSubscriptionOutcome[] = [
  "confirmation_required",
  "already_active",
  "cooldown",
  "daily_limit",
  "blocked",
];
const CONFIRMATION_OUTCOMES: readonly NewsletterConfirmationOutcome[] = [
  "confirmed",
  "invalid_token",
  "expired_token",
  "used_token",
  "blocked",
];
const UNSUBSCRIBE_OUTCOMES: readonly NewsletterUnsubscribeOutcome[] = [
  "unsubscribed",
  "already_unsubscribed",
  "already_not_sendable",
  "not_found",
];
const TOKEN_UNSUBSCRIBE_OUTCOMES: readonly NewsletterTokenUnsubscribeOutcome[] = [
  "unsubscribed",
  "already_unsubscribed",
  "invalid_or_expired",
];
const TOKEN_PURPOSES: readonly NewsletterTokenPurpose[] = ["subscribe", "resubscribe"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

function persistenceFailure(code: "rpc_failed" | "rpc_contract_violation"): NewsletterOperationError {
  return new NewsletterOperationError("persistence_error", code);
}

function singleRow<Row>(result: RpcResult<Row>): Row {
  if (result.error) throw persistenceFailure("rpc_failed");
  if (!result.data || result.data.length !== 1) throw persistenceFailure("rpc_contract_violation");
  return result.data[0];
}

function includesValue<Value extends string>(values: readonly Value[], value: string): value is Value {
  return values.some((candidate) => candidate === value);
}

export function createNewsletterRpcGateway(
  client: SupabaseClient<Database>,
): NewsletterRpcGateway {
  return {
    async requestSubscription(args) {
      const { data, error } = await client.rpc("request_newsletter_subscription", args);
      return { data, error };
    },
    async confirmSubscription(args) {
      const { data, error } = await client.rpc("confirm_newsletter_subscription", args);
      return { data, error };
    },
    async prepareWelcomeDelivery(args) {
      const { data, error } = await client.rpc("prepare_newsletter_welcome_delivery", args);
      return { data, error };
    },
    async unsubscribeSubscriber(args) {
      const { data, error } = await client.rpc("unsubscribe_newsletter_subscriber", args);
      return { data, error };
    },
    async unsubscribeByToken(args) {
      const { data, error } = await client.rpc("unsubscribe_newsletter_by_token", args);
      return { data, error };
    },
    async recordProviderEvent(args) {
      const { data, error } = await client.rpc("record_newsletter_provider_event", args);
      return { data, error };
    },
    async checkDeliveryEligibility(args) {
      const { data, error } = await client.rpc(
        "check_newsletter_delivery_eligibility",
        args,
      );
      return { data, error };
    },
    async registerOutboundDelivery(args) {
      const { data, error } = await client.rpc(
        "register_newsletter_outbound_delivery",
        args,
      );
      return { data, error };
    },
    async processResendWebhook(args) {
      const { data, error } = await client.rpc(
        "process_newsletter_resend_webhook",
        args,
      );
      return { data, error };
    },
  };
}

export function createNewsletterRepository(gateway: NewsletterRpcGateway): NewsletterRepository {
  return {
    async requestSubscription(params): Promise<NewsletterRequestRepositoryResult> {
      const row = singleRow(
        await gateway.requestSubscription({
          p_email: params.email,
          p_email_normalized: params.emailNormalized,
          p_token_hash: params.tokenHash,
          p_token_expires_at: params.tokenExpiresAt,
          p_source: params.source,
          p_consent_version: params.consentVersion,
          p_source_path: params.sourcePath,
          p_source_detail: params.sourceDetail,
          p_language_code: params.languageCode,
          p_country_code: params.countryCode,
          p_province_slug: params.provinceSlug,
          p_region_slug: params.regionSlug,
          p_ip_hash: params.ipHash,
        }),
      );
      if (!includesValue(SUBSCRIPTION_OUTCOMES, row.outcome)) {
        throw persistenceFailure("rpc_contract_violation");
      }
      let tokenPurpose: NewsletterTokenPurpose | null = null;
      if (row.outcome === "confirmation_required") {
        if (!row.subscriber_id || !UUID_PATTERN.test(row.subscriber_id)) {
          throw persistenceFailure("rpc_contract_violation");
        }
        if (!row.token_purpose || !includesValue(TOKEN_PURPOSES, row.token_purpose)) {
          throw persistenceFailure("rpc_contract_violation");
        }
        tokenPurpose = row.token_purpose;
      }
      return {
        outcome: row.outcome,
        subscriberId: row.outcome === "confirmation_required" ? row.subscriber_id : null,
        tokenPurpose,
      };
    },

    async confirmSubscription(tokenHash): Promise<NewsletterConfirmRepositoryResult> {
      const row = singleRow(await gateway.confirmSubscription({ p_token_hash: tokenHash }));
      if (!includesValue(CONFIRMATION_OUTCOMES, row.outcome)) {
        throw persistenceFailure("rpc_contract_violation");
      }
      if (row.outcome === "confirmed" && (!row.subscriber_id || !UUID_PATTERN.test(row.subscriber_id))) {
        throw persistenceFailure("rpc_contract_violation");
      }
      return {
        outcome: row.outcome,
        subscriberId: row.outcome === "confirmed" ? row.subscriber_id : null,
      };
    },

    async prepareWelcomeDelivery(
      params: NewsletterPrepareWelcomeRepositoryParams,
    ): Promise<NewsletterWelcomeDeliveryContext> {
      const row = singleRow(
        await gateway.prepareWelcomeDelivery({
          p_subscriber_id: params.subscriberId,
          p_token_hash: params.tokenHash,
          p_expires_at: params.expiresAt,
        }),
      );
      if (
        !UUID_PATTERN.test(row.subscriber_id) ||
        row.subscriber_id !== params.subscriberId ||
        !isValidEmail(row.recipient_email) ||
        (row.preferred_province !== null && !SLUG_PATTERN.test(row.preferred_province)) ||
        (row.preferred_region !== null && !SLUG_PATTERN.test(row.preferred_region)) ||
        !LOCALE_PATTERN.test(row.locale)
      ) {
        throw persistenceFailure("rpc_contract_violation");
      }
      return {
        subscriberId: row.subscriber_id,
        recipientEmail: row.recipient_email,
        provinceSlug: row.preferred_province,
        regionSlug: row.preferred_region,
        locale: row.locale,
      };
    },

    async unsubscribeSubscriber(params: NewsletterUnsubscribeRepositoryParams) {
      const row = singleRow(
        await gateway.unsubscribeSubscriber({
          p_subscriber_id: params.subscriberId,
          p_consent_version: params.consentVersion,
          p_source: params.source,
          p_source_path: params.sourcePath,
          p_ip_hash: params.ipHash,
        }),
      );
      if (!includesValue(UNSUBSCRIBE_OUTCOMES, row.outcome)) {
        throw persistenceFailure("rpc_contract_violation");
      }
      return row.outcome;
    },

    async unsubscribeByToken(params: NewsletterTokenUnsubscribeRepositoryParams) {
      const row = singleRow(
        await gateway.unsubscribeByToken({
          p_token_hash: params.tokenHash,
          p_consent_version: params.consentVersion,
          p_source: params.source,
          p_source_path: params.sourcePath,
          p_ip_hash: params.ipHash,
        }),
      );
      if (!includesValue(TOKEN_UNSUBSCRIBE_OUTCOMES, row.outcome)) {
        throw persistenceFailure("rpc_contract_violation");
      }
      return row.outcome;
    },

    async recordProviderEvent(params: NewsletterProviderEventRepositoryParams) {
      const row = singleRow(
        await gateway.recordProviderEvent({
          p_provider: params.provider,
          p_provider_event_id: params.providerEventId,
          p_provider_message_id: params.providerMessageId,
          p_subscriber_id: params.subscriberId,
          p_event_type: params.eventType,
          p_is_permanent: params.isPermanent,
          p_occurred_at: params.occurredAt,
        }),
      );
      if (row.outcome !== "recorded" && row.outcome !== "duplicate") {
        throw persistenceFailure("rpc_contract_violation");
      }
      return row.outcome;
    },

    async checkDeliveryEligibility(subscriberId, deliveryKind) {
      if (!gateway.checkDeliveryEligibility) {
        throw persistenceFailure("rpc_contract_violation");
      }
      const row = singleRow(
        await gateway.checkDeliveryEligibility({
          p_subscriber_id: subscriberId,
          p_delivery_kind: deliveryKind,
        }),
      );
      if (row.outcome !== "allowed" && row.outcome !== "blocked") {
        throw persistenceFailure("rpc_contract_violation");
      }
      return row.outcome;
    },

    async registerOutboundDelivery(params) {
      if (!gateway.registerOutboundDelivery) {
        throw persistenceFailure("rpc_contract_violation");
      }
      const row = singleRow(
        await gateway.registerOutboundDelivery({
          p_subscriber_id: params.subscriberId,
          p_provider_message_id: params.providerMessageId,
          p_delivery_kind: params.deliveryKind,
          p_occurred_at: params.occurredAt,
        }),
      );
      if (row.outcome !== "recorded" && row.outcome !== "duplicate") {
        throw persistenceFailure("rpc_contract_violation");
      }
      return row.outcome;
    },

    async processResendWebhook(params) {
      if (!gateway.processResendWebhook) {
        throw persistenceFailure("rpc_contract_violation");
      }
      const row = singleRow(
        await gateway.processResendWebhook({
          p_svix_id: params.svixId,
          p_event_type: params.eventType,
          p_provider_message_id: params.providerMessageId,
          p_occurred_at: params.occurredAt,
          p_recipient_email_normalized: params.recipientEmailNormalized,
          p_is_permanent: params.isPermanent,
        }),
      );
      if (
        !["processed", "duplicate", "ignored", "unmatched"].includes(
          row.outcome,
        )
      ) {
        throw persistenceFailure("rpc_contract_violation");
      }
      return row.outcome as "processed" | "duplicate" | "ignored" | "unmatched";
    },
  };
}

export function createConfiguredNewsletterRepository(): NewsletterRepository | null {
  const client = createSupabaseServerClient();
  return client ? createNewsletterRepository(createNewsletterRpcGateway(client)) : null;
}
