import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_07_CAMPAIGN_KEY =
  "agenda_motor_2026_09_17";
export const NEWSLETTER_EDITION_07_SUBJECT =
  "A Coruña, Barcelona y lo que viene este fin de semana";
export const NEWSLETTER_EDITION_07_PREHEADER =
  "EcoRally FIA, 24H de Barcelona, TrialGP en España y Jaizkibel para cerrar otro fin de semana muy cargado.";
export const NEWSLETTER_EDITION_07_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_07_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_07_HTML_SHA256 =
  "c0345e6138fb08566f71ae3ecc7ce82a0c41e1fef09bfb2591a1185bce355194";
export const NEWSLETTER_EDITION_07_TEXT_SHA256 =
  "d6b1bec2281583985d59288b933ceccbdd4f204a17ce5f20e8f3d4ae1875ca5d";
export const NEWSLETTER_EDITION_07_CONTENT_MANIFEST_SHA256 =
  "32dadec0d2a9c75c2c6b3a7f93761cad4a40d0fd104fedd92c69d42f9f3977ba";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-09-17/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_09_17";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 6;
const EXPECTED_BASE_LINK_COUNT = 14;
const EXPECTED_BASE_UTM_COUNT = 11;
const CORRUPT_TEXT_MARKERS = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\ufffd"] as const;

export type NewsletterEdition07ContentVariant =
  | "national"
  | "madrid"
  | "a-coruna"
  | "barcelona";

export type NewsletterEdition07AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition07Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition07TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition07PreparedContent =
  NewsletterEdition07TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition07ContentVariant;
  };

export const NEWSLETTER_EDITION_07_ASSET_MANIFEST: readonly NewsletterEdition07AssetManifestEntry[] = [
  {
    file: "01-ecorally-a-coruna-hero.webp",
    width: 1200,
    height: 675,
    bytes: 124672,
    sha256: "592117992f4c42d6be5e2f7f89f749a4a8b80e878f7c0efbc5c793330563b245",
  },
  {
    file: "02-24h-barcelona.webp",
    width: 800,
    height: 500,
    bytes: 49808,
    sha256: "d407c5d63607bd1304c484351b1a61ece099dc276398b132eae621d42a848537",
  },
  {
    file: "03-trialgp-espana-pobladura.webp",
    width: 800,
    height: 500,
    bytes: 107902,
    sha256: "32037b2a6000d61f464a0c3366d2235eb822331030e949f65da66a7315d50b24",
  },
  {
    file: "04-subida-jaizkibel.webp",
    width: 800,
    height: 500,
    bytes: 86174,
    sha256: "cdfa604f42dc403cc0e0c8295c0840aaa0b8119084c5f867db7e39a31972abac",
  },
  {
    file: "05-rallye-villa-de-llanes.webp",
    width: 800,
    height: 500,
    bytes: 87724,
    sha256: "a81a4f2e750457978794d62dccc4b0635f8daf0565890b5cf1784bfc71ba95e8",
  },
  {
    file: "06-hot-wheels-jarama-madrid.webp",
    width: 800,
    height: 500,
    bytes: 98046,
    sha256: "68db61c12f42d7a5150a4ef41c447914577804364cb8e941e22aaabb098195c7",
  },
  {
    file: "eventomotor-header.png",
    width: 1240,
    height: 200,
    bytes: 38429,
    sha256: "2eefc398cde203f3b7f0f1e912a97f04de51368318e941cec1d99c50236456e0",
  },
  {
    file: "eventomotor-logo.png",
    width: 520,
    height: 56,
    bytes: 26745,
    sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc",
  },
];

