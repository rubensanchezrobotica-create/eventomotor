import "server-only";

import {
  executeNewsletterEdition09TestSend as executeNeutralTestSend,
  type NewsletterEdition09TestEnvironment,
  type NewsletterEdition09TestRequest,
  type NewsletterEdition09TestResult,
} from "@/lib/newsletter/edition-09-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition09Source } from "@/lib/newsletter/edition-09-source.server";

export {
  NewsletterEdition09TestSendError,
  parseNewsletterEdition09TestArguments,
} from "@/lib/newsletter/edition-09-test-send";

type ExecuteNewsletterEdition09ServerTestOptions = {
  request: NewsletterEdition09TestRequest;
  environment?: NewsletterEdition09TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition09TestSend(
  options: ExecuteNewsletterEdition09ServerTestOptions,
): Promise<NewsletterEdition09TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition09Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition09TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition09TestEnvironment {
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
