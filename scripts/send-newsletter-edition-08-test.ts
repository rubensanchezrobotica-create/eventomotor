import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition08TestSendError,
  executeNewsletterEdition08TestSend,
  newsletterEdition08TestEnvironmentFromProcess,
  parseNewsletterEdition08TestArguments,
} from "@/lib/newsletter/edition-08-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition08TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition08TestSend({
    request,
    environment: newsletterEdition08TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition08TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 08 test send failed safely.");
  }
  process.exitCode = 1;
});
