import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_08_CAMPAIGN_KEY = "agenda_motor_2026_09_24";
export const NEWSLETTER_EDITION_08_SUBJECT =
  "Llanes, Arteixo y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_08_PREHEADER =
  "Rallye Villa de Llanes, Trial des Nations, Jerez y Onil para un fin de semana cargado de motor.";
export const NEWSLETTER_EDITION_08_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_08_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_08_HTML_SHA256 =
  "f7f8735a2dfed386be6400ae4d2e354109a30930b72f7342de2585e745d67f1d";
export const NEWSLETTER_EDITION_08_TEXT_SHA256 =
  "75c740d5bbfd24bca41fe874ce9ae426fef195c610963e35bb22e8622e9868f1";
export const NEWSLETTER_EDITION_08_CONTENT_MANIFEST_SHA256 =
  "027cbe6dcd0d99cc31fd7e857e9839312b182e2148e6915a4ca9a9d21e160fd4";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-09-24/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_09_24";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["Ã", "Â", "â€", "�"] as const;

export type NewsletterEdition08ContentVariant =
  | "national"
  | "madrid"
  | "cataluna"
  | "comunidad-valenciana";

export type NewsletterEdition08TerritorialRegionSlug =
  | "comunidad-de-madrid"
  | "cataluna"
  | "comunidad-valenciana";

type NewsletterEdition08TerritorialModule = {
  variant: Exclude<NewsletterEdition08ContentVariant, "national">;
  title: string;
  meta: string;
  paragraphs: readonly string[];
  cta: string;
  url: string;
  image: string;
  imageAlt: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_08_TERRITORIAL_MODULES: Readonly<
  Record<NewsletterEdition08TerritorialRegionSlug, NewsletterEdition08TerritorialModule>
> = {
  "comunidad-de-madrid": {
    variant: "madrid",
    title: "Xtreme Challenge Madrid 2026",
    meta: "25–26 septiembre · Madrid",
    paragraphs: [
      "Si prefieres pasar el fin de semana sobre la moto en lugar de verlo desde fuera, Xtreme Challenge llega a Madrid con uno de sus encuentros mototurísticos no competitivos.",
      "Dos días alrededor de la ruta, la convivencia y el ambiente motero, con un formato pensado más para disfrutar de la carretera que para competir.",
    ],
    cta: "Ver Xtreme Challenge Madrid",
    url: "https://www.eventomotor.com/evento/xtreme-challenge-madrid-2026-09-25",
    image: "06-xtreme-challenge-madrid.webp",
    imageAlt: "Xtreme Challenge Madrid 2026",
    utmContent: "xtreme_challenge_madrid",
  },
  cataluna: {
    variant: "cataluna",
    title: "Salón del Automóvil de Lleida 2026",
    meta: "25–27 septiembre · Fira de Lleida",
    paragraphs: [
      "Este fin de semana Fira de Lleida vuelve a dedicar sus pabellones 4 y 5 y el recinto exterior al automóvil.",
      "Una alternativa tranquila a la competición para acercarse a la ciudad y pasar unas horas alrededor del mundo del coche. El salón estará abierto los tres días de 10:30 a 20:00 y la entrada es gratuita.",
    ],
    cta: "Ver Salón del Automóvil de Lleida",
    url: "https://www.eventomotor.com/evento/salon-automovil-lleida-2026-09-25",
    image: "07-salon-automovil-lleida.webp",
    imageAlt: "Salón del Automóvil de Lleida 2026",
    utmContent: "salon_automovil_lleida",
  },
  "comunidad-valenciana": {
    variant: "comunidad-valenciana",
    title: "Supercars + ROOW",
    meta: "26–27 septiembre · Circuit Ricardo Tormo, Cheste",
    paragraphs: [
      "Mientras Onil pone el foco en la montaña, Cheste ofrece otra forma completamente distinta de pasar el fin de semana.",
      "Supercars + ROOW mezcla competición en pista con exhibiciones, concentraciones y ambiente de paddock, con las Supercars Endurance Series y Historic Endurance formando parte del programa.",
    ],
    cta: "Ver Supercars + ROOW",
    url: "https://www.eventomotor.com/evento/supercars-roow-cheste-2026-09-26",
    image: "08-supercars-roow-cheste.webp",
    imageAlt: "Supercars + ROOW",
    utmContent: "supercars_roow_cheste",
  },
};

const TERRITORIAL_MODULE_BY_VARIANT = new Map<
  NewsletterEdition08ContentVariant,
  NewsletterEdition08TerritorialModule
>(
  Object.values(NEWSLETTER_EDITION_08_TERRITORIAL_MODULES).map((territorialModule) => [
    territorialModule.variant,
    territorialModule,
  ]),
);

export function newsletterEdition08ContentVariantForRegion(
  regionSlug: string | null | undefined,
): NewsletterEdition08ContentVariant {
  if (!regionSlug) return "national";
  const territorialModule = NEWSLETTER_EDITION_08_TERRITORIAL_MODULES[
    regionSlug as NewsletterEdition08TerritorialRegionSlug
  ];
  return territorialModule?.variant ?? "national";
}

export type NewsletterEdition08AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition08Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition08TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition08PreparedContent =
  NewsletterEdition08TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition08ContentVariant;
  };

