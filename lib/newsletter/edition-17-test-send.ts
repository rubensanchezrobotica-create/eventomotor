import {
  NEWSLETTER_EDITION_17_REPLY_TO,
  NEWSLETTER_EDITION_17_SENDER,
  type NewsletterEdition17Source,
  prepareEdition17Content,
} from "@/lib/newsletter/edition-17-content";
import { NEWSLETTER_EDITION_17_SUBJECT } from "@/lib/newsletter/edition-17-editorial";

export const NEWSLETTER_EDITION_17_TEST_RECIPIENT = "rubensanchezrobotica@gmail.com";
export const NEWSLETTER_EDITION_17_TEST_ARMED_VALUE = "edition17-protected-gmail-test-2026-11-26";
export const NEWSLETTER_EDITION_17_TEST_CONFIRM_PHRASE = "SEND-EDITION-17-TEST";
export const NEWSLETTER_EDITION_17_TEST_SUBJECT = "[PRUEBA] " + NEWSLETTER_EDITION_17_SUBJECT;
export const NEWSLETTER_EDITION_17_TEST_IDEMPOTENCY_KEY = "edition17-madrid-gmail-qa-20261126-v1";
export const NEWSLETTER_EDITION_17_SAFE_TEST_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition17-gmail-test-token-fixture-000000000000";

const PROVIDER_ID = /^[A-Za-z0-9_./:+-]{1,200}$/;

export type NewsletterEdition17TestRequest = {
  send: boolean;
  to?: string;
  confirmTo?: string;
  confirmPhrase?: string;
  variant?: string;
};

