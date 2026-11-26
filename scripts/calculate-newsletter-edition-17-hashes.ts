import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  NEWSLETTER_EDITION_17_ASSET_MANIFEST,
  canonicalizeEdition17Text,
} from "@/lib/newsletter/edition-17-content";
import {
  NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_17_PREHEADER,
  NEWSLETTER_EDITION_17_SUBJECT,
} from "@/lib/newsletter/edition-17-editorial";
import {
  NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL,
  renderEdition17Sendable,
} from "@/lib/newsletter/edition-17-render";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main(): Promise<void> {
  const root = resolve("docs/newsletter/ediciones/2026-11-26");
  const manifest = JSON.parse(await readFile(resolve(root, "asset-manifest.json"), "utf8")) as unknown;
  if (JSON.stringify(manifest) !== JSON.stringify(NEWSLETTER_EDITION_17_ASSET_MANIFEST)) {
    throw new Error("Edition 17 manifest mismatch");
  }
  const expected = NEWSLETTER_EDITION_17_ASSET_MANIFEST.map(({ file }) => file).sort();
  const actual = (await readdir(resolve(root, "assets"))).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Edition 17 asset set mismatch");
  for (const entry of NEWSLETTER_EDITION_17_ASSET_MANIFEST) {
    const bytes = await readFile(resolve(root, "assets", entry.file));
    if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error(`Edition 17 asset mismatch: ${entry.file}`);
    }
  }

  const renders = { national: { html: "", text: "" }, madrid: { html: "", text: "" } };
  for (const variant of ["national", "madrid"] as const) {
    const rendered = renderEdition17Sendable(variant, NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL);
    if (rendered.html.includes("PREVIEW LOCAL") || rendered.html.includes('src="assets/')) {
      throw new Error(`Edition 17 ${variant} projection is not canonical`);
    }
    renders[variant] = {
      html: sha256(canonicalizeEdition17Text(rendered.html)),
      text: sha256(canonicalizeEdition17Text(rendered.text)),
    };
  }
  const contentManifestDigest = sha256(JSON.stringify({
    editionKey: NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_17_SUBJECT,
    preheader: NEWSLETTER_EDITION_17_PREHEADER,
    variantMap: {
      national: null,
      "comunidad-de-madrid": "madrid",
      cataluna: null,
      aragon: null,
      galicia: null,
      "sin-region": null,
      unknown: null,
    },
    assets: NEWSLETTER_EDITION_17_ASSET_MANIFEST,
    renders,
  }));
  console.log(JSON.stringify({ status: "CANONICAL_HASHES_REPRODUCED", renders, contentManifestDigest }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Edition 17 hash calculation failed");
  process.exitCode = 1;
});
