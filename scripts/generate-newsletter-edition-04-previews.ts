import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition04PreviewContent,
  type NewsletterEdition04ContentVariant,
} from "@/lib/newsletter/edition-04-content";
import { loadNewsletterEdition04Source } from "@/lib/newsletter/edition-04-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-08-27";
const PREVIEW_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition04-preview-token-fixture-000000000000";
const VARIANTS: readonly NewsletterEdition04ContentVariant[] = [
  "national",
  "madrid",
  "a-coruna",
  "barcelona",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition04Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition04PreviewContent(
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
  console.log(`Generated ${VARIANTS.length} Edition 04 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 04 preview generation failed safely.");
  process.exitCode = 1;
});
