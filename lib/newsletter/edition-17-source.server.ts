import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertEdition17SealReady,
  NEWSLETTER_EDITION_17_ASSET_MANIFEST,
  type NewsletterEdition17Source,
} from "@/lib/newsletter/edition-17-content";

const DIRECTORY = "docs/newsletter/ediciones/2026-11-26";

export async function loadNewsletterEdition17Source(
  projectRoot = process.cwd(),
): Promise<NewsletterEdition17Source> {
  assertEdition17SealReady();
  const [assetManifest, entries] = await Promise.all([
    readFile(resolve(projectRoot, DIRECTORY, "asset-manifest.json"), "utf8"),
    Promise.all(NEWSLETTER_EDITION_17_ASSET_MANIFEST.map(async ({ file }) => [
      file,
      await readFile(resolve(projectRoot, DIRECTORY, "assets", file)),
    ] as const)),
  ]);
  return { assetManifest, assets: Object.fromEntries(entries) };
}
