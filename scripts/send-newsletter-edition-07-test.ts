import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition07TestSendError,
  executeNewsletterEdition07TestSend,
  newsletterEdition07TestEnvironmentFromProcess,
  parseNewsletterEdition07TestArguments,
} from "@/lib/newsletter/edition-07-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition07TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition07TestSend({
    request,
    environment: newsletterEdition07TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition07TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 07 test send failed safely.");
  }
  process.exitCode = 1;
});
