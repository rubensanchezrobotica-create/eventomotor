import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  FetchNewsletterResendClient,
  type NewsletterResendClient,
  type NewsletterResendClientResult,
  type NewsletterResendEmailPayload,
} from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import {
  isValidEmail,
  isValidNewsletterActionTokenShape,
  normalizeEmail,
} from "@/lib/newsletter/schemas";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-06";
const HTML_FILE = `${EDITION_DIRECTORY}/email-production.html`;
const TEXT_FILE = `${EDITION_DIRECTORY}/email-texto-plano.txt`;
const HTML_SHA256 =
  "8faaf0afdfb717c089c177bdf522e529f0e0e03c7736b75e507ad3e456231496";
const TEXT_SHA256 =
  "e99738f8f9a54ffe7d11054f5609ead768d34ab63209f31f0b8ef06e89f51d2a";
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

type Edition01FileReader = (
  path: string,
  encoding: "utf8",
) => Promise<string>;

type Edition01ClientFactory = (apiKey: string) => NewsletterResendClient;

type ExecuteNewsletterEdition01TestOptions = {
  request: NewsletterEdition01TestRequest;
  environment?: NewsletterEdition01TestEnvironment;
  clientFactory?: Edition01ClientFactory;
  fileReader?: Edition01FileReader;
  logger?: (message: string) => void;
  projectRoot?: string;
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

function assertSafeExecutionEnvironment(
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

export function validateEdition01UnsubscribeUrl(value: string | undefined): string {
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
  if (!source.html.startsWith("<!doctype html>") || !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 01")) {
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
  if (!source.text.includes("La Bañeza, rally y 4 planes más para este fin de semana")) {
    fail("template_subject_invalid");
  }

  return {
    imageCount: imageSources.length,
    htmlCampaignCount,
    htmlPlaceholderCount,
    textPlaceholderCount,
  };
}

export async function loadEdition01Source(
  projectRoot = process.cwd(),
  fileReader: Edition01FileReader = readFile,
): Promise<NewsletterEdition01Source> {
  const [html, text] = await Promise.all([
    fileReader(resolve(projectRoot, HTML_FILE), "utf8"),
    fileReader(resolve(projectRoot, TEXT_FILE), "utf8"),
  ]);

  if (sha256(html) !== HTML_SHA256 || sha256(text) !== TEXT_SHA256) {
    fail("template_digest_mismatch");
  }

  validateEdition01Template({ html, text });
  return { html, text };
}

export function prepareEdition01Content(
  source: NewsletterEdition01Source,
  unsubscribeUrl: string,
): NewsletterEdition01PreparedContent {
  const summary = validateEdition01Template(source);
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
): void {
  logger("Edition 01 validation passed.");
  logger(`Mode: ${mode}`);
  logger(`Recipient: ${maskEmail(recipient)}`);
  logger(`Absolute edition images: ${summary.imageCount}`);
  logger(`HTML campaign markers: ${summary.htmlCampaignCount}`);
  logger("Unsubscribe placeholders: 1 HTML + 1 text, replaced safely");
  logger(`Sender: ${NEWSLETTER_PRODUCTION_SENDER}`);
  logger(`Reply-To: ${NEWSLETTER_PRODUCTION_REPLY_TO}`);
  logger("Subject prefix: [PRUEBA]");
}

function defaultClientFactory(apiKey: string): NewsletterResendClient {
  return new FetchNewsletterResendClient({ apiKey });
}

export async function executeNewsletterEdition01TestSend(
  options: ExecuteNewsletterEdition01TestOptions,
): Promise<NewsletterEdition01TestResult> {
  const environment = options.environment ?? {};
  const logger = options.logger ?? (() => undefined);
  assertSafeExecutionEnvironment(environment);

  const recipient = validatedRecipient(options.request.to);
  const unsubscribeUrl = validateEdition01UnsubscribeUrl(
    options.request.unsubscribeUrl,
  );
  const source = await loadEdition01Source(
    options.projectRoot,
    options.fileReader,
  );
  const prepared = prepareEdition01Content(source, unsubscribeUrl);
  const summary: NewsletterEdition01TemplateSummary = {
    imageCount: prepared.imageCount,
    htmlCampaignCount: prepared.htmlCampaignCount,
    htmlPlaceholderCount: prepared.htmlPlaceholderCount,
    textPlaceholderCount: prepared.textPlaceholderCount,
  };

  if (!options.request.send) {
    logValidationSummary(logger, "dry-run", recipient, summary);
    logger("Dry-run complete. No email was sent.");
    return { status: "dry_run", recipient: maskEmail(recipient), summary };
  }

  const apiKey = assertSendGates(options.request, environment);
  const payload: NewsletterResendEmailPayload = {
    from: NEWSLETTER_PRODUCTION_SENDER,
    to: [recipient],
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    subject: NEWSLETTER_EDITION_01_TEST_SUBJECT,
    html: prepared.html,
    text: prepared.text,
  };
  const client = (options.clientFactory ?? defaultClientFactory)(apiKey);
  const providerResult: NewsletterResendClientResult =
    await client.sendEmail(payload);
  if (providerResult.status !== "accepted") {
    fail(`provider_${providerResult.status}`);
  }

  logValidationSummary(logger, "send", recipient, summary);
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

export function newsletterEdition01EnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition01TestEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_TEST_SEND_ARMED,
    apiKey: includeApiKey
      ? process.env.NEWSLETTER_RESEND_API_KEY
      : undefined,
    ci: process.env.CI,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}
