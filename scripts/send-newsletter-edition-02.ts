import {
  NewsletterEdition02CampaignError,
  executeNewsletterEdition02Campaign,
  newsletterEdition02CampaignEnvironmentFromProcess,
  parseNewsletterEdition02CampaignArguments,
} from "@/lib/newsletter/edition-02-campaign.server";

async function main(): Promise<void> {
  const request = parseNewsletterEdition02CampaignArguments(
    process.argv.slice(2),
  );
  await executeNewsletterEdition02Campaign({
    request,
    environment: newsletterEdition02CampaignEnvironmentFromProcess(request.send),
    logger: (message) => console.log(message),
  });
}

void main().catch((error: unknown) => {
  if (error instanceof NewsletterEdition02CampaignError) {
    console.error(error.message);
  } else {
    console.error("Edition 02 campaign failed safely.");
  }
  process.exitCode = 1;
});
