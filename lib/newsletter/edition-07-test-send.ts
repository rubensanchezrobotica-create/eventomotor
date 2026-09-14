import {
  NEWSLETTER_EDITION_07_REPLY_TO,
  NEWSLETTER_EDITION_07_SENDER,
  NEWSLETTER_EDITION_07_SUBJECT,
  prepareEdition07Content,
  type NewsletterEdition07ContentVariant,
  type NewsletterEdition07Source,
  type NewsletterEdition07TemplateSummary,
} from "@/lib/newsletter/edition-07-content";
import { NEWSLETTER_EDITION_01_TEST_ARMED_VALUE } from "@/lib/newsletter/edition-01-test-send";
import { isValidEmail, normalizeEmail } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_07_TEST_ARMED_VALUE =
  NEWSLETTER_EDITION_01_TEST_ARMED_VALUE;
export const NEWSLETTER_EDITION_07_TEST_CONFIRM_PHRASE =
  "SEND-EDITION-07-TEST";
export const NEWSLETTER_EDITION_07_SAFE_TEST_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition07-preview-token-fixture-000000000000";

const MAX_ALLOWLIST_LENGTH = 4_096;
const SAFE_PROVIDER_ID_PATTERN = /^[A-Za-z0-9_./:+-]{1,200}$/;

export type NewsletterEdition07TestRequest = {
  send: boolean;
  to?: string;
  confirmTo?: string;
  confirmPhrase?: string;
  unsubscribeUrl?: string;
  variant?: NewsletterEdition07ContentVariant;
};

