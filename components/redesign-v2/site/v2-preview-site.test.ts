import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getInteriorNavigationIds, getV2MobileNavigationIds, resolveInteriorNavigationItem, resolveInteriorNavigationItems, resolveNewsletterSurface } from "./preview-navigation";

function source(relativePath: string) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
}

const shell = readFileSync(new URL("./V2PreviewShell.tsx", import.meta.url), "utf8");
const interiorShell = readFileSync(new URL("./V2InteriorShell.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./preview-navigation.ts", import.meta.url), "utf8");
const mobileNavigation = readFileSync(new URL("./InteriorMobileNavigation.client.tsx", import.meta.url), "utf8");
const home = source("components/redesign-v2/RedesignV2Home.tsx");
const publicHome = source("app/page.tsx");
const homeStyles = source("components/redesign-v2/RedesignV2.module.css");
const interiorStyles = readFileSync(new URL("./V2PreviewShell.module.css", import.meta.url), "utf8");
const calendarPage = source("app/calendario/page.tsx");
const weekendPage = source("app/eventos-motor-este-fin-de-semana/page.tsx");
const disciplinesPage = source("components/redesign-v2/disciplines/DisciplinesPage.tsx");
const disciplineDetail = source("components/redesign-v2/discipline-detail/DisciplineDetailPage.tsx");
const compactAgenda = source("components/redesign-v2/newsletter/CompactAgendaSignup.client.tsx");
const displayFont = source("components/redesign-v2/redesign-v2-fonts.ts");

test("el shell interior conserva breadcrumbs, PageHero fotográfico y footer configurables", () => {
  assert.match(shell, /<V2InteriorShell \{\.\.\.props\} navigationMode="preview" \/>/);
  assert.match(interiorShell, /breadcrumbs\.map/);
  assert.match(interiorShell, /<h1[\s\S]*?id="redesign-v2-interior-title"[\s\S]*?>\{title\}<\/h1>/);
  assert.match(interiorShell, /<p>\{description\}<\/p>/);
  assert.match(interiorShell, /heroImageSrc/);
  assert.match(interiorShell, /<footer className=\{styles\.footer\}>/);
});

test("la navegación interior mantiene los destinos Preview y la jerarquía pública por superficie", () => {
  assert.deepEqual(getInteriorNavigationIds("public", "desktop"), [
    "calendar",
    "weekend",
    "disciplines",
    "territories",
    "favorites",
  ]);
  assert.deepEqual(getInteriorNavigationIds("public", "mobile"), [
    "calendar",
    "weekend",
    "disciplines",
    "territories",
    "favorites",
    "publish",
    "contact",
  ]);
  assert.deepEqual(getInteriorNavigationIds("preview", "desktop"), [
    "calendar",
    "weekend",
    "disciplines",
    "territories",
    "favorites",
  ]);
  assert.deepEqual(getInteriorNavigationIds("preview", "mobile"), [
    "calendar",
    "weekend",
    "disciplines",
    "territories",
    "favorites",
    "publish",
    "contact",
  ]);
  assert.deepEqual(getInteriorNavigationIds("preview", "desktop"), getInteriorNavigationIds("public", "desktop"));
  assert.deepEqual(getInteriorNavigationIds("preview", "mobile"), getInteriorNavigationIds("public", "mobile"));
  assert.equal(resolveInteriorNavigationItem("weekend", "public").href, "/eventos-motor-este-fin-de-semana");
  assert.equal(resolveInteriorNavigationItem("weekend", "preview").href, "/eventos-motor-este-fin-de-semana");
  assert.equal(resolveInteriorNavigationItem("weekend", "public").label, "Fin de semana");
  assert.equal(resolveInteriorNavigationItem("publish", "preview").variant, "primary");
  assert.equal(resolveInteriorNavigationItem("contact", "preview").variant, "default");
  assert.equal(resolveInteriorNavigationItem("newsletter", "public").href, "/newsletter");
  assert.equal(resolveInteriorNavigationItem("newsletter", "preview").href, "/preview/redesign-v2/newsletter");
  assert.equal(resolveInteriorNavigationItem("newsletter", "public").label, "La Agenda Motor");
  assert.match(navigation, /territories:[\s\S]*?label:\s*"Zonas"[\s\S]*?productionHref:\s*"\/zonas"/);
  assert.match(interiorShell, /getInteriorNavigationIds\(navigationMode, "desktop"\)/);
  assert.match(interiorShell, /getV2MobileNavigationIds\(navigationMode, newsletterVisible\)/);
  assert.doesNotMatch(interiorShell, /usePathname|pathname/);
});

