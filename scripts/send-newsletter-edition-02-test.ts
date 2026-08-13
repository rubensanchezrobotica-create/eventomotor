import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition02TestSendError,
  executeNewsletterEdition02TestSend,
  newsletterEdition02TestEnvironmentFromProcess,
  parseNewsletterEdition02TestArguments,
} from "@/lib/newsletter/edition-02-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition02TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition02TestSend({
    request,
    environment: newsletterEdition02TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition02TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 02 test send failed safely.");
  }
  process.exitCode = 1;
});
