import "server-only";

import {
  executeNewsletterEdition12TestSend as executeNeutralTestSend,
  type NewsletterEdition12TestEnvironment,
  type NewsletterEdition12TestRequest,
  type NewsletterEdition12TestResult,
} from "@/lib/newsletter/edition-12-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition12Source } from "@/lib/newsletter/edition-12-source.server";

export {
  NewsletterEdition12TestSendError,
  parseNewsletterEdition12TestArguments,
} from "@/lib/newsletter/edition-12-test-send";

type ExecuteNewsletterEdition12ServerTestOptions = {
  request: NewsletterEdition12TestRequest;
  environment?: NewsletterEdition12TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition12TestSend(
  options: ExecuteNewsletterEdition12ServerTestOptions,
): Promise<NewsletterEdition12TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition12Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition12TestEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition12TestEnvironment {
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
