import assert from "node:assert/strict";
import test from "node:test";

import { resolveNewsletterMode } from "./config";
import {
  constantTimeEqual,
  createOpaqueNewsletterToken,
  createSignedNewsletterAction,
  hashNewsletterToken,
  NEWSLETTER_TOKEN_BYTES,
  verifySignedNewsletterAction,
} from "./crypto.server";
import {
  applyProviderEventStatus,
  canIssuePublicConfirmationToken,
  confirmSubscriberStatus,
  decideSubscriptionRequest,
  evaluateConfirmationToken,
  unsubscribeSubscriberStatus,
} from "./policy";
import { isValidEmail, normalizeEmail } from "./schemas";

const NOW = new Date("2026-07-21T12:00:00.000Z");

test("normalizes email using only trim and lowercase", () => {
  assert.equal(normalizeEmail(" User.Name+track@Example.COM "), "user.name+track@example.com");
  assert.equal(isValidEmail(" User.Name+track@Example.COM "), true);
  assert.equal(isValidEmail("invalid"), false);
});

test("creates random tokens with at least 32 bytes and stable SHA-256 hashes", () => {
  const first = createOpaqueNewsletterToken();
  const second = createOpaqueNewsletterToken();
  assert.equal(NEWSLETTER_TOKEN_BYTES, 32);
  assert.notEqual(first, second);
  assert.ok(first.length >= 43);
  assert.equal(hashNewsletterToken(first), hashNewsletterToken(first));
  assert.match(hashNewsletterToken(first), /^[0-9a-f]{64}$/);
});

test("validates versioned HMAC signatures, purpose and expiry", () => {
  const secret = "test-only-secret-with-enough-entropy";
  const token = createSignedNewsletterAction(
    { purpose: "subscribe", subjectId: "subscriber-123", expiresAt: new Date(NOW.getTime() + 60_000) },
    secret,
  );

  assert.deepEqual(verifySignedNewsletterAction(token, "subscribe", secret, NOW), {
    version: "v1",
    purpose: "subscribe",
    subjectId: "subscriber-123",
    expiresAt: NOW.getTime() + 60_000,
  });
  assert.equal(verifySignedNewsletterAction(token, "resubscribe", secret, NOW), null);
  assert.equal(verifySignedNewsletterAction(`${token.slice(0, -1)}x`, "subscribe", secret, NOW), null);
  assert.equal(verifySignedNewsletterAction(token, "subscribe", secret, new Date(NOW.getTime() + 60_000)), null);
  assert.equal(constantTimeEqual("same", "same"), true);
  assert.equal(constantTimeEqual("same", "different"), false);
});

test("applies subscription request rules without external dependencies", () => {
  assert.deepEqual(decideSubscriptionRequest(null, NOW), {
    outcome: "confirmation_required",
    status: "pending",
    tokenPurpose: "subscribe",
  });
  assert.equal(
    decideSubscriptionRequest(
      {
        status: "active",
        lastConfirmationRequestedAt: null,
        confirmationWindowStartedAt: null,
        confirmationRequestCount: 0,
      },
      NOW,
    ).outcome,
    "already_active",
  );
  const resubscribe = decideSubscriptionRequest(
    {
      status: "unsubscribed",
      lastConfirmationRequestedAt: null,
      confirmationWindowStartedAt: null,
      confirmationRequestCount: 0,
    },
    NOW,
  );
  assert.equal(resubscribe.status, "unsubscribed");
  assert.equal(resubscribe.tokenPurpose, "resubscribe");
});

test("enforces cooldown, request window and blocked public states", () => {
  const base = {
    status: "pending" as const,
    confirmationWindowStartedAt: new Date(NOW.getTime() - 60_000),
    confirmationRequestCount: 1,
  };
  assert.equal(
    decideSubscriptionRequest(
      { ...base, lastConfirmationRequestedAt: new Date(NOW.getTime() - 10 * 60_000) },
      NOW,
    ).outcome,
    "cooldown",
  );
  assert.equal(
    decideSubscriptionRequest(
      { ...base, confirmationRequestCount: 3, lastConfirmationRequestedAt: new Date(NOW.getTime() - 60 * 60_000) },
      NOW,
    ).outcome,
    "daily_limit",
  );
  for (const status of ["bounced", "complained", "suppressed"] as const) {
    const decision = decideSubscriptionRequest(
      {
        status,
        lastConfirmationRequestedAt: null,
        confirmationWindowStartedAt: null,
        confirmationRequestCount: 0,
      },
      NOW,
    );
    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.status, status);
    assert.equal(decision.tokenPurpose, null);
  }
});

