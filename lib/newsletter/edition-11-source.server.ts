import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  NEWSLETTER_EDITION_11_ASSET_MANIFEST,
  type NewsletterEdition11Source,
} from "@/lib/newsletter/edition-11-content";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-15";
const HTML_FILE = `${EDITION_DIRECTORY}/email-production.html`;
const TEXT_FILE = `${EDITION_DIRECTORY}/email-texto-plano.txt`;
const ASSET_MANIFEST_FILE = `${EDITION_DIRECTORY}/asset-manifest.json`;

export async function loadNewsletterEdition11Source(
  projectRoot = process.cwd(),
): Promise<NewsletterEdition11Source> {
  const [html, text, assetManifest, assetEntries] = await Promise.all([
    readFile(resolve(projectRoot, HTML_FILE), "utf8"),
    readFile(resolve(projectRoot, TEXT_FILE), "utf8"),
    readFile(resolve(projectRoot, ASSET_MANIFEST_FILE), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_11_ASSET_MANIFEST.map(async ({ file }) => [
        file,
        await readFile(resolve(projectRoot, EDITION_DIRECTORY, "assets", file)),
      ] as const),
    ),
  ]);
  return {
    html,
    text,
    assetManifest,
    assets: Object.fromEntries(assetEntries),
  };
}
