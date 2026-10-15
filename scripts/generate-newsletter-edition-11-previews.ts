import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition11PreviewContent,
  type NewsletterEdition11ContentVariant,
} from "@/lib/newsletter/edition-11-content";
import { NEWSLETTER_EDITION_11_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL } from "@/lib/newsletter/edition-11-render-seal";
import { loadNewsletterEdition11Source } from "@/lib/newsletter/edition-11-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-15";
const VARIANTS: readonly NewsletterEdition11ContentVariant[] = [
  "national",
  "madrid",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition11Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition11PreviewContent(
        source,
        variant,
        NEWSLETTER_EDITION_11_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
      );
      await writeFile(
        resolve(root, EDITION_DIRECTORY, `preview-${variant}.html`),
        preview.html,
        "utf8",
      );
    }),
  );
  console.log(`Generated ${VARIANTS.length} Edition 11 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 11 preview generation failed safely.");
  process.exitCode = 1;
});
