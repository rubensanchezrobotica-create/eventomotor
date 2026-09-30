import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition09PreviewContent,
  type NewsletterEdition09ContentVariant,
} from "@/lib/newsletter/edition-09-content";
import { loadNewsletterEdition09Source } from "@/lib/newsletter/edition-09-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-10-01";
const PREVIEW_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition09-preview-token-fixture-000000000000";
const VARIANTS: readonly NewsletterEdition09ContentVariant[] = [
  "national",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition09Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition09PreviewContent(
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
  console.log(`Generated ${VARIANTS.length} Edition 09 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 09 preview generation failed safely.");
  process.exitCode = 1;
});
