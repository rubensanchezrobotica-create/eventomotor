import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_12_CAMPAIGN_KEY = "agenda_motor_2026_10_22";
export const NEWSLETTER_EDITION_12_SUBJECT =
  "Barcelona cierra el GT Open: un fin de semana de finales";
export const NEWSLETTER_EDITION_12_PREHEADER =
  "GT Open en Montmeló, clásicos en MotorLand, rally en Valencia y motocross en Talavera.";
export const NEWSLETTER_EDITION_12_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_12_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_12_HTML_SHA256 =
  "4175a13778b08b86246013f20e069229dc78842db8a6dd6ac2e1f4a1292b7540";
export const NEWSLETTER_EDITION_12_TEXT_SHA256 =
  "77944105d13e2f7aec85242adbddb21d841878b2ec1230b0e14a4a2dfd7c795f";
export const NEWSLETTER_EDITION_12_CONTENT_MANIFEST_SHA256 =
  "f8505100a2f8d44fa5d4c35a8d69f6e11a59a24f0d3a0dd39c49392d58b6dd5c";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-10-22/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_10_22";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["Ã", "Â", "â€", "�"] as const;

export type NewsletterEdition12ContentVariant = "national" | "madrid";

export type NewsletterEdition12TerritorialRegionSlug = "comunidad-de-madrid";

type NewsletterEdition12TerritorialModule = {
  variant: Exclude<NewsletterEdition12ContentVariant, "national">;
  title: string;
  meta: string;
  paragraphs: readonly string[];
  cta: string;
  url: string;
  image: string;
  imageAlt: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_12_TERRITORIAL_MODULES: Readonly<
  Record<NewsletterEdition12TerritorialRegionSlug, NewsletterEdition12TerritorialModule>
> = {
  "comunidad-de-madrid": {
    variant: "madrid",
    title: "Campeonato RACE de Velocidad + GR Cup Spain",
    meta: "24 octubre · Circuito de Madrid Jarama – RACE",
    paragraphs: [
      "El Jarama también tiene una jornada importante de competición este sábado.",
      "El Campeonato RACE de Velocidad cierra su temporada con la Saxo Trophy, la GTI Trophy y el Campeonato RACE de Turismos. A ellas se suma la GR Cup Spain, que también llega al circuito madrileño para despedir su calendario 2026.",
      "Una jornada de carreras con distintas categorías, parrillas de turismos y varios campeonatos todavía por decidir.",
    ],
    cta: "Ver carreras en el Jarama",
    url: "https://www.jarama.org/competicion/crv",
    image: "06-jarama-race-gr-cup.webp",
    imageAlt: "Ilustración editorial de turismos de competición en circuito",
    utmContent: "jarama_race_gr_cup",
  },
};

const TERRITORIAL_MODULE_BY_VARIANT = new Map<
  NewsletterEdition12ContentVariant,
  NewsletterEdition12TerritorialModule
>(
  Object.values(NEWSLETTER_EDITION_12_TERRITORIAL_MODULES).map((territorialModule) => [
    territorialModule.variant,
    territorialModule,
  ]),
);

export function newsletterEdition12ContentVariantForRegion(
  regionSlug: string | null | undefined,
): NewsletterEdition12ContentVariant {
  if (!regionSlug) return "national";
  const territorialModule = NEWSLETTER_EDITION_12_TERRITORIAL_MODULES[
    regionSlug as NewsletterEdition12TerritorialRegionSlug
  ];
  return territorialModule?.variant ?? "national";
}

export type NewsletterEdition12AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition12Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition12TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition12PreparedContent =
  NewsletterEdition12TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition12ContentVariant;
  };

