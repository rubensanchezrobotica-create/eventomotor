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
  "bounced",
  "complained",
  "opened",
  "clicked",
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
  last_opened_at: string | null;
  last_clicked_at: string | null;
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
  last_opened_at?: string | null;
  last_clicked_at?: string | null;
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
