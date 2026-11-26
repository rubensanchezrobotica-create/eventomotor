import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";
import {
  NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_17_PREHEADER,
  NEWSLETTER_EDITION_17_SUBJECT,
} from "@/lib/newsletter/edition-17-editorial";
import {
  NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL,
  renderEdition17Sendable,
} from "@/lib/newsletter/edition-17-render";
import type { NewsletterEdition17ContentVariant } from "@/lib/newsletter/edition-17-territorial";

export const NEWSLETTER_EDITION_17_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_17_REPLY_TO = "info@eventomotor.com";
// Canonical local seal for the approved public-asset renders of both variants.
const UNSEALED_SHA256 = "0".repeat(64);
export const NEWSLETTER_EDITION_17_RENDER_SHA256 = {
  national: {
    html: "65c8ee462b00959bdebdb63d19ef3fa15e4d2ee0285d89ff982e8b581dee8791",
    text: "0e02e8c03906bdbd44e3294f650f10f7d4c17230b615f0ea6d797bcee77196dd",
  },
  madrid: {
    html: "fc3ce05c1163dd043c329d979b5048fd4eb5db9fdcd8cb3a45decb99c4842bea",
    text: "fb4874ceac840cd744263c0de37f637e6e67c0192897dfb49ad6ff3fb93eb78e",
  },
} as const;
// The national canonical render anchors the five-argument campaign identity;
// the manifest also seals the Madrid render and the exact eight local assets.
export const NEWSLETTER_EDITION_17_HTML_SHA256 = NEWSLETTER_EDITION_17_RENDER_SHA256.national.html;
export const NEWSLETTER_EDITION_17_TEXT_SHA256 = NEWSLETTER_EDITION_17_RENDER_SHA256.national.text;
export const NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256 = "a13009463408077bd45602a28839b6b479db449daf6b6b6ca610eec7fbcaac38";

