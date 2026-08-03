import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertNewsletterEdition01TestExecutionEnvironment,
  executeNewsletterEdition01TestSend as executeNewsletterEdition01TestSendNeutral,
  selectNewsletterEdition01Environment,
  type NewsletterEdition01Source,
  type NewsletterEdition01TestEnvironment,
  type NewsletterEdition01TestRequest,
  type NewsletterEdition01TestResult,
} from "@/lib/newsletter/edition-01-test-send";
import { FetchNewsletterResendClient } from "@/lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
} from "@/lib/newsletter/resend-config.server";

export {
  NewsletterEdition01TestSendError,
  parseNewsletterEdition01TestArguments,
} from "@/lib/newsletter/edition-01-test-send";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-06";
const HTML_FILE = `${EDITION_DIRECTORY}/email-production.html`;
const TEXT_FILE = `${EDITION_DIRECTORY}/email-texto-plano.txt`;

type Edition01FileReader = (
  path: string,
  encoding: "utf8",
) => Promise<string>;

type ExecuteNewsletterEdition01ServerTestOptions = {
  request: NewsletterEdition01TestRequest;
  environment?: NewsletterEdition01TestEnvironment;
  fileReader?: Edition01FileReader;
  logger?: (message: string) => void;
  projectRoot?: string;
};

async function loadEdition01Source(
  projectRoot = process.cwd(),
  fileReader: Edition01FileReader = readFile,
): Promise<NewsletterEdition01Source> {
  const [html, text] = await Promise.all([
    fileReader(resolve(projectRoot, HTML_FILE), "utf8"),
    fileReader(resolve(projectRoot, TEXT_FILE), "utf8"),
  ]);
  return { html, text };
}

export async function executeNewsletterEdition01TestSend(
  options: ExecuteNewsletterEdition01ServerTestOptions,
): Promise<NewsletterEdition01TestResult> {
  assertNewsletterEdition01TestExecutionEnvironment(options.environment ?? {});
  const source = await loadEdition01Source(
    options.projectRoot,
    options.fileReader,
  );
  return executeNewsletterEdition01TestSendNeutral({
    request: options.request,
    environment: options.environment,
    source,
    sender: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    clientFactory: (apiKey) => new FetchNewsletterResendClient({ apiKey }),
    logger: options.logger,
  });
}

export function newsletterEdition01EnvironmentFromProcess(
  includeApiKey = false,
): NewsletterEdition01TestEnvironment {
  return selectNewsletterEdition01Environment(
    {
      armed: process.env.NEWSLETTER_EDITION_TEST_SEND_ARMED,
      apiKey: includeApiKey
        ? process.env.NEWSLETTER_RESEND_API_KEY
        : undefined,
      ci: process.env.CI,
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
    },
    includeApiKey,
  );
}
