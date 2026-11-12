export class GateError extends Error {
  constructor(code, audit = null) { super(code); this.name = "GateError"; this.code = code; this.audit = audit; }
}

const fail = (code, audit) => { throw new GateError(code, audit); };
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = /^[0-9a-f]{64}$/;

export function validateMeta(meta, edition, date) {
  if (meta.edition !== edition || meta.date !== date || meta.campaignKey !== `agenda_motor_${date.replaceAll("-", "_")}`) fail("edition_identity_mismatch");
  if (!meta.subject || !meta.assets?.length || !meta.urls?.length) fail("metadata_incomplete");
  for (const key of ["htmlSha256", "textSha256", "contentManifestDigest"]) if (!hash.test(meta.identity?.[key] || "")) fail("canonical_hash_missing");
  if (meta.identity.editionKey !== meta.campaignKey || meta.identity.subject !== meta.subject) fail("canonical_identity_mismatch");
  if (meta.testRecipient !== "rubensanchezrobotica@gmail.com" || !meta.testConfirm || !meta.testArm || !meta.campaignConfirm || !meta.campaignArm) fail("edition_protection_missing");
  for (const asset of meta.assets) if (!hash.test(asset.sha256) || !asset.file || !integer(asset.bytes)) fail("asset_manifest_invalid");
  return meta;
}

export function validatePreview(row, meta) {
  if (!row || row.identity?.editionKey !== meta.campaignKey || row.identity?.subject !== meta.subject ||
      row.identity?.htmlSha256 !== meta.identity.htmlSha256 ||
      row.identity?.textSha256 !== meta.identity.textSha256 ||
      row.identity?.contentManifestDigest !== meta.identity.contentManifestDigest) fail("preview_identity_mismatch");
  const s = row.summary;
  if (!s) fail("preview_missing");
  for (const key of ["eligibleCount", "nationalCount", "madridCount", "excludedCount", "duplicateCount", "invalidCount", "preparedCount", "sendingCount", "acceptedCount", "failedCount", "unknownCount", "retryableCount"]) {
    if (!integer(s[key])) fail("preview_counter_invalid");
  }
  if (s.nationalCount + s.madridCount !== s.eligibleCount || s.eligibleCount > 500 || s.duplicateCount || s.invalidCount) fail("preview_audience_gate");
  return s;
}

export function requireFreshPreview(s) {
  if (s.campaignStatus !== "not_created" || s.campaignId !== null || s.audienceFrozenAt !== null ||
      s.eligibleCount < 1 || s.preparedCount || s.sendingCount || s.acceptedCount ||
      s.failedCount || s.unknownCount || s.retryableCount) fail("campaign_not_fresh");
}

export function validateAudit(a, meta) {
  if (!a || !uuid.test(a.campaignId || "") || !a.audienceFrozenAt) fail("snapshot_missing");
  for (const key of ["deliveryCount", "preparedCount", "sendingCount", "acceptedCount", "failedCount", "unknownCount", "nationalCount", "madridCount", "duplicateSubscriberCount", "duplicateEmailCount", "invalidVariantCount"]) {
    if (!integer(a[key])) fail("snapshot_counter_invalid");
  }
  if (a.deliveryCount < 1 || a.deliveryCount > 500 ||
      a.nationalCount + a.madridCount !== a.deliveryCount ||
      a.preparedCount + a.sendingCount + a.acceptedCount + a.failedCount + a.unknownCount !== a.deliveryCount ||
      a.duplicateSubscriberCount || a.duplicateEmailCount || a.invalidVariantCount) fail("snapshot_inconsistent");
  return a;
}

export function requirePrepared(a) {
  if (a.campaignStatus !== "prepared" || a.preparedCount !== a.deliveryCount ||
      a.sendingCount || a.acceptedCount || a.failedCount || a.unknownCount) fail("campaign_not_prepared");
}

