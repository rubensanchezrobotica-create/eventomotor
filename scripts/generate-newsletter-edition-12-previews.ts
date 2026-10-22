import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition12PreviewContent,
  type NewsletterEdition12ContentVariant,
} from "@/lib/newsletter/edition-12-content";
import { NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL } from "@/lib/newsletter/edition-12-render-seal";
import { loadNewsletterEdition12Source } from "@/lib/newsletter/edition-12-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-22";
const VARIANTS: readonly NewsletterEdition12ContentVariant[] = [
  "national",
  "madrid",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition12Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition12PreviewContent(
        source,
        variant,
        NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
      );
      await Promise.all([
        writeFile(resolve(root, EDITION_DIRECTORY, `preview-${variant}.html`), preview.html, "utf8"),
        writeFile(resolve(root, EDITION_DIRECTORY, `preview-${variant}.txt`), preview.text, "utf8"),
      ]);
    }),
  );
  console.log(`Generated ${VARIANTS.length} Edition 12 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 12 preview generation failed safely.");
  process.exitCode = 1;
});
