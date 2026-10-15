import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_11_CAMPAIGN_KEY = "agenda_motor_2026_10_15";
export const NEWSLETTER_EDITION_11_SUBJECT =
  "Barcelona, Jerez y RallyRACC: fin de semana grande";
export const NEWSLETTER_EDITION_11_PREHEADER =
  "WEC en Montmeló, final de WorldSBK, RallyRACC y BMW Motorrad Days en Peñíscola.";
export const NEWSLETTER_EDITION_11_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_11_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_11_HTML_SHA256 =
  "ccb92ad28b8a98b1a19a335178542dbff6a62d741647b6aefaf7fe749ac3e2ff";
export const NEWSLETTER_EDITION_11_TEXT_SHA256 =
  "f61eeae201817f5d45f680e5c5369aefa4ebd71abec248f30db07da7d26a6e62";
export const NEWSLETTER_EDITION_11_CONTENT_MANIFEST_SHA256 =
  "3cf233c5960aa9e4f7dbd2bb5223ee6cdfaa1810ca19c5a3eaf45dcc5ddd01e3";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-10-15/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_10_15";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["Ã", "Â", "â€", "�"] as const;

export type NewsletterEdition11ContentVariant = "national" | "madrid";

export type NewsletterEdition11TerritorialRegionSlug = "comunidad-de-madrid";

type NewsletterEdition11TerritorialModule = {
  variant: Exclude<NewsletterEdition11ContentVariant, "national">;
  title: string;
  meta: string;
  paragraphs: readonly string[];
  cta: string;
  url: string;
  image: string;
  imageAlt: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_11_TERRITORIAL_MODULES: Readonly<
  Record<NewsletterEdition11TerritorialRegionSlug, NewsletterEdition11TerritorialModule>
> = {
  "comunidad-de-madrid": {
    variant: "madrid",
    title: "XXVII Jornada de Puertas Abiertas · Fundación RACE",
    meta: "17 octubre · Circuito de Madrid Jarama – RACE",
    paragraphs: [
      "El Jarama abre sus puertas este sábado a una parte enorme de la historia del automóvil.",
      "La Fundación RACE anuncia más de 850 vehículos clásicos e históricos y más de 40 clubes en una jornada que se desarrollará de 10:00 a 19:00. Entre ellos habrá cerca de 50 automóviles anteriores a 1930, además de diferentes grupos de clásicos recorriendo el circuito.",
      "Un plan especialmente difícil de igualar para quien tenga el Jarama cerca este fin de semana.",
    ],
    cta: "Ver Jornada de Puertas Abiertas",
    url: "https://www.eventomotor.com/evento/xxvii-jornada-puertas-abiertas-fundacion-race-2026-10-17",
    image: "06-jarama-clasicos-madrid.webp",
    imageAlt: "Vehículos clásicos en el Circuito de Madrid Jarama – RACE",
    utmContent: "jarama_puertas_abiertas",
  },
};

const TERRITORIAL_MODULE_BY_VARIANT = new Map<
  NewsletterEdition11ContentVariant,
  NewsletterEdition11TerritorialModule
>(
  Object.values(NEWSLETTER_EDITION_11_TERRITORIAL_MODULES).map((territorialModule) => [
    territorialModule.variant,
    territorialModule,
  ]),
);

export function newsletterEdition11ContentVariantForRegion(
  regionSlug: string | null | undefined,
): NewsletterEdition11ContentVariant {
  if (!regionSlug) return "national";
  const territorialModule = NEWSLETTER_EDITION_11_TERRITORIAL_MODULES[
    regionSlug as NewsletterEdition11TerritorialRegionSlug
  ];
  return territorialModule?.variant ?? "national";
}

export type NewsletterEdition11AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition11Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition11TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition11PreparedContent =
  NewsletterEdition11TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition11ContentVariant;
  };

