import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("app/preview/redesign-v2/zonas/page.tsx");
const component = source("components/redesign-v2/zones/ZonesDirectoryPage.tsx");
const model = source("components/redesign-v2/zones/territory-directory-model.ts");
const styles = source("components/redesign-v2/zones/ZonesDirectoryPage.module.css");
const navigation = source("components/redesign-v2/site/preview-navigation.ts");
const sitemap = source("app/sitemap.ts");

test("A7.3 crea una única ruta preview server-first y reutiliza el shell V2", () => {
  assert.match(route, /await connection\(\)/);
  assert.equal((route.match(/getVisibleEvents\(\)/g) || []).length, 1);
  assert.match(route, /buildTerritoryDirectoryModel/);
  assert.match(route, /<V2PreviewShell/);
  assert.match(route, /<ZonesDirectoryPage model=\{model\}/);
  assert.doesNotMatch(route, /["']use client["']/);
  assert.doesNotMatch(component, /["']use client["']/);
});

test("A7.3 mantiene la preview fuera del índice sin cambiar sitemap o canonicales", () => {
  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /nocache:\s*true/);
  assert.doesNotMatch(route, /canonical|application\/ld\+json|generateMetadata/);
  assert.doesNotMatch(sitemap, /preview\/redesign-v2\/zonas/);
});

test("A7.3 deriva el directorio en servidor sin payload completo ni interacción cliente", () => {
  assert.match(model, /SPANISH_TERRITORIES\.map/);
  assert.match(model, /matchEventToSpanishTerritory/);
  assert.match(model, /isSpanishTerritoryEvent/);
  assert.match(model, /madridCalendarDateKey/);
  assert.doesNotMatch(component, /onClick=|<button|<input|<select/);
  assert.doesNotMatch(route, /events=\{|events=\{events\}/);
});

test("A7.3 renderiza 17 comunidades y separa Ceuta y Melilla sin macrozonas", () => {
  assert.match(component, /model\.communities\.map/);
  assert.match(component, /model\.autonomousCities\.map/);
  assert.match(component, /Comunidades autónomas/);
  assert.match(component, /Ciudades autónomas/);
  assert.doesNotMatch(component, /Norte|Centro|Cataluña-Aragón|Levante|Sur|Canarias/);
});

test("A7.3 usa anchors reales sólo cuando el contrato proporciona href", () => {
  assert.match(component, /territory\.href \? \(/);
  assert.match(component, /<Link[\s\S]*?href=\{territory\.href\}/);
  assert.match(component, /Detalle en preparación/);
  assert.match(component, /Más información próximamente/);
  assert.doesNotMatch(component, /Landing no publicada|catálogo territorial|Territorios conocidos/);
  assert.doesNotMatch(component, /aria-disabled|href=["']#["']/);
});

test("A7.3 cambia sólo el destino preview de Zonas y conserva producción", () => {
  assert.match(navigation, /territories:[\s\S]*?productionHref:\s*"\/zonas"[\s\S]*?previewHref:\s*"\/preview\/redesign-v2\/zonas"/);
});

test("A7.3 protege grid, tactilidad, foco heredado, overflow y densidad móvil", () => {
  assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /@media \(max-width: 350px\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /min-width:\s*0/);
  assert.match(styles, /overflow:\s*hidden/);
});

test("A7.3 no introduce imágenes, mapas, buscadores ni enlaces provinciales", () => {
  assert.doesNotMatch(route + component, /next\/image|<Image|mapbox|leaflet|google maps/i);
  assert.doesNotMatch(component, /buscar|filtro|province.*href/i);
});
