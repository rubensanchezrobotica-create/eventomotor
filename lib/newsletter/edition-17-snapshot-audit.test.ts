import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { NewsletterEdition17SnapshotAudit } from "./edition-17-campaign";
import {
  validateNewsletterEdition17SnapshotAudit,
} from "./edition-17-snapshot-audit";

const prepared: NewsletterEdition17SnapshotAudit = {
  campaignId: "e9e90fb9-271b-4371-9756-d61299157ea1",
  campaignStatus: "prepared",
  audienceFrozenAt: "2026-11-26T10:00:00Z",
  deliveryCount: 2,
  preparedCount: 2,
  sendingCount: 0,
  acceptedCount: 0,
  failedCount: 0,
  unknownCount: 0,
  nationalCount: 1,
  madridCount: 1,
  duplicateSubscriberCount: 0,
  duplicateEmailCount: 0,
  invalidVariantCount: 0,
};

test("Edition 17 read-only audit validates prepared and fully reconciled snapshots", () => {
  assert.doesNotThrow(() => validateNewsletterEdition17SnapshotAudit(prepared, "prepared"));
  assert.doesNotThrow(() => validateNewsletterEdition17SnapshotAudit({
    ...prepared, campaignStatus: "completed", preparedCount: 0, acceptedCount: 2,
  }, "completed"));
});

test("Edition 17 read-only audit rejects duplicates, invalid variants and >500", () => {
  for (const audit of [
    { ...prepared, duplicateSubscriberCount: 1 },
    { ...prepared, duplicateEmailCount: 1 },
    { ...prepared, invalidVariantCount: 1 },
    { ...prepared, deliveryCount: 501, preparedCount: 501, nationalCount: 500 },
  ]) {
    assert.throws(() => validateNewsletterEdition17SnapshotAudit(audit, "prepared"));
  }
});

test("Edition 17 read-only audit blocks a second send and partial reconciliation", () => {
  assert.throws(() => validateNewsletterEdition17SnapshotAudit({
    ...prepared, campaignStatus: "completed", preparedCount: 0, acceptedCount: 2,
  }, "prepared"));
  assert.throws(() => validateNewsletterEdition17SnapshotAudit({
    ...prepared, campaignStatus: "completed", preparedCount: 0, acceptedCount: 1, unknownCount: 1,
  }, "completed"));
});

test("Edition 17 audit CLI uses only the frozen audit RPC and no provider", () => {
  const cli = readFileSync("scripts/audit-newsletter-edition-17.ts", "utf8");
  assert.match(cli, /repository\.auditFrozenCampaign\(/);
  assert.doesNotMatch(cli, /prepareCampaign\(|claimDelivery\(|recordAccepted\(|sendEmail\(|FetchNewsletterResendClient/);
  assert.doesNotMatch(cli, /newsletter_subscribers|newsletter_campaign_deliveries/);
});
