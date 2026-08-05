import { createHash } from "node:crypto";

import {
  isValidEmail,
  isValidNewsletterActionTokenShape,
  normalizeEmail,
} from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_01_HTML_SHA256 =
  "75299306a8cfd8b67b37f1770244dccedd81e00137b44deff3432730bdb722ab";
export const NEWSLETTER_EDITION_01_TEXT_SHA256 =
  "1e455b715895999acf47327e8732d99466cc3c0ab629d68f1bd69bbca22371be";
const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-08-06/assets/";
const CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_08_06";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const CORRUPT_TEXT_MARKERS = [
  "\u00c3",
  "\u00c2",
  "\u00e2\u20ac",
  "\ufffd",
] as const;
const EXPECTED_IMAGE_COUNT = 7;
const EXPECTED_HTML_CAMPAIGN_COUNT = 13;

export const NEWSLETTER_EDITION_01_TEST_ARMED_VALUE = "edition-01-test-only";
export const NEWSLETTER_EDITION_01_TEST_CONFIRM_PHRASE =
  "SEND-EDITION-01-TEST";
export const NEWSLETTER_EDITION_01_TEST_SUBJECT =
  "[PRUEBA] La Bañeza, rally y 4 planes más para este fin de semana";

export type NewsletterEdition01TestRequest = {
  send: boolean;
  to?: string;
  confirmTo?: string;
  confirmPhrase?: string;
  unsubscribeUrl?: string;
};

export type NewsletterEdition01TestEnvironment = {
  armed?: string;
  apiKey?: string;
  ci?: string;
  nodeEnv?: string;
  vercel?: string;
  vercelEnv?: string;
};

export type NewsletterEdition01Source = {
  html: string;
  text: string;
};

export type NewsletterEdition01TemplateSummary = {
  imageCount: number;
  htmlCampaignCount: number;
  htmlPlaceholderCount: number;
  textPlaceholderCount: number;
};

export type NewsletterEdition01PreparedContent =
  NewsletterEdition01TemplateSummary & {
    html: string;
    text: string;
  };

export type NewsletterEdition01EmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export type NewsletterEdition01ClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition01Client {
  sendEmail(
    payload: NewsletterEdition01EmailPayload,
  ): Promise<NewsletterEdition01ClientResult>;
}

export type NewsletterEdition01TestResult =
  | {
      status: "dry_run";
      recipient: string;
      summary: NewsletterEdition01TemplateSummary;
    }
  | {
      status: "accepted";
      recipient: string;
      providerMessageId: string;
      summary: NewsletterEdition01TemplateSummary;
    };

type Edition01ClientFactory = (apiKey: string) => NewsletterEdition01Client;

export type ExecuteNewsletterEdition01TestOptions = {
  request: NewsletterEdition01TestRequest;
  source: NewsletterEdition01Source;
  sender: string;
  replyTo: string;
  environment?: NewsletterEdition01TestEnvironment;
  clientFactory?: Edition01ClientFactory;
  logger?: (message: string) => void;
};

