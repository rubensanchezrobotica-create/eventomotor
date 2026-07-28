import type {
  NewsletterConfirmationOutcome,
  NewsletterProviderEventType,
  NewsletterSubscriptionOutcome,
  NewsletterTokenUnsubscribeOutcome,
  NewsletterTokenPurpose,
  NewsletterUnsubscribeOutcome,
} from "@/lib/newsletter/types";

export const NEWSLETTER_PUBLIC_MUTATION_RESPONSE = Object.freeze({
  message: "Si la solicitud es válida, recibirás los próximos pasos por correo.",
});

export type NewsletterErrorCategory =
  | "configuration_error"
  | "validation_error"
  | "persistence_error"
  | "token_error"
  | "blocked_state"
  | "cooldown"
  | "provider_error"
  | "unexpected_error";

export type NewsletterErrorCode =
  | "mutations_disabled"
  | "persistence_unavailable"
  | "mail_transport_unavailable"
  | "invalid_input"
  | "invalid_token"
  | "rpc_failed"
  | "rpc_contract_violation"
  | "subscriber_blocked"
  | "request_throttled"
  | "mail_transport_failed"
  | "unexpected_failure";

const SAFE_ERROR_MESSAGES: Readonly<Record<NewsletterErrorCode, string>> = {
  mutations_disabled: "Newsletter mutations are disabled.",
  persistence_unavailable: "Newsletter persistence is unavailable.",
  mail_transport_unavailable: "Newsletter mail transport is unavailable.",
  invalid_input: "Newsletter input is invalid.",
  invalid_token: "Newsletter token is invalid.",
  rpc_failed: "Newsletter persistence operation failed.",
  rpc_contract_violation: "Newsletter persistence returned an invalid result.",
  subscriber_blocked: "Newsletter operation is blocked.",
  request_throttled: "Newsletter request is temporarily limited.",
  mail_transport_failed: "Newsletter mail transport failed.",
  unexpected_failure: "Newsletter operation failed unexpectedly.",
};

export class NewsletterOperationError extends Error {
  readonly category: NewsletterErrorCategory;
  readonly code: NewsletterErrorCode;

  constructor(category: NewsletterErrorCategory, code: NewsletterErrorCode) {
    super(SAFE_ERROR_MESSAGES[code]);
    this.name = "NewsletterOperationError";
    this.category = category;
    this.code = code;
  }
}

export type NewsletterRequestInput = {
  email: string;
  source: string;
  consentVersion: string;
  sourcePath?: string | null;
  sourceDetail?: string | null;
  languageCode?: string;
  countryCode?: string;
  provinceSlug?: string | null;
  regionSlug?: string | null;
  ipHash?: string | null;
};

export type NewsletterConfirmInput = {
  token: string;
};

export type NewsletterUnsubscribeInput = {
  subscriberId: string;
  source: string;
  consentVersion: string;
  sourcePath?: string | null;
  ipHash?: string | null;
};

export type NewsletterTokenUnsubscribeInput = Omit<
  NewsletterUnsubscribeInput,
  "subscriberId"
> & {
  token: string;
};

export type NewsletterProviderEventInput = {
  provider: string;
  providerEventId: string;
  providerMessageId?: string | null;
  subscriberId?: string | null;
  eventType: NewsletterProviderEventType;
  isPermanent: boolean;
  occurredAt: string;
};

export type NewsletterRequestRepositoryParams = {
  email: string;
  emailNormalized: string;
  tokenHash: string;
  tokenExpiresAt: string;
  source: string;
  consentVersion: string;
  sourcePath: string | null;
  sourceDetail: string | null;
  languageCode: string;
  countryCode: string;
  provinceSlug: string | null;
  regionSlug: string | null;
  ipHash: string | null;
};

export type NewsletterRequestRepositoryResult = {
  outcome: NewsletterSubscriptionOutcome;
  subscriberId: string | null;
  tokenPurpose: NewsletterTokenPurpose | null;
};

export type NewsletterConfirmRepositoryResult = {
  outcome: NewsletterConfirmationOutcome;
  subscriberId: string | null;
};

export type NewsletterWelcomeDeliveryContext = {
  subscriberId: string;
  recipientEmail: string;
  provinceSlug: string | null;
  regionSlug: string | null;
  locale: string;
};

