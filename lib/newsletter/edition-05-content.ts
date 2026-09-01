import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_05_CAMPAIGN_KEY =
  "agenda_motor_2026_09_03";
export const NEWSLETTER_EDITION_05_SUBJECT =
  "Cheste, Tenerife y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_05_PREHEADER =
  "MotoJunior en Cheste, rally raid, Tenerife y la primera F1 de MADRING ya en el horizonte.";
export const NEWSLETTER_EDITION_05_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_05_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_05_HTML_SHA256 =
  "94bd543ab743265ca3f9d4a47f922e1a1f30e35ca6c3111cd08fe6e65f8897c7";
export const NEWSLETTER_EDITION_05_TEXT_SHA256 =
  "02b1f7912cddae76418a4b44d7ac9a45d70f25a5798c1ea03a19cc477287d587";
export const NEWSLETTER_EDITION_05_CONTENT_MANIFEST_SHA256 =
  "923b13b5b485d9a5549217c181a8b2899c7357ab6772ac089e2325970224a5d1";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-09-03/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_09_03";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\ufffd"] as const;

export type NewsletterEdition05ContentVariant =
  | "national"
  | "madrid"
  | "a-coruna"
  | "barcelona";

export type NewsletterEdition05AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition05Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition05TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition05PreparedContent =
  NewsletterEdition05TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition05ContentVariant;
  };

export const NEWSLETTER_EDITION_05_ASSET_MANIFEST: readonly NewsletterEdition05AssetManifestEntry[] = [
  {
    file: "01-fim-motojunior-cheste-hero.webp",
    width: 1200,
    height: 675,
    bytes: 88860,
    sha256: "268f1b5ff0bb4492878a4a59c8765e0c8993d3801124b142a96c6320e3251c42",
  },
  {
    file: "02-cierzo-rallye-ejercito-tierra.webp",
    width: 800,
    height: 500,
    bytes: 129070,
    sha256: "120fd38009072d4036df5a1b39989bdbcfd6d2b90fc3ac2dcac2ce1680b973dd",
  },
  {
    file: "03-rallye-orvecame-isla-tenerife.webp",
    width: 800,
    height: 500,
    bytes: 74086,
    sha256: "770352b4485404d3e8b2a07611cfe62be0295eeaeb4568c096f98039efdeb590",
  },
  {
    file: "04-race-monteblanco.webp",
    width: 800,
    height: 500,
    bytes: 81120,
    sha256: "75a2e814327404f567c4ccac55d16de1a1412738f4bd4327cc5cf4df9f863968",
  },
  {
    file: "05-f1-madring.webp",
    width: 800,
    height: 500,
    bytes: 71110,
    sha256: "b81deb9baa549ec13fd4e45087b401aed177f70ec426b9a07e89665c4c43d55e",
  },
  {
    file: "eventomotor-header.png",
    width: 1240,
    height: 200,
    bytes: 37943,
    sha256: "fb18ea36f163b24e10930c55b54662b40c1f509f195c1c9a5857a441c29386a9",
  },
  {
    file: "eventomotor-logo.png",
    width: 520,
    height: 56,
    bytes: 26745,
    sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc",
  },
];

export class NewsletterEdition05ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 05 content blocked: ${code}.`);
    this.name = "NewsletterEdition05ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition05ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition05Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_05_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_05_SUBJECT,
    preheader: NEWSLETTER_EDITION_05_PREHEADER,
    variantMap: {
      national: null,
      madrid: null,
      "a-coruna": null,
      barcelona: null,
    },
    assets: NEWSLETTER_EDITION_05_ASSET_MANIFEST,
  });
}

export function newsletterEdition05ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition05Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_05_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }

  const expectedFiles = NEWSLETTER_EDITION_05_ASSET_MANIFEST.map((asset) => asset.file);
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== [...expectedFiles].sort()[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_05_ASSET_MANIFEST) {
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

export function validateEdition05UnsubscribeUrl(value: string): string {
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

export function validateEdition05Template(
  source: NewsletterEdition05Source,
): NewsletterEdition05TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 05") ||
    !source.html.includes(NEWSLETTER_EDITION_05_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_05_PREHEADER)
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

  const summary: NewsletterEdition05TemplateSummary = {
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
    assetCount: NEWSLETTER_EDITION_05_ASSET_MANIFEST.length,
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

export function validateEdition05SourceIntegrity(
  source: NewsletterEdition05Source,
): NewsletterEdition05TemplateSummary {
  if (
    sha256(canonicalizeEdition05Text(source.html)) !==
      NEWSLETTER_EDITION_05_HTML_SHA256 ||
    sha256(canonicalizeEdition05Text(source.text)) !==
      NEWSLETTER_EDITION_05_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition05ContentManifestDigest() !==
    NEWSLETTER_EDITION_05_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition05Template(source);
}

function territorialHtml(_variant: NewsletterEdition05ContentVariant): string {
  void _variant;
  return "";
}

function territorialText(_variant: NewsletterEdition05ContentVariant): string {
  void _variant;
  return "";
}

export function prepareEdition05Content(
  source: NewsletterEdition05Source,
  variant: NewsletterEdition05ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition05PreparedContent {
  const summary = validateEdition05SourceIntegrity(source);
  if (!["national", "madrid", "a-coruna", "barcelona"].includes(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition05UnsubscribeUrl(unsubscribeUrl);
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

export function prepareEdition05PreviewContent(
  source: NewsletterEdition05Source,
  variant: NewsletterEdition05ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition05PreparedContent {
  const prepared = prepareEdition05Content(source, variant, unsubscribeUrl);
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
