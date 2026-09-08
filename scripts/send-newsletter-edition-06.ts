import {
  NewsletterEdition06CampaignError,
  executeNewsletterEdition06Campaign,
  newsletterEdition06CampaignEnvironmentFromProcess,
  parseNewsletterEdition06CampaignArguments,
} from "@/lib/newsletter/edition-06-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition06CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition06Campaign({
    request,
    environment: newsletterEdition06CampaignEnvironmentFromProcess(
      request.sendPrepared,
    ),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition06CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 06 campaign failed safely.");
  }
  process.exitCode = 1;
});