export class NewsletterEdition07ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 07 content blocked: ${code}.`);
    this.name = "NewsletterEdition07ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition07ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition07Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_07_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_07_SUBJECT,
    preheader: NEWSLETTER_EDITION_07_PREHEADER,
    variantMap: {
      national: null,
      madrid: "hot_wheels_legends_tour_jarama",
      "a-coruna": null,
      barcelona: null,
    },
    assets: NEWSLETTER_EDITION_07_ASSET_MANIFEST,
  });
}

export function newsletterEdition07ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition07Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_07_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }

  const expectedFiles = NEWSLETTER_EDITION_07_ASSET_MANIFEST.map((asset) => asset.file);
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== [...expectedFiles].sort()[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_07_ASSET_MANIFEST) {
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

export function validateEdition07UnsubscribeUrl(value: string): string {
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

export function validateEdition07Template(
  source: NewsletterEdition07Source,
): NewsletterEdition07TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 07") ||
    !source.html.includes(NEWSLETTER_EDITION_07_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_07_PREHEADER)
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

  const summary: NewsletterEdition07TemplateSummary = {
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
    assetCount: NEWSLETTER_EDITION_07_ASSET_MANIFEST.length,
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

export function validateEdition07SourceIntegrity(
  source: NewsletterEdition07Source,
): NewsletterEdition07TemplateSummary {
  if (
    sha256(canonicalizeEdition07Text(source.html)) !==
      NEWSLETTER_EDITION_07_HTML_SHA256 ||
    sha256(canonicalizeEdition07Text(source.text)) !==
      NEWSLETTER_EDITION_07_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition07ContentManifestDigest() !==
    NEWSLETTER_EDITION_07_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition07Template(source);
}

function territorialHtml(variant: NewsletterEdition07ContentVariant): string {
  if (variant !== "madrid") return "";
  return `          <tr>
            <td class="mobile-pad" style="padding:4px 28px 22px;">
              <div style="margin:0 0 11px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.2px;color:#ff5a0a;text-transform:uppercase;">Lo próximo cerca de ti</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f3f5" style="border:1px solid #c4ccd5;border-radius:14px;background-color:#f1f3f5;overflow:hidden;">
                <tr>
                  <td class="stack-column" width="42%" valign="top" style="padding:0;">
                    <a href="https://www.eventomotor.com/evento/hot-wheels-legends-tour-espana-jarama-2026-09-19?utm_source=la_agenda_motor&amp;utm_medium=email&amp;utm_campaign=agenda_motor_2026_09_17&amp;utm_content=hot_wheels_jarama_madrid" style="text-decoration:none;">
                      <img src="https://www.eventomotor.com/newsletter/2026-09-17/assets/06-hot-wheels-jarama-madrid.webp" width="236" alt="Hot Wheels Legends Tour España 2026" style="display:block;width:100%;max-width:236px;height:auto;border:0;">
                    </a>
                  </td>
                  <td class="stack-column" width="58%" valign="middle" style="padding:18px;box-sizing:border-box;overflow-wrap:break-word;">
                    <h3 style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:25px;color:#111827;font-weight:800;">Hot Wheels Legends Tour España 2026</h3>
                    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#4b5563;"><strong style="color:#111827;">19–20 septiembre</strong> · Circuito de Madrid Jarama-RACE</p>
                    <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#4b5563;">La final española y portuguesa del Hot Wheels Legends Tour llega a Jarama con una selección de proyectos finalistas y un fin de semana cargado de actividad alrededor del automóvil.</p>
                    <a href="https://www.eventomotor.com/evento/hot-wheels-legends-tour-espana-jarama-2026-09-19?utm_source=la_agenda_motor&amp;utm_medium=email&amp;utm_campaign=agenda_motor_2026_09_17&amp;utm_content=hot_wheels_jarama_madrid" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#111827;text-decoration:none;">Ver Hot Wheels Legends Tour <span style="color:#ff5a0a;">→</span></a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
`;
}

function territorialText(variant: NewsletterEdition07ContentVariant): string {
  if (variant !== "madrid") return "";
  return `LO PRÓXIMO CERCA DE TI
Hot Wheels Legends Tour España 2026
19–20 septiembre · Circuito de Madrid Jarama-RACE

La final española y portuguesa del Hot Wheels Legends Tour llega a Jarama con una selección de proyectos finalistas y un fin de semana cargado de actividad alrededor del automóvil.

Ver Hot Wheels Legends Tour:
https://www.eventomotor.com/evento/hot-wheels-legends-tour-espana-jarama-2026-09-19?utm_source=la_agenda_motor&utm_medium=email&utm_campaign=agenda_motor_2026_09_17&utm_content=hot_wheels_jarama_madrid

`;
}

export function prepareEdition07Content(
  source: NewsletterEdition07Source,
  variant: NewsletterEdition07ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition07PreparedContent {
  const summary = validateEdition07SourceIntegrity(source);
  if (!["national", "madrid", "a-coruna", "barcelona"].includes(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition07UnsubscribeUrl(unsubscribeUrl);
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
  const expectedImageCount = variant === "madrid" ? 7 : EXPECTED_IMAGE_COUNT;
  const expectedLinkCount =
    variant === "madrid" ? EXPECTED_BASE_LINK_COUNT + 2 : EXPECTED_BASE_LINK_COUNT;
  const expectedCampaignCount =
    variant === "madrid" ? EXPECTED_BASE_UTM_COUNT + 2 : EXPECTED_BASE_UTM_COUNT;
  const renderedImages = [
    ...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),
  ].map((match) => match[1] ?? "");
  const renderedLinks = [
    ...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi),
  ];
  if (
    renderedImages.length !== expectedImageCount ||
    new Set(renderedImages).size !== expectedImageCount ||
    renderedLinks.length !== expectedLinkCount ||
    countOccurrences(html, UTM_CAMPAIGN_MARKER) !== expectedCampaignCount ||
    (variant === "madrid") !== html.includes("Hot Wheels Legends Tour España 2026") ||
    (variant === "madrid") !== text.includes("Hot Wheels Legends Tour España 2026")
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

export function prepareEdition07PreviewContent(
  source: NewsletterEdition07Source,
  variant: NewsletterEdition07ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition07PreparedContent {
  const prepared = prepareEdition07Content(source, variant, unsubscribeUrl);
  const html = prepared.html.replaceAll(
    ASSET_ORIGIN,
    LOCAL_PREVIEW_ASSET_PREFIX,
  );
  if (
    html.includes(ASSET_ORIGIN) ||
    countOccurrences(html, `src="${LOCAL_PREVIEW_ASSET_PREFIX}`) !==
      prepared.imageCount
  ) {
    fail("preview_asset_rewrite_failed");
  }
  return { ...prepared, html };
}
