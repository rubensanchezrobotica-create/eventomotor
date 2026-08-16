import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../../app/preview/redesign-v2/eventos-motor-este-fin-de-semana/page.tsx", import.meta.url), "utf8");
const experience = readFileSync(new URL("./WeekendPageExperience.client.tsx", import.meta.url), "utf8");
const search = readFileSync(new URL("./WeekendSearchExperience.client.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./WeekendEventCard.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./WeekendPageExperience.module.css", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../../../app/sitemap.ts", import.meta.url), "utf8");

test("A3 es una página servidor aislada que filtra datos reales antes del cliente", () => {
  assert.match(page, /await connection\(\)/);
  assert.match(page, /getVisibleEvents/);
  assert.match(page, /getVehicleType/);
  assert.match(page, /projectPreviewEvent/);
  assert.match(page, /eventIntersectsWeekend/);
  assert.match(page, /<V2PreviewShell/);
  assert.match(page, /<WeekendPageExperience events=\{weekendEvents\}/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(experience, /^["']use client["']/);
  assert.doesNotMatch(page, /components\/preview\/weekend|app\/eventos-motor-este-fin-de-semana/);
});

test("A3 es noindex, nofollow, nocache, sin canonical, JSON-LD ni sitemap", () => {
  assert.match(page, /index:\s*false/);
  assert.match(page, /follow:\s*false/);
  assert.match(page, /nocache:\s*true/);
  assert.doesNotMatch(page, /canonical|application\/ld\+json/i);
  assert.doesNotMatch(sitemap, /preview\/redesign-v2\/eventos-motor-este-fin-de-semana/);
});

test("el buscador conserva el lenguaje Home, autocomplete accesible y sólo dos filtros avanzados", () => {
  assert.match(search, />¿Qué buscas\?</);
  assert.match(search, /placeholder="Evento, ciudad o ubicación"/);
  assert.match(search, /buildPreviewSuggestions/);
  assert.match(search, /Ubicación/);
  assert.match(search, /Evento/);
  assert.match(search, /Disciplina/);
  assert.match(search, /ArrowDown/);
  assert.match(search, /ArrowUp/);
  assert.match(search, /Escape/);
  assert.match(search, /role="combobox"/);
  assert.match(search, /role="listbox"/);
  assert.match(search, /name="discipline"/);
  assert.match(search, /name="vehicle"/);
  assert.doesNotMatch(search, /name="date"|name="place"|name="day"/);
});

test("la URL sólo usa q, discipline, vehicle, day y page y el día es un control independiente", () => {
  assert.match(experience, /parseWeekendUrlState/);
  assert.match(experience, /serializeWeekendUrlState/);
  assert.match(experience, /useSearchParams/);
  assert.match(experience, /router\.replace/);
  assert.match(experience, /router\.push/);
  assert.match(experience, /dayOptions\.map/);
  assert.match(experience, /aria-pressed=\{state\.day === day\}/);
  assert.doesNotMatch(experience, /[?&]date=|[?&]month=|\/buscar/);
});

test("la página ofrece tarjetas reales, acciones existentes, detalle público y Calendar Preview", () => {
  assert.match(card, /previewEventHref/);
  assert.match(card, /<EventRetentionActions/);
  assert.match(card, /<TrackLink/);
  assert.match(card, /previewEventStatus/);
  assert.match(card, /formatWeekendEventDate/);
  assert.match(experience, /\/preview\/redesign-v2\/calendario/);
  assert.doesNotMatch(card, /precio|entradas desde|popular|personas interesadas/i);
});

test("la secuencia visible pagina a 12 y diversifica después del slice", () => {
  const paginationIndex = experience.indexOf("paginateWeekendEvents");
  const diversityIndex = experience.indexOf("diversifyWeekendVisibleImages", paginationIndex);
  assert.match(experience, /WEEKEND_PAGE_SIZE/);
  assert.ok(paginationIndex >= 0);
  assert.ok(diversityIndex > paginationIndex);
  assert.match(experience, /pagination\.visible\.map/);
});

test("sólo la paginación explícita arma scroll y respeta movimiento reducido", () => {
  const changePage = experience.slice(experience.indexOf("function changePage"), experience.indexOf("return ("));
  assert.match(experience, /const pendingPaginationScroll = useRef\(false\)/);
  assert.match(experience, /if \(!pendingPaginationScroll\.current\) return/);
  assert.match(changePage, /pendingPaginationScroll\.current = true/);
  assert.match(experience, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(experience, /popstate[\s\S]*pendingPaginationScroll\.current = true/);
});

test("los controles táctiles y el layout móvil tienen contrato sin overflow", () => {
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.eventGrid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /min-width:\s*0/);
  assert.match(styles, /overflow:\s*hidden/);
});

test("A3.1 deja Calendar en el módulo permanente y compacta el empty sin CTA duplicado", () => {
  assert.doesNotMatch(experience, /Ver el calendario completo/);
  assert.doesNotMatch(experience, /aria-hidden="true">↗/);
  assert.match(experience, /Planifica todo el mes/);
  assert.match(experience, /href="\/preview\/redesign-v2\/calendario">Abrir calendario/);
  assert.match(styles, /\.emptyState\s*\{[\s\S]*?padding:\s*44px 20px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.emptyState\s*\{[\s\S]*?padding:\s*30px 18px/);
});

test("A3.1 muestra limpiar sólo con filtros de búsqueda y conserva el día", () => {
  const clearEmpty = experience.slice(experience.indexOf("function clearEmptySearchFilters"), experience.indexOf("function clearQuery"));
  assert.match(experience, /const hasSearchFilters = Boolean\(state\.q \|\| state\.discipline \|\| state\.vehicle\)/);
  assert.match(experience, /hasSearchFilters \? "Prueba con otro día o elimina los filtros para ampliar la agenda\." : "Prueba con otro día para ampliar la agenda\."/);
  assert.match(experience, /\{hasSearchFilters \? <button[^>]+onClick=\{clearEmptySearchFilters\}[^>]*>Limpiar filtros<\/button> : null\}/);
  assert.match(clearEmpty, /navigate\(\{ \.\.\.state, q: "", discipline: "", vehicle: "", page: 1 \}\)/);
  assert.doesNotMatch(clearEmpty, /day:/);
});

test("A3.1 reduce sólo la densidad desktop y conserva el selector móvil 2 por 2", () => {
  assert.match(styles, /@media \(min-width: 1025px\)[\s\S]*?min-height:\s*144px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.dayButtons\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.dayButtons button\s*\{[\s\S]*?min-height:\s*98px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.resultsHeader h2\s*\{[\s\S]*?font-size:\s*clamp\(1\.7rem, 7\.2vw, 1\.82rem\)/);
});

test("las métricas no contienen la consulta ni datos personales", () => {
  const applySearch = experience.slice(experience.indexOf("function applySearch"), experience.indexOf("function clearFilters"));
  const searchMetric = applySearch.match(/trackEvent\("search_events",\s*(\{[^;]+\})\);/)?.[1] ?? "";
  assert.match(applySearch, /trackEvent\("search_events"/);
  assert.ok(searchMetric);
  assert.doesNotMatch(searchMetric, /query:|q:/);
  assert.doesNotMatch(experience, /email|subscriber|recipient/i);
});
