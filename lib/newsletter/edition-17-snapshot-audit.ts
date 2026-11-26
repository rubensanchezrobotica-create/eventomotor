import type { NewsletterEdition17SnapshotAudit } from "@/lib/newsletter/edition-17-campaign";

export type NewsletterEdition17ExpectedSnapshotStatus = "prepared" | "completed";

export class NewsletterEdition17SnapshotAuditError extends Error {
  constructor(readonly code: string) {
    super(`Edition 17 snapshot audit blocked: ${code}.`);
    this.name = "NewsletterEdition17SnapshotAuditError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition17SnapshotAuditError(code);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateNewsletterEdition17SnapshotAudit(
  audit: NewsletterEdition17SnapshotAudit,
  expectedStatus: NewsletterEdition17ExpectedSnapshotStatus,
): void {
  const counts = [
    audit.deliveryCount, audit.preparedCount, audit.sendingCount,
    audit.acceptedCount, audit.failedCount, audit.unknownCount,
    audit.nationalCount, audit.madridCount, audit.duplicateSubscriberCount,
    audit.duplicateEmailCount, audit.invalidVariantCount,
  ];
  if (
    !UUID.test(audit.campaignId) ||
    !Number.isFinite(Date.parse(audit.audienceFrozenAt)) ||
    counts.some((count) => !Number.isInteger(count) || count < 0) ||
    audit.deliveryCount < 1 || audit.deliveryCount > 500 ||
    audit.nationalCount + audit.madridCount !== audit.deliveryCount ||
    audit.preparedCount + audit.sendingCount + audit.acceptedCount +
      audit.failedCount + audit.unknownCount !== audit.deliveryCount ||
    audit.duplicateSubscriberCount !== 0 || audit.duplicateEmailCount !== 0 ||
    audit.invalidVariantCount !== 0
  ) fail("snapshot_invariant_failed");
  if (audit.campaignStatus !== expectedStatus) fail("campaign_status_unexpected");
  if (expectedStatus === "prepared") {
    if (
      audit.preparedCount !== audit.deliveryCount ||
      audit.sendingCount !== 0 || audit.acceptedCount !== 0 ||
      audit.failedCount !== 0 || audit.unknownCount !== 0
    ) fail("prepared_snapshot_mismatch");
  } else if (
    audit.acceptedCount !== audit.deliveryCount ||
    audit.preparedCount !== 0 || audit.sendingCount !== 0 ||
    audit.failedCount !== 0 || audit.unknownCount !== 0
  ) fail("reconciliation_mismatch");
}
