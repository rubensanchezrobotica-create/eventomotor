import "server-only";

import { createConfiguredNewsletterEdition04CampaignRepository } from "@/lib/newsletter/edition-04-campaign-repository.server";
import {
  executeNewsletterEdition04Campaign as executeNeutralCampaign,
  type NewsletterEdition04CampaignEnvironment,
  type NewsletterEdition04CampaignRequest,
  type NewsletterEdition04CampaignResult,
} from "@/lib/newsletter/edition-04-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition04Source } from "@/lib/newsletter/edition-04-source.server";

export {
  NewsletterEdition04CampaignError,
  parseNewsletterEdition04CampaignArguments,
} from "@/lib/newsletter/edition-04-campaign";

type ExecuteNewsletterEdition04CampaignServerOptions = {
  request: NewsletterEdition04CampaignRequest;
  environment?: NewsletterEdition04CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition04Source } from "@/lib/newsletter/edition-04-source.server";

export async function executeNewsletterEdition04Campaign(
  options: ExecuteNewsletterEdition04CampaignServerOptions,
): Promise<NewsletterEdition04CampaignResult> {
  const repository = createConfiguredNewsletterEdition04CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition04Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
  });
}

export function newsletterEdition04CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition04CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_04_CAMPAIGN_ARMED,
    apiKey: includeApiKey ? process.env.NEWSLETTER_RESEND_API_KEY : undefined,
    ci: process.env.CI,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    newsletterMode: process.env.NEWSLETTER_MODE,
    nodeEnv: process.env.NODE_ENV,
    publicLaunchEnabled: process.env.NEWSLETTER_PUBLIC_LAUNCH_ENABLED,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}
