import {
  NEWSLETTER_EDITION_02_REPLY_TO,
  NEWSLETTER_EDITION_02_SENDER,
  NEWSLETTER_EDITION_02_SUBJECT,
  prepareEdition02Content,
  type NewsletterEdition02ContentVariant,
  type NewsletterEdition02Source,
  type NewsletterEdition02TemplateSummary,
} from "@/lib/newsletter/edition-02-content";
import { NEWSLETTER_EDITION_01_TEST_ARMED_VALUE } from "@/lib/newsletter/edition-01-test-send";
import {
  isValidEmail,
  isValidNewsletterOpaqueToken,
  normalizeEmail,
} from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_02_TEST_ARMED_VALUE =
  NEWSLETTER_EDITION_01_TEST_ARMED_VALUE;
export const NEWSLETTER_EDITION_02_TEST_CONFIRM_PHRASE =
  "SEND-EDITION-02-TEST";

const MAX_ALLOWLIST_ENTRIES = 20;
const MAX_ALLOWLIST_LENGTH = 4_096;
const SAFE_PROVIDER_ID_PATTERN = /^[A-Za-z0-9_./:+-]{1,200}$/;
const VARIANTS = ["national", "madrid", "a-coruna", "barcelona"] as const;

export type NewsletterEdition02TestRequest = {
  send: boolean;
  to?: string;
  confirmTo?: string;
  confirmPhrase?: string;
  unsubscribeUrl?: string;
  variant?: NewsletterEdition02ContentVariant;
};

export type NewsletterEdition02TestEnvironment = {
  armed?: string;
  apiKey?: string;
  ci?: string;
  mailTransport?: string;
  newsletterMode?: string;
  nodeEnv?: string;
  recipientAllowlist?: string;
  vercel?: string;
  vercelEnv?: string;
};

export type NewsletterEdition02TestEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export type NewsletterEdition02TestClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition02TestClient {
  sendEmail(
    payload: NewsletterEdition02TestEmailPayload,
  ): Promise<NewsletterEdition02TestClientResult>;
}

export type NewsletterEdition02TestResult =
  | {
      status: "dry_run";
      recipient: string;
      variant: NewsletterEdition02ContentVariant;
      subject: string;
      summary: NewsletterEdition02TemplateSummary;
    }
  | {
      status: "accepted";
      recipient: string;
      variant: NewsletterEdition02ContentVariant;
      subject: string;
      providerMessageId: string;
      summary: NewsletterEdition02TemplateSummary;
    };

export type ExecuteNewsletterEdition02TestOptions = {
  request: NewsletterEdition02TestRequest;
  source: NewsletterEdition02Source;
  sender: string;
  replyTo: string;
  environment?: NewsletterEdition02TestEnvironment;
  clientFactory?: (apiKey: string) => NewsletterEdition02TestClient;
  logger?: (message: string) => void;
};

