import {
  NewsletterEdition17CampaignError,
  executeNewsletterEdition17Campaign,
  newsletterEdition17CampaignEnvironmentFromProcess,
  parseNewsletterEdition17CampaignArguments,
} from "@/lib/newsletter/edition-17-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition17CampaignArguments(process.argv.slice(2));
  await executeNewsletterEdition17Campaign({
    request,
    environment: newsletterEdition17CampaignEnvironmentFromProcess(request.sendPrepared),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition17CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 17 campaign failed safely.");
  }
  process.exitCode = 1;
});
