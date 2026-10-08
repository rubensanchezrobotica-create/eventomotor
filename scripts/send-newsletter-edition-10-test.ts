import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition10TestSendError,
  executeNewsletterEdition10TestSend,
  newsletterEdition10TestEnvironmentFromProcess,
  parseNewsletterEdition10TestArguments,
} from "@/lib/newsletter/edition-10-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition10TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition10TestSend({
    request,
    environment: newsletterEdition10TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition10TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 10 test send failed safely.");
  }
  process.exitCode = 1;
});
