import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicRouteSource = readFileSync(
  new URL("../../app/disciplinas/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const previewRouteSource = readFileSync(
  new URL("../../app/preview/disciplinas/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("./DisciplinePreviewPage.tsx", import.meta.url),
  "utf8",
);
const explorerSource = readFileSync(
  new URL("./DisciplineExplorer.tsx", import.meta.url),
  "utf8",
);
const eventCardSource = readFileSync(
  new URL("./DisciplineEventCard.tsx", import.meta.url),
  "utf8",
);
const sitemapSource = readFileSync(
  new URL("../../app/sitemap.ts", import.meta.url),
  "utf8",
);

test("la pública converge a V2 sin cambiar el contrato de filtros y la preview histórica", () => {
  assert.match(publicRouteSource, /DisciplineDetailPage/);
  assert.match(publicRouteSource, /V2InteriorShell/);
  assert.match(publicRouteSource, /navigationMode="public"/);
  assert.match(publicRouteSource, /routeContext="public"/);
  assert.match(publicRouteSource, /buildDisciplinePreviewData/);
  assert.match(publicRouteSource, /parseDisciplineFilters/);
  assert.match(publicRouteSource, /buildPublicDisciplineDetailPageModel/);
  assert.match(publicRouteSource, /getVisibleEvents/);
  assert.doesNotMatch(publicRouteSource, /DisciplinePreviewPage/);
  assert.match(previewRouteSource, /DisciplinePreviewPage/);
  assert.match(previewRouteSource, /buildDisciplinePreviewData/);
  assert.match(previewRouteSource, /parseDisciplineFilters/);
  assert.match(previewRouteSource, /getVisibleEvents/);
  assert.match(previewRouteSource, /mode="preview"/);
});

test("la pública elimina el matcher textual y valida slugs antes de clasificar", () => {
  assert.match(publicRouteSource, /if \(!isDisciplineSlug\(slug\)\) notFound\(\)/);
  assert.doesNotMatch(publicRouteSource, /matchesTerms|eventSearchText|discipline\.terms/);
  assert.match(publicRouteSource, /buildDisciplinePreviewData\(events, slug, now\)/);
});

test("la protección de preview no afecta a la ruta pública", () => {
  assert.match(previewRouteSource, /isDisciplinePreviewAvailable\(process\.env\.VERCEL_ENV\)/);
  assert.doesNotMatch(publicRouteSource, /VERCEL_ENV|isDisciplinePreviewAvailable/);
});

test("los enlaces y la analítica cambian de base sin duplicar componentes", () => {
  assert.match(pageSource, /mode === "preview" \? "\/preview\/disciplinas" : "\/disciplinas"/);
  assert.match(pageSource, /mode === "preview" \? "discipline_preview" : "discipline_public"/);
  assert.match(explorerSource, /disciplineFiltersToSearchParams/);
  assert.match(explorerSource, /nextDisciplineVisibleLimit/);
  assert.match(eventCardSource, /ZoneEventCard/);
});

test("la preview histórica conserva contenido editorial, FAQ e históricos", () => {
  assert.match(pageSource, /introParagraphs\(data\.discipline\.intro\)/);
  assert.match(pageSource, /DisciplineSeoDisclosure/);
  assert.match(pageSource, /Preguntas frecuentes/);
  assert.match(pageSource, /DisciplineHistory/);
});

test("el sitemap publica ocho disciplinas y nunca añade previews", () => {
  assert.match(sitemapSource, /SEO_DISCIPLINES\.map/);
  assert.match(sitemapSource, /`\/disciplinas\/\$\{discipline\.slug\}`/);
  assert.doesNotMatch(sitemapSource, /preview\/disciplinas/);
});
