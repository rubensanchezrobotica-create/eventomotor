import "server-only";

import { createConfiguredNewsletterEdition03CampaignRepository } from "@/lib/newsletter/edition-03-campaign-repository.server";
import {
  executeNewsletterEdition03Campaign as executeNeutralCampaign,
  type NewsletterEdition03CampaignEnvironment,
  type NewsletterEdition03CampaignRequest,
  type NewsletterEdition03CampaignResult,
} from "@/lib/newsletter/edition-03-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition03Source } from "@/lib/newsletter/edition-03-source.server";

export {
  NewsletterEdition03CampaignError,
  parseNewsletterEdition03CampaignArguments,
} from "@/lib/newsletter/edition-03-campaign";

type ExecuteNewsletterEdition03CampaignServerOptions = {
  request: NewsletterEdition03CampaignRequest;
  environment?: NewsletterEdition03CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition03Source } from "@/lib/newsletter/edition-03-source.server";

export async function executeNewsletterEdition03Campaign(
  options: ExecuteNewsletterEdition03CampaignServerOptions,
): Promise<NewsletterEdition03CampaignResult> {
  const repository = createConfiguredNewsletterEdition03CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition03Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
  });
}

export function newsletterEdition03CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition03CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_03_CAMPAIGN_ARMED,
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
