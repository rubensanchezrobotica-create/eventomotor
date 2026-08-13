import { createHash } from "node:crypto";

import { isValidNewsletterActionTokenShape } from "@/lib/newsletter/schemas";

export const NEWSLETTER_EDITION_02_CAMPAIGN_KEY =
  "agenda_motor_2026_08_13";
export const NEWSLETTER_EDITION_02_SUBJECT =
  "Drift nocturno, rally y 4 planes más para este fin de semana";
export const NEWSLETTER_EDITION_02_PREHEADER =
  "Seis planes entre Valladolid, Asturias, Xàtiva, Burgos, Cambrils y Bizkaia para vivir el motor del 14 al 16 de agosto.";
export const NEWSLETTER_EDITION_02_SENDER =
  "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>";
export const NEWSLETTER_EDITION_02_REPLY_TO = "info@eventomotor.com";
export const NEWSLETTER_EDITION_02_HTML_SHA256 =
  "b53612f67a2553b86dffcd1d90dd4670a40aa47de57180a09f855926c8423dda";
export const NEWSLETTER_EDITION_02_TEXT_SHA256 =
  "225984e08d5bbc4eef38c9fee1ebe7d8fb59bccdaea341ae937642a23b398a9c";
export const NEWSLETTER_EDITION_02_CONTENT_MANIFEST_SHA256 =
  "931950286b42cf46ac4ef95f6adb74f137fd2d9d090cb8377c358d3b2e973407";

const ASSET_ORIGIN =
  "https://www.eventomotor.com/newsletter/2026-08-13/assets/";
const LOCAL_PREVIEW_ASSET_PREFIX = "assets/";
const UTM_CAMPAIGN_MARKER = "utm_campaign=agenda_motor_2026_08_13";
const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TERRITORIAL_PLACEHOLDER = "{{territorial_block}}";
const EXPECTED_IMAGE_COUNT = 7;
const EXPECTED_BASE_LINK_COUNT = 16;
const EXPECTED_BASE_UTM_COUNT = 13;
const CORRUPT_TEXT_MARKERS = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\ufffd"] as const;

export type NewsletterEdition02ContentVariant =
  | "national"
  | "madrid"
  | "a-coruna"
  | "barcelona";

