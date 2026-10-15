import "server-only";

import { createConfiguredNewsletterEdition11CampaignRepository } from "@/lib/newsletter/edition-11-campaign-repository.server";
import {
  executeNewsletterEdition11Campaign as executeNeutralCampaign,
  type NewsletterEdition11CampaignEnvironment,
  type NewsletterEdition11CampaignRequest,
  type NewsletterEdition11CampaignResult,
  type NewsletterEdition11PreparedCampaignSeal,
} from "@/lib/newsletter/edition-11-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition11Source } from "@/lib/newsletter/edition-11-source.server";

export {
  NewsletterEdition11CampaignError,
  parseNewsletterEdition11CampaignArguments,
} from "@/lib/newsletter/edition-11-campaign";

type ExecuteNewsletterEdition11CampaignServerOptions = {
  request: NewsletterEdition11CampaignRequest;
  environment?: NewsletterEdition11CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition11Source } from "@/lib/newsletter/edition-11-source.server";

export async function executeNewsletterEdition11Campaign(
  options: ExecuteNewsletterEdition11CampaignServerOptions,
): Promise<NewsletterEdition11CampaignResult> {
  const repository = createConfiguredNewsletterEdition11CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition11Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared
      ? newsletterEdition11PreparedCampaignSealFromProcess()
      : null,
  });
}

function newsletterEdition11PreparedCampaignSealFromProcess(): NewsletterEdition11PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_11_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_11_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_11_PREPARED_NATIONAL_COUNT;
  const madridCount = process.env.NEWSLETTER_EDITION_11_PREPARED_MADRID_COUNT;
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

export function newsletterEdition11CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition11CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_11_CAMPAIGN_ARMED,
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
