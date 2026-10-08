import {
  NewsletterEdition10CampaignError,
  executeNewsletterEdition10Campaign,
  newsletterEdition10CampaignEnvironmentFromProcess,
  parseNewsletterEdition10CampaignArguments,
} from "@/lib/newsletter/edition-10-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition10CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition10Campaign({
    request,
    environment: newsletterEdition10CampaignEnvironmentFromProcess(
      request.sendPrepared,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition10CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 10 campaign failed safely.");
  }
  process.exitCode = 1;
});
