import "server-only";

import {
  executeNewsletterEdition05TestSend as executeNeutralTestSend,
  type NewsletterEdition05TestEnvironment,
  type NewsletterEdition05TestRequest,
  type NewsletterEdition05TestResult,
} from "@/lib/newsletter/edition-05-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition05Source } from "@/lib/newsletter/edition-05-source.server";

export {
  NewsletterEdition05TestSendError,
  parseNewsletterEdition05TestArguments,
} from "@/lib/newsletter/edition-05-test-send";

type ExecuteNewsletterEdition05ServerTestOptions = {
  request: NewsletterEdition05TestRequest;
  environment?: NewsletterEdition05TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition05TestSend(
  options: ExecuteNewsletterEdition05ServerTestOptions,
): Promise<NewsletterEdition05TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition05Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition05TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition05TestEnvironment {
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
