import {
  NewsletterEdition11CampaignError,
  executeNewsletterEdition11Campaign,
  newsletterEdition11CampaignEnvironmentFromProcess,
  parseNewsletterEdition11CampaignArguments,
} from "@/lib/newsletter/edition-11-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition11CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition11Campaign({
    request,
    environment: newsletterEdition11CampaignEnvironmentFromProcess(
      request.sendPrepared,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition11CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 11 campaign failed safely.");
  }
  process.exitCode = 1;
});
