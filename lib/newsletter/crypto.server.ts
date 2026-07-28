import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  NewsletterSignedActionPayload,
  NewsletterTokenPurpose,
} from "@/lib/newsletter/types";

export const NEWSLETTER_TOKEN_BYTES = 32;
export const NEWSLETTER_SIGNATURE_VERSION = "v1" as const;

export function createOpaqueNewsletterToken(): string {
  return randomBytes(NEWSLETTER_TOKEN_BYTES).toString("base64url");
}

export function hashNewsletterToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function signedContent(payload: NewsletterSignedActionPayload): string {
  const encodedSubject = Buffer.from(payload.subjectId, "utf8").toString("base64url");
  return [payload.version, payload.purpose, encodedSubject, String(payload.expiresAt)].join(".");
}

function signContent(content: string, secret: string): string {
  return createHmac("sha256", secret).update(content, "utf8").digest("base64url");
}

export function createSignedNewsletterAction(
  input: {
    purpose: NewsletterTokenPurpose;
    subjectId: string;
    expiresAt: Date;
  },
  secret: string,
): string {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Newsletter signing secret must contain at least 32 bytes");
  }
  if (!input.subjectId || Buffer.byteLength(input.subjectId, "utf8") > 128) {
    throw new Error("Newsletter signed action subject is invalid");
  }

  const payload: NewsletterSignedActionPayload = {
    version: NEWSLETTER_SIGNATURE_VERSION,
    purpose: input.purpose,
    subjectId: input.subjectId,
    expiresAt: input.expiresAt.getTime(),
  };
  const content = signedContent(payload);
  return `${content}.${signContent(content, secret)}`;
}

export function verifySignedNewsletterAction(
  token: string,
  expectedPurpose: NewsletterTokenPurpose,
  secret: string,
  now = new Date(),
): NewsletterSignedActionPayload | null {
  if (Buffer.byteLength(secret, "utf8") < 32 || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;

  const [version, purpose, encodedSubject, rawExpiresAt, signature] = parts;
  if (version !== NEWSLETTER_SIGNATURE_VERSION || purpose !== expectedPurpose) return null;
  if (purpose !== "subscribe" && purpose !== "resubscribe") return null;

  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return null;

  const content = [version, purpose, encodedSubject, rawExpiresAt].join(".");
  if (!constantTimeEqual(signContent(content, secret), signature)) return null;

  try {
    const subjectId = Buffer.from(encodedSubject, "base64url").toString("utf8");
    if (!subjectId) return null;
    return { version, purpose, subjectId, expiresAt };
  } catch {
    return null;
  }
}
