import { loadEnvConfig } from "@next/env";

import {
  NewsletterEdition11TestSendError,
  executeNewsletterEdition11TestSend,
  newsletterEdition11TestEnvironmentFromProcess,
  parseNewsletterEdition11TestArguments,
} from "@/lib/newsletter/edition-11-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition11TestArguments(process.argv.slice(2));
  if (request.send) loadEnvConfig(process.cwd(), true);
  await executeNewsletterEdition11TestSend({
    request,
    environment: newsletterEdition11TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition11TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 11 test send failed safely.");
  }
  process.exitCode = 1;
});
