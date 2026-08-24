import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_04_CAMPAIGN_KEY =
  "agenda_motor_2026_08_27";
export const NEWSLETTER_EDITION_04_SUBJECT =
  "MotoGP Aragón, Navia y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_04_PREHEADER =
  "MotoGP en MotorLand, drift urbano en Navia, Bizkaia Rider y más para los próximos días.";
export const NEWSLETTER_EDITION_04_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_04_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_04_HTML_SHA256 =
  "7d7df2e1fef45881c518530f414af236692404f04edaaf92f63d9556e6a1155c";
export const NEWSLETTER_EDITION_04_TEXT_SHA256 =
  "a06850c9b6784850940e8383fa09b0675e020309f3a83cde768137d303e74710";
export const NEWSLETTER_EDITION_04_CONTENT_MANIFEST_SHA256 =
  "3547036537fcef9d49b27ba650fb2dcb7fa414d825b9618ef3b6008a54d89204";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-08-27/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_08_27";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\ufffd"] as const;

export type NewsletterEdition04ContentVariant =
  | "national"
  | "madrid"
  | "a-coruna"
  | "barcelona";

export type NewsletterEdition04AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition04Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition04TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition04PreparedContent =
  NewsletterEdition04TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition04ContentVariant;
  };

export const NEWSLETTER_EDITION_04_ASSET_MANIFEST: readonly NewsletterEdition04AssetManifestEntry[] = [
  {
    file: "01-motogp-aragon-hero.webp",
    width: 1200,
    height: 675,
    bytes: 136890,
    sha256: "9db0fd01a66dc3dd578b1bc6a646e97c49f8a7045118d0f5248bf5e0d0436521",
  },
  {
    file: "02-duelo-traseras-navia.webp",
    width: 800,
    height: 500,
    bytes: 103408,
    sha256: "feae5f33dcc4e9a799221f412657e2a459745fb65b2dd70cd593a6f30aae9138",
  },
  {
    file: "03-bizkaia-rider.webp",
    width: 800,
    height: 500,
    bytes: 114700,
    sha256: "19ac23fa2467d2f9fe7b8be07f2eaf98373b18899db33151c65347d7f0e97dae",
  },
  {
    file: "04-rallysprint-penamayor.webp",
    width: 800,
    height: 500,
    bytes: 147374,
    sha256: "26823ee6aa237d1464bbcb54a2694111c6dcf73b8727e260aadda6a0c9fd2fbb",
  },
  {
    file: "05-fim-motojunior-cheste.webp",
    width: 800,
    height: 500,
    bytes: 77314,
    sha256: "1468592124936d7deceb404853675083b39db58dcba45465b1e31175e8633694",
  },
  {
    file: "eventomotor-header.png",
    width: 1240,
    height: 200,
    bytes: 38798,
    sha256: "eacaf0285945446a5a432ff83f28bac99cf9e046c895f9502adbd646288b806b",
  },
  {
    file: "eventomotor-logo.png",
    width: 520,
    height: 56,
    bytes: 26745,
    sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc",
  },
];

