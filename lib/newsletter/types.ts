export const NEWSLETTER_MODES = ["off", "preview", "test", "live"] as const;
export const NEWSLETTER_SUBSCRIBER_STATUSES = [
  "pending",
  "active",
  "unsubscribed",
  "bounced",
  "complained",
  "suppressed",
] as const;
export const NEWSLETTER_TOKEN_PURPOSES = ["subscribe", "resubscribe"] as const;
export const NEWSLETTER_CONSENT_ACTIONS = [
  "subscribe_requested",
  "confirmation_issued",
  "confirmed",
  "resubscribe_requested",
  "unsubscribed",
  "bounced",
  "complained",
  "suppressed",
] as const;
export const NEWSLETTER_PROVIDER_EVENT_TYPES = [
  "sent",
  "delivered",
  "delivery_delayed",
  "failed",
  "bounced",
  "complained",
  "suppressed",
] as const;

export type NewsletterMode = (typeof NEWSLETTER_MODES)[number];
export type NewsletterSubscriberStatus = (typeof NEWSLETTER_SUBSCRIBER_STATUSES)[number];
export type NewsletterTokenPurpose = (typeof NEWSLETTER_TOKEN_PURPOSES)[number];
export type NewsletterConsentAction = (typeof NEWSLETTER_CONSENT_ACTIONS)[number];
export type NewsletterProviderEventType = (typeof NEWSLETTER_PROVIDER_EVENT_TYPES)[number];

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  email_normalized: string;
  status: NewsletterSubscriberStatus;
  language_code: string;
  country_code: string;
  province_slug: string | null;
  region_slug: string | null;
  source: string;
  source_detail: string | null;
  source_path: string | null;
  consent_version: string;
  last_confirmation_requested_at: string | null;
  confirmation_request_window_started_at: string | null;
  confirmation_request_count: number;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  suppressed_at: string | null;
  provider_contact_id: string | null;
  last_sent_at: string | null;
  last_delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterSubscriberInsert = {
  id?: string;
  email: string;
  email_normalized: string;
  status?: NewsletterSubscriberStatus;
  language_code?: string;
  country_code?: string;
  province_slug?: string | null;
  region_slug?: string | null;
  source: string;
  source_detail?: string | null;
  source_path?: string | null;
  consent_version: string;
  last_confirmation_requested_at?: string | null;
  confirmation_request_window_started_at?: string | null;
  confirmation_request_count?: number;
  confirmed_at?: string | null;
  unsubscribed_at?: string | null;
  bounced_at?: string | null;
  complained_at?: string | null;
  suppressed_at?: string | null;
  provider_contact_id?: string | null;
  last_sent_at?: string | null;
  last_delivered_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type NewsletterPreferenceRow = {
  subscriber_id: string;
  weekly_digest_enabled: boolean;
  created_at: string;
  updated_at: string;
};
export type NewsletterPreferenceInsert = {
  subscriber_id: string;
  weekly_digest_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type NewsletterConfirmationTokenRow = {
  id: string;
  subscriber_id: string;
  token_hash: string;
  purpose: NewsletterTokenPurpose;
  expires_at: string;
  used_at: string | null;
  invalidated_at: string | null;
  created_at: string;
};
export type NewsletterConfirmationTokenInsert = {
  id?: string;
  subscriber_id: string;
  token_hash: string;
  purpose: NewsletterTokenPurpose;
  expires_at: string;
  used_at?: string | null;
  invalidated_at?: string | null;
  created_at?: string;
};

export type NewsletterUnsubscribeTokenRow = {
  id: string;
  subscriber_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string | null;
  invalidated_at: string | null;
  first_used_at: string | null;
  updated_at: string;
};
export type NewsletterUnsubscribeTokenInsert = {
  id?: string;
  subscriber_id: string;
  token_hash: string;
  created_at?: string;
  expires_at?: string | null;
  invalidated_at?: string | null;
  first_used_at?: string | null;
  updated_at?: string;
};

export type NewsletterConsentEventRow = {
  id: string;
  subscriber_id: string;
  action: NewsletterConsentAction;
  consent_version: string;
  source: string;
  source_path: string | null;
  ip_hash: string | null;
  occurred_at: string;
};
export type NewsletterConsentEventInsert = {
  id?: string;
  subscriber_id: string;
  action: NewsletterConsentAction;
  consent_version: string;
  source: string;
  source_path?: string | null;
  ip_hash?: string | null;
  occurred_at?: string;
};

export type NewsletterEmailEventRow = {
  id: string;
  provider: string;
  provider_event_id: string;
  provider_message_id: string | null;
  subscriber_id: string | null;
  event_type: NewsletterProviderEventType;
  is_permanent: boolean;
  occurred_at: string;
  received_at: string;
};
export type NewsletterEmailEventInsert = {
  id?: string;
  provider: string;
  provider_event_id: string;
  provider_message_id?: string | null;
  subscriber_id?: string | null;
  event_type: NewsletterProviderEventType;
  is_permanent?: boolean;
  occurred_at: string;
  received_at?: string;
};

export type NewsletterSuppressionReason =
  | "voluntary"
  | "permanent_bounce"
  | "complaint"
  | "provider_suppression";

export type NewsletterSuppressionRow = {
  id: string;
  subscriber_id: string;
  email_hash: string;
  reason: NewsletterSuppressionReason;
  suppressed_at: string;
  lifted_at: string | null;
  provider_message_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterSuppressionInsert = {
  id?: string;
  subscriber_id: string;
  email_hash: string;
  reason: NewsletterSuppressionReason;
  suppressed_at: string;
  lifted_at?: string | null;
  provider_message_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type NewsletterWebhookReceiptRow = {
  svix_id: string;
  event_type: string;
  provider_message_id: string | null;
  subscriber_id: string | null;
  provider_created_at: string;
  received_at: string;
  outcome: "processed" | "ignored" | "unmatched";
};

export type NewsletterWebhookReceiptInsert = {
  svix_id: string;
  event_type: string;
  provider_message_id?: string | null;
  subscriber_id?: string | null;
  provider_created_at: string;
  received_at?: string;
  outcome: NewsletterWebhookReceiptRow["outcome"];
};

export type NewsletterCampaignStatus =
  | "prepared"
  | "sending"
  | "completed"
  | "paused";
export type NewsletterCampaignDeliveryStatus =
  | "prepared"
  | "sending"
  | "accepted"
  | "failed"
  | "unknown";

export type NewsletterCampaignRow = {
  id: string;
  edition_key: string;
  subject: string;
  html_sha256: string;
  text_sha256: string;
  status: NewsletterCampaignStatus;
  created_at: string;
  updated_at: string;
  prepared_at: string;
  started_at: string | null;
  completed_at: string | null;
  audience_frozen_at: string | null;
  content_manifest_digest: string | null;
};
export type NewsletterCampaignInsert = {
  id?: string;
  edition_key: string;
  subject: string;
  html_sha256: string;
  text_sha256: string;
  status?: NewsletterCampaignStatus;
  created_at?: string;
  updated_at?: string;
  prepared_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  audience_frozen_at?: string | null;
  content_manifest_digest?: string | null;
};

export type NewsletterCampaignDeliveryRow = {
  id: string;
  campaign_id: string;
  subscriber_id: string;
  status: NewsletterCampaignDeliveryStatus;
  attempt_count: number;
  retryable: boolean;
  claim_id: string | null;
  idempotency_key: string | null;
  provider_message_id: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
  prepared_at: string;
  last_attempt_at: string | null;
  claimed_at: string | null;
  accepted_at: string | null;
  failed_at: string | null;
  unknown_at: string | null;
  content_variant: "national" | "madrid" | "a-coruna" | "barcelona";
};
export type NewsletterCampaignDeliveryInsert = {
  id?: string;
  campaign_id: string;
  subscriber_id: string;
  status?: NewsletterCampaignDeliveryStatus;
  attempt_count?: number;
  retryable?: boolean;
  claim_id?: string | null;
  idempotency_key?: string | null;
  provider_message_id?: string | null;
  last_error_code?: string | null;
  created_at?: string;
  updated_at?: string;
  prepared_at?: string;
  last_attempt_at?: string | null;
  claimed_at?: string | null;
  accepted_at?: string | null;
  failed_at?: string | null;
  unknown_at?: string | null;
  content_variant?: "national" | "madrid" | "a-coruna" | "barcelona";
};

export type NewsletterCampaignUnsubscribeTokenRow = {
  id: string;
  delivery_id: string;
  subscriber_id: string;
  attempt_number: number;
  token_hash: string;
  created_at: string;
  updated_at: string;
  first_used_at: string | null;
  invalidated_at: string | null;
};
export type NewsletterCampaignUnsubscribeTokenInsert = {
  id?: string;
  delivery_id: string;
  subscriber_id: string;
  attempt_number: number;
  token_hash: string;
  created_at?: string;
  updated_at?: string;
  first_used_at?: string | null;
  invalidated_at?: string | null;
};

export type NewsletterSubscriptionOutcome =
  | "confirmation_required"
  | "already_active"
  | "cooldown"
  | "daily_limit"
  | "blocked";

export type NewsletterConfirmationOutcome =
  | "confirmed"
  | "invalid_token"
  | "expired_token"
  | "used_token"
  | "blocked";

export type NewsletterUnsubscribeOutcome =
  | "unsubscribed"
  | "already_unsubscribed"
  | "already_not_sendable"
  | "not_found";

export type NewsletterTokenUnsubscribeOutcome =
  | "unsubscribed"
  | "already_unsubscribed"
  | "invalid_or_expired";

export type NewsletterSignedActionPayload = {
  version: "v1";
  purpose: NewsletterTokenPurpose;
  subjectId: string;
  expiresAt: number;
};
