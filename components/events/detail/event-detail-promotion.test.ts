import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("pública y preview consumen una única presentación neutral", () => {
  const publicRoute = readFileSync(new URL("../../../app/evento/[slug]/page.tsx", import.meta.url), "utf8");
  const previewRoute = readFileSync(new URL("../../../app/preview/evento/[slug]/page.tsx", import.meta.url), "utf8");
  const view = readFileSync(new URL("./EventDetailView.tsx", import.meta.url), "utf8");

  assert.match(publicRoute, /components\/events\/detail\/EventDetailView/);
  assert.match(previewRoute, /components\/events\/detail\/EventDetailView/);
  assert.match(publicRoute, /if \(!event\) notFound\(\)/);
  assert.match(publicRoute, /footerContactTrackingLocation="event_detail_footer"/);
  assert.match(publicRoute, /alternates: \{ canonical: url \}/);
  assert.match(publicRoute, /openGraph:/);
  assert.match(publicRoute, /twitter:/);
  assert.match(publicRoute, /type="application\/ld\+json"/);
  assert.match(publicRoute, /"@type": "Event"/);
  assert.match(previewRoute, /isEventDetailPreviewAvailable/);
  assert.match(previewRoute, /index: false/);
  assert.match(previewRoute, /follow: false/);
  assert.match(view, /href=\{`\/evento\/\$\{relatedSlug\}`\}/);
  assert.doesNotMatch(publicRoute, /\/preview\/evento/);
});

test("la presentación mantiene condicionales para programa, contenido y CTA", () => {
  const view = readFileSync(new URL("./EventDetailView.tsx", import.meta.url), "utf8");

  assert.match(view, /\{aboutText \? \(/);
  assert.match(view, /\{event\.scheduleText \? \(/);
  assert.match(view, /\{primaryAction \? \(/);
  assert.match(view, /eventImagePoster/);
  assert.match(view, /eventImageFallback/);
});
