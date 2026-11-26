import "server-only";

import {
  executeNewsletterEdition17TestSend as executeNeutralTestSend,
  type NewsletterEdition17TestEnvironment,
  type NewsletterEdition17TestRequest,
  type NewsletterEdition17TestResult,
} from "@/lib/newsletter/edition-17-test-send";
import { loadNewsletterEdition17Source } from "@/lib/newsletter/edition-17-source.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";

export {
  NewsletterEdition17TestSendError,
  parseNewsletterEdition17TestArguments,
} from "@/lib/newsletter/edition-17-test-send";

export type ExecuteNewsletterEdition17ServerTestOptions = {
  request: NewsletterEdition17TestRequest;
  environment?: NewsletterEdition17TestEnvironment;
  logger?: (message: string) => void;
  projectRoot?: string;
};

export async function executeNewsletterEdition17TestSend(
  options: ExecuteNewsletterEdition17ServerTestOptions,
): Promise<NewsletterEdition17TestResult> {
  return executeNeutralTestSend({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition17Source(options.projectRoot),
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition17TestEnvironmentFromProcess(includeApiKey = false): NewsletterEdition17TestEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_17_TEST_SEND_ARMED,
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
