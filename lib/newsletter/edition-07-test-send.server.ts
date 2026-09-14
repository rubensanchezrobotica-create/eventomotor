import "server-only";

import {
  executeNewsletterEdition07TestSend as executeNeutralTestSend,
  type NewsletterEdition07TestEnvironment,
  type NewsletterEdition07TestRequest,
  type NewsletterEdition07TestResult,
} from "@/lib/newsletter/edition-07-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition07Source } from "@/lib/newsletter/edition-07-source.server";

export {
  NewsletterEdition07TestSendError,
  parseNewsletterEdition07TestArguments,
} from "@/lib/newsletter/edition-07-test-send";

type ExecuteNewsletterEdition07ServerTestOptions = {
  request: NewsletterEdition07TestRequest;
  environment?: NewsletterEdition07TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition07TestSend(
  options: ExecuteNewsletterEdition07ServerTestOptions,
): Promise<NewsletterEdition07TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition07Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition07TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition07TestEnvironment {
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