export const NEWSLETTER_EDITION_11_ASSET_MANIFEST: readonly NewsletterEdition11AssetManifestEntry[] = [
  { file: "01-wec-barcelona-hero.webp", width: 1200, height: 675, bytes: 133058, sha256: "c49b2d529e8a5a52b07344ae6436ab7045780c18bf1b484081214eac029b6c2d" },
  { file: "02-worldsbk-jerez.webp", width: 800, height: 500, bytes: 57292, sha256: "ed8a40a47f3e49f26f350fbf956ad446adcd87606f3c1e7c6bf20e57b1348000" },
  { file: "03-rallyracc-catalunya-gr-yaris.webp", width: 800, height: 500, bytes: 105794, sha256: "ce69fe0f18588180aa124c5201069461a47fe5516e1a7341ad267def1dbfd91e" },
  { file: "04-bmw-motorrad-days-peniscola.webp", width: 800, height: 500, bytes: 75710, sha256: "409c3d88327bbb4179d2c1a3bdfea21219757aeb6fbc4575428673349e14f938" },
  { file: "05-motorland-classic-festival.webp", width: 800, height: 500, bytes: 64296, sha256: "24e23fa2ceb77b20a2f2c25423d0b2edd5b9567f25d48a50aa1bdefd3dd1a067" },
  { file: "06-jarama-clasicos-madrid.webp", width: 800, height: 500, bytes: 68466, sha256: "37c8ed1159f76b4f7853f62f395d4cdb939d2e7245b6e22c6569f325cb2ebf05" },
  { file: "eventomotor-header.png", width: 1240, height: 200, bytes: 37708, sha256: "59e491138251d2447933ceb838875a13b3c4522df43c8cbd6277836f9eae9bf9" },
  { file: "eventomotor-logo.png", width: 520, height: 56, bytes: 26745, sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc" },
];

export class NewsletterEdition11ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 11 content blocked: ${code}.`);
    this.name = "NewsletterEdition11ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition11ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition11Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_11_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_11_SUBJECT,
    preheader: NEWSLETTER_EDITION_11_PREHEADER,
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
    assets: NEWSLETTER_EDITION_11_ASSET_MANIFEST,
  });
}

export function newsletterEdition11ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition11Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_11_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }
  const expectedFiles = NEWSLETTER_EDITION_11_ASSET_MANIFEST.map((asset) => asset.file).sort();
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_11_ASSET_MANIFEST) {
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

export function validateEdition11UnsubscribeUrl(value: string): string {
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

export function validateEdition11Template(
  source: NewsletterEdition11Source,
): NewsletterEdition11TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 11") ||
    !source.html.includes(NEWSLETTER_EDITION_11_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_11_PREHEADER)
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
  const summary: NewsletterEdition11TemplateSummary = {
    imageCount: imageSources.length,
    linkCount: links.length,
    htmlCampaignCount: countOccurrences(source.html, UTM_CAMPAIGN_MARKER),
    htmlUnsubscribePlaceholderCount: countOccurrences(source.html, UNSUBSCRIBE_PLACEHOLDER),
    textUnsubscribePlaceholderCount: countOccurrences(source.text, UNSUBSCRIBE_PLACEHOLDER),
    htmlTerritorialPlaceholderCount: countOccurrences(source.html, TERRITORIAL_PLACEHOLDER),
    textTerritorialPlaceholderCount: countOccurrences(source.text, TERRITORIAL_PLACEHOLDER),
    assetCount: NEWSLETTER_EDITION_11_ASSET_MANIFEST.length,
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

export function validateEdition11SourceIntegrity(
  source: NewsletterEdition11Source,
): NewsletterEdition11TemplateSummary {
  if (
    sha256(canonicalizeEdition11Text(source.html)) !== NEWSLETTER_EDITION_11_HTML_SHA256 ||
    sha256(canonicalizeEdition11Text(source.text)) !== NEWSLETTER_EDITION_11_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition11ContentManifestDigest() !==
    NEWSLETTER_EDITION_11_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition11Template(source);
}

function trackedUrl(territorialModule: NewsletterEdition11TerritorialModule): string {
  const url = new URL(territorialModule.url);
  url.searchParams.set("utm_source", "la_agenda_motor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", NEWSLETTER_EDITION_11_CAMPAIGN_KEY);
  url.searchParams.set("utm_content", territorialModule.utmContent);
  return url.toString();
}

function territorialHtml(variant: NewsletterEdition11ContentVariant): string {
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

function territorialText(variant: NewsletterEdition11ContentVariant): string {
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

export function prepareEdition11Content(
  source: NewsletterEdition11Source,
  variant: NewsletterEdition11ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition11PreparedContent {
  const summary = validateEdition11SourceIntegrity(source);
  if (variant !== "national" && !TERRITORIAL_MODULE_BY_VARIANT.has(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition11UnsubscribeUrl(unsubscribeUrl);
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
  const territorialTitles = Object.values(NEWSLETTER_EDITION_11_TERRITORIAL_MODULES).map(
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

export function prepareEdition11PreviewContent(
  source: NewsletterEdition11Source,
  variant: NewsletterEdition11ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition11PreparedContent {
  const prepared = prepareEdition11Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(ASSET_ORIGIN, LOCAL_PREVIEW_ASSET_PREFIX);
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !== prepared.imageCount
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
