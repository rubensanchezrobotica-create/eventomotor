import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_09_CAMPAIGN_KEY = "agenda_motor_2026_10_01";
export const NEWSLETTER_EDITION_09_SUBJECT =
  "Barcelona, Jarama y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_09_PREHEADER =
  "GT3 en Montmeló, camiones en Jarama, históricos en A Coruña y karting internacional en Valencia.";
export const NEWSLETTER_EDITION_09_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_09_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_09_HTML_SHA256 =
  "ba84332139cfeebd9e35e68569127f519c6614a3629375ccf74970614df58289";
export const NEWSLETTER_EDITION_09_TEXT_SHA256 =
  "7b0684d2b7d4bde7a1e93cb13a47af94db44882478d8b7f3915b586cedae1698";
export const NEWSLETTER_EDITION_09_CONTENT_MANIFEST_SHA256 =
  "009e7944968617a66e6d6601e8199a0f2a86555c3f042322ed782def52a7f58d";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-10-01/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_10_01";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["Ã", "Â", "â€", "�"] as const;

export type NewsletterEdition09ContentVariant = "national";

export type NewsletterEdition09TerritorialRegionSlug = string;

type NewsletterEdition09TerritorialModule = {
  variant: NewsletterEdition09ContentVariant;
  title: string;
  meta: string;
  paragraphs: readonly string[];
  cta: string;
  url: string;
  image: string;
  imageAlt: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_09_TERRITORIAL_MODULES: Readonly<
  Record<NewsletterEdition09TerritorialRegionSlug, NewsletterEdition09TerritorialModule>
> = {};

const TERRITORIAL_MODULE_BY_VARIANT = new Map<
  NewsletterEdition09ContentVariant,
  NewsletterEdition09TerritorialModule
>(
  Object.values(NEWSLETTER_EDITION_09_TERRITORIAL_MODULES).map((territorialModule) => [
    territorialModule.variant,
    territorialModule,
  ]),
);

export function newsletterEdition09ContentVariantForRegion(
  regionSlug: string | null | undefined,
): NewsletterEdition09ContentVariant {
  if (!regionSlug) return "national";
  const territorialModule = NEWSLETTER_EDITION_09_TERRITORIAL_MODULES[
    regionSlug as NewsletterEdition09TerritorialRegionSlug
  ];
  return territorialModule?.variant ?? "national";
}

export type NewsletterEdition09AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition09Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition09TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition09PreparedContent =
  NewsletterEdition09TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition09ContentVariant;
  };

