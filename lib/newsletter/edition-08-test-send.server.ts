import "server-only";

import {
  executeNewsletterEdition08TestSend as executeNeutralTestSend,
  type NewsletterEdition08TestEnvironment,
  type NewsletterEdition08TestRequest,
  type NewsletterEdition08TestResult,
} from "@/lib/newsletter/edition-08-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition08Source } from "@/lib/newsletter/edition-08-source.server";

export {
  NewsletterEdition08TestSendError,
  parseNewsletterEdition08TestArguments,
} from "@/lib/newsletter/edition-08-test-send";

type ExecuteNewsletterEdition08ServerTestOptions = {
  request: NewsletterEdition08TestRequest;
  environment?: NewsletterEdition08TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition08TestSend(
  options: ExecuteNewsletterEdition08ServerTestOptions,
): Promise<NewsletterEdition08TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition08Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition08TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition08TestEnvironment {
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
