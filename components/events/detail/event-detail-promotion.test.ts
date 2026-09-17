import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("la ficha pública usa V2 sin retirar el renderer neutral de la Preview histórica", () => {
  const publicRoute = readFileSync(new URL("../../../app/evento/[slug]/page.tsx", import.meta.url), "utf8");
  const publicSeo = readFileSync(new URL("../../../lib/event-page-seo.ts", import.meta.url), "utf8");
  const previewRoute = readFileSync(new URL("../../../app/preview/evento/[slug]/page.tsx", import.meta.url), "utf8");
  const view = readFileSync(new URL("../../redesign-v2/event-detail/EventDetailV2.tsx", import.meta.url), "utf8");

  assert.match(publicRoute, /components\/redesign-v2\/event-detail\/EventDetailV2/);
  assert.match(publicRoute, /routeContext="public"/);
  assert.match(previewRoute, /components\/events\/detail\/EventDetailView/);
  assert.match(publicRoute, /if \(!event\) notFound\(\)/);
  assert.match(publicRoute, /newsletterPublicLaunchEnabled =\s*publicConfiguration\.enabled/);
  assert.match(publicSeo, /alternates: \{ canonical: url \}/);
  assert.match(publicSeo, /openGraph:/);
  assert.match(publicSeo, /twitter:/);
  assert.match(publicRoute, /type="application\/ld\+json"/);
  assert.match(publicSeo, /"@type": "Event"/);
  assert.match(previewRoute, /isEventDetailPreviewAvailable/);
  assert.match(previewRoute, /index: false/);
  assert.match(previewRoute, /follow: false/);
  assert.match(view, /href=\{related\.href\}/);
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