export type NewsletterEdition07TestEnvironment = {
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

export type NewsletterEdition07TestEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export type NewsletterEdition07TestClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition07TestClient {
  sendEmail(
    payload: NewsletterEdition07TestEmailPayload,
  ): Promise<NewsletterEdition07TestClientResult>;
}

type NewsletterEdition07TestResultBase = {
  recipient: string;
  variant: "national";
  subject: string;
  summary: NewsletterEdition07TemplateSummary;
  allowlistCount: 1;
};

export type NewsletterEdition07TestResult =
  | (NewsletterEdition07TestResultBase & {
      status: "dry_run";
      providerCalled: false;
    })
  | (NewsletterEdition07TestResultBase & {
      status: "accepted";
      providerCalled: true;
      providerMessageId: string;
    });

export type ExecuteNewsletterEdition07TestOptions = {
  request: NewsletterEdition07TestRequest;
  source: NewsletterEdition07Source;
  sender: string;
  replyTo: string;
  environment?: NewsletterEdition07TestEnvironment;
  clientFactory?: (apiKey: string) => NewsletterEdition07TestClient;
  logger?: (message: string) => void;
};

export class NewsletterEdition07TestSendError extends Error {
  constructor(readonly code: string) {
    super(`Edition 07 test send blocked: ${code}.`);
    this.name = "NewsletterEdition07TestSendError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition07TestSendError(code);
}

function assertSafeEnvironment(
  environment: NewsletterEdition07TestEnvironment,
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
  value: NewsletterEdition07ContentVariant | undefined,
): "national" {
  if (value !== undefined && value !== "national") fail("variant_not_allowed");
  return "national";
}

function parsedSingleAllowlist(value: string | undefined): readonly [string] {
  if (!value || value.length > MAX_ALLOWLIST_LENGTH || value.includes("*")) {
    fail("allowlist_invalid");
  }
  const entries = value.split(",");
  if (entries.length !== 1) fail("single_allowlisted_recipient_required");
  const entry = entries[0] ?? "";
  const recipient = normalizeEmail(entry);
  if (
    !entry.trim() ||
    entry !== entry.trim() ||
    !isValidEmail(recipient) ||
    /[<>;]/.test(entry)
  ) {
    fail("allowlist_invalid");
  }
  return [recipient];
}

function validatedTestUnsubscribeUrl(value: string | undefined): string {
  const candidate = value ?? NEWSLETTER_EDITION_07_SAFE_TEST_UNSUBSCRIBE_URL;
  if (candidate !== NEWSLETTER_EDITION_07_SAFE_TEST_UNSUBSCRIBE_URL) {
    fail("unsubscribe_url_invalid");
  }
  return candidate;
}

function assertValidationGates(
  recipient: string,
  environment: NewsletterEdition07TestEnvironment,
): readonly [string] {
  if (environment.newsletterMode !== "test") fail("mode_not_test");
  if (environment.mailTransport !== "resend") fail("transport_not_resend");
  const allowlist = parsedSingleAllowlist(environment.recipientAllowlist);
  if (allowlist[0] !== recipient) fail("recipient_not_allowed");
  return allowlist;
}

function assertSendGates(
  request: NewsletterEdition07TestRequest,
  recipient: string,
  environment: NewsletterEdition07TestEnvironment,
): string {
  if (!request.confirmTo || request.confirmTo !== request.to) {
    fail("recipient_confirmation_mismatch");
  }
  if (validatedRecipient(request.confirmTo) !== recipient) {
    fail("recipient_confirmation_mismatch");
  }
  if (request.confirmPhrase !== NEWSLETTER_EDITION_07_TEST_CONFIRM_PHRASE) {
    fail("confirmation_phrase_invalid");
  }
  if (environment.armed !== NEWSLETTER_EDITION_07_TEST_ARMED_VALUE) {
    fail("send_not_armed");
  }
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

function logSummary(
  logger: (message: string) => void,
  mode: "dry-run" | "send",
  recipient: string,
  environment: NewsletterEdition07TestEnvironment,
  summary: NewsletterEdition07TemplateSummary,
): void {
  logger("EDITION_07_PROTECTED_TEST_VALIDATION=PASS");
  logger(`AUTHORIZED_RECIPIENT_RESOLVED=YES`);
  logger(`RECIPIENT=${maskEmail(recipient)}`);
  logger(`ALLOWLIST_COUNT=1`);
  logger(`SINGLE_GMAIL=${recipient.endsWith("@gmail.com") ? "YES" : "NO"}`);
  logger(`MODE_TEST=YES`);
  logger(
    `TEST_SEND_ARMED=${
      environment.armed === NEWSLETTER_EDITION_07_TEST_ARMED_VALUE ? "YES" : "NO"
    }`,
  );
  logger("VARIANT=national");
  logger("TARGET_RECIPIENT_COUNT=1");
  logger(`DRY_RUN=${mode === "dry-run" ? "YES" : "NO"}`);
  logger(`ABSOLUTE_EDITION_IMAGES=${summary.imageCount}`);
  logger("UNSUBSCRIBE_CONTEXT=SAFE_SYNTHETIC_TEST_TOKEN");
  logger(`SUBJECT=${NEWSLETTER_EDITION_07_SUBJECT}`);
  logger(`PROVIDER_CALL_PLANNED=${mode === "send" ? "YES" : "NO"}`);
}

export async function executeNewsletterEdition07TestSend(
  options: ExecuteNewsletterEdition07TestOptions,
): Promise<NewsletterEdition07TestResult> {
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  assertSafeEnvironment(environment);
  if (
    options.sender !== NEWSLETTER_EDITION_07_SENDER ||
    options.replyTo !== NEWSLETTER_EDITION_07_REPLY_TO
  ) {
    fail("mail_identity_invalid");
  }

  const recipient = validatedRecipient(options.request.to);
  const variant = validatedVariant(options.request.variant);
  const allowlist = assertValidationGates(recipient, environment);
  const unsubscribeUrl = validatedTestUnsubscribeUrl(
    options.request.unsubscribeUrl,
  );
  const prepared = prepareEdition07Content(
    options.source,
    variant,
    unsubscribeUrl,
  );
  const summary: NewsletterEdition07TemplateSummary = {
    imageCount: prepared.imageCount,
    linkCount: prepared.linkCount,
    htmlCampaignCount: prepared.htmlCampaignCount,
    htmlUnsubscribePlaceholderCount: prepared.htmlUnsubscribePlaceholderCount,
    textUnsubscribePlaceholderCount: prepared.textUnsubscribePlaceholderCount,
    htmlTerritorialPlaceholderCount: prepared.htmlTerritorialPlaceholderCount,
    textTerritorialPlaceholderCount: prepared.textTerritorialPlaceholderCount,
    assetCount: prepared.assetCount,
  };

  if (!options.request.send) {
    logSummary(logger, "dry-run", recipient, environment, summary);
    logger("PROVIDER_CALLED=NO");
    logger("TEST_EMAILS_SENT=0");
    return {
      status: "dry_run",
      recipient: maskEmail(recipient),
      variant,
      subject: NEWSLETTER_EDITION_07_SUBJECT,
      summary,
      allowlistCount: allowlist.length,
      providerCalled: false,
    };
  }

  const apiKey = assertSendGates(options.request, recipient, environment);
  if (!options.clientFactory) fail("client_unavailable");
  const providerResult = await options.clientFactory(apiKey).sendEmail({
    from: options.sender,
    to: [recipient],
    replyTo: options.replyTo,
    subject: NEWSLETTER_EDITION_07_SUBJECT,
    html: prepared.html,
    text: prepared.text,
  });
  if (providerResult.status !== "accepted") {
    fail(`provider_${providerResult.status}`);
  }
  if (!SAFE_PROVIDER_ID_PATTERN.test(providerResult.providerMessageId)) {
    fail("provider_response_invalid");
  }

  logSummary(logger, "send", recipient, environment, summary);
  logger("PROVIDER_CALLED=YES");
  logger("TEST_EMAILS_SENT=1");
  logger("PROVIDER_MESSAGE_ID_PRESENT=YES");
  return {
    status: "accepted",
    recipient: maskEmail(recipient),
    variant,
    subject: NEWSLETTER_EDITION_07_SUBJECT,
    providerMessageId: providerResult.providerMessageId,
    summary,
    allowlistCount: allowlist.length,
    providerCalled: true,
  };
}

export function parseNewsletterEdition07TestArguments(
  argv: readonly string[],
): NewsletterEdition07TestRequest {
  const request: NewsletterEdition07TestRequest = {
    send: false,
    variant: "national",
  };
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
      if (value !== "national") fail("variant_not_allowed");
      request.variant = "national";
    }
  }
  return request;
}
