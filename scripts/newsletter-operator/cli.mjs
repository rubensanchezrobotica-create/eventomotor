import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { GateError, operate } from "./core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [action, ...argv] = process.argv.slice(2);
const flags = new Map();
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i]?.startsWith("--") || argv[i + 1] === undefined || flags.has(argv[i])) throw new GateError("arguments_invalid");
  flags.set(argv[i], argv[i + 1]);
}
for (const name of flags.keys()) if (!["--edition", "--date", "--worktree", "--approval", "--variant"].includes(name)) throw new GateError("unknown_option");
const edition = Number(flags.get("--edition"));
const date = flags.get("--date");
const worktree = resolve(flags.get("--worktree") || join(here, "..", "..", "..", `eventomotor-newsletter-edition-${String(edition).padStart(2, "0")}`));
if (!Number.isInteger(edition) || edition < 1 || edition > 99 ||
    !/^20\d\d-\d\d-\d\d$/.test(date || "") ||
    !worktree.endsWith(`eventomotor-newsletter-edition-${String(edition).padStart(2, "0")}`) ||
    !existsSync(join(worktree, "lib", "newsletter", `edition-${edition}-campaign.ts`))) throw new GateError("edition_worktree_invalid");
const branch = spawnSync("git", ["-C", worktree, "branch", "--show-current"], { encoding: "utf8", windowsHide: true });
if (branch.status !== 0 || branch.stdout.trim() !== `codex/newsletter-edition-${String(edition).padStart(2, "0")}`) throw new GateError("edition_branch_invalid");
if (["CI", "VERCEL", "VERCEL_ENV"].some((key) => process.env[key] !== undefined) || process.env.NODE_ENV === "production") throw new GateError("remote_runtime_blocked");
const baseEnv = { ...process.env };
for (const key of ["CI", "VERCEL", "VERCEL_ENV"]) delete baseEnv[key];

function child(script, args, env = {}) {
  const result = spawnSync("node", ["--conditions=react-server", "--import", "tsx", script, ...args], {
    cwd: worktree, env: { ...baseEnv, ...env }, encoding: "utf8", timeout: 30 * 60_000, maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new GateError("edition_runner_failed_or_uncertain_no_retry");
  return result.stdout.trim();
}
function bridge(command) {
  const out = child(join(here, "edition-bridge.cjs"), [String(edition), command]);
  try { return JSON.parse(out); } catch { throw new GateError("edition_bridge_output_invalid"); }
}
function parseKeyValue(output) {
  const values = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}
async function getSafe(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try { return await fetch(url, { redirect: "manual", signal: controller.signal, ...options }); }
  finally { clearTimeout(timeout); }
}
const adapter = {
  meta: () => bridge("meta"),
  preview: () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new GateError("supabase_credential_unavailable");
    return bridge("preview");
  },
  audit: () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new GateError("supabase_credential_unavailable");
    return bridge("audit");
  },
  async verifyAssets(meta) {
    if (!meta.headerOpaque) throw new GateError("header_not_opaque");
    for (const asset of meta.assets) {
      const url = `https://www.eventomotor.com/newsletter/${date}/assets/${encodeURIComponent(asset.file)}`;
      const response = await getSafe(url);
      if (response.status !== 200 || response.redirected || response.headers.get("location")) throw new GateError("public_asset_http_invalid");
      const mime = asset.file.endsWith(".png") ? "image/png" : "image/webp";
      if (response.headers.get("content-type")?.split(";")[0].trim() !== mime) throw new GateError("public_asset_mime_invalid");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new GateError("public_asset_hash_invalid");
    }
  },
  async verifyLinks(meta) {
    for (const value of meta.urls) {
      const url = new URL(value);
      if (url.origin !== "https://www.eventomotor.com" || url.searchParams.get("utm_campaign") !== meta.campaignKey) throw new GateError("content_link_invalid");
      const response = await getSafe(url);
      if (response.status !== 200) throw new GateError("content_link_http_invalid");
    }
  },
  async test(meta) {
    if (!process.env.NEWSLETTER_RESEND_API_KEY) throw new GateError("resend_credential_unavailable");
    const variant = flags.get("--variant") || "madrid";
    const output = child(join(worktree, "scripts", `send-newsletter-edition-${edition}-test.ts`), [
      "--to", meta.testRecipient, "--variant", variant, "--send",
      "--confirm-to", meta.testRecipient, "--confirm-phrase", meta.testConfirm,
    ], {
      NEWSLETTER_MODE: "test", NEWSLETTER_MAIL_TRANSPORT: "resend",
      NEWSLETTER_TEST_RECIPIENT_ALLOWLIST: meta.testRecipient,
      [`NEWSLETTER_EDITION_${edition}_TEST_SEND_ARMED`]: meta.testArm,
    });
    const values = parseKeyValue(output);
    if (values.get("PROVIDER_CALL_COUNT") !== "1" || values.get("PROVIDER_ACCEPTED") !== "YES" ||
        !values.get("PROVIDER_MESSAGE_ID")) throw new GateError("test_result_uncertain_no_retry");
    return { status: "accepted", messageId: values.get("PROVIDER_MESSAGE_ID"), recipient: meta.testRecipient };
  },
  async prepare(meta) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new GateError("supabase_credential_unavailable");
    child(join(worktree, "scripts", `send-newsletter-edition-${edition}.ts`), [
      "--prepare-only", "--confirm-edition", meta.campaignKey, "--confirm-phrase", meta.campaignConfirm,
    ], {
      NEWSLETTER_MODE: "live", NEWSLETTER_MAIL_TRANSPORT: "resend",
      NEWSLETTER_PUBLIC_LAUNCH_ENABLED: "public-newsletter-live",
      [`NEWSLETTER_EDITION_${edition}_CAMPAIGN_ARMED`]: meta.campaignArm,
    });
    return { invokedOnce: true };
  },
  async send(meta, audit) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEWSLETTER_RESEND_API_KEY) throw new GateError("production_credential_unavailable");
    child(join(worktree, "scripts", `send-newsletter-edition-${edition}.ts`), [
      "--send-prepared", "--limit", String(audit.deliveryCount), "--confirm-edition", meta.campaignKey,
      "--confirm-phrase", meta.campaignConfirm, "--confirm-campaign-id", audit.campaignId,
    ], {
      NEWSLETTER_MODE: "live", NEWSLETTER_MAIL_TRANSPORT: "resend",
      NEWSLETTER_PUBLIC_LAUNCH_ENABLED: "public-newsletter-live",
      [`NEWSLETTER_EDITION_${edition}_CAMPAIGN_ARMED`]: meta.campaignArm,
      [`NEWSLETTER_EDITION_${edition}_PREPARED_CAMPAIGN_ID`]: audit.campaignId,
      [`NEWSLETTER_EDITION_${edition}_PREPARED_DELIVERY_COUNT`]: String(audit.deliveryCount),
      [`NEWSLETTER_EDITION_${edition}_PREPARED_NATIONAL_COUNT`]: String(audit.nationalCount),
      [`NEWSLETTER_EDITION_${edition}_PREPARED_MADRID_COUNT`]: String(audit.madridCount),
    });
    return { invokedOnce: true };
  },
};

try {
  const result = await operate(action, adapter, { edition, date, approval: flags.get("--approval") });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  process.stderr.write(`NEWSLETTER_OPERATOR_STOP=${error instanceof GateError ? error.code : "unexpected_error"}\n`);
  if (error instanceof GateError && error.audit) {
    process.stderr.write(`READ_ONLY_AUDIT_AFTER_STOP=${JSON.stringify(error.audit)}\n`);
  }
  process.exitCode = 1;
}
