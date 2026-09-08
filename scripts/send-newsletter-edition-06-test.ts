import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition06TestSendError,
  executeNewsletterEdition06TestSend,
  newsletterEdition06TestEnvironmentFromProcess,
  parseNewsletterEdition06TestArguments,
} from "@/lib/newsletter/edition-06-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition06TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition06TestSend({
    request,
    environment: newsletterEdition06TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition06TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 06 test send failed safely.");
  }
  process.exitCode = 1;
});
