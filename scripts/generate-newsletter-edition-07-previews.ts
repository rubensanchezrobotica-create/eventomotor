import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition07PreviewContent,
  type NewsletterEdition07ContentVariant,
} from "@/lib/newsletter/edition-07-content";
import { loadNewsletterEdition07Source } from "@/lib/newsletter/edition-07-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-17";
const PREVIEW_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition07-preview-token-fixture-000000000000";
const VARIANTS: readonly NewsletterEdition07ContentVariant[] = [
  "national",
  "madrid",
  "a-coruna",
  "barcelona",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition07Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition07PreviewContent(
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
  console.log(`Generated ${VARIANTS.length} Edition 07 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 07 preview generation failed safely.");
  process.exitCode = 1;
});
