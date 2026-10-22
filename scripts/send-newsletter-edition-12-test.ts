import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition12TestSendError,
  executeNewsletterEdition12TestSend,
  newsletterEdition12TestEnvironmentFromProcess,
  parseNewsletterEdition12TestArguments,
} from "@/lib/newsletter/edition-12-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition12TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition12TestSend({
    request,
    environment: newsletterEdition12TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition12TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 12 test send failed safely.");
  }
  process.exitCode = 1;
});
