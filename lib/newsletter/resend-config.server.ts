import "server-only";

import { isValidEmail, normalizeEmail } from "@/lib/newsletter/schemas";
import type { NewsletterMailTransport } from "@/lib/newsletter/mail-transport.server";
import {
  FetchNewsletterResendClient,
  type NewsletterResendClient,
} from "@/lib/newsletter/resend-client.server";
import { ResendNewsletterMailTransport } from "@/lib/newsletter/resend-transport.server";

const MAX_ALLOWLIST_ENTRIES = 20;
const MAX_ALLOWLIST_LENGTH = 4_096;
const DISPLAY_NAME_PATTERN = /^[^<>\r\n]{1,80}$/;

export type NewsletterResendEnvironment = {
  newsletterMode?: string;
  mailTransport?: string;
  apiKey?: string;
  from?: string;
  replyTo?: string;
  recipientAllowlist?: string;
  nodeEnv?: string;
  vercelEnv?: string;
};

export type NewsletterResendConfigurationReason =
  | "transport_not_selected"
  | "mode_not_test"
  | "deployment_blocked"
  | "api_key_invalid"
  | "from_invalid"
  | "reply_to_invalid"
  | "allowlist_invalid";

export type NewsletterResendConfiguration =
  | { enabled: false; reason: NewsletterResendConfigurationReason }
  | {
      enabled: true;
      apiKey: string;
      from: string;
      replyTo: string;
      allowedRecipients: readonly string[];
    };

export type ConfiguredNewsletterResendRuntime = {
  transport: NewsletterMailTransport;
  serviceMode: "test";
};

function isValidSender(value: string): boolean {
  if (value.length > 320 || value !== value.trim()) return false;
  if (isValidEmail(value)) return true;
  const match = value.match(/^(.+?)\s*<([^<>]+)>$/);
  return Boolean(
    match &&
      DISPLAY_NAME_PATTERN.test(match[1]?.trim() ?? "") &&
      isValidEmail(match[2] ?? "") &&
      normalizeEmail(match[2] ?? "") === (match[2] ?? "").trim().toLowerCase(),
  );
}

function parseAllowlist(value: string): readonly string[] | null {
  if (!value || value.length > MAX_ALLOWLIST_LENGTH || value.includes("*")) return null;
  const entries = value.split(",");
  if (entries.length < 1 || entries.length > MAX_ALLOWLIST_ENTRIES) return null;
  const normalized: string[] = [];
  for (const entry of entries) {
    const recipient = normalizeEmail(entry);
    if (!entry.trim() || !isValidEmail(recipient) || /[<>;]/.test(entry)) return null;
    normalized.push(recipient);
  }
  return new Set(normalized).size === normalized.length ? Object.freeze(normalized) : null;
}

function isValidApiKey(value: string): boolean {
  return (
    value.length >= 20 &&
    value.length <= 500 &&
    value === value.trim() &&
    !/[\s\u0000-\u001f\u007f]/.test(value)
  );
}

export function evaluateNewsletterResendConfiguration(
  environment: NewsletterResendEnvironment,
): NewsletterResendConfiguration {
  if (environment.mailTransport !== "resend") {
    return { enabled: false, reason: "transport_not_selected" };
  }
  if (environment.newsletterMode !== "test") {
    return { enabled: false, reason: "mode_not_test" };
  }
  if (environment.nodeEnv === "production" || environment.vercelEnv !== undefined) {
    return { enabled: false, reason: "deployment_blocked" };
  }
  if (!environment.apiKey || !isValidApiKey(environment.apiKey)) {
    return { enabled: false, reason: "api_key_invalid" };
  }
  if (!environment.from || !isValidSender(environment.from)) {
    return { enabled: false, reason: "from_invalid" };
  }
  if (
    !environment.replyTo ||
    environment.replyTo !== environment.replyTo.trim() ||
    !isValidEmail(environment.replyTo)
  ) {
    return { enabled: false, reason: "reply_to_invalid" };
  }
  const allowedRecipients = environment.recipientAllowlist
    ? parseAllowlist(environment.recipientAllowlist)
    : null;
  if (!allowedRecipients) {
    return { enabled: false, reason: "allowlist_invalid" };
  }
  return {
    enabled: true,
    apiKey: environment.apiKey,
    from: environment.from,
    replyTo: normalizeEmail(environment.replyTo),
    allowedRecipients,
  };
}

function currentResendEnvironment(): NewsletterResendEnvironment {
  return {
    newsletterMode: process.env.NEWSLETTER_MODE,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    apiKey: process.env.NEWSLETTER_RESEND_API_KEY,
    from: process.env.NEWSLETTER_RESEND_FROM,
    replyTo: process.env.NEWSLETTER_RESEND_REPLY_TO,
    recipientAllowlist: process.env.NEWSLETTER_TEST_RECIPIENT_ALLOWLIST,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  };
}

export function createConfiguredNewsletterResendRuntime(
  clientFactory: (apiKey: string) => NewsletterResendClient = (apiKey) =>
    new FetchNewsletterResendClient({ apiKey }),
): ConfiguredNewsletterResendRuntime | null {
  const configuration = evaluateNewsletterResendConfiguration(
    currentResendEnvironment(),
  );
  if (!configuration.enabled) return null;

  return {
    serviceMode: "test",
    transport: new ResendNewsletterMailTransport({
      client: clientFactory(configuration.apiKey),
      from: configuration.from,
      replyTo: configuration.replyTo,
      allowedRecipients: configuration.allowedRecipients,
    }),
  };
}