export class NewsletterEdition01TestSendError extends Error {
  constructor(readonly code: string) {
    super(`Edition 01 test send blocked: ${code}.`);
    this.name = "NewsletterEdition01TestSendError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition01TestSendError(code);
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalizeEdition01TemplateText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function assertNewsletterEdition01TestExecutionEnvironment(
  environment: NewsletterEdition01TestEnvironment,
): void {
  if (environment.ci !== undefined) fail("ci_blocked");
  if (
    environment.vercel !== undefined ||
    environment.vercelEnv !== undefined
  ) {
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

function maskEmail(value: string): string {
  const [local = "", domain = ""] = value.split("@");
  const domainParts = domain.split(".");
  const domainName = domainParts.shift() ?? "";
  const suffix = domainParts.length > 0 ? `.${domainParts.join(".")}` : "";
  return `${local.slice(0, 2)}***@${domainName.slice(0, 2)}***${suffix}`;
}

export function validateEdition01UnsubscribeUrl(
  value: string | undefined,
): string {
  if (!value) fail("unsubscribe_url_missing");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail("unsubscribe_url_invalid");
  }

  const entries = [...parsed.searchParams.entries()];
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== "https://www.eventomotor.com" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/newsletter/unsubscribe" ||
    parsed.hash ||
    entries.length !== 1 ||
    entries[0]?.[0] !== "token" ||
    !isValidNewsletterActionTokenShape(entries[0]?.[1] ?? "")
  ) {
    fail("unsubscribe_url_invalid");
  }

  return parsed.toString();
}

export function validateEdition01Template(
  source: NewsletterEdition01Source,
): NewsletterEdition01TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 01")
  ) {
    fail("template_unexpected");
  }
  if (
    CORRUPT_TEXT_MARKERS.some(
      (marker) => source.html.includes(marker) || source.text.includes(marker),
    )
  ) {
    fail("template_encoding_invalid");
  }

