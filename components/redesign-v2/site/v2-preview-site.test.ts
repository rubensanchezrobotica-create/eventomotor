import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("./V2PreviewShell.tsx", import.meta.url), "utf8");
const interiorShell = readFileSync(new URL("./V2InteriorShell.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./preview-navigation.ts", import.meta.url), "utf8");
const mobileNavigation = readFileSync(new URL("./InteriorMobileNavigation.client.tsx", import.meta.url), "utf8");

test("el shell interior conserva breadcrumbs, PageHero fotográfico y footer configurables", () => {
  assert.match(shell, /<V2InteriorShell \{\.\.\.props\} navigationMode="preview" \/>/);
  assert.match(interiorShell, /breadcrumbs\.map/);
  assert.match(interiorShell, /<h1 id="redesign-v2-interior-title">\{title\}<\/h1>/);
  assert.match(interiorShell, /<p>\{description\}<\/p>/);
  assert.match(interiorShell, /heroImageSrc/);
  assert.match(interiorShell, /<footer className=\{styles\.footer\}>/);
});

test("la navegación primaria interior contiene sólo Calendario, Disciplinas, Zonas y Contacto", () => {
  assert.match(interiorShell, /const desktopNavigation = \["calendar", "disciplines", "territories", "contact"\]/);
  assert.match(navigation, /territories:[\s\S]*?label:\s*"Zonas"[\s\S]*?productionHref:\s*"\/zonas"/);
  assert.doesNotMatch(interiorShell, /const desktopNavigation = \[[^\]]*"home"/);
  assert.doesNotMatch(interiorShell, /const desktopNavigation = \[[^\]]*"weekend"/);
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
