import "server-only";

import { createConfiguredNewsletterEdition07CampaignRepository } from "@/lib/newsletter/edition-07-campaign-repository.server";
import {
  executeNewsletterEdition07Campaign as executeNeutralCampaign,
  type NewsletterEdition07CampaignEnvironment,
  type NewsletterEdition07CampaignRequest,
  type NewsletterEdition07CampaignResult,
  type NewsletterEdition07PreparedCampaignSeal,
} from "@/lib/newsletter/edition-07-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition07Source } from "@/lib/newsletter/edition-07-source.server";

export {
  NewsletterEdition07CampaignError,
  parseNewsletterEdition07CampaignArguments,
} from "@/lib/newsletter/edition-07-campaign";

type ExecuteNewsletterEdition07CampaignServerOptions = {
  request: NewsletterEdition07CampaignRequest;
  environment?: NewsletterEdition07CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition07Source } from "@/lib/newsletter/edition-07-source.server";

export async function executeNewsletterEdition07Campaign(
  options: ExecuteNewsletterEdition07CampaignServerOptions,
): Promise<NewsletterEdition07CampaignResult> {
  const repository = createConfiguredNewsletterEdition07CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition07Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared
      ? newsletterEdition07PreparedCampaignSealFromProcess()
      : null,
  });
}

function newsletterEdition07PreparedCampaignSealFromProcess(): NewsletterEdition07PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_07_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_07_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_07_PREPARED_NATIONAL_COUNT;
  const madridCount = process.env.NEWSLETTER_EDITION_07_PREPARED_MADRID_COUNT;
  const aCorunaCount = process.env.NEWSLETTER_EDITION_07_PREPARED_A_CORUNA_COUNT;
  const barcelonaCount = process.env.NEWSLETTER_EDITION_07_PREPARED_BARCELONA_COUNT;
  if (
    campaignId === undefined &&
    deliveryCount === undefined &&
    nationalCount === undefined &&
    madridCount === undefined &&
    aCorunaCount === undefined &&
    barcelonaCount === undefined
  ) {
    return null;
  }
  return {
    campaignId: campaignId ?? "",
    deliveryCount: Number(deliveryCount),
    variantCounts: {
      national: Number(nationalCount),
      madrid: Number(madridCount),
      "a-coruna": Number(aCorunaCount),
      barcelona: Number(barcelonaCount),
    },
  };
}

export function newsletterEdition07CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition07CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_07_CAMPAIGN_ARMED,
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
