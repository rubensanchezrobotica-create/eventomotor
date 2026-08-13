import "server-only";

import {
  executeNewsletterEdition02TestSend as executeNeutralTestSend,
  type NewsletterEdition02TestEnvironment,
  type NewsletterEdition02TestRequest,
  type NewsletterEdition02TestResult,
} from "@/lib/newsletter/edition-02-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition02Source } from "@/lib/newsletter/edition-02-source.server";

export {
  NewsletterEdition02TestSendError,
  parseNewsletterEdition02TestArguments,
} from "@/lib/newsletter/edition-02-test-send";

type ExecuteNewsletterEdition02ServerTestOptions = {
  request: NewsletterEdition02TestRequest;
  environment?: NewsletterEdition02TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition02TestSend(
  options: ExecuteNewsletterEdition02ServerTestOptions,
): Promise<NewsletterEdition02TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition02Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition02TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition02TestEnvironment {
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
