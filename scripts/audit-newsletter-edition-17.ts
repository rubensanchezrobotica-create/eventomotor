import "server-only";

import { newsletterEdition17CampaignIdentity } from "@/lib/newsletter/edition-17-campaign";
import { createConfiguredNewsletterEdition17CampaignRepository } from "@/lib/newsletter/edition-17-campaign-repository.server";
import { validateEdition17SourceIntegrity } from "@/lib/newsletter/edition-17-content";
import { loadNewsletterEdition17Source } from "@/lib/newsletter/edition-17-source.server";
import {
  validateNewsletterEdition17SnapshotAudit,
  type NewsletterEdition17ExpectedSnapshotStatus,
} from "@/lib/newsletter/edition-17-snapshot-audit";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (
    argv.length !== 2 || argv[0] !== "--expect-status" ||
    (argv[1] !== "prepared" && argv[1] !== "completed")
  ) throw new Error("invalid_audit_arguments");
  if (process.env.CI !== undefined || process.env.VERCEL !== undefined || process.env.VERCEL_ENV !== undefined) {
    throw new Error("remote_runtime_blocked");
  }
  validateEdition17SourceIntegrity(await loadNewsletterEdition17Source());
  const repository = createConfiguredNewsletterEdition17CampaignRepository();
  if (!repository) throw new Error("supabase_connection_unavailable");
  const audit = await repository.auditFrozenCampaign(newsletterEdition17CampaignIdentity());
  console.log(`CAMPAIGN_ID=${audit.campaignId}`);
  console.log(`CAMPAIGN_STATUS=${audit.campaignStatus}`);
  console.log(`AUDIENCE_FROZEN_AT=${audit.audienceFrozenAt}`);
  console.log(`DELIVERIES_TOTAL=${audit.deliveryCount}`);
  console.log(`DELIVERIES_PREPARED=${audit.preparedCount}`);
  console.log(`DELIVERIES_SENDING=${audit.sendingCount}`);
  console.log(`DELIVERIES_ACCEPTED=${audit.acceptedCount}`);
  console.log(`DELIVERIES_FAILED=${audit.failedCount}`);
  console.log(`DELIVERIES_UNKNOWN=${audit.unknownCount}`);
  console.log(`FROZEN_NATIONAL=${audit.nationalCount}`);
  console.log(`FROZEN_MADRID=${audit.madridCount}`);
  console.log(`DUPLICATE_SUBSCRIBERS=${audit.duplicateSubscriberCount}`);
  console.log(`DUPLICATE_EMAILS=${audit.duplicateEmailCount}`);
  console.log(`INVALID_VARIANTS=${audit.invalidVariantCount}`);
  validateNewsletterEdition17SnapshotAudit(audit, argv[1] as NewsletterEdition17ExpectedSnapshotStatus);
  console.log("SNAPSHOT_AUDIT=PASS");
}

void main().catch(() => {
  console.error("Edition 17 snapshot audit failed safely.");
  process.exitCode = 1;
});
