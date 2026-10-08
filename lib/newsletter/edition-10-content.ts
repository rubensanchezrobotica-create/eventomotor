import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_10_CAMPAIGN_KEY = "agenda_motor_2026_10_08";
export const NEWSLETTER_EDITION_10_SUBJECT =
  "Navarra, Mollerussa y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_10_PREHEADER =
  "F4 en Navarra, Europeo de Autocross, EcoRally en Canarias y mototurismo en Ávila.";
export const NEWSLETTER_EDITION_10_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_10_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_10_HTML_SHA256 =
  "5311980ff79ce9a02577ab6322bf52738848564bfe50d14a8d76c686a96767b0";
export const NEWSLETTER_EDITION_10_TEXT_SHA256 =
  "0f43f8d40078cb4c352ba739c0f1326c5cbf2aae741f7a89a98b7bae841d4639";
export const NEWSLETTER_EDITION_10_CONTENT_MANIFEST_SHA256 =
  "5ba42d26aa17c46480a37c8df2d839d885df6c7b15d956887efdb8734b67f76b";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-10-08/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_10_08";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["Ã", "Â", "â€", "�"] as const;

export type NewsletterEdition10ContentVariant = "national" | "madrid";

export type NewsletterEdition10TerritorialRegionSlug = "comunidad-de-madrid";

type NewsletterEdition10TerritorialModule = {
  variant: Exclude<NewsletterEdition10ContentVariant, "national">;
  title: string;
  meta: string;
  paragraphs: readonly string[];
  cta: string;
  url: string;
  image: string;
  imageAlt: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_10_TERRITORIAL_MODULES: Readonly<
  Record<NewsletterEdition10TerritorialRegionSlug, NewsletterEdition10TerritorialModule>
> = {
  "comunidad-de-madrid": {
    variant: "madrid",
    title: "II Rallye Comunidad de Madrid · El Molar",
    meta: "9–10 octubre · El Molar, Madrid",
    paragraphs: [
      "Madrid también tiene cita propia este fin de semana.",
      "El II Rallye Comunidad de Madrid se celebra entre viernes y sábado con El Molar como referencia, una alternativa muy cercana para quienes quieran sumar un plan de rally sin salir de la Comunidad. La Federación Madrileña mantiene oficialmente la prueba los días 9 y 10 de octubre.",
    ],
    cta: "Ver Rallye Comunidad de Madrid",
    url: "https://www.eventomotor.com/evento/ii-rallye-comunidad-madrid-el-molar-2026-10-10",
    image: "06-rallye-comunidad-madrid-el-molar.webp",
    imageAlt: "Imagen representativa de rally para la cita de El Molar",
    utmContent: "rallye_comunidad_madrid_el_molar",
  },
};

const TERRITORIAL_MODULE_BY_VARIANT = new Map<
  NewsletterEdition10ContentVariant,
  NewsletterEdition10TerritorialModule
>(
  Object.values(NEWSLETTER_EDITION_10_TERRITORIAL_MODULES).map((territorialModule) => [
    territorialModule.variant,
    territorialModule,
  ]),
);

export function newsletterEdition10ContentVariantForRegion(
  regionSlug: string | null | undefined,
): NewsletterEdition10ContentVariant {
  if (!regionSlug) return "national";
  const territorialModule = NEWSLETTER_EDITION_10_TERRITORIAL_MODULES[
    regionSlug as NewsletterEdition10TerritorialRegionSlug
  ];
  return territorialModule?.variant ?? "national";
}

export type NewsletterEdition10AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition10Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition10TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition10PreparedContent =
  NewsletterEdition10TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition10ContentVariant;
  };

