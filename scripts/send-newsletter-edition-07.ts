import {
  NewsletterEdition07CampaignError,
  executeNewsletterEdition07Campaign,
  newsletterEdition07CampaignEnvironmentFromProcess,
  parseNewsletterEdition07CampaignArguments,
} from "@/lib/newsletter/edition-07-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition07CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition07Campaign({
    request,
    environment: newsletterEdition07CampaignEnvironmentFromProcess(
      request.sendPrepared,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition07CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 07 campaign failed safely.");
  }
  process.exitCode = 1;
});
