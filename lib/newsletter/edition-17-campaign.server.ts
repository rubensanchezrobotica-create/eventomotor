import "server-only";

import {
  executeNewsletterEdition17Campaign as executeNeutralCampaign,
  type NewsletterEdition17CampaignEnvironment,
  type NewsletterEdition17CampaignRequest,
  type NewsletterEdition17CampaignResult,
  type NewsletterEdition17PreparedCampaignSeal,
} from "@/lib/newsletter/edition-17-campaign";
import { createConfiguredNewsletterEdition17CampaignRepository } from "@/lib/newsletter/edition-17-campaign-repository.server";
import { loadNewsletterEdition17Source } from "@/lib/newsletter/edition-17-source.server";
import { createOpaqueNewsletterToken, hashNewsletterToken } from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import { NEWSLETTER_PRODUCTION_REPLY_TO, NEWSLETTER_PRODUCTION_SENDER } from "@/lib/newsletter/resend-config.server";

export {
  NewsletterEdition17CampaignError,
  parseNewsletterEdition17CampaignArguments,
} from "@/lib/newsletter/edition-17-campaign";

export type ExecuteNewsletterEdition17CampaignServerOptions = {
  request: NewsletterEdition17CampaignRequest;
  environment?: NewsletterEdition17CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

function preparedSealFromProcess(): NewsletterEdition17PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_17_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_17_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_17_PREPARED_NATIONAL_COUNT;
  const madridCount = process.env.NEWSLETTER_EDITION_17_PREPARED_MADRID_COUNT;
  if ([campaignId, deliveryCount, nationalCount, madridCount].every((value) => value === undefined)) return null;
  return {
    campaignId: campaignId ?? "",
    deliveryCount: Number(deliveryCount),
    variantCounts: { national: Number(nationalCount), madrid: Number(madridCount) },
  };
}

export function newsletterEdition17CampaignEnvironmentFromProcess(includeApiKey = false): NewsletterEdition17CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_17_CAMPAIGN_ARMED,
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

export async function executeNewsletterEdition17Campaign(options: ExecuteNewsletterEdition17CampaignServerOptions): Promise<NewsletterEdition17CampaignResult> {
  const repository = createConfiguredNewsletterEdition17CampaignRepository();
  if (!repository) throw new Error("Newsletter edition 16 persistence is unavailable.");
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition17Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared ? preparedSealFromProcess() : null,
  });
}
