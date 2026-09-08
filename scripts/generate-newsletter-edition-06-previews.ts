import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition06PreviewContent,
  type NewsletterEdition06ContentVariant,
} from "@/lib/newsletter/edition-06-content";
import { loadNewsletterEdition06Source } from "@/lib/newsletter/edition-06-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-10";
const PREVIEW_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition06-preview-token-fixture-000000000000";
const VARIANTS: readonly NewsletterEdition06ContentVariant[] = [
  "national",
  "madrid",
  "a-coruna",
  "barcelona",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition06Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition06PreviewContent(
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
  console.log(`Generated ${VARIANTS.length} Edition 06 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 06 preview generation failed safely.");
  process.exitCode = 1;
});
