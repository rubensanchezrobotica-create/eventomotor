import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  NEWSLETTER_EDITION_05_ASSET_MANIFEST,
  type NewsletterEdition05Source,
} from "@/lib/newsletter/edition-05-content";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-03";
const HTML_FILE = `${EDITION_DIRECTORY}/email-production.html`;
const TEXT_FILE = `${EDITION_DIRECTORY}/email-texto-plano.txt`;
const ASSET_MANIFEST_FILE = `${EDITION_DIRECTORY}/asset-manifest.json`;

export async function loadNewsletterEdition05Source(
  projectRoot = process.cwd(),
): Promise<NewsletterEdition05Source> {
  const [html, text, assetManifest, assetEntries] = await Promise.all([
    readFile(resolve(projectRoot, HTML_FILE), "utf8"),
    readFile(resolve(projectRoot, TEXT_FILE), "utf8"),
    readFile(resolve(projectRoot, ASSET_MANIFEST_FILE), "utf8"),
    Promise.all(
      NEWSLETTER_EDITION_05_ASSET_MANIFEST.map(async ({ file }) => [
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
