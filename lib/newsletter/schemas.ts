import {
  NEWSLETTER_CONSENT_ACTIONS,
  NEWSLETTER_MODES,
  NEWSLETTER_PROVIDER_EVENT_TYPES,
  NEWSLETTER_SUBSCRIBER_STATUSES,
  NEWSLETTER_TOKEN_PURPOSES,
  type NewsletterConsentAction,
  type NewsletterMode,
  type NewsletterProviderEventType,
  type NewsletterSubscriberStatus,
  type NewsletterTokenPurpose,
} from "@/lib/newsletter/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,1024}$/;
const ACTION_TOKEN_PATTERN = /^[A-Za-z0-9._-]{32,1024}$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

export function isValidNewsletterOpaqueToken(value: string): boolean {
  return OPAQUE_TOKEN_PATTERN.test(value);
}

export function isValidNewsletterActionTokenShape(value: string): boolean {
  return ACTION_TOKEN_PATTERN.test(value);
}

export function isNewsletterMode(value: string): value is NewsletterMode {
  return NEWSLETTER_MODES.some((mode) => mode === value);
}

export function isNewsletterSubscriberStatus(value: string): value is NewsletterSubscriberStatus {
  return NEWSLETTER_SUBSCRIBER_STATUSES.some((status) => status === value);
}

export function isNewsletterTokenPurpose(value: string): value is NewsletterTokenPurpose {
  return NEWSLETTER_TOKEN_PURPOSES.some((purpose) => purpose === value);
}

export function isNewsletterConsentAction(value: string): value is NewsletterConsentAction {
  return NEWSLETTER_CONSENT_ACTIONS.some((action) => action === value);
}

export function isNewsletterProviderEventType(value: string): value is NewsletterProviderEventType {
  return NEWSLETTER_PROVIDER_EVENT_TYPES.some((eventType) => eventType === value);
}
