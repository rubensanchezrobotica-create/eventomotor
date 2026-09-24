import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const seo = readFileSync(new URL("../../../lib/event-page-seo.ts", import.meta.url), "utf8");
const redirects = readFileSync(new URL("../../../lib/event-slug-redirects.ts", import.meta.url), "utf8");
const eventPage = page.slice(page.indexOf("export default async function EventPage"));

test("Vall redirige antes de consultar eventos y los aliases previos conservan el fallback", () => {
  assert.match(page, /permanentRedirect\(redirectHref\)/);
  assert.match(page, /eventSlugRedirectHref\(slug, await searchParams\)/);
  assert.match(page, /shouldRedirectEventSlugBeforeLookup\(slug\)/);

  const prelookupRedirect = eventPage.indexOf("shouldRedirectEventSlugBeforeLookup(slug)");
  const eventLookup = eventPage.indexOf("getVisibleEvents()");
  const fallbackRedirect = eventPage.indexOf("if (!event && redirectHref) permanentRedirect(redirectHref)");
  const notFoundCall = eventPage.indexOf("notFound();");

  assert.ok(prelookupRedirect < eventLookup);
  assert.ok(eventLookup < fallbackRedirect);
  assert.ok(fallbackRedirect < notFoundCall);
});

test("RPM conserva su redirección pública previa como fallback tras la consulta", () => {
  assert.match(
    redirects,
    /"rpm-fest-night-demons-2026-2026-08-15": "rpm-fest-night-demons-2026"/,
  );
  assert.match(page, /if \(!event && redirectHref\) permanentRedirect\(redirectHref\)/);
  assert.ok(
    eventPage.indexOf("getVisibleEvents()")
      < eventPage.indexOf("if (!event && redirectHref) permanentRedirect(redirectHref)"),
  );
});

test("canonical, Open Graph y JSON-LD se construyen con el slug almacenado", () => {
  assert.match(seo, /event\.slug \|\| requestedSlug/);
  assert.match(seo, /alternates: \{ canonical: url \}/);
  assert.match(seo, /openGraph: \{[\s\S]*?\n\s+url,/);
  assert.match(seo, /url,\s+mainEntityOfPage: url,/);
});
