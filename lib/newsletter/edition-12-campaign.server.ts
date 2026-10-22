import "server-only";

import { createConfiguredNewsletterEdition12CampaignRepository } from "@/lib/newsletter/edition-12-campaign-repository.server";
import {
  executeNewsletterEdition12Campaign as executeNeutralCampaign,
  type NewsletterEdition12CampaignEnvironment,
  type NewsletterEdition12CampaignRequest,
  type NewsletterEdition12CampaignResult,
  type NewsletterEdition12PreparedCampaignSeal,
} from "@/lib/newsletter/edition-12-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition12Source } from "@/lib/newsletter/edition-12-source.server";

export {
  NewsletterEdition12CampaignError,
  parseNewsletterEdition12CampaignArguments,
} from "@/lib/newsletter/edition-12-campaign";

type ExecuteNewsletterEdition12CampaignServerOptions = {
  request: NewsletterEdition12CampaignRequest;
  environment?: NewsletterEdition12CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition12Source } from "@/lib/newsletter/edition-12-source.server";

export async function executeNewsletterEdition12Campaign(
  options: ExecuteNewsletterEdition12CampaignServerOptions,
): Promise<NewsletterEdition12CampaignResult> {
  const repository = createConfiguredNewsletterEdition12CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition12Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared
      ? newsletterEdition12PreparedCampaignSealFromProcess()
      : null,
  });
}

function newsletterEdition12PreparedCampaignSealFromProcess(): NewsletterEdition12PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_12_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_12_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_12_PREPARED_NATIONAL_COUNT;
  const madridCount = process.env.NEWSLETTER_EDITION_12_PREPARED_MADRID_COUNT;
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

export function newsletterEdition12CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition12CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_12_CAMPAIGN_ARMED,
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
