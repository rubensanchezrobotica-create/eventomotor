import "server-only";

import { createConfiguredNewsletterEdition05CampaignRepository } from "@/lib/newsletter/edition-05-campaign-repository.server";
import {
  executeNewsletterEdition05Campaign as executeNeutralCampaign,
  type NewsletterEdition05CampaignEnvironment,
  type NewsletterEdition05CampaignRequest,
  type NewsletterEdition05CampaignResult,
} from "@/lib/newsletter/edition-05-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition05Source } from "@/lib/newsletter/edition-05-source.server";

export {
  NewsletterEdition05CampaignError,
  parseNewsletterEdition05CampaignArguments,
} from "@/lib/newsletter/edition-05-campaign";

type ExecuteNewsletterEdition05CampaignServerOptions = {
  request: NewsletterEdition05CampaignRequest;
  environment?: NewsletterEdition05CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition05Source } from "@/lib/newsletter/edition-05-source.server";

export async function executeNewsletterEdition05Campaign(
  options: ExecuteNewsletterEdition05CampaignServerOptions,
): Promise<NewsletterEdition05CampaignResult> {
  const repository = createConfiguredNewsletterEdition05CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition05Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
  });
}

export function newsletterEdition05CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition05CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_05_CAMPAIGN_ARMED,
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