export class NewsletterEdition04ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 04 content blocked: ${code}.`);
    this.name = "NewsletterEdition04ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition04ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition04Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_04_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_04_SUBJECT,
    preheader: NEWSLETTER_EDITION_04_PREHEADER,
    variantMap: {
      national: null,
      madrid: null,
      "a-coruna": null,
      barcelona: null,
    },
    assets: NEWSLETTER_EDITION_04_ASSET_MANIFEST,
  });
}

export function newsletterEdition04ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition04Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_04_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }

  const expectedFiles = NEWSLETTER_EDITION_04_ASSET_MANIFEST.map((asset) => asset.file);
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== [...expectedFiles].sort()[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_04_ASSET_MANIFEST) {
    const asset = source.assets[expected.file];
    if (
      !asset ||
      asset.byteLength !== expected.bytes ||
      expected.bytes > 300_000 ||
      sha256(asset) !== expected.sha256
    ) {
      fail("asset_digest_mismatch");
    }
  }
}

export function validateEdition04UnsubscribeUrl(value: string): string {
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
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/newsletter/unsubscribe" ||
    parsed.hash ||
    entries.length !== 1 ||
    entries[0]?.[0] !== "token" ||
    !isValidNewsletterActionTokenShape(entries[0]?.[1] ?? "")
  ) {
    fail("unsubscribe_url_invalid");
  }
  return parsed.toString();
}

export function validateEdition04Template(
  source: NewsletterEdition04Source,
): NewsletterEdition04TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 04") ||
    !source.html.includes(NEWSLETTER_EDITION_04_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_04_PREHEADER)
  ) {
    fail("template_unexpected");
  }
  if (
    CORRUPT_TEXT_MARKERS.some(
      (marker) => source.html.includes(marker) || source.text.includes(marker),
    )
  ) {
    fail("template_encoding_invalid");
  }
  const imageSources = [
    ...source.html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),
  ].map((match) => match[1] ?? "");
  const links = [...source.html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].map(
    (match) => match[1] ?? "",
  );
  if (
    imageSources.length !== EXPECTED_IMAGE_COUNT ||
    new Set(imageSources).size !== EXPECTED_IMAGE_COUNT ||
    imageSources.some((imageSource) => !imageSource.startsWith(ASSET_ORIGIN)) ||
    links.length !== EXPECTED_BASE_LINK_COUNT ||
    /(?:\/_next\/image|localhost|data:|blob:)/i.test(source.html)
  ) {
    fail("template_assets_or_links_invalid");
  }

  const summary: NewsletterEdition04TemplateSummary = {
    imageCount: imageSources.length,
    linkCount: links.length,
    htmlCampaignCount: countOccurrences(source.html, UTM_CAMPAIGN_MARKER),
    htmlUnsubscribePlaceholderCount: countOccurrences(
      source.html,
      UNSUBSCRIBE_PLACEHOLDER,
    ),
    textUnsubscribePlaceholderCount: countOccurrences(
      source.text,
      UNSUBSCRIBE_PLACEHOLDER,
    ),
    htmlTerritorialPlaceholderCount: countOccurrences(
      source.html,
      TERRITORIAL_PLACEHOLDER,
    ),
    textTerritorialPlaceholderCount: countOccurrences(
      source.text,
      TERRITORIAL_PLACEHOLDER,
    ),
    assetCount: NEWSLETTER_EDITION_04_ASSET_MANIFEST.length,
  };
  if (
    summary.htmlCampaignCount !== EXPECTED_BASE_UTM_COUNT ||
    summary.htmlUnsubscribePlaceholderCount !== 1 ||
    summary.textUnsubscribePlaceholderCount !== 1 ||
    summary.htmlTerritorialPlaceholderCount !== 1 ||
    summary.textTerritorialPlaceholderCount !== 1
  ) {
    fail("template_placeholders_invalid");
  }
  if (
    /(?:recipient|subscriber|delivery)[_-]?id|open[_-]?id|click[_-]?id|tracking[_-]?pixel/i.test(
      source.html,
    ) ||
    /<img\b[^>]*(?:width=["']1["'][^>]*height=["']1["']|height=["']1["'][^>]*width=["']1["'])/i.test(
      source.html,
    )
  ) {
    fail("individual_tracking_detected");
  }
  return summary;
}

export function validateEdition04SourceIntegrity(
  source: NewsletterEdition04Source,
): NewsletterEdition04TemplateSummary {
  if (
    sha256(canonicalizeEdition04Text(source.html)) !==
      NEWSLETTER_EDITION_04_HTML_SHA256 ||
    sha256(canonicalizeEdition04Text(source.text)) !==
      NEWSLETTER_EDITION_04_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition04ContentManifestDigest() !==
    NEWSLETTER_EDITION_04_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition04Template(source);
}

function territorialHtml(_variant: NewsletterEdition04ContentVariant): string {
  void _variant;
  return "";
}

function territorialText(_variant: NewsletterEdition04ContentVariant): string {
  void _variant;
  return "";
}

export function prepareEdition04Content(
  source: NewsletterEdition04Source,
  variant: NewsletterEdition04ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition04PreparedContent {
  const summary = validateEdition04SourceIntegrity(source);
  if (!["national", "madrid", "a-coruna", "barcelona"].includes(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition04UnsubscribeUrl(unsubscribeUrl);
  const html = source.html
    .replace(TERRITORIAL_PLACEHOLDER, territorialHtml(variant))
    .replace(UNSUBSCRIBE_PLACEHOLDER, validatedUnsubscribeUrl);
  const text = source.text
    .replace(TERRITORIAL_PLACEHOLDER, territorialText(variant))
    .replace(UNSUBSCRIBE_PLACEHOLDER, validatedUnsubscribeUrl);
  if (
    html.includes(TERRITORIAL_PLACEHOLDER) ||
    text.includes(TERRITORIAL_PLACEHOLDER) ||
    html.includes(UNSUBSCRIBE_PLACEHOLDER) ||
    text.includes(UNSUBSCRIBE_PLACEHOLDER)
  ) {
    fail("placeholder_replacement_failed");
  }
  return { ...summary, html, text, variant };
}

export function prepareEdition04PreviewContent(
  source: NewsletterEdition04Source,
  variant: NewsletterEdition04ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition04PreparedContent {
  const prepared = prepareEdition04Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(
    ASSET_ORIGIN,
    LOCAL_PREVIEW_ASSET_PREFIX,
  );
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !==
      EXPECTED_IMAGE_COUNT
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
