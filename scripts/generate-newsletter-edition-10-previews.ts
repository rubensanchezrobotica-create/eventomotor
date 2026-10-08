import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition10PreviewContent,
  type NewsletterEdition10ContentVariant,
} from "@/lib/newsletter/edition-10-content";
import { NEWSLETTER_EDITION_10_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL } from "@/lib/newsletter/edition-10-render-seal";
import { loadNewsletterEdition10Source } from "@/lib/newsletter/edition-10-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-08";
const VARIANTS: readonly NewsletterEdition10ContentVariant[] = [
  "national",
  "madrid",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition10Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition10PreviewContent(
        source,
        variant,
        NEWSLETTER_EDITION_10_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL,
      );
      await writeFile(
        resolve(root, EDITION_DIRECTORY, `preview-${variant}.html`),
        preview.html,
        "utf8",
      );
    }),
  );
  console.log(`Generated ${VARIANTS.length} Edition 10 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 10 preview generation failed safely.");
  process.exitCode = 1;
});
