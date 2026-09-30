import {
  NewsletterEdition09CampaignError,
  executeNewsletterEdition09Campaign,
  newsletterEdition09CampaignEnvironmentFromProcess,
  parseNewsletterEdition09CampaignArguments,
} from "@/lib/newsletter/edition-09-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition09CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition09Campaign({
    request,
    environment: newsletterEdition09CampaignEnvironmentFromProcess(
      request.sendPrepared,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition09CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 09 campaign failed safely.");
  }
  process.exitCode = 1;
});