export const NEWSLETTER_EDITION_12_ASSET_MANIFEST: readonly NewsletterEdition12AssetManifestEntry[] = [
  { file: "01-gt-open-barcelona-hero.webp", width: 1200, height: 675, bytes: 135270, sha256: "661b06e49efaf918e793be7e2e41c9e4203f09b21ceaa2f5ced7b66ce870e2d6" },
  { file: "02-motorland-classic-festival.webp", width: 800, height: 500, bytes: 92258, sha256: "a42f452079ba788a2313eb4025995933e2759a3206f2afda325b2d5ef41b7e8a" },
  { file: "03-rallye-ciudad-de-valencia.webp", width: 800, height: 500, bytes: 163596, sha256: "9a7fd3f0d68c769ab5fd4edd70dfc5698adfae76a08ce98d47a4bdff5bd94f3b" },
  { file: "04-motocross-talavera.webp", width: 800, height: 500, bytes: 138780, sha256: "15f893863b2acc6131be05ba82a0dc1ba38cb084b3c5c8a4b489812f9369e9f1" },
  { file: "05-rally-costa-brava-historic.webp", width: 800, height: 500, bytes: 116186, sha256: "4749d0f0b08a360e24b68c147f33b8249926f51edc2a3f24258be0ee797d2d5c" },
  { file: "06-jarama-race-gr-cup.webp", width: 800, height: 500, bytes: 68560, sha256: "8bfc01502fa47e376b38926c0889db9f17f4926a074ba63aac91f78bbadc776a" },
  { file: "eventomotor-header.png", width: 1240, height: 200, bytes: 38368, sha256: "af7c97714b94fc40d1c1f0da092dbb61f158876d12afe06a9ceeb659ab775306" },
  { file: "eventomotor-logo.png", width: 520, height: 56, bytes: 26745, sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc" },
];

export class NewsletterEdition12ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 12 content blocked: ${code}.`);
    this.name = "NewsletterEdition12ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition12ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition12Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_12_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_12_SUBJECT,
    preheader: NEWSLETTER_EDITION_12_PREHEADER,
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
    assets: NEWSLETTER_EDITION_12_ASSET_MANIFEST,
  });
}

export function newsletterEdition12ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition12Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_12_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }
  const expectedFiles = NEWSLETTER_EDITION_12_ASSET_MANIFEST.map((asset) => asset.file).sort();
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_12_ASSET_MANIFEST) {
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

export function validateEdition12UnsubscribeUrl(value: string): string {
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

export function validateEdition12Template(
  source: NewsletterEdition12Source,
): NewsletterEdition12TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 12") ||
    !source.html.includes(NEWSLETTER_EDITION_12_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_12_PREHEADER)
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
  const summary: NewsletterEdition12TemplateSummary = {
    imageCount: imageSources.length,
    linkCount: links.length,
    htmlCampaignCount: countOccurrences(source.html, UTM_CAMPAIGN_MARKER),
    htmlUnsubscribePlaceholderCount: countOccurrences(source.html, UNSUBSCRIBE_PLACEHOLDER),
    textUnsubscribePlaceholderCount: countOccurrences(source.text, UNSUBSCRIBE_PLACEHOLDER),
    htmlTerritorialPlaceholderCount: countOccurrences(source.html, TERRITORIAL_PLACEHOLDER),
    textTerritorialPlaceholderCount: countOccurrences(source.text, TERRITORIAL_PLACEHOLDER),
    assetCount: NEWSLETTER_EDITION_12_ASSET_MANIFEST.length,
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

export function validateEdition12SourceIntegrity(
  source: NewsletterEdition12Source,
): NewsletterEdition12TemplateSummary {
  if (
    sha256(canonicalizeEdition12Text(source.html)) !== NEWSLETTER_EDITION_12_HTML_SHA256 ||
    sha256(canonicalizeEdition12Text(source.text)) !== NEWSLETTER_EDITION_12_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition12ContentManifestDigest() !==
    NEWSLETTER_EDITION_12_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition12Template(source);
}

function trackedUrl(territorialModule: NewsletterEdition12TerritorialModule): string {
  const url = new URL(territorialModule.url);
  url.searchParams.set("utm_source", "la_agenda_motor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", NEWSLETTER_EDITION_12_CAMPAIGN_KEY);
  url.searchParams.set("utm_content", territorialModule.utmContent);
  return url.toString();
}

function territorialHtml(variant: NewsletterEdition12ContentVariant): string {
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

function territorialText(variant: NewsletterEdition12ContentVariant): string {
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

export function prepareEdition12Content(
  source: NewsletterEdition12Source,
  variant: NewsletterEdition12ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition12PreparedContent {
  const summary = validateEdition12SourceIntegrity(source);
  if (variant !== "national" && !TERRITORIAL_MODULE_BY_VARIANT.has(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition12UnsubscribeUrl(unsubscribeUrl);
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
  const territorialTitles = Object.values(NEWSLETTER_EDITION_12_TERRITORIAL_MODULES).map(
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

export function prepareEdition12PreviewContent(
  source: NewsletterEdition12Source,
  variant: NewsletterEdition12ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition12PreparedContent {
  const prepared = prepareEdition12Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(ASSET_ORIGIN, LOCAL_PREVIEW_ASSET_PREFIX);
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !== prepared.imageCount
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
