import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../../app/preview/redesign-v2/buscar/page.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("./search/SearchPageExperience.client.tsx", import.meta.url), "utf8");
const searchModel = readFileSync(new URL("./search/search-page-model.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("./site/V2PreviewShell.tsx", import.meta.url), "utf8");
const shellStyles = readFileSync(new URL("./site/V2PreviewShell.module.css", import.meta.url), "utf8");
const searchStyles = readFileSync(new URL("./search/SearchPageExperience.module.css", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./site/preview-navigation.ts", import.meta.url), "utf8");
const mobileNavigation = readFileSync(new URL("./MobileNavigation.client.tsx", import.meta.url), "utf8");
const eventCard = readFileSync(new URL("./EventCard.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../../app/sitemap.ts", import.meta.url), "utf8");

test("Search A1 conserva page.tsx como servidor y limita la interacción al cliente", () => {
  assert.doesNotMatch(route, /["']use client["']/);
  assert.match(client, /^["']use client["']/);
  assert.match(route, /await connection\(\)/);
  assert.match(route, /getVisibleEvents\(\)/);
  assert.match(route, /<SearchPageExperience/);
  assert.match(route, /<V2PreviewShell/);
});

test("la metadata Preview es noindex/nofollow y no publica canonical ni JSON-LD", () => {
  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /noimageindex:\s*true/);
  assert.doesNotMatch(route, /canonical|alternates|application\/ld\+json|JSON-LD/);
  assert.doesNotMatch(sitemap, /preview\/redesign-v2\/buscar/);
});

test("el registry mantiene Home y Search dentro de Preview y marca los demás fallbacks", () => {
  assert.match(navigation, /home:[\s\S]*?previewHref:\s*"\/preview\/redesign-v2"/);
  assert.match(navigation, /search:[\s\S]*?previewHref:\s*"\/preview\/redesign-v2\/buscar"/);
  assert.match(navigation, /previewFallback:\s*"production"/);
  for (const href of [
    "/eventos-motor-este-fin-de-semana",
    "/calendario",
    "/disciplinas",
    "/zonas",
    "/newsletter",
    "/mis-eventos",
    "/publicar-evento",
  ]) assert.match(navigation, new RegExp(href.replaceAll("/", "\\/")));
});

test("el shell reutiliza el menú móvil accesible y no crea un segundo sistema", () => {
  assert.match(shell, /import MobileNavigation/);
  assert.match(shell, /<MobileNavigation items=/);
  assert.match(mobileNavigation, /aria-expanded=\{open\}/);
  assert.match(mobileNavigation, /event\.key === "Escape"/);
  assert.match(mobileNavigation, /buttonRef\.current\?\.focus\(\)/);
  assert.match(mobileNavigation, /data-preview-fallback=\{item\.previewFallback\}/);
});

test("breadcrumbs, H1 y footer compartido tienen estructura semántica", () => {
  assert.match(shell, /<nav aria-label="Migas de pan">/);
  assert.match(shell, /<ol className=\{styles\.breadcrumbs\}>/);
  assert.match(shell, /<h1 id="redesign-v2-interior-title">/);
  assert.match(shell, /<footer className=\{styles\.footer\}>/);
  assert.match(shell, /<CookieSettingsButton \/>/);
});

test("el shell documenta la duplicación temporal sin tocar tokens Home", () => {
  assert.match(shellStyles, /TEMPORARY_INTERIOR_TOKEN_DUPLICATION/);
  assert.match(shellStyles, /--orange:\s*#ff6200/);
  assert.match(shellStyles, /--ink:\s*#05070a/);
  assert.match(shellStyles, /width:\s*min\(1188px, calc\(100% - 48px\)\)/);
});

test("URL-state usa los seis parámetros y no navega por cada pulsación", () => {
  for (const param of ["q", "place", "date", "discipline", "vehicle", "page"]) {
    assert.match(searchModel, new RegExp(`params\\.set\\(\"${param}\"`));
  }
  assert.match(client, /onSubmit=\{submit\}/);
  assert.match(client, /router\.push\(href/);
  assert.match(client, /router\.replace\(href/);
  assert.match(client, /parseSearchPageState\(searchParams\)/);
  assert.doesNotMatch(client, /onChange=\{[^}]*router\.(?:push|replace)/);
  assert.match(client, /else if \(event\.key === "Enter"\) \{[\s\S]*?applyDraftSearch\(\)/);
  assert.match(client, /onBlur=\{closeSuggestions\}/);
  assert.match(searchStyles, /@media \(max-width:\s*760px\)[\s\S]*?\.suggestions\s*\{[\s\S]*?max-height:\s*132px/);
});

test("la fecha mantiene un único input nativo y el contrato iOS", () => {
  assert.equal(client.match(/type="date"/g)?.length, 1);
  assert.match(client, /data-selected=\{Boolean\(draft\.date && selectedDateLabel\)\}/);
  assert.match(client, /Ver eventos activos ese día\./);
  assert.match(client, /Toca la fecha para cambiarla\./);
  assert.match(searchStyles, /@media \(max-width:\s*760px\)[\s\S]*?font-size:\s*16px/);
  assert.match(searchStyles, /-webkit-appearance:\s*none/);
});

test("paginación presenta doce resultados y reequilibra después del slice", () => {
  assert.match(searchModel, /SEARCH_PAGE_SIZE = 12/);
  const resultBuilder = searchModel.slice(searchModel.indexOf("export function buildSearchPageResults"));
  assert.ok(resultBuilder.indexOf("filtered.slice(start, start + SEARCH_PAGE_SIZE)") < resultBuilder.indexOf("rebalanceVisibleV2EventImages"));
  assert.match(client, /Anterior/);
  assert.match(client, /Página \{results\.page\} de \{results\.pageCount\}/);
  assert.match(client, /Siguiente/);
  assert.match(searchStyles, /min-height:\s*46px/);
});

test("EventCard permanece compartida y enlaza intencionadamente a la ficha pública", () => {
  assert.match(client, /import EventCard from "\.\.\/EventCard"/);
  assert.match(client, /<EventCard event=\{event\}/);
  assert.match(eventCard, /previewEventHref\(event\)/);
  assert.doesNotMatch(client, /SearchEventCard/);
});

test("resultado y vacío son accesibles y no incluyen datos ficticios", () => {
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /aria-atomic="true"/);
  assert.match(client, /No hemos encontrado eventos con esos filtros\./);
  assert.match(client, /Limpiar filtros/);
  assert.doesNotMatch(client, /900\+|vista de lista|list toggle/i);
});

test("la cuadrícula responde 3/2/1 y los controles mantienen targets táctiles", () => {
  assert.match(searchStyles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(searchStyles, /@media \(max-width:\s*900px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(searchStyles, /@media \(max-width:\s*620px\)[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(searchStyles, /min-height:\s*52px/);
  assert.match(shellStyles, /overflow-x:\s*clip/);
});

test("analytics de búsqueda no envía texto libre ni PII", () => {
  const analyticsBlock = client.slice(client.indexOf('trackEvent("search_events"'), client.indexOf('navigate(next, "push"'));
  assert.match(analyticsBlock, /results_count/);
  assert.match(analyticsBlock, /has_query/);
  assert.match(analyticsBlock, /page_path:\s*pathname/);
  assert.doesNotMatch(analyticsBlock, /currentPagePath/);
  assert.doesNotMatch(analyticsBlock, /search_term|email|(?:query|place):\s*next\.(?:q|place)/);
});
