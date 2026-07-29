import "server-only";

import { isValidEmail, normalizeEmail } from "@/lib/newsletter/schemas";
import type { NewsletterMailTransport } from "@/lib/newsletter/mail-transport.server";
import {
  FetchNewsletterResendClient,
  type NewsletterResendClient,
} from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_R4B_ARMED_VALUE,
  parseNewsletterR4BLocalOrigin,
} from "@/lib/newsletter/r4b-guard";
import {
  NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
  parseNewsletterProductionCanaryOrigin,
} from "@/lib/newsletter/r5a-guard";
import { ResendNewsletterMailTransport } from "@/lib/newsletter/resend-transport.server";

const MAX_ALLOWLIST_ENTRIES = 20;
const MAX_PRODUCTION_CANARY_ALLOWLIST_ENTRIES = 10;
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
  vercel?: string;
  vercelEnv?: string;
};

export type NewsletterR4BResendEnvironment = NewsletterResendEnvironment & {
  armed?: string;
  localOrigin?: string;
};

export type NewsletterProductionCanaryResendEnvironment =
  NewsletterResendEnvironment & {
    armed?: string;
    canaryOrigin?: string;
    vercel?: string;
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

export type NewsletterR4BResendConfigurationReason =
  | NewsletterResendConfigurationReason
  | "r4b_not_armed"
  | "sender_domain_invalid"
  | "single_recipient_required"
  | "local_endpoint_invalid";

export type NewsletterR4BResendConfiguration =
  | { enabled: false; reason: NewsletterR4BResendConfigurationReason }
  | (Extract<NewsletterResendConfiguration, { enabled: true }> & {
      localOrigin: string;
    });

export type NewsletterProductionCanaryResendConfigurationReason =
  | NewsletterResendConfigurationReason
  | "mode_not_live"
  | "canary_not_armed"
  | "vercel_required"
  | "production_environment_required"
  | "canary_endpoint_invalid"
  | "sender_domain_invalid";

export type NewsletterProductionCanaryResendConfiguration =
  | {
      enabled: false;
      reason: NewsletterProductionCanaryResendConfigurationReason;
    }
  | (Extract<NewsletterResendConfiguration, { enabled: true }> & {
      canonicalEndpoint: string;
    });

export type ConfiguredNewsletterResendRuntime = {
  transport: NewsletterMailTransport;
  serviceMode: "test" | "live";
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

function senderEmail(value: string): string | null {
  if (isValidEmail(value)) return normalizeEmail(value);
  const match = value.match(/^(.+?)\s*<([^<>]+)>$/);
  return match && isValidEmail(match[2] ?? "") ? normalizeEmail(match[2] ?? "") : null;
}

function parseAllowlist(
  value: string,
  maximumEntries = MAX_ALLOWLIST_ENTRIES,
): readonly string[] | null {
  if (!value || value.length > MAX_ALLOWLIST_LENGTH || value.includes("*")) return null;
  const entries = value.split(",");
  if (entries.length < 1 || entries.length > maximumEntries) return null;
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

export function evaluateNewsletterR4BResendConfiguration(
  environment: NewsletterR4BResendEnvironment,
): NewsletterR4BResendConfiguration {
  if (environment.armed !== NEWSLETTER_R4B_ARMED_VALUE) {
    return { enabled: false, reason: "r4b_not_armed" };
  }
  if (environment.vercel !== undefined) {
    return { enabled: false, reason: "deployment_blocked" };
  }
  const base = evaluateNewsletterResendConfiguration(environment);
  if (!base.enabled) return base;

  const fromAddress = senderEmail(base.from);
  if (!fromAddress || fromAddress.split("@")[1] !== "news.eventomotor.com") {
    return { enabled: false, reason: "sender_domain_invalid" };
  }
  if (base.allowedRecipients.length !== 1) {
    return { enabled: false, reason: "single_recipient_required" };
  }
  const localEndpoint = parseNewsletterR4BLocalOrigin(environment.localOrigin);
  if (!localEndpoint) {
    return { enabled: false, reason: "local_endpoint_invalid" };
  }
  return {
    ...base,
    localOrigin: localEndpoint.origin,
  };
}

export function evaluateNewsletterProductionCanaryResendConfiguration(
  environment: NewsletterProductionCanaryResendEnvironment,
): NewsletterProductionCanaryResendConfiguration {
  if (environment.mailTransport !== "resend") {
    return { enabled: false, reason: "transport_not_selected" };
  }
  if (environment.newsletterMode !== "live") {
    return { enabled: false, reason: "mode_not_live" };
  }
  if (environment.armed !== NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE) {
    return { enabled: false, reason: "canary_not_armed" };
  }
  if (environment.vercel !== "1") {
    return { enabled: false, reason: "vercel_required" };
  }
  if (
    environment.vercelEnv !== "production" ||
    environment.nodeEnv !== "production"
  ) {
    return { enabled: false, reason: "production_environment_required" };
  }
  const origin = parseNewsletterProductionCanaryOrigin(
    environment.canaryOrigin,
  );
  if (!origin) {
    return { enabled: false, reason: "canary_endpoint_invalid" };
  }
  if (!environment.apiKey || !isValidApiKey(environment.apiKey)) {
    return { enabled: false, reason: "api_key_invalid" };
  }
  if (!environment.from || !isValidSender(environment.from)) {
    return { enabled: false, reason: "from_invalid" };
  }
  const fromAddress = senderEmail(environment.from);
  if (!fromAddress || fromAddress.split("@")[1] !== "news.eventomotor.com") {
    return { enabled: false, reason: "sender_domain_invalid" };
  }
  if (
    !environment.replyTo ||
    environment.replyTo !== environment.replyTo.trim() ||
    !isValidEmail(environment.replyTo)
  ) {
    return { enabled: false, reason: "reply_to_invalid" };
  }
  const allowedRecipients = environment.recipientAllowlist
    ? parseAllowlist(
        environment.recipientAllowlist,
        MAX_PRODUCTION_CANARY_ALLOWLIST_ENTRIES,
      )
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
    canonicalEndpoint: origin.origin,
  };
}

function currentNewsletterR4BResendEnvironment(): NewsletterR4BResendEnvironment {
  return {
    newsletterMode: process.env.NEWSLETTER_MODE,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    apiKey: process.env.NEWSLETTER_RESEND_API_KEY,
    from: process.env.NEWSLETTER_RESEND_FROM,
    replyTo: process.env.NEWSLETTER_RESEND_REPLY_TO,
    recipientAllowlist: process.env.NEWSLETTER_TEST_RECIPIENT_ALLOWLIST,
    armed: process.env.NEWSLETTER_R4B_ARMED,
    localOrigin: process.env.NEWSLETTER_R4B_LOCAL_ORIGIN,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}

export function currentNewsletterProductionCanaryEnvironment(): NewsletterProductionCanaryResendEnvironment {
  return {
    newsletterMode: process.env.NEWSLETTER_MODE,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    apiKey: process.env.NEWSLETTER_RESEND_API_KEY,
    from: process.env.NEWSLETTER_RESEND_FROM,
    replyTo: process.env.NEWSLETTER_RESEND_REPLY_TO,
    recipientAllowlist: process.env.NEWSLETTER_PRODUCTION_CANARY_ALLOWLIST,
    armed: process.env.NEWSLETTER_PRODUCTION_CANARY_ARMED,
    canaryOrigin: process.env.NEWSLETTER_PRODUCTION_CANARY_ORIGIN,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}

export function createNewsletterProductionCanaryResendRuntime(
  environment: NewsletterProductionCanaryResendEnvironment,
  clientFactory: (apiKey: string) => NewsletterResendClient = (apiKey) =>
    new FetchNewsletterResendClient({ apiKey }),
): ConfiguredNewsletterResendRuntime | null {
  const configuration =
    evaluateNewsletterProductionCanaryResendConfiguration(environment);
  if (!configuration.enabled) return null;

  return {
    serviceMode: "live",
    transport: new ResendNewsletterMailTransport({
      client: clientFactory(configuration.apiKey),
      from: configuration.from,
      replyTo: configuration.replyTo,
      allowedRecipients: configuration.allowedRecipients,
      linkOrigin: configuration.canonicalEndpoint,
      linkProfile: "production-canary",
    }),
  };
}

export function createConfiguredNewsletterResendRuntime(
  clientFactory: (apiKey: string) => NewsletterResendClient = (apiKey) =>
    new FetchNewsletterResendClient({ apiKey }),
): ConfiguredNewsletterResendRuntime | null {
  const productionCanary = createNewsletterProductionCanaryResendRuntime(
    currentNewsletterProductionCanaryEnvironment(),
    clientFactory,
  );
  if (productionCanary) return productionCanary;

  const configuration = evaluateNewsletterR4BResendConfiguration(
    currentNewsletterR4BResendEnvironment(),
  );
  if (!configuration.enabled) return null;

  return {
    serviceMode: "test",
    transport: new ResendNewsletterMailTransport({
      client: clientFactory(configuration.apiKey),
      from: configuration.from,
      replyTo: configuration.replyTo,
      allowedRecipients: configuration.allowedRecipients,
      linkOrigin: configuration.localOrigin,
    }),
  };
}
