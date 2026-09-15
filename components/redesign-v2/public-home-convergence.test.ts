import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicRoute = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const previewRoute = readFileSync(new URL("../../app/preview/redesign-v2/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("./RedesignV2Home.tsx", import.meta.url), "utf8");
const mobileNavigation = readFileSync(new URL("./MobileNavigation.client.tsx", import.meta.url), "utf8");
const search = readFileSync(new URL("./SearchExperience.client.tsx", import.meta.url), "utf8");
const eventCard = readFileSync(new URL("./EventCard.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("./redesign-v2-model.ts", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");

test("A10C converge / al renderer V2 con contexto público explícito y datos por petición", () => {
  assert.match(publicRoute, /import RedesignV2Home from "@\/components\/redesign-v2\/RedesignV2Home"/);
  assert.match(publicRoute, /await connection\(\)/);
  assert.match(publicRoute, /getVisibleEvents\(\)/);
  assert.match(publicRoute, /<RedesignV2Home[\s\S]*?routeMode="public"/);
  assert.doesNotMatch(publicRoute, /PreviewHomePage|getHomeVisibleEvents|\/api\/events/);
});

test("A10C conserva la Preview noindex con contexto Preview explícito", () => {
  assert.match(previewRoute, /robots:\s*{[\s\S]*?index: false,[\s\S]*?follow: false/);
  assert.match(previewRoute, /<RedesignV2Home[\s\S]*?newsletterVisible[\s\S]*?routeMode="preview"/);
  assert.match(home, /routeMode: "preview" \| "public"/);
  assert.doesNotMatch(home, /usePathname|window\.location|replace\([^)]*preview\/redesign-v2/);
});

test("A10C preserva literalmente el SEO público de Home", () => {
  assert.match(publicRoute, /absolute: "EventoMotor \| Calendario nacional de eventos de motor"/);
  assert.match(publicRoute, /description: HOME_DESCRIPTION/);
  assert.match(publicRoute, /canonical: SITE_URL/);
  assert.match(publicRoute, /openGraph:\s*{[\s\S]*?url: SITE_URL,[\s\S]*?siteName: SITE_NAME/);
  assert.match(publicRoute, /twitter:\s*{[\s\S]*?card: "summary_large_image"/);
  assert.match(publicRoute, /"@type": "WebSite"/);
  assert.doesNotMatch(publicRoute, /robots:/);
});

test("A10C mantiene utilizable el destino #calendario sin tocar el redirect", () => {
  assert.match(home, /<section[^>]*id="calendario"[^>]*aria-labelledby="proximos-eventos"/);
  assert.match(home, /public:[\s\S]*?calendar: "\/#calendario"/);
  assert.match(nextConfig, /legacyRedirect\("\/calendario", PUBLIC_NAVIGATION\.calendar\)/);
});

test("A10C aplica la IA pública aprobada sin convertir Contacto en navegación desktop", () => {
  const publicDesktop = home.match(/const desktopNavigation = routeMode === "public"[\s\S]*?: \[/)?.[0] ?? "";
  const publicMobile = home.match(/const mobileNavigation = routeMode === "public"[\s\S]*?: \[/)?.[0] ?? "";

  for (const label of ["Calendario", "Disciplinas", "Zonas", "Mis eventos"]) {
    assert.match(publicDesktop, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(publicDesktop, /label: "Contacto"/);
  for (const label of ["Publicar evento", "Contacto"]) {
    assert.match(publicMobile, new RegExp(`label: "${label}"`));
  }
  assert.match(home, /<MobileNavigation items={mobileNavigation} \/>/);
  assert.match(mobileNavigation, /items: readonly MobileNavigationItem\[\]/);
});

test("A10C impide fugas Preview desde Home pública y conserva destinos públicos", () => {
  const publicRoutes = home.match(/public: \{[\s\S]*?\n  \},\n  preview:/)?.[0] ?? "";
  assert.doesNotMatch(publicRoutes, /\/preview\//);
  for (const href of ["/mis-eventos", "/disciplinas", "/zonas", "/publicar-evento", "/contacto"]) {
    assert.match(publicRoutes, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(eventCard, /routeMode === "preview" \? `\/preview\/redesign-v2\$\{publicHref\}` : publicHref/);
  assert.match(model, /return `\/evento\/\$\{event\.slug \|\| event\.id\}`/);
  assert.match(model, /href: "\/disciplinas\/rallyes"/);
  assert.match(model, /href: "\/eventos-motor-madrid"/);
});

test("A10C reutiliza la guarda pública de newsletter y mantiene Preview visible", () => {
  for (const guard of [
    "evaluateNewsletterPublicLaunchResendConfiguration",
    "evaluateNewsletterProductionCanaryResendConfiguration",
    "isNewsletterPublicLaunchPageRequestAllowed",
  ]) assert.match(publicRoute, new RegExp(guard));
  assert.match(publicRoute, /newsletterVisible={newsletterPublicLaunchEnabled}/);
  assert.match(home, /{newsletterVisible \? <section className={styles\.newsletterSection}/);
  assert.match(previewRoute, /newsletterVisible/);
});

test("A10C preserva búsqueda, fecha nativa, guardado y analítica existente", () => {
  assert.match(search, /type="date"/);
  assert.match(search, /trackEvent\("search_events"/);
  assert.match(search, /trackEvent\("filter_discipline"/);
  assert.match(search, /trackEvent\("filter_vehicle_type"/);
  assert.match(eventCard, /eventName="click_event_detail"/);
  assert.match(eventCard, /<EventRetentionActions[\s\S]*?compactIcons[\s\S]*?directChildren[\s\S]*?saveOnly/);
  assert.match(home, /eventName="click_publish_event"/);
  const eventNames = [...`${home}\n${search}\n${eventCard}`.matchAll(/(?:trackEvent\(|eventName=)"([^"]+)"/g)]
    .map((match) => match[1]);
  const approvedEventNames = new Set([
    "click_event_detail",
    "click_publish_event",
    "filter_discipline",
    "filter_vehicle_type",
    "filter_zone",
    "search_events",
  ]);
  assert.ok(eventNames.length > 0);
  assert.deepEqual(eventNames.filter((eventName) => !approvedEventNames.has(eventName)), []);
});

test("A10C deja las prestaciones globales bajo app/layout sin duplicarlas", () => {
  for (const owner of ["CookieConsent", "GoogleAnalytics", "ServiceWorkerRegistration"]) assert.match(layout, new RegExp(owner));
  assert.match(layout, /"@type": "Organization"/);
  assert.doesNotMatch(home, /CookieConsent|GoogleAnalytics|PwaRegister|"@type": "Organization"/);
});
