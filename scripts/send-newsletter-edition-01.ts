import {
  NewsletterEdition01CampaignError,
  executeNewsletterEdition01Campaign,
  newsletterEdition01CampaignEnvironmentFromProcess,
  parseNewsletterEdition01CampaignArguments,
} from "@/lib/newsletter/edition-01-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition01CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition01Campaign({
    request,
    environment: newsletterEdition01CampaignEnvironmentFromProcess(
      request.send,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition01CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 01 campaign failed safely.");
  }
  process.exitCode = 1;
});