export const NEWSLETTER_EDITION_10_ASSET_MANIFEST: readonly NewsletterEdition10AssetManifestEntry[] = [
  { file: "01-racing-weekend-navarra-hero.webp", width: 1200, height: 675, bytes: 106380, sha256: "1280fcb1ea6454f314aa8395f3c12038f5a86d64d58e9da4bc9831e4e3fb7154" },
  { file: "02-autocross-cross-car-mollerussa.webp", width: 800, height: 500, bytes: 112858, sha256: "663a7b260851521611b8bb9b8c852425911096cfce13ac02003b35436330f367" },
  { file: "03-ecorally-canarias.webp", width: 800, height: 500, bytes: 66396, sha256: "f3991425b027c81358249d5c94f6da3a091a92531530867802b41a8e3c25c04e" },
  { file: "04-mototurismo-avila.webp", width: 800, height: 500, bytes: 74500, sha256: "fa16c6da26b12e7ebc0a9d3f769b7c9ee9f90b932f32c3526c7b1f5f395fc713" },
  { file: "05-rallyracc-catalunya-costa-daurada.webp", width: 800, height: 500, bytes: 88288, sha256: "124d73890f96ba0fd7f49a7089ae8ec867aa5d6c4a88241385df59917cda975f" },
  { file: "06-rallye-comunidad-madrid-el-molar.webp", width: 800, height: 500, bytes: 80522, sha256: "57db954bcfab58bbf9c939c87dc7bc2b690fdbdb8c48b39dba68a195c5f0cb4d" },
  { file: "eventomotor-header.png", width: 1240, height: 200, bytes: 37567, sha256: "d5ffec2aa87e76eb0fb2219851edcb657f4647e09b3f3d0b969cf32ea953dd79" },
  { file: "eventomotor-logo.png", width: 520, height: 56, bytes: 26745, sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc" },
];

export class NewsletterEdition10ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 10 content blocked: ${code}.`);
    this.name = "NewsletterEdition10ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition10ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition10Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_10_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_10_SUBJECT,
    preheader: NEWSLETTER_EDITION_10_PREHEADER,
    variantMap: {
      national: null,
      "comunidad-de-madrid": "madrid",
      cataluna: null,
      "comunidad-valenciana": null,
      andalucia: null,
      galicia: null,
      "sin-region": null,
      unknown: null,
    },
    assets: NEWSLETTER_EDITION_10_ASSET_MANIFEST,
  });
}

export function newsletterEdition10ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition10Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_10_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }
  const expectedFiles = NEWSLETTER_EDITION_10_ASSET_MANIFEST.map((asset) => asset.file).sort();
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_10_ASSET_MANIFEST) {
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

export function validateEdition10UnsubscribeUrl(value: string): string {
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

export function validateEdition10Template(
  source: NewsletterEdition10Source,
): NewsletterEdition10TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 10") ||
    !source.html.includes(NEWSLETTER_EDITION_10_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_10_PREHEADER)
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
  const summary: NewsletterEdition10TemplateSummary = {
    imageCount: imageSources.length,
    linkCount: links.length,
    htmlCampaignCount: countOccurrences(source.html, UTM_CAMPAIGN_MARKER),
    htmlUnsubscribePlaceholderCount: countOccurrences(source.html, UNSUBSCRIBE_PLACEHOLDER),
    textUnsubscribePlaceholderCount: countOccurrences(source.text, UNSUBSCRIBE_PLACEHOLDER),
    htmlTerritorialPlaceholderCount: countOccurrences(source.html, TERRITORIAL_PLACEHOLDER),
    textTerritorialPlaceholderCount: countOccurrences(source.text, TERRITORIAL_PLACEHOLDER),
    assetCount: NEWSLETTER_EDITION_10_ASSET_MANIFEST.length,
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

export function validateEdition10SourceIntegrity(
  source: NewsletterEdition10Source,
): NewsletterEdition10TemplateSummary {
  if (
    sha256(canonicalizeEdition10Text(source.html)) !== NEWSLETTER_EDITION_10_HTML_SHA256 ||
    sha256(canonicalizeEdition10Text(source.text)) !== NEWSLETTER_EDITION_10_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition10ContentManifestDigest() !==
    NEWSLETTER_EDITION_10_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition10Template(source);
}

function trackedUrl(territorialModule: NewsletterEdition10TerritorialModule): string {
  const url = new URL(territorialModule.url);
  url.searchParams.set("utm_source", "la_agenda_motor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", NEWSLETTER_EDITION_10_CAMPAIGN_KEY);
  url.searchParams.set("utm_content", territorialModule.utmContent);
  return url.toString();
}

function territorialHtml(variant: NewsletterEdition10ContentVariant): string {
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

function territorialText(variant: NewsletterEdition10ContentVariant): string {
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

export function prepareEdition10Content(
  source: NewsletterEdition10Source,
  variant: NewsletterEdition10ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition10PreparedContent {
  const summary = validateEdition10SourceIntegrity(source);
  if (variant !== "national" && !TERRITORIAL_MODULE_BY_VARIANT.has(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition10UnsubscribeUrl(unsubscribeUrl);
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
  const territorialTitles = Object.values(NEWSLETTER_EDITION_10_TERRITORIAL_MODULES).map(
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

export function prepareEdition10PreviewContent(
  source: NewsletterEdition10Source,
  variant: NewsletterEdition10ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition10PreparedContent {
  const prepared = prepareEdition10Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(ASSET_ORIGIN, LOCAL_PREVIEW_ASSET_PREFIX);
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !== prepared.imageCount
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
