import type {
  NewsletterProviderEventType,
  NewsletterSubscriberStatus,
  NewsletterSubscriptionOutcome,
  NewsletterTokenPurpose,
} from "@/lib/newsletter/types";

export const CONFIRMATION_COOLDOWN_MS = 15 * 60 * 1000;
export const CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_CONFIRMATION_REQUESTS_PER_WINDOW = 3;

export type ConfirmationTokenDecision = "valid" | "used" | "expired" | "invalidated";

export function evaluateConfirmationToken(
  token: { usedAt: Date | null; invalidatedAt: Date | null; expiresAt: Date },
  now = new Date(),
): ConfirmationTokenDecision {
  if (token.invalidatedAt) return "invalidated";
  if (token.usedAt) return "used";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export type SubscriptionRequestDecision = {
  outcome: NewsletterSubscriptionOutcome;
  status: NewsletterSubscriberStatus;
  tokenPurpose: NewsletterTokenPurpose | null;
};

export function decideSubscriptionRequest(
  existing: {
    status: NewsletterSubscriberStatus;
    lastConfirmationRequestedAt: Date | null;
    confirmationWindowStartedAt: Date | null;
    confirmationRequestCount: number;
  } | null,
  now = new Date(),
): SubscriptionRequestDecision {
  if (!existing) {
    return { outcome: "confirmation_required", status: "pending", tokenPurpose: "subscribe" };
  }

  if (
    existing.status === "bounced" ||
    existing.status === "complained" ||
    existing.status === "suppressed"
  ) {
    return { outcome: "blocked", status: existing.status, tokenPurpose: null };
  }

  if (existing.status === "active") {
    return { outcome: "already_active", status: "active", tokenPurpose: null };
  }

  if (
    existing.lastConfirmationRequestedAt &&
    now.getTime() - existing.lastConfirmationRequestedAt.getTime() < CONFIRMATION_COOLDOWN_MS
  ) {
    return { outcome: "cooldown", status: existing.status, tokenPurpose: null };
  }

  const insideWindow =
    existing.confirmationWindowStartedAt !== null &&
    now.getTime() - existing.confirmationWindowStartedAt.getTime() < CONFIRMATION_WINDOW_MS;
  if (insideWindow && existing.confirmationRequestCount >= MAX_CONFIRMATION_REQUESTS_PER_WINDOW) {
    return { outcome: "daily_limit", status: existing.status, tokenPurpose: null };
  }

  return {
    outcome: "confirmation_required",
    status: existing.status,
    tokenPurpose: existing.status === "pending" ? "subscribe" : "resubscribe",
  };
}

export function confirmSubscriberStatus(
  status: NewsletterSubscriberStatus,
  purpose: NewsletterTokenPurpose,
): NewsletterSubscriberStatus | null {
  if (status === "active") return "active";
  return canIssuePublicConfirmationToken(status, purpose) ? "active" : null;
}

export function canIssuePublicConfirmationToken(
  status: NewsletterSubscriberStatus,
  purpose: NewsletterTokenPurpose,
): boolean {
  return (
    (status === "pending" && purpose === "subscribe") ||
    (status === "unsubscribed" && purpose === "resubscribe")
  );
}

export function unsubscribeSubscriberStatus(
  status: NewsletterSubscriberStatus,
): NewsletterSubscriberStatus {
  if (status === "bounced" || status === "complained" || status === "suppressed") return status;
  return "unsubscribed";
}

export function applyProviderEventStatus(
  status: NewsletterSubscriberStatus,
  eventType: NewsletterProviderEventType,
  isPermanent: boolean,
): NewsletterSubscriberStatus {
  if (eventType === "complained") return "complained";
  if (eventType === "suppressed") return "suppressed";
  if (eventType === "bounced" && isPermanent) return "bounced";
  return status;
}
