import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  prepareEdition08PreviewContent,
  type NewsletterEdition08ContentVariant,
} from "@/lib/newsletter/edition-08-content";
import { loadNewsletterEdition08Source } from "@/lib/newsletter/edition-08-source.server";

const EDITION_DIRECTORY = "docs/newsletter/ediciones/2026-09-24";
const PREVIEW_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition08-preview-token-fixture-000000000000";
const VARIANTS: readonly NewsletterEdition08ContentVariant[] = [
  "national",
  "madrid",
  "cataluna",
  "comunidad-valenciana",
];

async function main(): Promise<void> {
  const root = process.cwd();
  const source = await loadNewsletterEdition08Source(root);
  await Promise.all(
    VARIANTS.map(async (variant) => {
      const preview = prepareEdition08PreviewContent(
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
  console.log(`Generated ${VARIANTS.length} Edition 08 previews from the runtime renderer.`);
}

void main().catch(() => {
  console.error("Edition 08 preview generation failed safely.");
  process.exitCode = 1;
});
