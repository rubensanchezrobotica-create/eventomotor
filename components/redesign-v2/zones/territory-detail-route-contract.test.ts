import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("app/preview/redesign-v2/zonas/[territory]/page.tsx");
const component = source("components/redesign-v2/zones/TerritoryDetailPage.tsx");
const model = source("components/redesign-v2/zones/territory-detail-model.ts");
const styles = source("components/redesign-v2/zones/TerritoryDetailPage.module.css");
const directoryModel = source("components/redesign-v2/zones/territory-directory-model.ts");
const sitemap = source("app/sitemap.ts");

test("A7.5B crea una única ruta dinámica server-first y obtiene eventos una vez", () => {
  assert.match(route, /params:\s*Promise<\{ territory: string \}>/);
  assert.match(route, /searchParams:\s*Promise/);
  assert.match(route, /await connection\(\)/);
  assert.equal((route.match(/getVisibleEvents\(\)/g) || []).length, 1);
  assert.match(route, /resolvePreviewTerritory\(territorySlug\)/);
  assert.match(route, /if \(!territory\) notFound\(\)/);
  assert.match(route, /buildTerritoryDetailPageModel/);
  assert.doesNotMatch(route, /["']use client["']/);
  assert.doesNotMatch(component, /["']use client["']/);
  assert.doesNotMatch(model, /["']use client["']/);
});

test("A7.5B mantiene Preview noindex sin canonical, JSON-LD ni sitemap público", () => {
  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /nocache:\s*true/);
  assert.match(route, /noimageindex:\s*true/);
  assert.doesNotMatch(route, /canonical|application\/ld\+json|generateMetadata/);
  assert.doesNotMatch(sitemap, /preview\/redesign-v2\/zonas\/\[territory\]/);
});

test("A7.5B reutiliza territorio, próxima fecha, imágenes y paginación V2 sin inferencia textual", () => {
  assert.match(model, /isSpanishTerritoryEvent/);
  assert.match(model, /matchEventToSpanishTerritory\(event\)\?\.id === territory\.id/);
  assert.match(model, /isUpcomingTerritoryEvent/);
  assert.match(model, /classifyEventDisciplinePage/);
  assert.match(model, /paginateVisibleEvents/);
  assert.match(model, /resolveRedesignEventImages/);
  assert.doesNotMatch(model, /matchEventToSpanishTerritory\(event\.(?:title|venue|city|tags)/);
  assert.doesNotMatch(model, /Math\.random|Date\.now/);
});

test("A7.5B reutiliza exactamente EventCard y no introduce una variante territorial", () => {
  assert.match(component, /import EventCard from ["']@\/components\/redesign-v2\/EventCard["']/);
  assert.equal((component.match(/<EventCard/g) || []).length, 1);
  assert.doesNotMatch(component, /TerritoryEventCard|ZoneEventCard|event\.imageUrl/);
  assert.match(component, /resolvedImage=\{item\.image\}/);
});

test("A7.5B implementa GET SSR, resetea page y limita los filtros al contrato", () => {
  assert.equal((component.match(/method="get"/g) || []).length, 3);
  assert.match(component, /name="q"/);
  assert.match(component, /name="province"/);
  assert.match(component, /name="discipline"/);
  assert.doesNotMatch(component, /name="page"/);
  assert.doesNotMatch(component, /name="(?:vehicle|date|weekend|next30|show)"/);
  assert.doesNotMatch(model, /show=all|vehicle|weekend|next30/);
  assert.match(component, /<details className=\{styles\.moreFilters\}/);
});

test("A7.5B ofrece enlaces reales de paginación, empty state y CTA sin anclas falsas", () => {
  assert.match(component, /Paginación de eventos en/);
  assert.match(component, /aria-current=\{item === model\.page \? "page"/);
  assert.match(component, /\/preview\/redesign-v2\/calendario/);
  assert.match(component, /\/publicar-evento/);
  assert.doesNotMatch(component, /href={["']#["']}|aria-disabled/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /:focus-visible/);
});

test("A7.5B conserva jerarquía tipográfica y hero territorial sin arte dedicado", () => {
  assert.match(route, /redesignV2DisplayPilot/);
  assert.match(route, /data-v2-display-font-pilot="archivo"/);
  assert.match(route, /eyebrow="Territorio"/);
  assert.match(route, /title=\{territory\.displayName\}/);
  assert.doesNotMatch(route, /heroImageSrc|heroImageAlt/);
  assert.match(styles, /#redesign-v2-interior-title[\s\S]*font-style:\s*italic/);
  assert.match(styles, /\.resultsHeader h2,[\s\S]*font-style:\s*normal/);
  assert.doesNotMatch(styles, /url\(/);
});

test("A7.5B enlaza las 17 comunidades al detalle Preview y conserva canonical aparte", () => {
  assert.match(directoryModel, /`\/preview\/redesign-v2\/zonas\/\$\{territory\.slug\}`/);
  assert.match(directoryModel, /publicCanonicalHref:\s*territory\.currentPublicCanonicalHref \?\? territory\.futurePublicCanonicalHref/);
  assert.doesNotMatch(directoryModel, /href:\s*territory\.currentPublicCanonicalHref/);
});

test("A7.5B protege responsive, overflow, tactilidad y filtros móviles colapsados", () => {
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /min-width:\s*0/);
  assert.match(styles, /@media \(max-width: 960px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(max-width: 350px\)/);
  assert.match(styles, /\.filterField input,[\s\S]*font-size:\s*16px/);
  assert.match(styles, /\.mobileFilters[\s\S]*display:\s*none/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.mobileFilters[\s\S]*display:\s*grid/);
  assert.match(styles, /\.moreFilters > summary[\s\S]*min-height:\s*46px/);
});

test("A7.5B-R1 compacta sólo el hero no móvil y el submit de inventario compacto", () => {
  assert.match(component, /singleConditionalFilter/);
  assert.match(component, /styles\.singleFilterForm/);
  assert.match(styles, /\.desktopFilterForm\.singleFilterForm\s*\{[\s\S]*?grid-template-columns:\s*minmax\(240px, 1fr\) auto/);
  assert.match(styles, /\.desktopFilterForm\.singleFilterForm \.applyFilters\s*\{[\s\S]*?width:\s*fit-content/);
  assert.match(styles, /data-a75-territory-detail[\s\S]*?min-height:\s*244px/);
  assert.match(styles, /data-a75-territory-detail[\s\S]*?section\[aria-labelledby="redesign-v2-interior-title"\] > div > span[\s\S]*?margin-top:\s*30px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?data-a75-territory-detail[\s\S]*?min-height:\s*256px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?section\[aria-labelledby="redesign-v2-interior-title"\] > div > span[\s\S]*?margin-top:\s*38px/);
  assert.match(model, /Descubre los próximos eventos de motor en \$\{model\.territory\.displayName\}/);
});

test("A7.5B sitúa contenido regional después de resultados sin duplicar la página pública", () => {
  assert.ok(component.indexOf("<Pagination model={model} />") < component.indexOf("<RegionalGuide model={model} />"));
  assert.match(component, /Guía de motor en \{model\.territory\.displayName\}/);
  assert.match(component, /model\.guideParagraphs/);
  assert.match(component, /model\.faqs/);
  assert.match(component, /model\.relatedLinks/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});
