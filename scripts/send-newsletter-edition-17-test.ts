import {
  NewsletterEdition17TestSendError,
  executeNewsletterEdition17TestSend,
  newsletterEdition17TestEnvironmentFromProcess,
  parseNewsletterEdition17TestArguments,
} from "@/lib/newsletter/edition-17-test-send.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition17TestArguments(process.argv.slice(2));
  await executeNewsletterEdition17TestSend({
    request,
    environment: newsletterEdition17TestEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition17TestSendError) {
    console.error(error.message);
  } else {
    console.error("Edition 17 protected test failed safely.");
  }
  process.exitCode = 1;
});
