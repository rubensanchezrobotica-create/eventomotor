import "server-only";

import { createConfiguredNewsletterEdition06CampaignRepository } from "@/lib/newsletter/edition-06-campaign-repository.server";
import {
  executeNewsletterEdition06Campaign as executeNeutralCampaign,
  type NewsletterEdition06CampaignEnvironment,
  type NewsletterEdition06CampaignRequest,
  type NewsletterEdition06CampaignResult,
  type NewsletterEdition06PreparedCampaignSeal,
} from "@/lib/newsletter/edition-06-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition06Source } from "@/lib/newsletter/edition-06-source.server";

export {
  NewsletterEdition06CampaignError,
  parseNewsletterEdition06CampaignArguments,
} from "@/lib/newsletter/edition-06-campaign";

type ExecuteNewsletterEdition06CampaignServerOptions = {
  request: NewsletterEdition06CampaignRequest;
  environment?: NewsletterEdition06CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition06Source } from "@/lib/newsletter/edition-06-source.server";

export async function executeNewsletterEdition06Campaign(
  options: ExecuteNewsletterEdition06CampaignServerOptions,
): Promise<NewsletterEdition06CampaignResult> {
  const repository = createConfiguredNewsletterEdition06CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition06Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared
      ? newsletterEdition06PreparedCampaignSealFromProcess()
      : null,
  });
}

function newsletterEdition06PreparedCampaignSealFromProcess(): NewsletterEdition06PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_06_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_06_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_06_PREPARED_NATIONAL_COUNT;
  const madridCount = process.env.NEWSLETTER_EDITION_06_PREPARED_MADRID_COUNT;
  const aCorunaCount = process.env.NEWSLETTER_EDITION_06_PREPARED_A_CORUNA_COUNT;
  const barcelonaCount = process.env.NEWSLETTER_EDITION_06_PREPARED_BARCELONA_COUNT;
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

export function newsletterEdition06CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition06CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_06_CAMPAIGN_ARMED,
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
