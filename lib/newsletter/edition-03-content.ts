import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_03_CAMPAIGN_KEY =
  "agenda_motor_2026_08_20";
export const NEWSLETTER_EDITION_03_SUBJECT =
  "Ferrol, Jarama y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_03_PREHEADER =
  "Rallye de Ferrol, F4 en Jarama, Sun To Sun y una fecha que conviene reservar.";
export const NEWSLETTER_EDITION_03_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_03_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_03_HTML_SHA256 =
  "2b36999e463983419a6d3b4c73db0d1d294678bbf67568e05ecabdafbeba1e99";
export const NEWSLETTER_EDITION_03_TEXT_SHA256 =
  "a737a8b35c8c20dc1f4c444a6e13d08a964300877c793d5bad5aae6a085cf66e";
export const NEWSLETTER_EDITION_03_CONTENT_MANIFEST_SHA256 =
  "0ae93712cc568e649032b2a16d51ef95cd1925cdfe7cb3adf1223bfae2190182";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-08-20/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_08_20";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\ufffd"] as const;

export type NewsletterEdition03ContentVariant =
  | "national"
  | "madrid"
  | "a-coruna"
  | "barcelona";

export type NewsletterEdition03AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition03Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition03TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition03PreparedContent =
  NewsletterEdition03TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition03ContentVariant;
  };

