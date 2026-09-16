import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getInteriorNavigationIds } from "./preview-navigation";

function source(relativePath: string) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
}

const shell = readFileSync(new URL("./V2PreviewShell.tsx", import.meta.url), "utf8");
const interiorShell = readFileSync(new URL("./V2InteriorShell.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./preview-navigation.ts", import.meta.url), "utf8");
const mobileNavigation = readFileSync(new URL("./InteriorMobileNavigation.client.tsx", import.meta.url), "utf8");
const home = source("components/redesign-v2/RedesignV2Home.tsx");

test("el shell interior conserva breadcrumbs, PageHero fotográfico y footer configurables", () => {
  assert.match(shell, /<V2InteriorShell \{\.\.\.props\} navigationMode="preview" \/>/);
  assert.match(interiorShell, /breadcrumbs\.map/);
  assert.match(interiorShell, /<h1 id="redesign-v2-interior-title">\{title\}<\/h1>/);
  assert.match(interiorShell, /<p>\{description\}<\/p>/);
  assert.match(interiorShell, /heroImageSrc/);
  assert.match(interiorShell, /<footer className=\{styles\.footer\}>/);
});

test("la navegación interior distingue el contrato público del Preview por superficie", () => {
  assert.deepEqual(getInteriorNavigationIds("public", "desktop"), [
    "calendar",
    "disciplines",
    "territories",
    "favorites",
  ]);
  assert.deepEqual(getInteriorNavigationIds("public", "mobile"), [
    "calendar",
    "disciplines",
    "territories",
    "favorites",
    "publish",
    "contact",
  ]);
  assert.deepEqual(getInteriorNavigationIds("preview", "desktop"), [
    "calendar",
    "disciplines",
    "territories",
    "contact",
  ]);
  assert.deepEqual(getInteriorNavigationIds("preview", "mobile"), [
    "calendar",
    "disciplines",
    "territories",
    "contact",
    "favorites",
    "publish",
  ]);
  assert.match(navigation, /territories:[\s\S]*?label:\s*"Zonas"[\s\S]*?productionHref:\s*"\/zonas"/);
  assert.match(interiorShell, /getInteriorNavigationIds\(navigationMode, "desktop"\)/);
  assert.match(interiorShell, /getInteriorNavigationIds\(navigationMode, "mobile"\)/);
  assert.doesNotMatch(interiorShell, /usePathname|pathname/);
});

test("la cabecera pública conserva Mis eventos, Publicar evento y Contacto en sus superficies aprobadas", () => {
  assert.match(
    navigation,
    /favorites:\s*\{\s*id:\s*"favorites",\s*label:\s*"Mis eventos",\s*productionHref:\s*"\/mis-eventos"\s*\}/,
  );
  assert.match(
    interiorShell,
    /navigationMode === "preview"[\s\S]*?className=\{styles\.favoritesLink\}[\s\S]*?navigationId="favorites"/,
  );
  assert.match(interiorShell, /className=\{styles\.publishButton\}[\s\S]*?navigationId="publish"/);
  assert.match(interiorShell, /<strong>EventoMotor<\/strong>[\s\S]*?navigationId="contact"/);
  assert.match(home, /routeMode === "public"[\s\S]*?label: "Calendario"[\s\S]*?label: "Disciplinas"[\s\S]*?label: "Zonas"[\s\S]*?label: "Mis eventos"/);
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

test("la navegación móvil interior es independiente del componente sagrado de Home", () => {
  assert.match(interiorShell, /import InteriorMobileNavigation/);
  assert.doesNotMatch(interiorShell, /\.\.\/MobileNavigation\.client/);
  assert.match(mobileNavigation, /aria-expanded=\{open\}/);
  assert.match(mobileNavigation, /event\.key === "Escape"/);
  assert.match(mobileNavigation, /buttonRef\.current\?\.focus\(\)/);
});
