import {
  NewsletterEdition04CampaignError,
  executeNewsletterEdition04Campaign,
  newsletterEdition04CampaignEnvironmentFromProcess,
  parseNewsletterEdition04CampaignArguments,
} from "@/lib/newsletter/edition-04-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition04CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition04Campaign({
    request,
    environment: newsletterEdition04CampaignEnvironmentFromProcess(
      request.send,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition04CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 04 campaign failed safely.");
  }
  process.exitCode = 1;
});