type TerritorialContent = {
  title: string;
  dateAndPlace: string;
  description: string;
  cta: string;
  image: string;
  imageAlt: string;
  url: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_03_TERRITORIAL_CONTENT: Readonly<{
  barcelona: TerritorialContent;
}> = {
  barcelona: {
    title: "Motor Extremo Montmeló",
    dateAndPlace: "22–23 agosto · Circuit de Barcelona-Catalunya",
    description:
      "Si estás en Barcelona, este fin de semana también hay actividad en Montmeló con las jornadas de Motor Extremo en el Circuit.",
    cta: "Ver Motor Extremo Montmeló",
    image: "06-motor-extremo-montmelo.webp",
    imageAlt: "Motos rodando en circuito para Motor Extremo Montmeló",
    url: "https://www.eventomotor.com/evento/motor-extremo-montmelo-agosto-2026-montmelo-2026-08-22",
    utmContent: "motor_extremo_montmelo",
  },
};

export const NEWSLETTER_EDITION_03_ASSET_MANIFEST: readonly NewsletterEdition03AssetManifestEntry[] = [
  {
    file: "01-rallye-ferrol-hero.webp",
    width: 1200,
    height: 675,
    bytes: 185830,
    sha256: "489a8825ff6c0c47810534fc5af006cf232423d17e68030fd9e042668daf42bf",
  },
  {
    file: "02-f4-jarama.webp",
    width: 800,
    height: 500,
    bytes: 101088,
    sha256: "5e6a615a4213905845904068ceae580ede534ea3d609aaaffda9492c06f649ad",
  },
  {
    file: "03-sun-to-sun.webp",
    width: 800,
    height: 500,
    bytes: 163340,
    sha256: "e3c305c2e2911b847229ad55b1af14888fd7553dbe45de8f9255d6956e5e2840",
  },
  {
    file: "04-bien-aparecida.webp",
    width: 800,
    height: 500,
    bytes: 116556,
    sha256: "86389e6affa4c874b6d346eee1f0cffdac2a44424a41cac4bdfcbcd1eb5aa89e",
  },
  {
    file: "05-motogp-aragon.webp",
    width: 800,
    height: 500,
    bytes: 69910,
    sha256: "c2b21c9c93495b0f38a1cdc190067256e29b5ee93aadba567e9fe4e66207f9c6",
  },
  {
    file: "06-motor-extremo-montmelo.webp",
    width: 800,
    height: 500,
    bytes: 76562,
    sha256: "dc4dee52a38da8cadb69b0afda2880a2daf65b6abd11579c931bc7e60792e990",
  },
  {
    file: "eventomotor-header.png",
    width: 1240,
    height: 200,
    bytes: 38716,
    sha256: "8329dd2b1790c6a58b345ce1389d62cd5cccb32aeb154d65e8eb3e7f537d7124",
  },
  {
    file: "eventomotor-logo.png",
    width: 520,
    height: 56,
    bytes: 26745,
    sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc",
  },
];

export class NewsletterEdition03ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 03 content blocked: ${code}.`);
    this.name = "NewsletterEdition03ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition03ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition03Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_03_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_03_SUBJECT,
    preheader: NEWSLETTER_EDITION_03_PREHEADER,
    variantMap: {
      national: null,
      madrid: null,
      "a-coruna": null,
      barcelona: NEWSLETTER_EDITION_03_TERRITORIAL_CONTENT.barcelona,
    },
    assets: NEWSLETTER_EDITION_03_ASSET_MANIFEST,
  });
}

export function newsletterEdition03ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition03Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_03_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }

  const expectedFiles = NEWSLETTER_EDITION_03_ASSET_MANIFEST.map((asset) => asset.file);
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== [...expectedFiles].sort()[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_03_ASSET_MANIFEST) {
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

export function validateEdition03UnsubscribeUrl(value: string): string {
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

export function validateEdition03Template(
  source: NewsletterEdition03Source,
): NewsletterEdition03TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 03") ||
    !source.html.includes(NEWSLETTER_EDITION_03_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_03_PREHEADER)
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

  const summary: NewsletterEdition03TemplateSummary = {
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
    assetCount: NEWSLETTER_EDITION_03_ASSET_MANIFEST.length,
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

export function validateEdition03SourceIntegrity(
  source: NewsletterEdition03Source,
): NewsletterEdition03TemplateSummary {
  if (
    sha256(canonicalizeEdition03Text(source.html)) !==
      NEWSLETTER_EDITION_03_HTML_SHA256 ||
    sha256(canonicalizeEdition03Text(source.text)) !==
      NEWSLETTER_EDITION_03_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition03ContentManifestDigest() !==
    NEWSLETTER_EDITION_03_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition03Template(source);
}

function territorialUrl(content: TerritorialContent): string {
  const url = new URL(content.url);
  url.searchParams.set("utm_source", "la_agenda_motor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", NEWSLETTER_EDITION_03_CAMPAIGN_KEY);
  url.searchParams.set("utm_content", content.utmContent);
  return url.toString();
}

function territorialHtml(variant: NewsletterEdition03ContentVariant): string {
  if (variant !== "barcelona") return "";
  const content = NEWSLETTER_EDITION_03_TERRITORIAL_CONTENT.barcelona;
  const href = territorialUrl(content).replaceAll("&", "&amp;");
  return `          <tr>
            <td class="mobile-pad" style="padding:2px 28px 20px;">
              <div style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;color:#ff5a0a;text-transform:uppercase;">Lo próximo cerca de ti</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f3f5" style="border:1px solid #c4ccd5;border-radius:14px;background-color:#f1f3f5;overflow:hidden;">
                <tr>
                  <td class="stack-column" width="42%" valign="top" style="padding:0;">
                    <a href="${href}" style="text-decoration:none;"><img src="${ASSET_ORIGIN}${content.image}" width="236" alt="${content.imageAlt}" style="display:block;width:100%;max-width:236px;height:auto;border:0;"></a>
                  </td>
                  <td class="stack-column" width="58%" valign="middle" style="padding:18px;box-sizing:border-box;overflow-wrap:break-word;">
                    <h3 style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:25px;color:#111827;font-weight:800;">${content.title}</h3>
                    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#4b5563;"><strong style="color:#111827;">${content.dateAndPlace}</strong></p>
                    <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#4b5563;">${content.description}</p>
                    <a href="${href}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#111827;text-decoration:none;">${content.cta} <span style="color:#ff5a0a;">→</span></a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function territorialText(variant: NewsletterEdition03ContentVariant): string {
  if (variant !== "barcelona") return "";
  const content = NEWSLETTER_EDITION_03_TERRITORIAL_CONTENT.barcelona;
  return `LO PRÓXIMO CERCA DE TI

${content.title}
${content.dateAndPlace}
${content.description}
${content.cta}:
${territorialUrl(content)}

`;
}

export function prepareEdition03Content(
  source: NewsletterEdition03Source,
  variant: NewsletterEdition03ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition03PreparedContent {
  const summary = validateEdition03SourceIntegrity(source);
  if (!["national", "madrid", "a-coruna", "barcelona"].includes(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition03UnsubscribeUrl(unsubscribeUrl);
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

export function prepareEdition03PreviewContent(
  source: NewsletterEdition03Source,
  variant: NewsletterEdition03ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition03PreparedContent {
  const prepared = prepareEdition03Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(
    ASSET_ORIGIN,
    LOCAL_PREVIEW_ASSET_PREFIX,
  );
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !==
      EXPECTED_IMAGE_COUNT + (variant === "barcelona" ? 1 : 0)
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
