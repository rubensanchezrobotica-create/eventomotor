import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createConfiguredNewsletterEdition02CampaignRepository } from "@/lib/newsletter/edition-02-campaign-repository.server";
import {
  executeNewsletterEdition02Campaign as executeNeutralCampaign,
  type NewsletterEdition02CampaignEnvironment,
  type NewsletterEdition02CampaignRequest,
  type NewsletterEdition02CampaignResult,
} from "@/lib/newsletter/edition-02-campaign";
import {
  NEWSLETTER_EDITION_02_ASSET_MANIFEST,
  type NewsletterEdition02Source,
} from "@/lib/newsletter/edition-02-content";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";

export {
  NewsletterEdition02CampaignError,
  parseNewsletterEdition02CampaignArguments,
} from "@/lib/newsletter/edition-02-campaign";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-13";
const HTML_FILE = `${EDITION_DIRECTORY}/email-production.html`;
const TEXT_FILE = `${EDITION_DIRECTORY}/email-texto-plano.txt`;
const ASSET_MANIFEST_FILE = `${EDITION_DIRECTORY}/asset-manifest.json`;

type ExecuteNewsletterEdition02CampaignServerOptions = {
  request: NewsletterEdition02CampaignRequest;
  environment?: NewsletterEdition02CampaignEnvironment;
  projectRoot?: string;
  logger?: (message: string) => void;
};

export async function loadNewsletterEdition02Source(
  projectRoot = process.cwd(),
): Promise<NewsletterEdition02Source> {
  const [html, text, assetManifest, assetEntries] = await Promise.all([
    readFile(resolve(projectRoot, HTML_FILE), "utf8"),
    readFile(resolve(projectRoot, TEXT_FILE), "utf8"),
    readFile(resolve(projectRoot, ASSET_MANIFEST_FILE), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_02_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(projectRoot, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return {
    html,
    text,
    assetManifest,
    assets: Object.fromEntries(assetEntries),
  };
}

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