test("confirms only compatible states and purposes", () => {
  assert.equal(confirmSubscriberStatus("pending", "subscribe"), "active");
  assert.equal(confirmSubscriberStatus("unsubscribed", "resubscribe"), "active");
  assert.equal(confirmSubscriberStatus("bounced", "subscribe"), null);
  assert.equal(confirmSubscriberStatus("bounced", "resubscribe"), null);
  assert.equal(confirmSubscriberStatus("unsubscribed", "subscribe"), null);
  assert.equal(confirmSubscriberStatus("complained", "resubscribe"), null);
  assert.equal(confirmSubscriberStatus("suppressed", "resubscribe"), null);
});

test("never issues either public token purpose for a permanently bounced subscriber", () => {
  assert.equal(canIssuePublicConfirmationToken("bounced", "subscribe"), false);
  assert.equal(canIssuePublicConfirmationToken("bounced", "resubscribe"), false);
});

test("rejects used, expired and invalidated confirmation tokens", () => {
  assert.equal(evaluateConfirmationToken({ usedAt: null, invalidatedAt: null, expiresAt: new Date(NOW.getTime() + 1) }, NOW), "valid");
  assert.equal(evaluateConfirmationToken({ usedAt: NOW, invalidatedAt: null, expiresAt: new Date(NOW.getTime() + 1) }, NOW), "used");
  assert.equal(evaluateConfirmationToken({ usedAt: null, invalidatedAt: null, expiresAt: NOW }, NOW), "expired");
  assert.equal(evaluateConfirmationToken({ usedAt: null, invalidatedAt: NOW, expiresAt: new Date(NOW.getTime() + 1) }, NOW), "invalidated");
});

test("keeps unsubscribe idempotent and ignores temporary delivery failures", () => {
  assert.equal(unsubscribeSubscriberStatus("active"), "unsubscribed");
  assert.equal(unsubscribeSubscriberStatus("unsubscribed"), "unsubscribed");
  assert.equal(unsubscribeSubscriberStatus("bounced"), "bounced");
  assert.equal(unsubscribeSubscriberStatus("complained"), "complained");
  assert.equal(applyProviderEventStatus("active", "delivery_delayed", false), "active");
  assert.equal(applyProviderEventStatus("active", "bounced", false), "active");
  assert.equal(applyProviderEventStatus("active", "bounced", true), "bounced");
  assert.equal(applyProviderEventStatus("active", "complained", false), "complained");
  assert.equal(applyProviderEventStatus("active", "suppressed", false), "suppressed");
});

test("resolves newsletter modes fail-closed in production", () => {
  assert.equal(resolveNewsletterMode({}), "off");
  assert.equal(resolveNewsletterMode({ mode: "invalid", nodeEnv: "development" }), "off");
  assert.equal(resolveNewsletterMode({ mode: "preview", nodeEnv: "development" }), "preview");
  assert.equal(resolveNewsletterMode({ mode: "test", nodeEnv: "development" }), "test");
  assert.equal(resolveNewsletterMode({ mode: "live", nodeEnv: "development" }), "off");
  assert.equal(resolveNewsletterMode({ mode: "preview", nodeEnv: "production" }), "off");
  assert.equal(resolveNewsletterMode({ mode: "test", nodeEnv: "production" }), "off");
  assert.equal(resolveNewsletterMode({ mode: "live", nodeEnv: "production" }), "live");
  assert.equal(resolveNewsletterMode({ mode: "preview", nodeEnv: "production", vercelEnv: "preview" }), "preview");
});
