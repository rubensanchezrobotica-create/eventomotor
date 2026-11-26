import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { renderEdition17Draft } from "../lib/newsletter/edition-17-render";

const DIRECTORY = "docs/newsletter/ediciones/2026-11-26";

async function main(): Promise<void> {
  const root = resolve(process.cwd(), DIRECTORY);
  await mkdir(root, { recursive: true });
  for (const variant of ["national", "madrid"] as const) {
    const draft = renderEdition17Draft(variant);
    await Promise.all([
      writeFile(resolve(root, `preview-${variant}-draft.html`), draft.html, "utf8"),
      writeFile(resolve(root, `preview-${variant}-draft.txt`), draft.text, "utf8"),
    ]);
  }
  console.log("Edition 17 local previews generated with approved images; final visual QA and production seal pending.");
}

void main().catch(() => {
  console.error("Edition 17 draft generation failed safely.");
  process.exitCode = 1;
});