export const NEWSLETTER_EDITION_09_ASSET_MANIFEST: readonly NewsletterEdition09AssetManifestEntry[] = [
  { file: "01-festival-velocidad-barcelona-hero.webp", width: 1200, height: 675, bytes: 145516, sha256: "cc163aa67cd4ea37f9e61f82822e4a419254ed82e31b61e420695a5a458d77b6" },
  { file: "02-gran-premio-camion-jarama.webp", width: 800, height: 500, bytes: 75276, sha256: "454788ce9bf61b685776b7727027e87ae122f419020ebace63bb74f371bd18c0" },
  { file: "03-rallye-rias-altas-historico.webp", width: 800, height: 500, bytes: 87012, sha256: "d659da33afa97d8f2e3b69593dd20f19a7ef199baa1841cbb9e4c866cec1aa18" },
  { file: "04-t4-nations-cup-valencia.webp", width: 800, height: 500, bytes: 74790, sha256: "127a7c78e912fb7c27735b1f8d287a10fbc9e9413e18da33e8040c88a4eb5dcd" },
  { file: "05-f4-tcr-navarra.webp", width: 800, height: 500, bytes: 73736, sha256: "7a12032c7b0c82c020ba6f7737499bd51e6c89b66128dbad5e0259e46a2566f6" },
  { file: "eventomotor-header.png", width: 1240, height: 200, bytes: 37841, sha256: "a3d488ec458d5340c096c29834811fdfd2f51f95f1ebd641a1355bd22f7bb785" },
  { file: "eventomotor-logo.png", width: 520, height: 56, bytes: 26745, sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc" },
];

export class NewsletterEdition09ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 09 content blocked: ${code}.`);
    this.name = "NewsletterEdition09ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition09ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition09Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_09_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_09_SUBJECT,
    preheader: NEWSLETTER_EDITION_09_PREHEADER,
    variantMap: {
      national: null,
      "comunidad-de-madrid": null,
      cataluna: null,
      "comunidad-valenciana": null,
      andalucia: null,
      galicia: null,
      "sin-region": null,
      unknown: null,
    },
    assets: NEWSLETTER_EDITION_09_ASSET_MANIFEST,
  });
}

export function newsletterEdition09ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition09Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_09_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }
  const expectedFiles = NEWSLETTER_EDITION_09_ASSET_MANIFEST.map((asset) => asset.file).sort();
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_09_ASSET_MANIFEST) {
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

export function validateEdition09UnsubscribeUrl(value: string): string {
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

export function validateEdition09Template(
  source: NewsletterEdition09Source,
): NewsletterEdition09TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 09") ||
    !source.html.includes(NEWSLETTER_EDITION_09_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_09_PREHEADER)
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
  const links = [
    ...source.html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi),
  ].map((match) => match[1] ?? "");
  if (
    imageSources.length !== EXPECTED_IMAGE_COUNT ||
    new Set(imageSources).size !== EXPECTED_IMAGE_COUNT ||
    imageSources.some((imageSource) => !imageSource.startsWith(ASSET_ORIGIN)) ||
    links.length !== EXPECTED_BASE_LINK_COUNT ||
    /(?:\/_next\/image|localhost|data:|blob:)/i.test(source.html)
  ) {
    fail("template_assets_or_links_invalid");
  }
  const summary: NewsletterEdition09TemplateSummary = {
    imageCount: imageSources.length,
    linkCount: links.length,
    htmlCampaignCount: countOccurrences(source.html, UTM_CAMPAIGN_MARKER),
    htmlUnsubscribePlaceholderCount: countOccurrences(source.html, UNSUBSCRIBE_PLACEHOLDER),
    textUnsubscribePlaceholderCount: countOccurrences(source.text, UNSUBSCRIBE_PLACEHOLDER),
    htmlTerritorialPlaceholderCount: countOccurrences(source.html, TERRITORIAL_PLACEHOLDER),
    textTerritorialPlaceholderCount: countOccurrences(source.text, TERRITORIAL_PLACEHOLDER),
    assetCount: NEWSLETTER_EDITION_09_ASSET_MANIFEST.length,
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
    /(?:recipient|subscriber|delivery)[_-]?id|open[_-]?id|click[_-]?id|tracking[_-]?pixel/i.test(source.html) ||
    /<img\b[^>]*(?:width=["']1["'][^>]*height=["']1["']|height=["']1["'][^>]*width=["']1["'])/i.test(source.html)
  ) {
    fail("individual_tracking_detected");
  }
  return summary;
}

export function validateEdition09SourceIntegrity(
  source: NewsletterEdition09Source,
): NewsletterEdition09TemplateSummary {
  if (
    sha256(canonicalizeEdition09Text(source.html)) !== NEWSLETTER_EDITION_09_HTML_SHA256 ||
    sha256(canonicalizeEdition09Text(source.text)) !== NEWSLETTER_EDITION_09_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition09ContentManifestDigest() !==
    NEWSLETTER_EDITION_09_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition09Template(source);
}

function trackedUrl(territorialModule: NewsletterEdition09TerritorialModule): string {
  const url = new URL(territorialModule.url);
  url.searchParams.set("utm_source", "la_agenda_motor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", NEWSLETTER_EDITION_09_CAMPAIGN_KEY);
  url.searchParams.set("utm_content", territorialModule.utmContent);
  return url.toString();
}

function territorialHtml(variant: NewsletterEdition09ContentVariant): string {
  const territorialModule = TERRITORIAL_MODULE_BY_VARIANT.get(variant);
  if (!territorialModule) return "";
  const url = trackedUrl(territorialModule).replaceAll("&", "&amp;");
  const paragraphs = territorialModule.paragraphs
    .map(
      (paragraph, index) =>
        `<p style="margin:0 0 ${index === territorialModule.paragraphs.length - 1 ? "12" : "8"}px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#4b5563;">${paragraph}</p>`,
    )
    .join("\n                    ");
  const [dates, ...locationParts] = territorialModule.meta.split(" · ");
  return `          <tr>
            <td class="mobile-pad" style="padding:4px 28px 22px;">
              <div style="margin:0 0 11px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.2px;color:#ff5a0a;text-transform:uppercase;">Lo próximo cerca de ti</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f3f5" style="border:1px solid #c4ccd5;border-radius:14px;background-color:#f1f3f5;overflow:hidden;">
                <tr>
                  <td class="stack-column" width="42%" valign="top" style="padding:0;">
                    <a href="${url}" style="text-decoration:none;">
                      <img src="${ASSET_ORIGIN}${territorialModule.image}" width="236" alt="${territorialModule.imageAlt}" style="display:block;width:100%;max-width:236px;height:auto;border:0;">
                    </a>
                  </td>
                  <td class="stack-column" width="58%" valign="middle" style="padding:18px;box-sizing:border-box;overflow-wrap:break-word;">
                    <h3 style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:25px;color:#111827;font-weight:800;">${territorialModule.title}</h3>
                    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#4b5563;"><strong style="color:#111827;">${dates}</strong> · ${locationParts.join(" · ")}</p>
                    ${paragraphs}
                    <a href="${url}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#111827;text-decoration:none;">${territorialModule.cta} <span style="color:#ff5a0a;">→</span></a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
`;
}

function territorialText(variant: NewsletterEdition09ContentVariant): string {
  const territorialModule = TERRITORIAL_MODULE_BY_VARIANT.get(variant);
  if (!territorialModule) return "";
  return `LO PRÓXIMO CERCA DE TI
${territorialModule.title}
${territorialModule.meta}

${territorialModule.paragraphs.join("\n\n")}

${territorialModule.cta}:
${trackedUrl(territorialModule)}

`;
}

export function prepareEdition09Content(
  source: NewsletterEdition09Source,
  variant: NewsletterEdition09ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition09PreparedContent {
  const summary = validateEdition09SourceIntegrity(source);
  if (variant !== "national" && !TERRITORIAL_MODULE_BY_VARIANT.has(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition09UnsubscribeUrl(unsubscribeUrl);
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
  const territorialModule = TERRITORIAL_MODULE_BY_VARIANT.get(variant);
  const expectedImageCount = territorialModule ? EXPECTED_IMAGE_COUNT + 1 : EXPECTED_IMAGE_COUNT;
  const expectedLinkCount = territorialModule ? EXPECTED_BASE_LINK_COUNT + 2 : EXPECTED_BASE_LINK_COUNT;
  const expectedCampaignCount = territorialModule ? EXPECTED_BASE_UTM_COUNT + 2 : EXPECTED_BASE_UTM_COUNT;
  const renderedImages = [
    ...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),
  ].map((match) => match[1] ?? "");
  const renderedLinks = [
    ...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi),
  ];
  const territorialTitles = Object.values(NEWSLETTER_EDITION_09_TERRITORIAL_MODULES).map(
    (entry) => entry.title,
  );
  if (
    renderedImages.length !== expectedImageCount ||
    new Set(renderedImages).size !== expectedImageCount ||
    renderedLinks.length !== expectedLinkCount ||
    countOccurrences(html, UTM_CAMPAIGN_MARKER) !== expectedCampaignCount ||
    territorialTitles.some(
      (title) =>
        html.includes(title) !== (title === territorialModule?.title) ||
        text.includes(title) !== (title === territorialModule?.title),
    )
  ) {
    fail("variant_render_invalid");
  }
  return {
    ...summary,
    imageCount: expectedImageCount,
    linkCount: expectedLinkCount,
    htmlCampaignCount: expectedCampaignCount,
    html,
    text,
    variant,
  };
}

export function prepareEdition09PreviewContent(
  source: NewsletterEdition09Source,
  variant: NewsletterEdition09ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition09PreparedContent {
  const prepared = prepareEdition09Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(ASSET_ORIGIN, LOCAL_PREVIEW_ASSET_PREFIX);
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !== prepared.imageCount
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
