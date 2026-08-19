import "server-only";

import {
  executeNewsletterEdition03TestSend as executeNeutralTestSend,
  type NewsletterEdition03TestEnvironment,
  type NewsletterEdition03TestRequest,
  type NewsletterEdition03TestResult,
} from "@/lib/newsletter/edition-03-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition03Source } from "@/lib/newsletter/edition-03-source.server";

export {
  NewsletterEdition03TestSendError,
  parseNewsletterEdition03TestArguments,
} from "@/lib/newsletter/edition-03-test-send";

type ExecuteNewsletterEdition03ServerTestOptions = {
  request: NewsletterEdition03TestRequest;
  environment?: NewsletterEdition03TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition03TestSend(
  options: ExecuteNewsletterEdition03ServerTestOptions,
): Promise<NewsletterEdition03TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition03Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition03TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition03TestEnvironment {
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
