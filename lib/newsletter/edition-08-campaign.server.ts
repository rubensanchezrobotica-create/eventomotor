import "server-only";

import { createConfiguredNewsletterEdition08CampaignRepository } from "@/lib/newsletter/edition-08-campaign-repository.server";
import {
  executeNewsletterEdition08Campaign as executeNeutralCampaign,
  type NewsletterEdition08CampaignEnvironment,
  type NewsletterEdition08CampaignRequest,
  type NewsletterEdition08CampaignResult,
  type NewsletterEdition08PreparedCampaignSeal,
} from "@/lib/newsletter/edition-08-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";
import { loadNewsletterEdition08Source } from "@/lib/newsletter/edition-08-source.server";

export {
  NewsletterEdition08CampaignError,
  parseNewsletterEdition08CampaignArguments,
} from "@/lib/newsletter/edition-08-campaign";

type ExecuteNewsletterEdition08CampaignServerOptions = {
  request: NewsletterEdition08CampaignRequest;
  environment?: NewsletterEdition08CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export { loadNewsletterEdition08Source } from "@/lib/newsletter/edition-08-source.server";

export async function executeNewsletterEdition08Campaign(
  options: ExecuteNewsletterEdition08CampaignServerOptions,
): Promise<NewsletterEdition08CampaignResult> {
  const repository = createConfiguredNewsletterEdition08CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadNewsletterEdition08Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
    preparedCampaignSeal: options.request.sendPrepared
      ? newsletterEdition08PreparedCampaignSealFromProcess()
      : null,
  });
}

function newsletterEdition08PreparedCampaignSealFromProcess(): NewsletterEdition08PreparedCampaignSeal | null {
  const campaignId = process.env.NEWSLETTER_EDITION_08_PREPARED_CAMPAIGN_ID;
  const deliveryCount = process.env.NEWSLETTER_EDITION_08_PREPARED_DELIVERY_COUNT;
  const nationalCount = process.env.NEWSLETTER_EDITION_08_PREPARED_NATIONAL_COUNT;
  const madridCount = process.env.NEWSLETTER_EDITION_08_PREPARED_MADRID_COUNT;
  const catalunaCount = process.env.NEWSLETTER_EDITION_08_PREPARED_CATALUNA_COUNT;
  const comunidadValencianaCount = process.env.NEWSLETTER_EDITION_08_PREPARED_COMUNIDAD_VALENCIANA_COUNT;
  if (
    campaignId === undefined &&
    deliveryCount === undefined &&
    nationalCount === undefined &&
    madridCount === undefined &&
    catalunaCount === undefined &&
    comunidadValencianaCount === undefined
  ) {
    return null;
  }
  return {
    campaignId: campaignId ?? "",
    deliveryCount: Number(deliveryCount),
    variantCounts: {
      national: Number(nationalCount),
      madrid: Number(madridCount),
      cataluna: Number(catalunaCount),
      "comunidad-valenciana": Number(comunidadValencianaCount),
    },
  };
}

export function newsletterEdition08CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition08CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_08_CAMPAIGN_ARMED,
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
