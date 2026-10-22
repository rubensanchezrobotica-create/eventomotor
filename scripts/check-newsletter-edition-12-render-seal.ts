import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalizeEdition12Text,
  prepareEdition12Content,
  prepareEdition12PreviewContent,
} from "@/lib/newsletter/edition-12-content";
import {
  NEWSLETTER_EDITION_12_CANONICAL_RENDER_SHA256,
  NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
} from "@/lib/newsletter/edition-12-render-seal";
import { loadNewsletterEdition12Source } from "@/lib/newsletter/edition-12-source.server";

function digest(value: string): string {
  return createHash("sha256")
    .update(canonicalizeEdition12Text(value), "utf8")
    .digest("hex");
}

async function main(): Promise<void> {
  const source = await loadNewsletterEdition12Source();
  console.log(
    `CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL=${NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL}`,
  );
  for (const variant of ["national", "madrid"] as const) {
    const rendered = prepareEdition12Content(
      source,
      variant,
      NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    );
    const preview = prepareEdition12PreviewContent(
      source,
      variant,
      NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
    );
    const savedPreview = await readFile(
      resolve("docs/newsletter/ediciones/2026-10-22", `preview-${variant}.html`),
      "utf8",
    );
    assert.equal(
      canonicalizeEdition12Text(preview.html),
      canonicalizeEdition12Text(savedPreview),
      `${variant} human QA preview changed`,
    );
    const htmlSha256 = digest(rendered.html);
    const textSha256 = digest(rendered.text);
    assert.equal(htmlSha256, NEWSLETTER_EDITION_12_CANONICAL_RENDER_SHA256[variant].html);
    assert.equal(textSha256, NEWSLETTER_EDITION_12_CANONICAL_RENDER_SHA256[variant].text);
    console.log(`HTML_${variant.toUpperCase()}_SHA256=${htmlSha256}`);
    console.log(`TEXT_${variant.toUpperCase()}_SHA256=${textSha256}`);
    console.log(`${variant.toUpperCase()}_HUMAN_QA_PREVIEW_MATCH=YES`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
