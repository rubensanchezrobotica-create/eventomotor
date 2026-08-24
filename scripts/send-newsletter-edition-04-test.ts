import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition04TestSendError,
  executeNewsletterEdition04TestSend,
  newsletterEdition04TestEnvironmentFromProcess,
  parseNewsletterEdition04TestArguments,
} from "@/lib/newsletter/edition-04-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition04TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition04TestSend({
    request,
    environment: newsletterEdition04TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition04TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 04 test send failed safely.");
  }
  process.exitCode = 1;
});
