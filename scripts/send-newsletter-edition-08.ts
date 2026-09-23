import {
  NewsletterEdition08CampaignError,
  executeNewsletterEdition08Campaign,
  newsletterEdition08CampaignEnvironmentFromProcess,
  parseNewsletterEdition08CampaignArguments,
} from "@/lib/newsletter/edition-08-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition08CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition08Campaign({
    request,
    environment: newsletterEdition08CampaignEnvironmentFromProcess(
      request.sendPrepared,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition08CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 08 campaign failed safely.");
  }
  process.exitCode = 1;
});
