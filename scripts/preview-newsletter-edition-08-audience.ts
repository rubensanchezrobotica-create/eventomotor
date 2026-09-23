import { loadEnvConfig } from "@next/env";

import { createSupabaseServerClient } from "@/lib/supabase";
import { newsletterEdition08CampaignIdentity } from "@/lib/newsletter/edition-08-campaign";

type Subscriber = {
  id: string;
  email_normalized: string;
  region_slug: string | null;
  status: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  suppressed_at: string | null;
};

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requireRows<T>(
  label: string,
  result: { data: T[] | null; error: { message: string } | null },
): T[] {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (!result.data) throw new Error(`${label}: missing data`);
  return result.data;
}

async function main(): Promise<void> {
  const envRoot = argumentValue("--env-root") ?? process.cwd();
  loadEnvConfig(envRoot, true);

  const client = createSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase service-role environment is unavailable.");
  }

  const identity = newsletterEdition08CampaignIdentity();

const [previewResult, subscribersResult, preferencesResult, consentsResult, suppressionsResult] =
  await Promise.all([
    client.rpc("preview_newsletter_campaign_v2", {
      p_edition_key: identity.editionKey,
      p_subject: identity.subject,
      p_html_sha256: identity.htmlSha256,
      p_text_sha256: identity.textSha256,
      p_content_manifest_digest: identity.contentManifestDigest,
    }),
    client
      .from("newsletter_subscribers")
      .select(
        "id,email_normalized,region_slug,status,confirmed_at,unsubscribed_at,bounced_at,complained_at,suppressed_at",
      )
      .range(0, 9999),
    client
      .from("newsletter_preferences")
      .select("subscriber_id,weekly_digest_enabled")
      .eq("weekly_digest_enabled", true)
      .range(0, 9999),
    client
      .from("newsletter_consent_events")
      .select("subscriber_id")
      .eq("action", "confirmed")
      .range(0, 9999),
    client
      .from("newsletter_suppressions")
      .select("subscriber_id")
      .is("lifted_at", null)
      .range(0, 9999),
  ]);

const previewRows = requireRows("campaign preview", previewResult);
if (previewRows.length !== 1) {
  throw new Error(`campaign preview returned ${previewRows.length} rows`);
}
const preview = previewRows[0];
if (preview.campaign_id !== null || preview.campaign_status !== "not_created") {
  throw new Error("Edition 08 campaign already exists; expected read-only not_created state.");
}

const subscribers = requireRows("subscribers", subscribersResult) as Subscriber[];
const weeklyDigestEnabled = new Set(
  requireRows("preferences", preferencesResult).map((row) => row.subscriber_id),
);
const confirmedConsent = new Set(
  requireRows("consents", consentsResult).map((row) => row.subscriber_id),
);
const activelySuppressed = new Set(
  requireRows("suppressions", suppressionsResult).map((row) => row.subscriber_id),
);

function isEligibleBeforeAddressValidation(subscriber: Subscriber): boolean {
  return (
    subscriber.status === "active" &&
    subscriber.confirmed_at !== null &&
    subscriber.unsubscribed_at === null &&
    subscriber.bounced_at === null &&
    subscriber.complained_at === null &&
    subscriber.suppressed_at === null &&
    weeklyDigestEnabled.has(subscriber.id) &&
    confirmedConsent.has(subscriber.id) &&
    !activelySuppressed.has(subscriber.id)
  );
}

function hasValidAddress(subscriber: Subscriber): boolean {
  const email = subscriber.email_normalized;
  return (
    email === email.trim() &&
    email.length >= 3 &&
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

const eligibleBeforeAddressValidation = subscribers.filter(
  isEligibleBeforeAddressValidation,
);
const sendable = eligibleBeforeAddressValidation.filter(hasValidAddress);
const invalid = eligibleBeforeAddressValidation.length - sendable.length;
const excluded = subscribers.length - sendable.length - invalid;

const addressCounts = new Map<string, number>();
for (const subscriber of sendable) {
  addressCounts.set(
    subscriber.email_normalized,
    (addressCounts.get(subscriber.email_normalized) ?? 0) + 1,
  );
}
const duplicates = [...addressCounts.values()].reduce(
  (total, count) => total + Math.max(count - 1, 0),
  0,
);

const regionCounts = new Map<string, number>();
let sinRegion = 0;
for (const subscriber of sendable) {
  const region = subscriber.region_slug?.trim() ?? "";
  if (!region) {
    sinRegion += 1;
    continue;
  }
  regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
}

const madrid = regionCounts.get("comunidad-de-madrid") ?? 0;
const cataluna = regionCounts.get("cataluna") ?? 0;
const valenciana = regionCounts.get("comunidad-valenciana") ?? 0;
const andalucia = regionCounts.get("andalucia") ?? 0;
const galicia = regionCounts.get("galicia") ?? 0;
const namedRegions = new Set([
  "comunidad-de-madrid",
  "cataluna",
  "comunidad-valenciana",
  "andalucia",
  "galicia",
]);
const otherRegions = [...regionCounts.entries()].reduce(
  (total, [region, count]) => total + (namedRegions.has(region) ? 0 : count),
  0,
);
const nationalOnly = sendable.length - madrid - cataluna - valenciana;
const regionDistribution =
  sinRegion + madrid + cataluna + valenciana + andalucia + galicia + otherRegions;

if (
  preview.eligible_count !== sendable.length ||
  preview.excluded_count !== excluded ||
  preview.duplicate_count !== duplicates ||
  preview.invalid_count !== invalid ||
  regionDistribution !== sendable.length
) {
  throw new Error("Local read-only audience classification disagrees with canonical preview.");
}

console.log(`TOTAL_SUBSCRIBERS=${subscribers.length}`);
console.log(`ELIGIBLE=${sendable.length}`);
console.log(`EXCLUDED=${excluded}`);
console.log(`DUPLICATES=${duplicates}`);
console.log(`INVALID=${invalid}`);
console.log(`SIN_REGION=${sinRegion}`);
console.log(`COMUNIDAD_DE_MADRID=${madrid}`);
console.log(`CATALUNA=${cataluna}`);
console.log(`COMUNIDAD_VALENCIANA=${valenciana}`);
console.log(`ANDALUCIA=${andalucia}`);
console.log(`GALICIA=${galicia}`);
console.log(`OTHER_REGIONS=${otherRegions}`);
console.log(`NATIONAL_ONLY=${nationalOnly}`);
console.log(`NATIONAL_PLUS_MADRID=${madrid}`);
console.log(`NATIONAL_PLUS_CATALUNA=${cataluna}`);
console.log(`NATIONAL_PLUS_VALENCIANA=${valenciana}`);
console.log("CAMPAIGN_CREATED=NO");
  console.log("AUDIENCE_PREVIEW_READ_ONLY=YES");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
