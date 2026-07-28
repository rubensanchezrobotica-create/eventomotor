import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("la ficha aplica redirect permanente en servidor antes del 404", () => {
  assert.match(page, /permanentRedirect\(redirectHref\)/);
  assert.match(page, /eventSlugRedirectHref\(slug, await searchParams\)/);
  assert.ok(page.indexOf("permanentRedirect(redirectHref)") < page.indexOf("notFound();"));
});

test("canonical, Open Graph y JSON-LD se construyen con el slug almacenado", () => {
  assert.match(page, /event\.slug \|\| requestedSlug/);
  assert.match(page, /alternates: \{ canonical: url \}/);
  assert.match(page, /openGraph: \{[\s\S]*?\n\s+url,/);
  assert.match(page, /url,\s+mainEntityOfPage: url,/);
});