export const NEWSLETTER_EDITION_08_ASSET_MANIFEST: readonly NewsletterEdition08AssetManifestEntry[] = [
  { file: "01-rallye-villa-llanes-hero.webp", width: 1200, height: 675, bytes: 109598, sha256: "e041e0e0ef3478104d67518b33c8366a31961052a822bb1c7d5e39fabdbf20ef" },
  { file: "02-trial-des-nations-arteixo.webp", width: 800, height: 500, bytes: 125476, sha256: "491750107e0982e6f2b9c24545dabf9a7d02037da04e82227bf732eb025da9a1" },
  { file: "03-racing-weekend-jerez.webp", width: 800, height: 500, bytes: 59502, sha256: "8a1ca1bd1db3893b119b6233df3244698086dbfdde3c507931c5541b64d01fd6" },
  { file: "04-subida-internacional-onil.webp", width: 800, height: 500, bytes: 103416, sha256: "492bc669a0791ba334b0543c76921aaee87171da6617c47a4b8b52aa850203ff" },
  { file: "05-festival-velocidad-barcelona.webp", width: 800, height: 500, bytes: 75450, sha256: "10ca5b89a71d052994e5d8821d1d707e92e6984d3811ff7edfe4b8580160f06a" },
  { file: "06-xtreme-challenge-madrid.webp", width: 800, height: 500, bytes: 80888, sha256: "db4311f6232e81034c2a53eb7367d884f3efe900cd1308aa07d074a807f3d838" },
  { file: "07-salon-automovil-lleida.webp", width: 800, height: 500, bytes: 76644, sha256: "d3ac287ffb20f91b6249149c4e5083a0f4952abb5f7ca141813268446745bb9f" },
  { file: "08-supercars-roow-cheste.webp", width: 800, height: 500, bytes: 76296, sha256: "42b8e6875f6ffea9bc1f8ece4a2f96fbfb5459f8a4228821dc9dfd230e0e8351" },
  { file: "eventomotor-header.png", width: 1240, height: 200, bytes: 38680, sha256: "b4a2866be8b7ac62996f383c7d0ff3230aabcf62794ee48513222435062971e1" },
  { file: "eventomotor-logo.png", width: 520, height: 56, bytes: 26745, sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc" },
];

export class NewsletterEdition08ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 08 content blocked: ${code}.`);
    this.name = "NewsletterEdition08ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition08ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition08Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_08_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_08_SUBJECT,
    preheader: NEWSLETTER_EDITION_08_PREHEADER,
    variantMap: {
      national: null,
      "comunidad-de-madrid": "madrid",
      cataluna: "cataluna",
      "comunidad-valenciana": "comunidad-valenciana",
      andalucia: null,
      galicia: null,
    },
    assets: NEWSLETTER_EDITION_08_ASSET_MANIFEST,
  });
}

export function newsletterEdition08ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition08Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_08_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }
  const expectedFiles = NEWSLETTER_EDITION_08_ASSET_MANIFEST.map((asset) => asset.file).sort();
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_08_ASSET_MANIFEST) {
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

export function validateEdition08UnsubscribeUrl(value: string): string {
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

export function validateEdition08Template(
  source: NewsletterEdition08Source,
): NewsletterEdition08TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 08") ||
    !source.html.includes(NEWSLETTER_EDITION_08_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_08_PREHEADER)
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
  const summary: NewsletterEdition08TemplateSummary = {
    imageCount: imageSources.length,
    linkCount: links.length,
    htmlCampaignCount: countOccurrences(source.html, UTM_CAMPAIGN_MARKER),
    htmlUnsubscribePlaceholderCount: countOccurrences(source.html, UNSUBSCRIBE_PLACEHOLDER),
    textUnsubscribePlaceholderCount: countOccurrences(source.text, UNSUBSCRIBE_PLACEHOLDER),
    htmlTerritorialPlaceholderCount: countOccurrences(source.html, TERRITORIAL_PLACEHOLDER),
    textTerritorialPlaceholderCount: countOccurrences(source.text, TERRITORIAL_PLACEHOLDER),
    assetCount: NEWSLETTER_EDITION_08_ASSET_MANIFEST.length,
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

export function validateEdition08SourceIntegrity(
  source: NewsletterEdition08Source,
): NewsletterEdition08TemplateSummary {
  if (
    sha256(canonicalizeEdition08Text(source.html)) !== NEWSLETTER_EDITION_08_HTML_SHA256 ||
    sha256(canonicalizeEdition08Text(source.text)) !== NEWSLETTER_EDITION_08_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition08ContentManifestDigest() !==
    NEWSLETTER_EDITION_08_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition08Template(source);
}

function trackedUrl(territorialModule: NewsletterEdition08TerritorialModule): string {
  const url = new URL(territorialModule.url);
  url.searchParams.set("utm_source", "la_agenda_motor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", NEWSLETTER_EDITION_08_CAMPAIGN_KEY);
  url.searchParams.set("utm_content", territorialModule.utmContent);
  return url.toString();
}

function territorialHtml(variant: NewsletterEdition08ContentVariant): string {
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

function territorialText(variant: NewsletterEdition08ContentVariant): string {
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

export function prepareEdition08Content(
  source: NewsletterEdition08Source,
  variant: NewsletterEdition08ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition08PreparedContent {
  const summary = validateEdition08SourceIntegrity(source);
  if (variant !== "national" && !TERRITORIAL_MODULE_BY_VARIANT.has(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition08UnsubscribeUrl(unsubscribeUrl);
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
  const territorialTitles = Object.values(NEWSLETTER_EDITION_08_TERRITORIAL_MODULES).map(
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

export function prepareEdition08PreviewContent(
  source: NewsletterEdition08Source,
  variant: NewsletterEdition08ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition08PreparedContent {
  const prepared = prepareEdition08Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(ASSET_ORIGIN, LOCAL_PREVIEW_ASSET_PREFIX);
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !== prepared.imageCount
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
