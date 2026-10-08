import "server-only";

import {
  executeNewsletterEdition10TestSend as executeNeutralTestSend,
  type NewsletterEdition10TestEnvironment,
  type NewsletterEdition10TestRequest,
  type NewsletterEdition10TestResult,
} from "@/lib/newsletter/edition-10-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition10Source } from "@/lib/newsletter/edition-10-source.server";

export {
  NewsletterEdition10TestSendError,
  parseNewsletterEdition10TestArguments,
} from "@/lib/newsletter/edition-10-test-send";

type ExecuteNewsletterEdition10ServerTestOptions = {
  request: NewsletterEdition10TestRequest;
  environment?: NewsletterEdition10TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition10TestSend(
  options: ExecuteNewsletterEdition10ServerTestOptions,
): Promise<NewsletterEdition10TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition10Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition10TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition10TestEnvironment {
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
