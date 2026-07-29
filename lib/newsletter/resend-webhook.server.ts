import "server-only";

import { Webhook } from "svix";
import {
  createConfiguredNewsletterRepository,
} from "@/lib/newsletter/repository.server";
import {
  NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
} from "@/lib/newsletter/r5a-guard";
import { isValidEmail, normalizeEmail } from "@/lib/newsletter/schemas";
import type {
  NewsletterRepository,
  NewsletterResendWebhookRepositoryParams,
} from "@/lib/newsletter/service-types";

const SVIX_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,200}$/;
const EVENT_TYPE_PATTERN = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
const PROVIDER_MESSAGE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,200}$/;
const HANDLED_EVENT_TYPES = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.failed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
]);
const INDIVIDUAL_TRACKING_EVENT_TYPES = new Set([
  "email.opened",
  "email.clicked",
]);

export type NewsletterResendWebhookEnvironment = {
  newsletterMode?: string;
  mailTransport?: string;
  canaryArmed?: string;
  webhookSecret?: string;
  nodeEnv?: string;
  vercel?: string;
  vercelEnv?: string;
};

export type NewsletterResendWebhookConfiguration =
  | { enabled: false }
  | { enabled: true; webhookSecret: string };

export type NewsletterWebhookHeaders = {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
};

export interface NewsletterWebhookVerifier {
  verify(
    payload: string,
    headers: NewsletterWebhookHeaders,
    webhookSecret: string,
  ): unknown;
}

export class SvixNewsletterWebhookVerifier
  implements NewsletterWebhookVerifier
{
  verify(
    payload: string,
    headers: NewsletterWebhookHeaders,
    webhookSecret: string,
  ): unknown {
    return new Webhook(webhookSecret).verify(payload, headers);
  }
}

function isValidWebhookSecret(value: string): boolean {
  return (
    value.startsWith("whsec_") &&
    value.length >= 20 &&
    value.length <= 500 &&
    value === value.trim() &&
    !/[\s\u0000-\u001f\u007f]/.test(value)
  );
}

export function evaluateNewsletterResendWebhookConfiguration(
  environment: NewsletterResendWebhookEnvironment,
): NewsletterResendWebhookConfiguration {
  if (
    environment.newsletterMode !== "live" ||
    environment.mailTransport !== "resend" ||
    environment.canaryArmed !== NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE ||
    environment.nodeEnv !== "production" ||
    environment.vercel !== "1" ||
    environment.vercelEnv !== "production" ||
    !environment.webhookSecret ||
    !isValidWebhookSecret(environment.webhookSecret)
  ) {
    return { enabled: false };
  }
  return {
    enabled: true,
    webhookSecret: environment.webhookSecret,
  };
}

export function currentNewsletterResendWebhookEnvironment():
  NewsletterResendWebhookEnvironment {
  return {
    newsletterMode: process.env.NEWSLETTER_MODE,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    canaryArmed: process.env.NEWSLETTER_PRODUCTION_CANARY_ARMED,
    webhookSecret: process.env.NEWSLETTER_RESEND_WEBHOOK_SECRET,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : null;
}

function parseRecipient(data: Record<string, unknown>): string | null {
  if (
    !Array.isArray(data.to) ||
    data.to.length !== 1 ||
    typeof data.to[0] !== "string" ||
    !isValidEmail(data.to[0])
  ) {
    return null;
  }
  return normalizeEmail(data.to[0]);
}

export function parseVerifiedResendWebhook(
  verified: unknown,
  svixId: string,
): NewsletterResendWebhookRepositoryParams | null {
  const event = objectValue(verified);
  const data = objectValue(event?.data);
  const eventType = event?.type;
  const occurredAt = parseTimestamp(event?.created_at);
  if (
    !SVIX_ID_PATTERN.test(svixId) ||
    typeof eventType !== "string" ||
    !EVENT_TYPE_PATTERN.test(eventType) ||
    eventType.length > 100 ||
    !occurredAt ||
    !data
  ) {
    return null;
  }

  const ignored =
    INDIVIDUAL_TRACKING_EVENT_TYPES.has(eventType) ||
    !HANDLED_EVENT_TYPES.has(eventType);
  if (ignored) {
    return {
      svixId,
      eventType,
      providerMessageId: null,
      occurredAt,
      recipientEmailNormalized: null,
      isPermanent: false,
    };
  }

  const providerMessageId = data.email_id;
  if (
    typeof providerMessageId !== "string" ||
    !PROVIDER_MESSAGE_ID_PATTERN.test(providerMessageId)
  ) {
    return null;
  }

  const recipientEmailNormalized = parseRecipient(data);
  if (!recipientEmailNormalized) return null;

  const bounce = objectValue(data.bounce);
  const isPermanent =
    eventType === "email.bounced" &&
    typeof bounce?.type === "string" &&
    bounce.type.toLowerCase() === "permanent";

  return {
    svixId,
    eventType,
    providerMessageId,
    occurredAt,
    recipientEmailNormalized,
    isPermanent,
  };
}

type NewsletterResendWebhookHandlerDependencies = {
  environment?: () => NewsletterResendWebhookEnvironment;
  verifier?: NewsletterWebhookVerifier;
  repository?: () => NewsletterRepository | null;
};

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
} as const;

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

export function createNewsletterResendWebhookHandler(
  dependencies: NewsletterResendWebhookHandlerDependencies = {},
): (request: Request) => Promise<Response> {
  const environment =
    dependencies.environment ?? currentNewsletterResendWebhookEnvironment;
  const verifier =
    dependencies.verifier ?? new SvixNewsletterWebhookVerifier();
  const repositoryFactory =
    dependencies.repository ?? createConfiguredNewsletterRepository;

  return async (request: Request): Promise<Response> => {
    const configuration =
      evaluateNewsletterResendWebhookConfiguration(environment());
    if (!configuration.enabled) {
      return response(404, { ok: false, error: "not_found" });
    }

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return response(400, { ok: false, error: "invalid_webhook" });
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return response(400, { ok: false, error: "invalid_webhook" });
    }

    let verified: unknown;
    try {
      verified = verifier.verify(
        rawBody,
        {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        },
        configuration.webhookSecret,
      );
    } catch {
      return response(400, { ok: false, error: "invalid_webhook" });
    }

    const event = parseVerifiedResendWebhook(verified, svixId);
    if (!event) {
      return response(400, { ok: false, error: "invalid_webhook" });
    }

    const repository = repositoryFactory();
    if (!repository?.processResendWebhook) {
      return response(503, { ok: false, error: "temporarily_unavailable" });
    }

    try {
      const outcome = await repository.processResendWebhook(event);
      return response(200, { ok: true, status: outcome });
    } catch {
      return response(503, { ok: false, error: "temporarily_unavailable" });
    }
  };
}

export const handleNewsletterResendWebhook =
  createNewsletterResendWebhookHandler();