export type NewsletterEdition17TestEnvironment = {
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

export type NewsletterEdition17TestEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type NewsletterEdition17TestClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterEdition17TestClient {
  sendEmail(payload: NewsletterEdition17TestEmailPayload): Promise<NewsletterEdition17TestClientResult>;
}

export type NewsletterEdition17TestResult =
  | { status: "dry_run"; recipient: string; subject: string; providerCalled: false }
  | { status: "accepted"; recipient: string; subject: string; providerCalled: true; providerMessageId: string };

export type ExecuteNewsletterEdition17TestOptions = {
  request: NewsletterEdition17TestRequest;
  source: NewsletterEdition17Source;
  sender: string;
  replyTo: string;
  environment?: NewsletterEdition17TestEnvironment;
  clientFactory?: (apiKey: string) => NewsletterEdition17TestClient;
  logger?: (message: string) => void;
};

export class NewsletterEdition17TestSendError extends Error {
  constructor(readonly code: string) {
    super("Edition 17 test send blocked: " + code + ".");
    this.name = "NewsletterEdition17TestSendError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition17TestSendError(code);
}

function assertEnvironment(environment: NewsletterEdition17TestEnvironment): void {
  if (environment.ci !== undefined) fail("ci_blocked");
  if (environment.vercel !== undefined || environment.vercelEnv !== undefined) fail("vercel_blocked");
  if (environment.nodeEnv === "production") fail("production_runtime_blocked");
  if (environment.newsletterMode !== "test") fail("mode_not_test");
  if (environment.mailTransport !== "resend") fail("transport_not_resend");
  if (environment.recipientAllowlist !== NEWSLETTER_EDITION_17_TEST_RECIPIENT) fail("allowlist_invalid");
}

function assertApiKey(apiKey: string | undefined): asserts apiKey is string {
  if (
    !apiKey || apiKey.length < 20 || apiKey.length > 500 ||
    apiKey !== apiKey.trim() || /[\s\u0000-\u001f\u007f]/.test(apiKey)
  ) fail("api_key_unavailable");
}

export async function executeNewsletterEdition17TestSend(
  options: ExecuteNewsletterEdition17TestOptions,
): Promise<NewsletterEdition17TestResult> {
  const environment = options.environment ?? {};
  const request = options.request;
  const logger = options.logger ?? (() => undefined);
  assertEnvironment(environment);
  if (options.sender !== NEWSLETTER_EDITION_17_SENDER || options.replyTo !== NEWSLETTER_EDITION_17_REPLY_TO) {
    fail("mail_identity_invalid");
  }
  if (request.to !== NEWSLETTER_EDITION_17_TEST_RECIPIENT) fail("recipient_not_allowed");
  if (request.variant !== "madrid") fail("variant_not_allowed");
  if (request.send) {
    if (request.confirmTo !== request.to) fail("recipient_confirmation_mismatch");
    if (request.confirmPhrase !== NEWSLETTER_EDITION_17_TEST_CONFIRM_PHRASE) fail("confirmation_phrase_invalid");
    if (environment.armed !== NEWSLETTER_EDITION_17_TEST_ARMED_VALUE) fail("send_not_armed");
  }

  // This checks the eight exact assets, both sealed renders and the manifest
  // before selecting the Madrid projection; no database is involved.
  const content = prepareEdition17Content(
    options.source,
    "madrid",
    NEWSLETTER_EDITION_17_SAFE_TEST_UNSUBSCRIBE_URL,
  );
  if (content.html.includes("PREVIEW LOCAL") || content.html.includes("2026-11-19/assets/") || content.html.includes('src="assets/')) {
    fail("content_not_sendable");
  }

  if (!request.send) {
    logger("EDITION_17_PROTECTED_TEST_VALIDATION=PASS");
    logger("CONTENT_VARIANT=madrid");
    logger("TARGET_RECIPIENT_COUNT=1");
    logger("PROVIDER_CALLED=NO");
    return {
      status: "dry_run",
      recipient: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
      subject: NEWSLETTER_EDITION_17_TEST_SUBJECT,
      providerCalled: false,
    };
  }

  assertApiKey(environment.apiKey);
  if (!options.clientFactory) fail("client_unavailable");

  const client = options.clientFactory(environment.apiKey);
  let result: NewsletterEdition17TestClientResult;
  logger("PROVIDER_CALL_ATTEMPTED=YES");
  try {
    result = await client.sendEmail({
      from: options.sender,
      to: [NEWSLETTER_EDITION_17_TEST_RECIPIENT],
      replyTo: options.replyTo,
      subject: NEWSLETTER_EDITION_17_TEST_SUBJECT,
      html: content.html,
      text: content.text,
      idempotencyKey: NEWSLETTER_EDITION_17_TEST_IDEMPOTENCY_KEY,
    });
  } catch {
    fail("provider_result_unknown_no_retry");
  }
  if (result.status !== "accepted") fail("provider_" + result.status + "_no_retry");
  if (!PROVIDER_ID.test(result.providerMessageId)) fail("provider_response_invalid_no_retry");

  logger("EDITION_17_PROTECTED_TEST_VALIDATION=PASS");
  logger("CONTENT_VARIANT=madrid");
  logger("TARGET_RECIPIENT_COUNT=1");
  logger("PROVIDER_CALL_COUNT=1");
  logger("PROVIDER_ACCEPTED=YES");
  logger("PROVIDER_MESSAGE_ID=" + result.providerMessageId);
  return {
    status: "accepted",
    recipient: NEWSLETTER_EDITION_17_TEST_RECIPIENT,
    subject: NEWSLETTER_EDITION_17_TEST_SUBJECT,
    providerCalled: true,
    providerMessageId: result.providerMessageId,
  };
}

export function parseNewsletterEdition17TestArguments(argv: readonly string[]): NewsletterEdition17TestRequest {
  const request: NewsletterEdition17TestRequest = { send: false };
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg || seen.has(arg)) fail("duplicate_or_empty_argument");
    seen.add(arg);
    if (arg === "--send") { request.send = true; continue; }
    if (!["--to", "--confirm-to", "--confirm-phrase", "--variant"].includes(arg)) fail("unknown_argument");
    const value = argv[++index];
    if (!value || value.startsWith("--")) fail("argument_value_missing");
    if (arg === "--to") request.to = value;
    if (arg === "--confirm-to") request.confirmTo = value;
    if (arg === "--confirm-phrase") request.confirmPhrase = value;
    if (arg === "--variant") request.variant = value;
  }
  return request;
}
