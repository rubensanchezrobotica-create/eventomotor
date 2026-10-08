import "server-only";

import { createConfiguredNewsletterEdition10CampaignRepository } from "@/lib/newsletter/edition-10-campaign-repository.server";
import {
  executeNewsletterEdition10Campaign as executeNeutralCampaign,
  type NewsletterEdition10CampaignEnvironment,
  type NewsletterEdition10CampaignRequest,
  type NewsletterEdition10CampaignResult,
  type NewsletterEdition10PreparedCampaignSeal,
} from "@/lib/newsletter/edition-10-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition10Source } from "@/lib/newsletter/edition-10-source.server";

export {
  NewsletterEdition10CampaignError,
  parseNewsletterEdition10CampaignArguments,
} from "@/lib/newsletter/edition-10-campaign";

type ExecuteNewsletterEdition10CampaignServerOptions = {
  request: NewsletterEdition10CampaignRequest;
  environment?: NewsletterEdition10CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition10Source } from "@/lib/newsletter/edition-10-source.server";

export async function executeNewsletterEdition10Campaign(
  options: ExecuteNewsletterEdition10CampaignServerOptions,
): Promise<NewsletterEdition10CampaignResult> {
  const repository = createConfiguredNewsletterEdition10CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition10Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared
      ? newsletterEdition10PreparedCampaignSealFromProcess()
      : null,
  });
}

function newsletterEdition10PreparedCampaignSealFromProcess(): NewsletterEdition10PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_10_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_10_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_10_PREPARED_NATIONAL_COUNT;
  const madridCount = process.env.NEWSLETTER_EDITION_10_PREPARED_MADRID_COUNT;
  if (
    campaignId === undefined &&
    deliveryCount === undefined &&
    nationalCount === undefined &&
    madridCount === undefined
  ) {
    return null;
  }
  return {
    campaignId: campaignId ?? "",
    deliveryCount: Number(deliveryCount),
    variantCounts: {
      national: Number(nationalCount),
      madrid: Number(madridCount),
    },
  };
}

export function newsletterEdition10CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition10CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_10_CAMPAIGN_ARMED,
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
