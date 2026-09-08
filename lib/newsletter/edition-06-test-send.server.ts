import "server-only";

import {
  executeNewsletterEdition06TestSend as executeNeutralTestSend,
  type NewsletterEdition06TestEnvironment,
  type NewsletterEdition06TestRequest,
  type NewsletterEdition06TestResult,
} from "@/lib/newsletter/edition-06-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition06Source } from "@/lib/newsletter/edition-06-source.server";

export {
  NewsletterEdition06TestSendError,
  parseNewsletterEdition06TestArguments,
} from "@/lib/newsletter/edition-06-test-send";

type ExecuteNewsletterEdition06ServerTestOptions = {
  request: NewsletterEdition06TestRequest;
  environment?: NewsletterEdition06TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition06TestSend(
  options: ExecuteNewsletterEdition06ServerTestOptions,
): Promise<NewsletterEdition06TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition06Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition06TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition06TestEnvironment {
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
