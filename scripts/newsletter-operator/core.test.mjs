import assert from "node:assert/strict";
import { test } from "node:test";
import { operate } from "./core.mjs";

const edition = 16;
const date = "2026-11-19";
const key = "agenda_motor_2026_11_19";
const campaignId = "11111111-1111-4111-8111-111111111111";
const meta = {
  edition, date, campaignKey: key, subject: "Asunto sellado",
  identity: { editionKey: key, subject: "Asunto sellado", htmlSha256: "a".repeat(64), textSha256: "b".repeat(64), contentManifestDigest: "c".repeat(64) },
  assets: [{ file: "hero.webp", bytes: 42, sha256: "d".repeat(64) }],
  urls: ["https://www.eventomotor.com/evento/x?utm_campaign=agenda_motor_2026_11_19"],
  testRecipient: "rubensanchezrobotica@gmail.com", testConfirm: "TEST", testArm: "ARM",
  campaignConfirm: "SEND", campaignArm: "LIVE", headerOpaque: true,
};
const fresh = {
  campaignId: null, campaignStatus: "not_created", audienceFrozenAt: null,
  eligibleCount: 2, nationalCount: 1, madridCount: 1, excludedCount: 3,
  duplicateCount: 0, invalidCount: 0, preparedCount: 0, sendingCount: 0,
  acceptedCount: 0, failedCount: 0, unknownCount: 0, retryableCount: 0,
};
const prepared = {
  campaignId, campaignStatus: "prepared", audienceFrozenAt: "2026-11-19T10:00:00Z",
  deliveryCount: 2, preparedCount: 2, sendingCount: 0, acceptedCount: 0,
  failedCount: 0, unknownCount: 0, nationalCount: 1, madridCount: 1,
  duplicateSubscriberCount: 0, duplicateEmailCount: 0, invalidVariantCount: 0,
};
function fixture(overrides = {}) {
  const calls = [];
  const adapter = {
    meta: async () => { calls.push("meta"); return meta; },
    preview: async () => { calls.push("preview"); return { identity: meta.identity, summary: fresh }; },
    audit: async () => { calls.push("audit"); return prepared; },
    verifyAssets: async () => { calls.push("assets"); },
    verifyLinks: async () => { calls.push("links"); },
    test: async () => { calls.push("test"); return { status: "accepted", messageId: "msg_1" }; },
    prepare: async () => { calls.push("prepare"); return { invokedOnce: true }; },
    send: async () => { calls.push("send"); return { invokedOnce: true }; },
    ...overrides,
  };
  return { adapter, calls };
}
const args = (approval) => ({ edition, date, approval });
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code);

