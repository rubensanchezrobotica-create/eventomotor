import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition01TestSendError,
  executeNewsletterEdition01TestSend,
  newsletterEdition01EnvironmentFromProcess,
  parseNewsletterEdition01TestArguments,
} from "@/lib/newsletter/edition-01-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition01TestArguments(process.argv.slice(2));

  if (request.send) {
    loadEnvConfig(process.cwd(), true);
  }

  await executeNewsletterEdition01TestSend({
    request,
    environment: newsletterEdition01EnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition01TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 01 test send failed safely.");
  }
  process.exitCode = 1;
});
