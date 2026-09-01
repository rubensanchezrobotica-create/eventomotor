import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition05PreviewContent,
  type NewsletterEdition05ContentVariant,
} from "@/lib/newsletter/edition-05-content";
import { loadNewsletterEdition05Source } from "@/lib/newsletter/edition-05-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-03";
const PREVIEW_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition05-preview-token-fixture-000000000000";
const VARIANTS: readonly NewsletterEdition05ContentVariant[] = [
  "national",
  "madrid",
  "a-coruna",
  "barcelona",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition05Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition05PreviewContent(
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
  console.log(`Generated ${VARIANTS.length} Edition 05 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 05 preview generation failed safely.");
  process.exitCode = 1;
});
