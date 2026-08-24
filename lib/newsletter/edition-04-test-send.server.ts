import "server-only";

import {
  executeNewsletterEdition04TestSend as executeNeutralTestSend,
  type NewsletterEdition04TestEnvironment,
  type NewsletterEdition04TestRequest,
  type NewsletterEdition04TestResult,
} from "@/lib/newsletter/edition-04-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition04Source } from "@/lib/newsletter/edition-04-source.server";

export {
  NewsletterEdition04TestSendError,
  parseNewsletterEdition04TestArguments,
} from "@/lib/newsletter/edition-04-test-send";

type ExecuteNewsletterEdition04ServerTestOptions = {
  request: NewsletterEdition04TestRequest;
  environment?: NewsletterEdition04TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition04TestSend(
  options: ExecuteNewsletterEdition04ServerTestOptions,
): Promise<NewsletterEdition04TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition04Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition04TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition04TestEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_TEST_SEND_ARMED,
    apiKey: includeApiKey ? process.env.NEWSLETTER_RESEND_API_KEY : undefined,
    ci: process.env.CI,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    newsletterMode: process.env.NEWSLETTER_MODE,
    nodeEnv: process.env.NODE_ENV,
    recipientAllowlist: process.env.NEWSLETTER_TEST_RECIPIENT_ALLOWLIST,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}