export type NewsletterPrepareWelcomeRepositoryParams = {
  subscriberId: string;
  tokenHash: string;
  expiresAt: string | null;
};

export type NewsletterTokenUnsubscribeRepositoryParams = Omit<
  NewsletterTokenUnsubscribeInput,
  "token" | "sourcePath" | "ipHash"
> & {
  tokenHash: string;
  sourcePath: string | null;
  ipHash: string | null;
};

export type NewsletterUnsubscribeRepositoryParams = Omit<
  NewsletterUnsubscribeInput,
  "sourcePath" | "ipHash"
> & {
  sourcePath: string | null;
  ipHash: string | null;
};

export type NewsletterProviderEventRepositoryParams = Omit<
  NewsletterProviderEventInput,
  "providerMessageId" | "subscriberId"
> & {
  providerMessageId: string | null;
  subscriberId: string | null;
};

export interface NewsletterRepository {
  requestSubscription(
    params: NewsletterRequestRepositoryParams,
  ): Promise<NewsletterRequestRepositoryResult>;
  confirmSubscription(tokenHash: string): Promise<NewsletterConfirmRepositoryResult>;
  prepareWelcomeDelivery(
    params: NewsletterPrepareWelcomeRepositoryParams,
  ): Promise<NewsletterWelcomeDeliveryContext>;
  unsubscribeSubscriber(
    params: NewsletterUnsubscribeRepositoryParams,
  ): Promise<NewsletterUnsubscribeOutcome>;
  unsubscribeByToken(
    params: NewsletterTokenUnsubscribeRepositoryParams,
  ): Promise<NewsletterTokenUnsubscribeOutcome>;
  recordProviderEvent(params: NewsletterProviderEventRepositoryParams): Promise<"recorded" | "duplicate">;
}

export type ConfirmationMailCommand = {
  kind: "confirmation";
  recipientEmail: string;
  rawConfirmationToken: string;
  purpose: NewsletterTokenPurpose;
  expiresAt: string;
};

export type WelcomeMailCommand = {
  kind: "welcome";
  recipientEmail: string;
  rawUnsubscribeToken: string;
  provinceSlug: string;
  regionSlug: string | null;
  locale: string;
};

export type NewsletterMailCommand = ConfirmationMailCommand | WelcomeMailCommand;
export type MailTransportResult = { status: "accepted" | "skipped" };
export type NewsletterMailStatus = "not_required" | "accepted" | "failed";

export type NewsletterPublicMutationResponse = typeof NEWSLETTER_PUBLIC_MUTATION_RESPONSE;

export type NewsletterRequestServiceResult = {
  publicResponse: NewsletterPublicMutationResponse;
  decision: NewsletterSubscriptionOutcome;
  mailStatus: NewsletterMailStatus;
  internalErrorCategory?: "blocked_state" | "cooldown" | "provider_error";
};

export type NewsletterConfirmServiceResult = {
  publicResponse: NewsletterPublicMutationResponse;
  decision: NewsletterConfirmationOutcome;
  mailStatus: NewsletterMailStatus;
  internalErrorCategory?: "blocked_state" | "persistence_error" | "provider_error";
};

export type NewsletterUnsubscribeServiceResult = {
  publicResponse: NewsletterPublicMutationResponse;
  decision: NewsletterUnsubscribeOutcome | NewsletterTokenUnsubscribeOutcome;
};

export type NewsletterProviderEventServiceResult = {
  decision: "recorded" | "duplicate";
};

export interface NewsletterService {
  requestSubscription(input: NewsletterRequestInput): Promise<NewsletterRequestServiceResult>;
  confirmSubscription(input: NewsletterConfirmInput): Promise<NewsletterConfirmServiceResult>;
  unsubscribeSubscriber(input: NewsletterUnsubscribeInput): Promise<NewsletterUnsubscribeServiceResult>;
  unsubscribeByToken(
    input: NewsletterTokenUnsubscribeInput,
  ): Promise<NewsletterUnsubscribeServiceResult>;
  recordProviderEvent(input: NewsletterProviderEventInput): Promise<NewsletterProviderEventServiceResult>;
}