export type NewsletterEdition17AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export const NEWSLETTER_EDITION_17_ASSET_MANIFEST: readonly NewsletterEdition17AssetManifestEntry[] = [
  { file: "01-motogp-valencia-hero.webp", width: 1200, height: 675, bytes: 133744, sha256: "8586462540613ef453fbf92a16b95ac9762afd6b2505327c4696685ef3c24b65" },
  { file: "02-challenge-of-the-champions-jarama.webp", width: 800, height: 500, bytes: 78388, sha256: "0cb68de86b41d21d2d63fe342ca7eb9d2b8f6721e26600cde1d94d61922694ee" },
  { file: "03-salon-2ruedas-valencia.webp", width: 800, height: 500, bytes: 103904, sha256: "e08bf975e690859947a5aa6488270fb85bfaa7a4f6a1447b8b583459e22607ee" },
  { file: "04-subida-mirador-guimar.webp", width: 800, height: 500, bytes: 114946, sha256: "50f93636d181162d00958bec44a51130a2b1a55fc0aa9b3ea4f76e9310549105" },
  { file: "05-enduroc-2026.webp", width: 800, height: 500, bytes: 194518, sha256: "9ed3b8cc3900523e31d9a2a1350726a50e03f338b02553ec6df1a819bd2eda38" },
  { file: "06-x-trial-madrid.webp", width: 800, height: 500, bytes: 122186, sha256: "e88b9a73180cb99f33f73974478fcb7d11d483730ce56183d88ad52f5dccd56f" },
  { file: "eventomotor-header.png", width: 1240, height: 200, bytes: 37624, sha256: "0b9b2876153930ed8da90b8dcc2a34f105588461860f38de20a9326d6958074c" },
  { file: "eventomotor-logo.png", width: 520, height: 56, bytes: 26745, sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc" },
];

export type NewsletterEdition17Source = {
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export class NewsletterEdition17ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 17 content blocked: ${code}.`);
    this.name = "NewsletterEdition17ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition17ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalizeEdition17Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function newsletterEdition17ContentManifestDigest(): string {
  return sha256(JSON.stringify({
    editionKey: NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_17_SUBJECT,
    preheader: NEWSLETTER_EDITION_17_PREHEADER,
    variantMap: {
      national: null,
      "comunidad-de-madrid": "madrid",
      cataluna: null,
      aragon: null,
      galicia: null,
      "sin-region": null,
      unknown: null,
    },
    assets: NEWSLETTER_EDITION_17_ASSET_MANIFEST,
    renders: NEWSLETTER_EDITION_17_RENDER_SHA256,
  }));
}

export function assertEdition17SealReady(): void {
  if (
    NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256 === UNSEALED_SHA256 ||
    NEWSLETTER_EDITION_17_ASSET_MANIFEST.some((entry) => entry.bytes === 0 || entry.sha256 === UNSEALED_SHA256) ||
    Object.values(NEWSLETTER_EDITION_17_RENDER_SHA256).some(
      (render) => render.html === UNSEALED_SHA256 || render.text === UNSEALED_SHA256,
    )
  ) fail("edition_not_sealed");
}

export function validateEdition17SourceIntegrity(source: NewsletterEdition17Source): void {
  assertEdition17SealReady();
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_17_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }
  const expectedFiles = NEWSLETTER_EDITION_17_ASSET_MANIFEST.map(({ file }) => file).sort();
  const actualFiles = Object.keys(source.assets).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) fail("asset_set_mismatch");
  for (const entry of NEWSLETTER_EDITION_17_ASSET_MANIFEST) {
    const bytes = source.assets[entry.file];
    if (!bytes || bytes.byteLength !== entry.bytes || entry.bytes > 300_000 || sha256(bytes) !== entry.sha256) {
      fail("asset_digest_mismatch");
    }
  }
  if (newsletterEdition17ContentManifestDigest() !== NEWSLETTER_EDITION_17_CONTENT_MANIFEST_SHA256) {
    fail("content_manifest_digest_mismatch");
  }
  for (const variant of ["national", "madrid"] as const) {
    const rendered = renderEdition17Sendable(variant, NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL);
    const expected = NEWSLETTER_EDITION_17_RENDER_SHA256[variant];
    if (
      sha256(canonicalizeEdition17Text(rendered.html)) !== expected.html ||
      sha256(canonicalizeEdition17Text(rendered.text)) !== expected.text
    ) fail("render_digest_mismatch");
    if (
      rendered.html.includes("PREVIEW LOCAL") ||
      rendered.html.includes("2026-11-19/assets/") ||
      rendered.html.includes("2026-11-12/assets/") ||
      rendered.html.includes('src="assets/') ||
      rendered.html.includes("{{") ||
      rendered.text.includes("{{")
    ) fail("sendable_render_invalid");
    const images = [...rendered.html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
    if (
      images.length !== (variant === "madrid" ? 7 : 6) ||
      new Set(images).size !== images.length ||
      images.some((url) => !url?.startsWith("https://www.eventomotor.com/newsletter/2026-11-26/assets/"))
    ) fail("sendable_assets_invalid");
  }
}

export function validateEdition17UnsubscribeUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail("unsubscribe_url_invalid");
  }
  const entries = [...parsed.searchParams.entries()];
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== "https://www.eventomotor.com" ||
    parsed.pathname !== "/newsletter/unsubscribe" ||
    parsed.username || parsed.password || parsed.hash ||
    entries.length !== 1 || entries[0]?.[0] !== "token" ||
    !isValidNewsletterActionTokenShape(entries[0]?.[1] ?? "")
  ) fail("unsubscribe_url_invalid");
  return parsed.toString();
}

export function prepareEdition17Content(
  source: NewsletterEdition17Source,
  variant: NewsletterEdition17ContentVariant,
  unsubscribeUrl: string,
): { html: string; text: string; variant: NewsletterEdition17ContentVariant } {
  validateEdition17SourceIntegrity(source);
  if (variant !== "national" && variant !== "madrid") fail("content_variant_invalid");
  const content = renderEdition17Sendable(variant, validateEdition17UnsubscribeUrl(unsubscribeUrl));
  if (content.html.includes(NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL)) {
    fail("subscriber_unsubscribe_missing");
  }
  return { ...content, variant };
}
