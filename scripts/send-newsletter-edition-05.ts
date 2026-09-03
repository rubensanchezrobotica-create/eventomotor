import {
  NewsletterEdition05CampaignError,
  executeNewsletterEdition05Campaign,
  newsletterEdition05CampaignEnvironmentFromProcess,
  parseNewsletterEdition05CampaignArguments,
} from "@/lib/newsletter/edition-05-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition05CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition05Campaign({
    request,
    environment: newsletterEdition05CampaignEnvironmentFromProcess(
      request.send || request.sendPrepared === true,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition05CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 05 campaign failed safely.");
  }
  process.exitCode = 1;
});
