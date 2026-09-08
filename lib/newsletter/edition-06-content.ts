import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_06_CAMPAIGN_KEY =
  "agenda_motor_2026_09_10";
export const NEWSLETTER_EDITION_06_SUBJECT =
  "MADRING, Aragón y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_06_PREHEADER =
  "F1 en Madrid, Baja Aragón, Big Twin y trial para un fin de semana muy cargado.";
export const NEWSLETTER_EDITION_06_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_06_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_06_HTML_SHA256 =
  "36c1b7779cd5636dd4a2059346da525488d28999f6c11d8d07d03fb0d8b1eadd";
export const NEWSLETTER_EDITION_06_TEXT_SHA256 =
  "1356a169064999b3b2244598533195ecb4c048d475998d9157b53218a45211b0";
export const NEWSLETTER_EDITION_06_CONTENT_MANIFEST_SHA256 =
  "a7600899553a318703b1a84f10f43c20ce0910a7f334a7f48cf9428e555eb211";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-09-10/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_09_10";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\ufffd"] as const;

export type NewsletterEdition06ContentVariant =
  | "national"
  | "madrid"
  | "a-coruna"
  | "barcelona";

export type NewsletterEdition06AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition06Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition06TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition06PreparedContent =
  NewsletterEdition06TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition06ContentVariant;
  };

export const NEWSLETTER_EDITION_06_ASSET_MANIFEST: readonly NewsletterEdition06AssetManifestEntry[] = [
  {
    file: "01-f1-madring-hero.webp",
    width: 1200,
    height: 675,
    bytes: 139148,
    sha256: "843a4b194507bd178e6fcaa4ddc6e0fe2f24fe5d2a2bb322915dcc20aae294f2",
  },
  {
    file: "02-baja-espana-aragon.webp",
    width: 800,
    height: 500,
    bytes: 130994,
    sha256: "86d40738e63f3530d1b694457417b881535384084f9bc7a0752f95680bcfb854",
  },
  {
    file: "03-big-twin-espana.webp",
    width: 800,
    height: 500,
    bytes: 155400,
    sha256: "0ddaff1246c3b8aecb573664538fef83489d33f94f15abde5210e1f4d504da85",
  },
  {
    file: "04-trial-vimianzo.webp",
    width: 800,
    height: 500,
    bytes: 175726,
    sha256: "ab456d2d7c34a35e2c12511bb32b50508ad34865eb6c39149699966e91400513",
  },
  {
    file: "05-eco-rally-a-coruna.webp",
    width: 800,
    height: 500,
    bytes: 105964,
    sha256: "47ee79ba144dddee5f9647f1a088dfcbc5677bdc7afa78d56e72643633cd6b66",
  },
  {
    file: "eventomotor-header.png",
    width: 1240,
    height: 200,
    bytes: 38233,
    sha256: "4163658063440544171d358a78b37ea0a559e2a7423d4aa9ea8ebce31d69b6bf",
  },
  {
    file: "eventomotor-logo.png",
    width: 520,
    height: 56,
    bytes: 26745,
    sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc",
  },
];

export class NewsletterEdition06ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 06 content blocked: ${code}.`);
    this.name = "NewsletterEdition06ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition06ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition06Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_06_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_06_SUBJECT,
    preheader: NEWSLETTER_EDITION_06_PREHEADER,
    variantMap: {
      national: null,
      madrid: null,
      "a-coruna": null,
      barcelona: null,
    },
    assets: NEWSLETTER_EDITION_06_ASSET_MANIFEST,
  });
}

export function newsletterEdition06ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition06Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_06_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }

  const expectedFiles = NEWSLETTER_EDITION_06_ASSET_MANIFEST.map((asset) => asset.file);
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== [...expectedFiles].sort()[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_06_ASSET_MANIFEST) {
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

export function validateEdition06UnsubscribeUrl(value: string): string {
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

export function validateEdition06Template(
  source: NewsletterEdition06Source,
): NewsletterEdition06TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 06") ||
    !source.html.includes(NEWSLETTER_EDITION_06_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_06_PREHEADER)
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

  const summary: NewsletterEdition06TemplateSummary = {
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
    assetCount: NEWSLETTER_EDITION_06_ASSET_MANIFEST.length,
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

export function validateEdition06SourceIntegrity(
  source: NewsletterEdition06Source,
): NewsletterEdition06TemplateSummary {
  if (
    sha256(canonicalizeEdition06Text(source.html)) !==
      NEWSLETTER_EDITION_06_HTML_SHA256 ||
    sha256(canonicalizeEdition06Text(source.text)) !==
      NEWSLETTER_EDITION_06_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition06ContentManifestDigest() !==
    NEWSLETTER_EDITION_06_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition06Template(source);
}

function territorialHtml(_variant: NewsletterEdition06ContentVariant): string {
  void _variant;
  return "";
}

function territorialText(_variant: NewsletterEdition06ContentVariant): string {
  void _variant;
  return "";
}

export function prepareEdition06Content(
  source: NewsletterEdition06Source,
  variant: NewsletterEdition06ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition06PreparedContent {
  const summary = validateEdition06SourceIntegrity(source);
  if (!["national", "madrid", "a-coruna", "barcelona"].includes(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition06UnsubscribeUrl(unsubscribeUrl);
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

export function prepareEdition06PreviewContent(
  source: NewsletterEdition06Source,
  variant: NewsletterEdition06ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition06PreparedContent {
  const prepared = prepareEdition06Content(source, variant, unsubscribeUrl);
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
