import "server-only";

import { createConfiguredNewsletterEdition02CampaignRepository } from "@/lib/newsletter/edition-02-campaign-repository.server";
import {
  executeNewsletterEdition02Campaign as executeNeutralCampaign,
  type NewsletterEdition02CampaignEnvironment,
  type NewsletterEdition02CampaignRequest,
  type NewsletterEdition02CampaignResult,
} from "@/lib/newsletter/edition-02-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition02Source } from "@/lib/newsletter/edition-02-source.server";

export {
  NewsletterEdition02CampaignError,
  parseNewsletterEdition02CampaignArguments,
} from "@/lib/newsletter/edition-02-campaign";

type ExecuteNewsletterEdition02CampaignServerOptions = {
  request: NewsletterEdition02CampaignRequest;
  environment?: NewsletterEdition02CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition02Source } from "@/lib/newsletter/edition-02-source.server";

export async function executeNewsletterEdition02Campaign(
  options: ExecuteNewsletterEdition02CampaignServerOptions,
): Promise<NewsletterEdition02CampaignResult> {
  const repository = createConfiguredNewsletterEdition02CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition02Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
  });
}

export function newsletterEdition02CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition02CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_02_CAMPAIGN_ARMED,
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
