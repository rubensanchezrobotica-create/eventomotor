import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition03TestSendError,
  executeNewsletterEdition03TestSend,
  newsletterEdition03TestEnvironmentFromProcess,
  parseNewsletterEdition03TestArguments,
} from "@/lib/newsletter/edition-03-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition03TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition03TestSend({
    request,
    environment: newsletterEdition03TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition03TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 03 test send failed safely.");
  }
  process.exitCode = 1;
});
