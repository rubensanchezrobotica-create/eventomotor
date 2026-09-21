import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

for (const { route, component } of [
  { route: "preview-home", component: "HomePage" },
  { route: "preview-concept", component: "ConceptHomePage" },
] as const) {
  test(`${route} is noindex and calls notFound before rendering in production`, () => {
    const page = source(`app/${route}/page.tsx`);

    assert.match(page, /export const metadata: Metadata = \{\s*robots: \{\s*index: false,\s*follow: false,/);
    assert.doesNotMatch(page, /canonical|alternates:/);
    assert.match(page, /if \(process\.env\.VERCEL_ENV === "production"\) notFound\(\);/);
    assert.equal((page.match(/notFound\(\)/g) ?? []).length, 1);
    assert.ok(page.indexOf('if (process.env.VERCEL_ENV === "production") notFound();') < page.indexOf(`return <${component} />;`));
    assert.match(page, new RegExp(`return <${component} \\/>;`));
    assert.doesNotMatch(page, /redirect\(|permanentRedirect\(/);
  });
}

test("legacy preview routes stay out of the sitemap and the V2 guard is unchanged", () => {
  const sitemap = source("app/sitemap.ts");
  const redesignPreview = source("app/preview/redesign-v2/page.tsx");

  assert.doesNotMatch(sitemap, /preview-home|preview-concept/);
  assert.match(redesignPreview, /if \(!isRedesignPreviewAvailable\(\)\) notFound\(\)/);
});
