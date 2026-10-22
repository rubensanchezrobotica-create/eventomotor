import {
  NewsletterEdition12CampaignError,
  executeNewsletterEdition12Campaign,
  newsletterEdition12CampaignEnvironmentFromProcess,
  parseNewsletterEdition12CampaignArguments,
} from "@/lib/newsletter/edition-12-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition12CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition12Campaign({
    request,
    environment: newsletterEdition12CampaignEnvironmentFromProcess(
      request.sendPrepared,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition12CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 12 campaign failed safely.");
  }
  process.exitCode = 1;
});