  const imageSources = [
    ...source.html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),
  ].map((match) => match[1] ?? "");
  if (
    imageSources.length !== EXPECTED_IMAGE_COUNT ||
    new Set(imageSources).size !== EXPECTED_IMAGE_COUNT ||
    imageSources.some((imageSource) => !imageSource.startsWith(ASSET_ORIGIN)) ||
    /<img\b[^>]*\bsrc=["'](?:\.?\/)?assets\//i.test(source.html) ||
    /url\(["']?(?:\.?\/)?assets\//i.test(source.html)
  ) {
    fail("template_images_invalid");
  }

  const htmlPlaceholderCount = countOccurrences(
    source.html,
    UNSUBSCRIBE_PLACEHOLDER,
  );
  const textPlaceholderCount = countOccurrences(
    source.text,
    UNSUBSCRIBE_PLACEHOLDER,
  );
  if (htmlPlaceholderCount !== 1 || textPlaceholderCount !== 1) {
    fail("unsubscribe_placeholder_invalid");
  }

  const htmlCampaignCount = countOccurrences(source.html, CAMPAIGN_MARKER);
  if (htmlCampaignCount !== EXPECTED_HTML_CAMPAIGN_COUNT) {
    fail("template_campaign_invalid");
  }
  if (
    !source.text.includes(
      "La Bañeza, rally y 4 planes más para este fin de semana",
    )
  ) {
    fail("template_subject_invalid");
  }

  return {
    imageCount: imageSources.length,
    htmlCampaignCount,
    htmlPlaceholderCount,
    textPlaceholderCount,
  };
}

export function validateEdition01SourceIntegrity(
  source: NewsletterEdition01Source,
): NewsletterEdition01TemplateSummary {
  if (
    sha256(canonicalizeEdition01TemplateText(source.html)) !==
      NEWSLETTER_EDITION_01_HTML_SHA256 ||
    sha256(canonicalizeEdition01TemplateText(source.text)) !==
      NEWSLETTER_EDITION_01_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  return validateEdition01Template(source);
}

export function prepareEdition01Content(
  source: NewsletterEdition01Source,
  unsubscribeUrl: string,
): NewsletterEdition01PreparedContent {
  const summary = validateEdition01SourceIntegrity(source);
  const validatedUrl = validateEdition01UnsubscribeUrl(unsubscribeUrl);
  const html = source.html.replace(UNSUBSCRIBE_PLACEHOLDER, validatedUrl);
  const text = source.text.replace(UNSUBSCRIBE_PLACEHOLDER, validatedUrl);

  if (
    html.includes(UNSUBSCRIBE_PLACEHOLDER) ||
    text.includes(UNSUBSCRIBE_PLACEHOLDER)
  ) {
    fail("unsubscribe_placeholder_replacement_failed");
  }

  return { ...summary, html, text };
}

function assertSendGates(
  request: NewsletterEdition01TestRequest,
  environment: NewsletterEdition01TestEnvironment,
): string {
  if (!request.confirmTo || request.confirmTo !== request.to) {
    fail("recipient_confirmation_mismatch");
  }
  validatedRecipient(request.confirmTo);
  if (request.confirmPhrase !== NEWSLETTER_EDITION_01_TEST_CONFIRM_PHRASE) {
    fail("confirmation_phrase_invalid");
  }
  if (environment.armed !== NEWSLETTER_EDITION_01_TEST_ARMED_VALUE) {
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

function logValidationSummary(
  logger: (message: string) => void,
  mode: "dry-run" | "send",
  recipient: string,
  summary: NewsletterEdition01TemplateSummary,
  sender: string,
  replyTo: string,
): void {
  logger("Edition 01 validation passed.");
  logger(`Mode: ${mode}`);
  logger(`Recipient: ${maskEmail(recipient)}`);
  logger(`Absolute edition images: ${summary.imageCount}`);
  logger(`HTML campaign markers: ${summary.htmlCampaignCount}`);
  logger("Unsubscribe placeholders: 1 HTML + 1 text, replaced safely");
  logger(`Sender: ${sender}`);
  logger(`Reply-To: ${replyTo}`);
  logger("Subject prefix: [PRUEBA]");
}

export async function executeNewsletterEdition01TestSend(
  options: ExecuteNewsletterEdition01TestOptions,
): Promise<NewsletterEdition01TestResult> {
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  assertNewsletterEdition01TestExecutionEnvironment(environment);

  const recipient = validatedRecipient(options.request.to);
  const unsubscribeUrl = validateEdition01UnsubscribeUrl(
    options.request.unsubscribeUrl,
  );
  const prepared = prepareEdition01Content(options.source, unsubscribeUrl);
  const summary: NewsletterEdition01TemplateSummary = {
    imageCount: prepared.imageCount,
    htmlCampaignCount: prepared.htmlCampaignCount,
    htmlPlaceholderCount: prepared.htmlPlaceholderCount,
    textPlaceholderCount: prepared.textPlaceholderCount,
  };

  if (!options.request.send) {
    logValidationSummary(
      logger,
      "dry-run",
      recipient,
      summary,
      options.sender,
      options.replyTo,
    );
    logger("Dry-run complete. No email was sent.");
    return { status: "dry_run", recipient: maskEmail(recipient), summary };
  }

  const apiKey = assertSendGates(options.request, environment);
  if (!options.clientFactory) fail("client_unavailable");
  const payload: NewsletterEdition01EmailPayload = {
    from: options.sender,
    to: [recipient],
    replyTo: options.replyTo,
    subject: NEWSLETTER_EDITION_01_TEST_SUBJECT,
    html: prepared.html,
    text: prepared.text,
  };
  const providerResult = await options.clientFactory(apiKey).sendEmail(payload);
  if (providerResult.status !== "accepted") {
    fail(`provider_${providerResult.status}`);
  }

  logValidationSummary(
    logger,
    "send",
    recipient,
    summary,
    options.sender,
    options.replyTo,
  );
  logger(
    `Test email accepted. Provider message ID: ${providerResult.providerMessageId}`,
  );
  return {
    status: "accepted",
    recipient: maskEmail(recipient),
    providerMessageId: providerResult.providerMessageId,
    summary,
  };
}

export function parseNewsletterEdition01TestArguments(
  argv: readonly string[],
): NewsletterEdition01TestRequest {
  const request: NewsletterEdition01TestRequest = { send: false };
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
      argument !== "--unsubscribe-url"
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
  }

  return request;
}

export function selectNewsletterEdition01Environment(
  environment: NewsletterEdition01TestEnvironment,
  includeApiKey = false,
): NewsletterEdition01TestEnvironment {
  return {
    armed: environment.armed,
    apiKey: includeApiKey ? environment.apiKey : undefined,
    ci: environment.ci,
    nodeEnv: environment.nodeEnv,
    vercel: environment.vercel,
    vercelEnv: environment.vercelEnv,
  };
}
