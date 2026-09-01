import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition05TestSendError,
  executeNewsletterEdition05TestSend,
  newsletterEdition05TestEnvironmentFromProcess,
  parseNewsletterEdition05TestArguments,
} from "@/lib/newsletter/edition-05-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition05TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition05TestSend({
    request,
    environment: newsletterEdition05TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition05TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 05 test send failed safely.");
  }
  process.exitCode = 1;
});