function aggregateAudit(a) {
  if (!a) return null;
  const keys = [
    "campaignId", "campaignStatus", "audienceFrozenAt", "deliveryCount",
    "preparedCount", "sendingCount", "acceptedCount", "failedCount", "unknownCount",
    "nationalCount", "madridCount", "duplicateSubscriberCount",
    "duplicateEmailCount", "invalidVariantCount",
  ];
  return Object.fromEntries(keys.map((key) => [key, a[key]]));
}

async function auditAfterUncertainty(adapter, meta) {
  try { return aggregateAudit(validateAudit(await adapter.audit(), meta)); }
  catch { return null; }
}

export async function operate(action, adapter, { edition, date, approval } = {}) {
  const meta = validateMeta(await adapter.meta(), edition, date);
  const result = { action, edition, campaignKey: meta.campaignKey };
  if (action === "status") {
    const row = await adapter.preview();
    result.preview = validatePreview(row, meta);
    return result;
  }
  if (action === "preview") {
    await adapter.verifyAssets(meta);
    await adapter.verifyLinks(meta);
    const row = await adapter.preview();
    result.preview = validatePreview(row, meta);
    result.readyToPrepare = (() => { try { requireFreshPreview(result.preview); return true; } catch { return false; } })();
    return result;
  }
  if (action === "audit") {
    result.audit = validateAudit(await adapter.audit(), meta);
    return result;
  }
  if (action === "report") {
    const row = await adapter.preview();
    result.preview = validatePreview(row, meta);
    if (result.preview.campaignId) result.audit = validateAudit(await adapter.audit(), meta);
    return result;
  }
  if (action === "test") {
    if (approval !== `TEST:${meta.campaignKey}`) fail("test_authorization_missing");
    requireFreshPreview(validatePreview(await adapter.preview(), meta));
    await adapter.verifyAssets(meta);
    await adapter.verifyLinks(meta);
    result.test = await adapter.test(meta);
    if (result.test?.status !== "accepted" || !result.test?.messageId) fail("test_provider_uncertain_no_retry");
    return result;
  }
  if (action === "prepare") {
    if (approval !== `PREPARE:${meta.campaignKey}:${meta.identity.contentManifestDigest}`) fail("prepare_authorization_missing");
    await adapter.verifyAssets(meta);
    await adapter.verifyLinks(meta);
    const row = await adapter.preview();
    const before = validatePreview(row, meta);
    requireFreshPreview(before);
    result.before = before;
    try { result.prepare = await adapter.prepare(meta); }
    catch { fail("prepare_uncertain_no_retry", await auditAfterUncertainty(adapter, meta)); }
    const a = validateAudit(await adapter.audit(), meta);
    requirePrepared(a);
    if (a.deliveryCount !== before.eligibleCount || a.nationalCount !== before.nationalCount ||
        a.madridCount !== before.madridCount) fail("frozen_audience_mismatch");
    result.audit = a;
    return result;
  }
  if (action === "send") {
    const before = validateAudit(await adapter.audit(), meta);
    requirePrepared(before);
    if (approval !== `SEND:${meta.campaignKey}:${before.campaignId}:${before.deliveryCount}`) fail("send_authorization_missing");
    result.before = before;
    try { result.send = await adapter.send(meta, before); }
    catch { fail("send_uncertain_no_retry", await auditAfterUncertainty(adapter, meta)); }
    result.audit = validateAudit(await adapter.audit(), meta);
    if (result.audit.campaignId !== before.campaignId || result.audit.deliveryCount !== before.deliveryCount) fail("post_send_snapshot_mismatch", aggregateAudit(result.audit));
    if (result.audit.campaignStatus !== "completed" ||
        result.audit.acceptedCount !== result.audit.deliveryCount ||
        result.audit.preparedCount || result.audit.sendingCount ||
        result.audit.failedCount || result.audit.unknownCount) fail("send_not_fully_reconciled_no_retry", aggregateAudit(result.audit));
    return result;
  }
  fail("unknown_action");
}