test("status and preview are read-only", async () => {
  const f = fixture();
  assert.equal((await operate("status", f.adapter, args())).preview.eligibleCount, 2);
  assert.equal((await operate("preview", f.adapter, args())).readyToPrepare, true);
  assert.deepEqual(f.calls, ["meta", "preview", "meta", "assets", "links", "preview"]);
});
test("audit and report only read the canonical snapshot", async () => {
  const f = fixture({ preview: async () => ({ identity: meta.identity, summary: { ...fresh, campaignId, campaignStatus: "prepared", audienceFrozenAt: prepared.audienceFrozenAt, preparedCount: 2 } }) });
  assert.equal((await operate("audit", f.adapter, args())).audit.campaignId, campaignId);
  assert.equal((await operate("report", f.adapter, args())).audit.deliveryCount, 2);
  assert.equal(f.calls.includes("prepare") || f.calls.includes("send"), false);
});
test("test requires edition-specific human authorization", async () => {
  const f = fixture();
  await rejects(operate("test", f.adapter, args()), "test_authorization_missing");
  assert.equal(f.calls.includes("test"), false);
  const out = await operate("test", f.adapter, args(`TEST:${key}`));
  assert.equal(out.test.messageId, "msg_1");
  assert.equal(f.calls.filter((x) => x === "test").length, 1);
});
test("uncertain test provider result has no retry", async () => {
  const f = fixture({ test: async () => { f.calls.push("test"); return { status: "unknown" }; } });
  await rejects(operate("test", f.adapter, args(`TEST:${key}`)), "test_provider_uncertain_no_retry");
  assert.equal(f.calls.filter((x) => x === "test").length, 1);
});
test("completed edition blocks a new protected test", async () => {
  const f = fixture({ preview: async () => ({ identity: meta.identity, summary: { ...fresh, campaignStatus: "completed", campaignId } }) });
  await rejects(operate("test", f.adapter, args(`TEST:${key}`)), "campaign_not_fresh");
  assert.equal(f.calls.includes("test"), false);
});
test("prepare uses one fresh preview and one prepare", async () => {
  const f = fixture();
  const out = await operate("prepare", f.adapter, args(`PREPARE:${key}:${meta.identity.contentManifestDigest}`));
  assert.equal(out.audit.deliveryCount, 2);
  assert.equal(f.calls.filter((x) => x === "prepare").length, 1);
});
test("completed campaign blocks second prepare", async () => {
  const f = fixture({ preview: async () => ({ identity: meta.identity, summary: { ...fresh, campaignStatus: "completed", campaignId } }) });
  await rejects(operate("prepare", f.adapter, args(`PREPARE:${key}:${meta.identity.contentManifestDigest}`)), "campaign_not_fresh");
  assert.equal(f.calls.includes("prepare"), false);
});
test("duplicates and invalid addresses block prepare", async () => {
  for (const keyName of ["duplicateCount", "invalidCount"]) {
    const f = fixture({ preview: async () => ({ identity: meta.identity, summary: { ...fresh, [keyName]: 1 } }) });
    await rejects(operate("prepare", f.adapter, args(`PREPARE:${key}:${meta.identity.contentManifestDigest}`)), "preview_audience_gate");
    assert.equal(f.calls.includes("prepare"), false);
  }
});
test("hash mismatch blocks mutation", async () => {
  const f = fixture({ preview: async () => ({ identity: { ...meta.identity, htmlSha256: "f".repeat(64) }, summary: fresh }) });
  await rejects(operate("prepare", f.adapter, args(`PREPARE:${key}:${meta.identity.contentManifestDigest}`)), "preview_identity_mismatch");
  assert.equal(f.calls.includes("prepare"), false);
});
test("more than 500 recipients blocks prepare", async () => {
  const f = fixture({ preview: async () => ({ identity: meta.identity, summary: { ...fresh, eligibleCount: 501, nationalCount: 500 } }) });
  await rejects(operate("prepare", f.adapter, args(`PREPARE:${key}:${meta.identity.contentManifestDigest}`)), "preview_audience_gate");
  assert.equal(f.calls.includes("prepare"), false);
});
test("uncertain prepare is audited but never repeated", async () => {
  const f = fixture({
    prepare: async () => { f.calls.push("prepare"); throw Error("timeout"); },
    audit: async () => { f.calls.push("audit"); return { ...prepared, recipientEmail: "must-not-appear@example.test" }; },
  });
  await assert.rejects(
    operate("prepare", f.adapter, args(`PREPARE:${key}:${meta.identity.contentManifestDigest}`)),
    (error) => error.code === "prepare_uncertain_no_retry" &&
      error.audit?.deliveryCount === 2 &&
      !JSON.stringify(error.audit).includes("must-not-appear"),
  );
  assert.equal(f.calls.filter((x) => x === "prepare").length, 1);
  assert.equal(f.calls.filter((x) => x === "audit").length, 1);
});
test("send requires independent authorization and a prepared snapshot", async () => {
  const f = fixture();
  await rejects(operate("send", f.adapter, args()), "send_authorization_missing");
  assert.equal(f.calls.includes("send"), false);
  const bad = fixture({ audit: async () => ({ ...prepared, campaignStatus: "completed", acceptedCount: 2, preparedCount: 0 }) });
  await rejects(operate("send", bad.adapter, args(`SEND:${key}:${campaignId}:2`)), "campaign_not_prepared");
  assert.equal(bad.calls.includes("send"), false);
});
test("single send reconciles full acceptance", async () => {
  let auditCalls = 0;
  const f = fixture({ audit: async () => ++auditCalls === 1 ? prepared : { ...prepared, campaignStatus: "completed", preparedCount: 0, acceptedCount: 2 } });
  const out = await operate("send", f.adapter, args(`SEND:${key}:${campaignId}:2`));
  assert.equal(out.audit.campaignStatus, "completed");
  assert.equal(f.calls.filter((x) => x === "send").length, 1);
});
test("partial or uncertain provider result stops without second send", async () => {
  let auditCalls = 0;
  const f = fixture({ audit: async () => ++auditCalls === 1 ? prepared : { ...prepared, campaignStatus: "paused", preparedCount: 1, unknownCount: 1 } });
  await rejects(operate("send", f.adapter, args(`SEND:${key}:${campaignId}:2`)), "send_not_fully_reconciled_no_retry");
  assert.equal(f.calls.filter((x) => x === "send").length, 1);
  const uncertain = fixture({ send: async () => { uncertain.calls.push("send"); throw Error("timeout"); } });
  await rejects(operate("send", uncertain.adapter, args(`SEND:${key}:${campaignId}:2`)), "send_uncertain_no_retry");
  assert.equal(uncertain.calls.filter((x) => x === "send").length, 1);
});