export type NewsletterEdition02AssetManifestEntry = {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type NewsletterEdition02Source = {
  html: string;
  text: string;
  assetManifest: string;
  assets: Readonly<Record<string, Uint8Array>>;
};

export type NewsletterEdition02TemplateSummary = {
  imageCount: number;
  linkCount: number;
  htmlCampaignCount: number;
  htmlUnsubscribePlaceholderCount: number;
  textUnsubscribePlaceholderCount: number;
  htmlTerritorialPlaceholderCount: number;
  textTerritorialPlaceholderCount: number;
  assetCount: number;
};

export type NewsletterEdition02PreparedContent =
  NewsletterEdition02TemplateSummary & {
    html: string;
    text: string;
    variant: NewsletterEdition02ContentVariant;
  };

type TerritorialContent = {
  title: string;
  dateAndPlace: string;
  description: string;
  url: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_02_TERRITORIAL_CONTENT: Readonly<
  Record<Exclude<NewsletterEdition02ContentVariant, "national">, TerritorialContent>
> = {
  madrid: {
    title: "F4 Spain · Jarama",
    dateAndPlace: "22–23 de agosto · Circuito de Madrid Jarama-RACE",
    description:
      "El próximo fin de semana, la F4 Spain llega al Jarama. Si estás en Madrid, esta es una de las fechas para apuntar ya en la agenda.",
    url: "https://www.eventomotor.com/evento/f4-spain-jarama-2026-08-22",
    utmContent: "f4_jarama",
  },
  "a-coruna": {
    title: "Rallye Ferrol 2026",
    dateAndPlace: "21–23 de agosto · Ferrol, A Coruña",
    description:
      "El próximo fin de semana toca Rallye Ferrol. Una de las próximas citas fuertes del calendario gallego.",
    url: "https://www.eventomotor.com/evento/rallye-ferrol-2026-08-21",
    utmContent: "rallye_ferrol",
  },
  barcelona: {
    title: "Motor Extremo Montmeló",
    dateAndPlace: "22–23 de agosto · Circuit de Barcelona-Catalunya",
    description:
      "El próximo fin de semana hay tandas de moto en Montmeló. Dos jornadas de circuito para tenerlas ya localizadas.",
    url: "https://www.eventomotor.com/evento/motor-extremo-montmelo-agosto-2026-montmelo-2026-08-22",
    utmContent: "motor_extremo_montmelo",
  },
};

export const NEWSLETTER_EDITION_02_ASSET_MANIFEST: readonly NewsletterEdition02AssetManifestEntry[] = [
  {
    file: "01-rpm-fest-hero.jpg",
    width: 1200,
    height: 675,
    bytes: 227745,
    sha256: "40f3a71a95892754ea6813c2677ddbcb1cfa3830a0e891fc536110495319635e",
  },
  {
    file: "02-rallysprint-carbayin.jpg",
    width: 800,
    height: 500,
    bytes: 100548,
    sha256: "ccfbce1e6cc971bb56ee3dc1da8fde9b8dec0d2d88ac6cbc74b83edd1270b9d1",
  },
  {
    file: "03-xativa-velocitat.jpg",
    width: 800,
    height: 500,
    bytes: 92152,
    sha256: "eda88bf31b80201ae29b82b93f7d10d47fff48ccb6085ef6f5c018477e1f624c",
  },
  {
    file: "04-supercross-castrojeriz.jpg",
    width: 800,
    height: 500,
    bytes: 79918,
    sha256: "7336060ccf952acf0cee559af7d563557e0a5066015a24a62d159ce0e008c4dd",
  },
  {
    file: "05-concentracion-cambrils.jpg",
    width: 800,
    height: 500,
    bytes: 82520,
    sha256: "2b5988bbbbcf70a9a79e3431a8611de19afa41411c930aea48d566f70ad29845",
  },
  {
    file: "06-clasicos-el-regato.jpg",
    width: 800,
    height: 500,
    bytes: 110355,
    sha256: "d66d3437223316b1b422d8986c6e48318b223204941f76d10a68bcdeba4b0437",
  },
  {
    file: "eventomotor-logo.png",
    width: 520,
    height: 56,
    bytes: 26745,
    sha256: "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc",
  },
];

export class NewsletterEdition02ContentError extends Error {
  constructor(readonly code: string) {
    super(`Edition 02 content blocked: ${code}.`);
    this.name = "NewsletterEdition02ContentError";
  }
}

function fail(code: string): never {
  throw new NewsletterEdition02ContentError(code);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

export function canonicalizeEdition02Text(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function contentManifestPayload(): string {
  return JSON.stringify({
    editionKey: NEWSLETTER_EDITION_02_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_02_SUBJECT,
    preheader: NEWSLETTER_EDITION_02_PREHEADER,
    variantMap: {
      national: null,
      madrid: NEWSLETTER_EDITION_02_TERRITORIAL_CONTENT.madrid,
      "a-coruna": NEWSLETTER_EDITION_02_TERRITORIAL_CONTENT["a-coruna"],
      barcelona: NEWSLETTER_EDITION_02_TERRITORIAL_CONTENT.barcelona,
    },
    assets: NEWSLETTER_EDITION_02_ASSET_MANIFEST,
  });
}

export function newsletterEdition02ContentManifestDigest(): string {
  return sha256(contentManifestPayload());
}

function assertExpectedManifest(source: NewsletterEdition02Source): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.assetManifest);
  } catch {
    fail("asset_manifest_invalid");
  }
  if (JSON.stringify(parsed) !== JSON.stringify(NEWSLETTER_EDITION_02_ASSET_MANIFEST)) {
    fail("asset_manifest_mismatch");
  }

  const expectedFiles = NEWSLETTER_EDITION_02_ASSET_MANIFEST.map((asset) => asset.file);
  const actualFiles = Object.keys(source.assets).sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== [...expectedFiles].sort()[index])
  ) {
    fail("asset_set_mismatch");
  }
  for (const expected of NEWSLETTER_EDITION_02_ASSET_MANIFEST) {
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

export function validateEdition02UnsubscribeUrl(value: string): string {
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

export function validateEdition02Template(
  source: NewsletterEdition02Source,
): NewsletterEdition02TemplateSummary {
  if (
    !source.html.startsWith("<!doctype html>") ||
    !source.text.startsWith("LA AGENDA MOTOR · EDICIÓN 02") ||
    !source.html.includes(NEWSLETTER_EDITION_02_PREHEADER) ||
    !source.text.includes(NEWSLETTER_EDITION_02_PREHEADER)
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

  const summary: NewsletterEdition02TemplateSummary = {
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
    assetCount: NEWSLETTER_EDITION_02_ASSET_MANIFEST.length,
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

export function validateEdition02SourceIntegrity(
  source: NewsletterEdition02Source,
): NewsletterEdition02TemplateSummary {
  if (
    sha256(canonicalizeEdition02Text(source.html)) !==
      NEWSLETTER_EDITION_02_HTML_SHA256 ||
    sha256(canonicalizeEdition02Text(source.text)) !==
      NEWSLETTER_EDITION_02_TEXT_SHA256
  ) {
    fail("template_digest_mismatch");
  }
  assertExpectedManifest(source);
  if (
    newsletterEdition02ContentManifestDigest() !==
    NEWSLETTER_EDITION_02_CONTENT_MANIFEST_SHA256
  ) {
    fail("content_manifest_digest_mismatch");
  }
  return validateEdition02Template(source);
}

function territorialUrl(content: TerritorialContent): string {
  const url = new URL(content.url);
  url.searchParams.set("utm_source", "la_agenda_motor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", NEWSLETTER_EDITION_02_CAMPAIGN_KEY);
  url.searchParams.set("utm_content", content.utmContent);
  return url.toString();
}

function territorialHtml(variant: NewsletterEdition02ContentVariant): string {
  if (variant === "national") return "";
  const content = NEWSLETTER_EDITION_02_TERRITORIAL_CONTENT[variant];
  const href = territorialUrl(content).replaceAll("&", "&amp;");
  return `          <tr>
            <td class="mobile-pad" style="padding:2px 28px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#e6ebf0" style="background-color:#e6ebf0;border-left:4px solid #ff5a0a;border-radius:10px;">
                <tr>
                  <td style="padding:17px 18px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;color:#ff5a0a;text-transform:uppercase;">Lo próximo cerca de ti</div>
                    <h2 style="margin:5px 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:25px;color:#111827;font-weight:850;">${content.title}</h2>
                    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#4b5563;"><strong style="color:#111827;">${content.dateAndPlace}</strong></p>
                    <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#4b5563;">${content.description}</p>
                    <a href="${href}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#111827;text-decoration:none;">Ver evento <span style="color:#ff5a0a;">→</span></a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function territorialText(variant: NewsletterEdition02ContentVariant): string {
  if (variant === "national") return "";
  const content = NEWSLETTER_EDITION_02_TERRITORIAL_CONTENT[variant];
  return `LO PRÓXIMO CERCA DE TI

${content.title}
${content.dateAndPlace}
${content.description}
${territorialUrl(content)}

`;
}

export function prepareEdition02Content(
  source: NewsletterEdition02Source,
  variant: NewsletterEdition02ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition02PreparedContent {
  const summary = validateEdition02SourceIntegrity(source);
  if (!["national", "madrid", "a-coruna", "barcelona"].includes(variant)) {
    fail("content_variant_invalid");
  }
  const validatedUnsubscribeUrl = validateEdition02UnsubscribeUrl(unsubscribeUrl);
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

export function prepareEdition02PreviewContent(
  source: NewsletterEdition02Source,
  variant: NewsletterEdition02ContentVariant,
  unsubscribeUrl: string,
): NewsletterEdition02PreparedContent {
  const prepared = prepareEdition02Content(source, variant, unsubscribeUrl);
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
