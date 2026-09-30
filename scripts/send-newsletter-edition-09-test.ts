import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition09TestSendError,
  executeNewsletterEdition09TestSend,
  newsletterEdition09TestEnvironmentFromProcess,
  parseNewsletterEdition09TestArguments,
} from "@/lib/newsletter/edition-09-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition09TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition09TestSend({
    request,
    environment: newsletterEdition09TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition09TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 09 test send failed safely.");
  }
  process.exitCode = 1;
});