test("A14C-5 expone La Agenda Motor sin alterar la navegación primaria ni la altura de cabecera", () => {
  assert.deepEqual(getInteriorNavigationIds("public", "desktop"), [
    "calendar", "weekend", "disciplines", "territories", "favorites",
  ]);
  const mobile = getV2MobileNavigationIds("public", true);
  assert.equal(mobile.filter((id) => id === "newsletter").length, 1);
  assert.equal(mobile.indexOf("newsletter") + 1, mobile.indexOf("contact"));
  assert.doesNotMatch(getV2MobileNavigationIds("public", false).join(","), /newsletter/);
  assert.match(interiorShell, /newsletterVisible \? <PreviewAwareLink mode=\{newsletterLinkMode\} navigationId="newsletter">La Agenda Motor/);
  assert.match(interiorShell, /getV2MobileNavigationIds\(navigationMode, newsletterVisible\)/);
  assert.match(interiorShell, /<PreviewAwareLink mode=\{newsletterLinkMode\} navigationId="newsletter" \/>/);
  assert.match(home, /<PreviewAwareLink mode=\{newsletterLinkMode\} navigationId="newsletter" \/>/);
  assert.match(calendarPage, /newsletterContextualCta/);
  assert.match(weekendPage, /newsletterContextualCta/);
  assert.match(interiorShell, /<CompactAgendaSignup[\s\S]*?previewOnly=\{!newsletterSurface\.canSubmitLive\}/);
  assert.doesNotMatch(interiorShell, /¿Quieres recibir la agenda cada semana\?/);
  assert.doesNotMatch(interiorShell, /V2NewsletterFooterBlock|Los próximos eventos de motor, cada semana\./);
  assert.match(interiorStyles, /\.utilityBar\s*\{\s*min-height: 34px;/);
  assert.match(interiorStyles, /\.navbar\s*\{[\s\S]*?min-height: 70px;/);
  assert.doesNotMatch(getInteriorNavigationIds("public", "desktop").join(","), /newsletter/);
  assert.doesNotMatch(source("app/newsletter/page.tsx"), /\/preview\/redesign-v2\/newsletter/);
});

test("A14C-5C separa QA local/Preview de la autorización pública live", () => {
  const cases = [
    { label: "local", nodeEnv: "development", vercelEnv: undefined, publicLaunchAllowed: false, visible: true, canSubmitLive: false, href: "/preview/redesign-v2/newsletter" },
    { label: "Vercel Preview", nodeEnv: "production", vercelEnv: "preview", publicLaunchAllowed: false, visible: true, canSubmitLive: false, href: "/preview/redesign-v2/newsletter" },
    { label: "production live", nodeEnv: "production", vercelEnv: "production", publicLaunchAllowed: true, visible: true, canSubmitLive: true, href: "/newsletter" },
    { label: "production disabled", nodeEnv: "production", vercelEnv: "production", publicLaunchAllowed: false, visible: false, canSubmitLive: false, href: null },
  ] as const;

  for (const scenario of cases) {
    const surface = resolveNewsletterSurface({ navigationMode: "public", ...scenario });
    assert.equal(surface.visible, scenario.visible, scenario.label);
    assert.equal(surface.canSubmitLive, scenario.canSubmitLive, scenario.label);
    const mobile = getV2MobileNavigationIds("public", surface.visible);
    const items = resolveInteriorNavigationItems(mobile, "public", surface.linkMode);
    assert.equal(items.find((item) => item.id === "newsletter")?.href ?? null, scenario.href, scenario.label);
    assert.equal(items.find((item) => item.id === "contact")?.href, "/contacto", scenario.label);
    assert.equal(getInteriorNavigationIds("public", "desktop").includes("newsletter"), false);
  }

  assert.deepEqual(resolveNewsletterSurface({ navigationMode: "public", publicLaunchAllowed: true, nodeEnv: "production", vercelEnv: "preview" }), {
    visible: true, canSubmitLive: false, linkMode: "preview",
  });
  assert.equal(resolveNewsletterSurface({ navigationMode: "preview", publicLaunchAllowed: false, nodeEnv: "production", vercelEnv: "production" }).visible, false);
  assert.match(publicHome, /publicLaunchAllowed: newsletterPublicLaunchEnabled/);
  assert.match(publicHome, /newsletterQaVisible=\{newsletterSurface\.visible && !newsletterPublicLaunchEnabled\}/);
  assert.match(home, /const canSubmitLive = routeMode === "public" && newsletterCanSubmitLive/);
  assert.match(home, /previewOnly=\{!canSubmitLive\}/);
  assert.match(interiorShell, /resolveNewsletterSurface\(\{/);
  assert.match(interiorShell, /resolveInteriorNavigationItems\(mobileNavigation, navigationMode, newsletterLinkMode\)/);
  assert.match(interiorShell, /newsletterContextualCta && newsletterVisible/);
  assert.match(interiorShell, /mode=\{newsletterLinkMode\} navigationId="newsletter"/);
});

test("A14C-7 reutiliza la composición editorial de Disciplinas y elimina promos duplicadas", () => {
  assert.equal((disciplinesPage.match(/<CompactAgendaSignup/g) || []).length, 1);
  assert.equal((disciplineDetail.match(/<CompactAgendaSignup/g) || []).length, 1);
  assert.equal((interiorShell.match(/<CompactAgendaSignup/g) || []).length, 1);
  assert.match(compactAgenda, /data-newsletter-surface="v2-compact"/);
  assert.match(compactAgenda, /className=\{styles\.panel\}/);
  assert.match(interiorShell, /newsletterContextualCta && newsletterVisible/);
  assert.match(interiorShell, /previewOnly=\{!newsletterSurface\.canSubmitLive\}/);
  assert.match(interiorShell, /<footer className=\{styles\.footer\}>[\s\S]*?navigationId="newsletter"/);
  assert.match(home, /<footer className=\{styles\.footer\}>[\s\S]*?navigationId="newsletter"/);
  assert.doesNotMatch(interiorShell, /V2NewsletterFooterBlock|newsletterContextualCta a|¿Quieres recibir la agenda cada semana\?/);
  assert.doesNotMatch(home, /V2NewsletterFooterBlock|<CompactAgendaSignup/);
  assert.doesNotMatch(interiorStyles, /\.footerNewsletter|\.newsletterContextualCta/);
  assert.doesNotMatch(getInteriorNavigationIds("public", "desktop").join(","), /newsletter/);
  const submit = compactAgenda.slice(compactAgenda.indexOf("async function submit("), compactAgenda.indexOf("function resetResult()"));
  assert.match(submit, /if \(previewOnly\) \{\s*setState\("preview_submitted"\);\s*return;\s*\}/);
  assert.ok(submit.indexOf("if (previewOnly)") < submit.indexOf("requestNewsletterSubscription({"));
});

test("la cabecera compartida conserva Mis eventos, Publicar evento y Contacto en sus superficies aprobadas", () => {
  assert.match(
    navigation,
    /favorites:\s*\{\s*id:\s*"favorites",\s*label:\s*"Mis eventos",\s*productionHref:\s*"\/mis-eventos"\s*\}/,
  );
  assert.match(interiorShell, /export function V2GlobalHeader/);
  assert.match(interiorShell, /desktopNavigation\.map\(\(id\) =>/);
  assert.match(interiorShell, /className=\{styles\.publishButton\}[\s\S]*?navigationId="publish"/);
  assert.match(interiorShell, /<strong>EventoMotor<\/strong>[\s\S]*?navigationId="contact"/);
  assert.match(home, /<V2GlobalHeader[\s\S]*?navigationMode=\{routeMode\}/);
  assert.match(interiorShell, /<V2GlobalHeader[\s\S]*?navigationMode=\{navigationMode\}/);
  assert.doesNotMatch(home, /<header\b|<MobileNavigation/);
});

test("todas las superficies públicas V2 convergidas reciben el mismo shell público", () => {
  const directRoutes = [
    "app/calendario/page.tsx",
    "app/disciplinas/page.tsx",
    "app/zonas/page.tsx",
    "app/publicar-evento/page.tsx",
    "app/mis-eventos/page.tsx",
  ];

  for (const route of directRoutes) {
    const routeSource = source(route);
    assert.match(routeSource, /<V2InteriorShell/);
    assert.match(routeSource, /navigationMode="public"/);
  }

  const territoryRoute = source("app/eventos-motor-madrid/page.tsx");
  const territoryAdapter = source("components/regions/PublicRegionalLanding.tsx");
  assert.match(territoryRoute, /<PublicRegionalLanding/);
  assert.match(territoryAdapter, /<V2InteriorShell/);
  assert.match(territoryAdapter, /navigationMode="public"/);
});

test("los estados activos públicos se resuelven sin falsos positivos entre secciones", () => {
  const routeContracts = [
    ["app/calendario/page.tsx", "calendar"],
    ["app/disciplinas/page.tsx", "disciplines"],
    ["app/zonas/page.tsx", "territories"],
    ["app/publicar-evento/page.tsx", "publish"],
    ["app/mis-eventos/page.tsx", "favorites"],
  ] as const;

  for (const [route, expectedNavigationId] of routeContracts) {
    assert.match(source(route), new RegExp(`currentNavigationId="${expectedNavigationId}"`));
  }
  assert.match(source("components/regions/PublicRegionalLanding.tsx"), /currentNavigationId="territories"/);
  assert.match(interiorShell, /aria-current=\{currentNavigationId === id \? "page" : undefined\}/);
});

test("el registry no define Search como página y marca fallbacks de producción", () => {
  assert.doesNotMatch(navigation, /["']search["']|\/buscar/i);
  assert.match(navigation, /home:[\s\S]*?previewHref:\s*"\/preview\/redesign-v2"/);
  assert.match(navigation, /calendar:[\s\S]*?previewHref:\s*"\/preview\/redesign-v2\/calendario"/);
  assert.match(navigation, /previewFallback:\s*"production"/);
});

test("Home e interiores comparten la misma navegación móvil accesible", () => {
  assert.match(home, /import \{ V2GlobalHeader \} from "\.\/site\/V2InteriorShell"/);
  assert.match(interiorShell, /import InteriorMobileNavigation/);
  assert.match(interiorShell, /<InteriorMobileNavigation/);
  assert.match(mobileNavigation, /aria-expanded=\{open\}/);
  assert.match(mobileNavigation, /event\.key === "Escape"/);
  assert.match(mobileNavigation, /buttonRef\.current\?\.focus\(\)/);
});

test("A10D-R4 comparte Archivo 900 italic en los H1 de Home y Calendar sin cambiar otros héroes", () => {
  assert.match(displayFont, /Archivo\(\{[\s\S]*?weight: "900"[\s\S]*?style: \["normal", "italic"\]/);
  assert.match(home, /redesignV2DisplayPilot\.variable/);
  assert.match(calendarPage, /heroTitleFontClassName=\{redesignV2DisplayPilot\.variable\}/);
  assert.match(interiorShell, /data-v2-display-h1=\{heroTitleFontClassName \? "archivo" : undefined\}/);
  assert.match(homeStyles, /\.heroCopy h1\s*\{[^}]*font-family:\s*var\(--font-v2-display-pilot\), "Arial Narrow", Arial, sans-serif;[^}]*font-style:\s*italic;[^}]*font-weight:\s*900;/);
  assert.match(interiorStyles, /\.pageHero h1\s*\{[^}]*font-style:\s*italic;[^}]*font-weight:\s*900;/);
  assert.match(interiorStyles, /\.pageHero h1\[data-v2-display-h1="archivo"\]\s*\{\s*font-family:\s*var\(--font-v2-display-pilot\), "Arial Narrow", Arial, sans-serif;/);
});

test("A10D-R4 identifica semánticamente el CTA en ambos menús sin estilos posicionales", () => {
  assert.equal(resolveInteriorNavigationItem("publish", "public").variant, "primary");
  assert.equal(resolveInteriorNavigationItem("contact", "public").variant, "default");
  assert.equal(resolveInteriorNavigationItem("publish", "preview").variant, "primary");
  assert.match(home, /publishTrackingSource="header_cta"/);
  assert.match(mobileNavigation, /data-navigation-variant=\{item\.variant\}/);
  assert.match(interiorStyles, /\.mobileMenu a\[data-navigation-variant="primary"\]/);
  assert.doesNotMatch(interiorStyles, /\.mobileMenu a:last-child/);
});

test("A10D-R4 propaga el destino activo al menú móvil sin activar Contacto o el CTA por defecto", () => {
  assert.match(interiorShell, /<InteriorMobileNavigation[\s\S]*?currentNavigationId=\{currentNavigationId\}/);
  assert.match(mobileNavigation, /aria-current=\{currentNavigationId === item\.id && item\.variant !== "primary" \? "page" : undefined\}/);
  assert.match(interiorStyles, /\.mobileMenu a\[aria-current="page"\]/);
  for (const [route, id] of [
    ["app/calendario/page.tsx", "calendar"],
    ["app/disciplinas/page.tsx", "disciplines"],
    ["app/zonas/page.tsx", "territories"],
    ["app/mis-eventos/page.tsx", "favorites"],
    ["components/regions/PublicRegionalLanding.tsx", "territories"],
  ]) assert.match(source(route), new RegExp(`currentNavigationId="${id}"`));
  assert.doesNotMatch(getInteriorNavigationIds("public", "desktop").join(","), /contact/);
  assert.match(getInteriorNavigationIds("public", "mobile").join(","), /contact/);
});
