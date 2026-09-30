import "server-only";

import { createConfiguredNewsletterEdition09CampaignRepository } from "@/lib/newsletter/edition-09-campaign-repository.server";
import {
  executeNewsletterEdition09Campaign as executeNeutralCampaign,
  type NewsletterEdition09CampaignEnvironment,
  type NewsletterEdition09CampaignRequest,
  type NewsletterEdition09CampaignResult,
  type NewsletterEdition09PreparedCampaignSeal,
} from "@/lib/newsletter/edition-09-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition09Source } from "@/lib/newsletter/edition-09-source.server";

export {
  NewsletterEdition09CampaignError,
  parseNewsletterEdition09CampaignArguments,
} from "@/lib/newsletter/edition-09-campaign";

type ExecuteNewsletterEdition09CampaignServerOptions = {
  request: NewsletterEdition09CampaignRequest;
  environment?: NewsletterEdition09CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition09Source } from "@/lib/newsletter/edition-09-source.server";

export async function executeNewsletterEdition09Campaign(
  options: ExecuteNewsletterEdition09CampaignServerOptions,
): Promise<NewsletterEdition09CampaignResult> {
  const repository = createConfiguredNewsletterEdition09CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition09Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared
      ? newsletterEdition09PreparedCampaignSealFromProcess()
      : null,
  });
}

function newsletterEdition09PreparedCampaignSealFromProcess(): NewsletterEdition09PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_09_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_09_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_09_PREPARED_NATIONAL_COUNT;
  if (
    campaignId === undefined &&
    deliveryCount === undefined &&
    nationalCount === undefined
  ) {
    return null;
  }
  return {
    campaignId: campaignId ?? "",
    deliveryCount: Number(deliveryCount),
    variantCounts: {
      national: Number(nationalCount),
    },
  };
}

export function newsletterEdition09CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition09CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_09_CAMPAIGN_ARMED,
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
