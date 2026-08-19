import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition03PreviewContent,
  type NewsletterEdition03ContentVariant,
} from "@/lib/newsletter/edition-03-content";
import { loadNewsletterEdition03Source } from "@/lib/newsletter/edition-03-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-20";
const PREVIEW_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition03-preview-token-fixture-000000000000";
const VARIANTS: readonly NewsletterEdition03ContentVariant[] = [
  "national",
  "madrid",
  "a-coruna",
  "barcelona",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition03Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition03PreviewContent(
        source,
        variant,
        PREVIEW_UNSUBSCRIBE_URL,
      );
      await writeFile(
        resolve(root, EDITION_DIRECTORY, `preview-${variant}.html`),
        preview.html,
        "utf8",
      );
    }),
  );
  console.log(`Generated ${VARIANTS.length} Edition 03 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 03 preview generation failed safely.");
  process.exitCode = 1;
});
