import {
  NewsletterEdition03CampaignError,
  executeNewsletterEdition03Campaign,
  newsletterEdition03CampaignEnvironmentFromProcess,
  parseNewsletterEdition03CampaignArguments,
} from "@/lib/newsletter/edition-03-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition03CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition03Campaign({
    request,
    environment: newsletterEdition03CampaignEnvironmentFromProcess(
      request.send,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition03CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 03 campaign failed safely.");
  }
  process.exitCode = 1;
});
