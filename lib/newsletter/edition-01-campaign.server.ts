import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createConfiguredNewsletterEdition01CampaignRepository } from "@/lib/newsletter/campaign-repository.server";
import {
  executeNewsletterEdition01Campaign as executeNeutralCampaign,
  type NewsletterEdition01CampaignEnvironment,
  type NewsletterEdition01CampaignRequest,
  type NewsletterEdition01CampaignResult,
} from "@/lib/newsletter/edition-01-campaign";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import type { NewsletterEdition01Source } from "@/lib/newsletter/edition-01-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";

export {
  NewsletterEdition01CampaignError,
  parseNewsletterEdition01CampaignArguments,
} from "@/lib/newsletter/edition-01-campaign";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-06";
const HTML_FILE = `${EDITION_DIRECTORY}/email-production.html`;
const TEXT_FILE = `${EDITION_DIRECTORY}/email-texto-plano.txt`;

type ExecuteNewsletterEdition01CampaignServerOptions = {
  request: NewsletterEdition01CampaignRequest;
  environment?: NewsletterEdition01CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

async function loadEdition01Source(
  projectRoot = process.cwd(),
): Promise<NewsletterEdition01Source> {
  const [html, text] = await Promise.all([
    readFile(resolve(projectRoot, HTML_FILE), "utf8"),
    readFile(resolve(projectRoot, TEXT_FILE), "utf8"),
  ]);
  return { html, text };
}

export async function executeNewsletterEdition01Campaign(
  options: ExecuteNewsletterEdition01CampaignServerOptions,
): Promise<NewsletterEdition01CampaignResult> {
  const repository = createConfiguredNewsletterEdition01CampaignRepository();
  if (!repository) {
    throw new Error("Newsletter campaign persistence is unavailable.");
  }
  return executeNeutralCampaign({
    request: options.request,
    environment: options.environment,
    source: await loadEdition01Source(options.projectRoot),
    repository,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    tokenFactory: createOpaqueNewsletterToken,
    tokenHasher: hashNewsletterToken,
    logger: options.logger,
  });
}

export function newsletterEdition01CampaignEnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition01CampaignEnvironment {
  return {
    armed: process.env.NEWSLETTER_EDITION_01_CAMPAIGN_ARMED,
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