export class NewsletterEdition02TestSendError extends Error {
  constructor(readonly code: string) {
    super(`Edition 02 test send blocked: ${code}.`);
    this.name = "NewsletterEdition02TestSendError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition02TestSendError(code);
}

function assertSafeEnvironment(
  environment: NewsletterEdition02TestEnvironment,
): void {
  if (environment.ci !== undefined) fail("ci_blocked");
  if (environment.vercel !== undefined || environment.vercelEnv !== undefined) {
    fail("vercel_blocked");
  }
  if (environment.nodeEnv === "production") fail("production_blocked");
}

function validatedRecipient(value: string | undefined): string {
  if (
    !value ||
    value !== value.trim() ||
    /[,;<>'"\r\n]/.test(value) ||
    !isValidEmail(value)
  ) {
    fail("single_recipient_required");
  }
  return normalizeEmail(value);
}

function validatedVariant(
  value: NewsletterEdition02ContentVariant | undefined,
): NewsletterEdition02ContentVariant {
  if (!value || !VARIANTS.includes(value)) fail("variant_required");
  return value;
}

function parsedAllowlist(value: string | undefined): readonly string[] {
  if (!value || value.length > MAX_ALLOWLIST_LENGTH || value.includes("*")) {
    fail("allowlist_invalid");
  }
  const entries = value.split(",");
  if (entries.length < 1 || entries.length > MAX_ALLOWLIST_ENTRIES) {
    fail("allowlist_invalid");
  }
  const normalized: string[] = [];
  for (const entry of entries) {
    const recipient = normalizeEmail(entry);
    if (!entry.trim() || !isValidEmail(recipient) || /[<>;]/.test(entry)) {
      fail("allowlist_invalid");
    }
    normalized.push(recipient);
  }
  if (new Set(normalized).size !== normalized.length) fail("allowlist_invalid");
  return normalized;
}

function assertSendGates(
  request: NewsletterEdition02TestRequest,
  recipient: string,
  environment: NewsletterEdition02TestEnvironment,
): string {
  if (!request.confirmTo || request.confirmTo !== request.to) {
    fail("recipient_confirmation_mismatch");
  }
  if (validatedRecipient(request.confirmTo) !== recipient) {
    fail("recipient_confirmation_mismatch");
  }
  if (!parsedAllowlist(environment.recipientAllowlist).includes(recipient)) {
    fail("recipient_not_allowed");
  }
  if (request.confirmPhrase !== NEWSLETTER_EDITION_02_TEST_CONFIRM_PHRASE) {
    fail("confirmation_phrase_invalid");
  }
  if (environment.armed !== NEWSLETTER_EDITION_02_TEST_ARMED_VALUE) {
    fail("send_not_armed");
  }
  if (environment.newsletterMode !== "test") fail("mode_not_test");
  if (environment.mailTransport !== "resend") fail("transport_not_resend");
  if (
    !environment.apiKey ||
    environment.apiKey.length < 20 ||
    environment.apiKey.length > 500 ||
    environment.apiKey !== environment.apiKey.trim() ||
    /[\s\u0000-\u001f\u007f]/.test(environment.apiKey)
  ) {
    fail("api_key_unavailable");
  }
  return environment.apiKey;
}

function maskEmail(value: string): string {
  const [local = "", domain = ""] = value.split("@");
  const [domainName = "", ...suffixParts] = domain.split(".");
  const suffix = suffixParts.length > 0 ? `.${suffixParts.join(".")}` : "";
  return `${local.slice(0, 2)}***@${domainName.slice(0, 2)}***${suffix}`;
}

function validatedTestUnsubscribeUrl(value: string | undefined): string {
  if (!value) fail("unsubscribe_url_missing");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail("unsubscribe_url_invalid");
  }
  if (!isValidNewsletterOpaqueToken(parsed.searchParams.get("token") ?? "")) {
    fail("unsubscribe_url_invalid");
  }
  return value;
}

export function newsletterEdition02TestSubject(
  variant: NewsletterEdition02ContentVariant,
): string {
  return `[PRUEBA E02 · ${variant.toUpperCase()}] ${NEWSLETTER_EDITION_02_SUBJECT}`;
}

function logSummary(
  logger: (message: string) => void,
  mode: "dry-run" | "send",
  recipient: string,
  variant: NewsletterEdition02ContentVariant,
  summary: NewsletterEdition02TemplateSummary,
): void {
  logger("Edition 02 test validation passed.");
  logger(`Mode: ${mode}`);
  logger(`Recipient: ${maskEmail(recipient)}`);
  logger(`Variant: ${variant}`);
  logger(`Absolute edition images: ${summary.imageCount}`);
  logger("Unsubscribe placeholders: 1 HTML + 1 text, replaced safely");
  logger(`Subject: ${newsletterEdition02TestSubject(variant)}`);
}

export async function executeNewsletterEdition02TestSend(
  options: ExecuteNewsletterEdition02TestOptions,
): Promise<NewsletterEdition02TestResult> {
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  assertSafeEnvironment(environment);
  if (
    options.sender !== NEWSLETTER_EDITION_02_SENDER ||
    options.replyTo !== NEWSLETTER_EDITION_02_REPLY_TO
  ) {
    fail("mail_identity_invalid");
  }

  const recipient = validatedRecipient(options.request.to);
  const variant = validatedVariant(options.request.variant);
  const unsubscribeUrl = validatedTestUnsubscribeUrl(
    options.request.unsubscribeUrl,
  );
  const prepared = prepareEdition02Content(
    options.source,
    variant,
    unsubscribeUrl,
  );
  const summary: NewsletterEdition02TemplateSummary = {
    imageCount: prepared.imageCount,
    linkCount: prepared.linkCount,
    htmlCampaignCount: prepared.htmlCampaignCount,
    htmlUnsubscribePlaceholderCount: prepared.htmlUnsubscribePlaceholderCount,
    textUnsubscribePlaceholderCount: prepared.textUnsubscribePlaceholderCount,
    htmlTerritorialPlaceholderCount: prepared.htmlTerritorialPlaceholderCount,
    textTerritorialPlaceholderCount: prepared.textTerritorialPlaceholderCount,
    assetCount: prepared.assetCount,
  };
  const subject = newsletterEdition02TestSubject(variant);

  if (!options.request.send) {
    logSummary(logger, "dry-run", recipient, variant, summary);
    logger("Dry-run complete. No email was sent.");
    return {
      status: "dry_run",
      recipient: maskEmail(recipient),
      variant,
      subject,
      summary,
    };
  }

  const apiKey = assertSendGates(options.request, recipient, environment);
  if (!options.clientFactory) fail("client_unavailable");
  const providerResult = await options.clientFactory(apiKey).sendEmail({
    from: options.sender,
    to: [recipient],
    replyTo: options.replyTo,
    subject,
    html: prepared.html,
    text: prepared.text,
  });
  if (providerResult.status !== "accepted") {
    fail(`provider_${providerResult.status}`);
  }
  if (!SAFE_PROVIDER_ID_PATTERN.test(providerResult.providerMessageId)) {
    fail("provider_response_invalid");
  }

  logSummary(logger, "send", recipient, variant, summary);
  logger(`Test email accepted. Provider message ID: ${providerResult.providerMessageId}`);
  return {
    status: "accepted",
    recipient: maskEmail(recipient),
    variant,
    subject,
    providerMessageId: providerResult.providerMessageId,
    summary,
  };
}

export function parseNewsletterEdition02TestArguments(
  argv: readonly string[],
): NewsletterEdition02TestRequest {
  const request: NewsletterEdition02TestRequest = { send: false };
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--send") {
      if (seen.has(argument)) fail("duplicate_argument");
      seen.add(argument);
      request.send = true;
      continue;
    }
    if (
      argument !== "--to" &&
      argument !== "--confirm-to" &&
      argument !== "--confirm-phrase" &&
      argument !== "--unsubscribe-url" &&
      argument !== "--variant"
    ) {
      fail("unknown_argument");
    }
    if (seen.has(argument)) fail("duplicate_argument");
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail("argument_value_missing");
    index += 1;
    if (argument === "--to") request.to = value;
    if (argument === "--confirm-to") request.confirmTo = value;
    if (argument === "--confirm-phrase") request.confirmPhrase = value;
    if (argument === "--unsubscribe-url") request.unsubscribeUrl = value;
    if (argument === "--variant") {
      if (!VARIANTS.includes(value as NewsletterEdition02ContentVariant)) {
        fail("variant_invalid");
      }
      request.variant = value as NewsletterEdition02ContentVariant;
    }
  }
  return request;
}
