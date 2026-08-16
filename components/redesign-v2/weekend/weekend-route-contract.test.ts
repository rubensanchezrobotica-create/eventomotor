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

test("A3.3 integra el selector en resultados y elimina el panel editorial independiente", () => {
  const resultsHeader = experience.slice(experience.indexOf('<div className={styles.resultsHeader}>'), experience.indexOf('{pagination.visible.length'));
  assert.doesNotMatch(experience, /className=\{styles\.daySelector\}|Tu agenda de motor|Elige un día o explora el fin de semana completo/);
  assert.match(resultsHeader, /Agenda seleccionada/);
  assert.match(resultsHeader, /formatWeekendRangeLabel\(range\)/);
  assert.match(resultsHeader, /className=\{styles\.dayButtons\}/);
  assert.equal((experience.match(/className=\{styles\.dayButtons\}/g) ?? []).length, 1);
  assert.match(experience, /aria-labelledby="weekend-v2-results-title"/);
});

test("A3.3.1 presenta un único control segmentado con cuatro celdas iguales", () => {
  assert.match(styles, /\.dayButtons\s*\{[\s\S]*?width:\s*min\(440px, 100%\)[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)[\s\S]*?gap:\s*0[\s\S]*?overflow:\s*hidden[\s\S]*?border:\s*1px solid #333b45/);
  assert.match(styles, /\.dayButtons button\s*\{[\s\S]*?height:\s*48px[\s\S]*?grid-template-rows:\s*repeat\(2, minmax\(0, auto\)\)[\s\S]*?border:\s*0[\s\S]*?border-radius:\s*0/);
  assert.match(styles, /\.dayButtons button \+ button\s*\{[\s\S]*?border-left:\s*1px solid #333b45/);
  assert.match(styles, /\.dayButtons button:focus-visible\s*\{[\s\S]*?box-shadow:\s*inset 0 0 0 3px #ff9d5d/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.dayButtons button\s*\{[\s\S]*?height:\s*56px/);
});

test("A3.2 conserva botones reales con aria-pressed y nombres accesibles completos", () => {
  assert.match(experience, /<button aria-current=\{isToday \? "date" : undefined\} aria-label=\{accessibleLabel\} aria-pressed=\{state\.day === day\}/);
  assert.match(experience, /const accessibleLabel = `\$\{label\}, \$\{date \? formatWeekendDayDate\(date\) : "fin de semana"\}, \$\{countLabel\}\$\{isToday \? ", hoy" : ""\}\.`/);
  assert.match(experience, /aria-label="Filtrar eventos por día del fin de semana"[^>]+role="group"/);
  assert.match(experience, /all:\s*"Todos"/);
  assert.match(experience, /fri:\s*"Vie"/);
  assert.match(experience, /sat:\s*"Sáb"/);
  assert.match(experience, /sun:\s*"Dom"/);
  assert.match(experience, /aria-hidden="true" className=\{styles\.dayLabel\}>\{compactLabel\}<\/span>/);
  assert.match(experience, /aria-hidden="true" className=\{styles\.dayMeta\}/);
});

test("A3.3.1 reserva dos líneas y mantiene Hoy dentro de la metadata", () => {
  const mobile = styles.slice(styles.indexOf("@media (max-width: 700px)"), styles.indexOf("@media (max-width: 350px)"));
  assert.match(mobile, /\.resultsMeta > strong\s*\{[\s\S]*?font-size:\s*clamp\(1\.375rem, 5\.8vw, 1\.5rem\)/);
  assert.doesNotMatch(mobile, /position:\s*absolute/);
  assert.match(experience, /\{dayCounts\[day\]\}\{isToday \? <span> · Hoy<\/span> : null\}/);
  assert.match(experience, /aria-current=\{isToday \? "date" : undefined\}/);
  assert.doesNotMatch(
    experience,
    /styles\.(?:desktopDaySummary|mobileDayLabel|mobileDayCount)/,
  );
  assert.match(styles, /\.dayLabel,\s*\.dayMeta\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums/);
});

test("A3.3.1 libera el H2 en desktop y ordena meta, selector y rango por breakpoint", () => {
  const resultsHeader = experience.slice(experience.indexOf('<div className={styles.resultsHeader}>'), experience.indexOf('{pagination.visible.length'));
  const meta = resultsHeader.slice(resultsHeader.indexOf('<div className={styles.resultsMeta}>'), resultsHeader.indexOf('<h2 id="weekend-v2-results-title">'));
  assert.match(meta, /Agenda seleccionada[\s\S]*?className=\{styles\.dayButtons\}[\s\S]*?formatWeekendRangeLabel\(range\)/);
  assert.doesNotMatch(meta, /<h2/);
  assert.match(styles, /\.resultsMeta\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(360px, 440px\) auto/);
  assert.match(styles, /@media \(max-width: 1024px\)[\s\S]*?\.resultsMeta\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*?\.dayButtons\s*\{[\s\S]*?grid-column:\s*1 \/ -1[\s\S]*?grid-row:\s*2/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.dayButtons\s*\{[\s\S]*?grid-row:\s*3[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
});

test("A3.2 presenta un único H2 contextual con pluralización y sin count móvil duplicado", () => {
  const resultHeader = experience.slice(experience.indexOf('<div className={styles.resultsHeader}>'), experience.indexOf('{pagination.visible.length'));
  assert.equal((resultHeader.match(/<h2(?:\s[^>]*)?>/g) ?? []).length, 1);
  assert.match(experience, /total === 1 \? "evento" : "eventos"/);
  assert.match(experience, /all:\s*"este fin de semana"/);
  assert.match(experience, /fri:\s*"este viernes"/);
  assert.match(experience, /sat:\s*"este sábado"/);
  assert.match(experience, /sun:\s*"este domingo"/);
  assert.match(experience, /formatWeekendResultHeading\(pagination\.total, state\.day\)/);
  assert.doesNotMatch(resultHeader, /<p>\{formatEventCount\(pagination\.total\)\}<\/p>/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.desktopResultsTitle\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.mobileResultsTitle\s*\{[\s\S]*?display:\s*inline/);
});

test("A3.3 mantiene Calendar y hace visible su flecha mediante currentColor", () => {
  assert.match(experience, /href="\/preview\/redesign-v2\/calendario">Abrir calendario <span aria-hidden="true">→<\/span>/);
  assert.match(styles, /\.calendarCta a span\s*\{[\s\S]*?color:\s*currentColor/);
  assert.match(styles, /\.eventDetailLink span\s*\{\s*color:\s*#ff6200;\s*\}/);
  assert.match(card, /Ver evento <span aria-hidden="true">→<\/span>/);
});

test("A3.2 documenta los seis resultados contextuales singular y plural", () => {
  const contexts = {
    all: "este fin de semana",
    fri: "este viernes",
    sat: "este sábado",
    sun: "este domingo",
  } as const;
  const heading = (total: number, day: keyof typeof contexts) => `${total} ${total === 1 ? "evento" : "eventos"} ${contexts[day]}`;
  assert.equal(heading(18, "all"), "18 eventos este fin de semana");
  assert.equal(heading(1, "all"), "1 evento este fin de semana");
  assert.equal(heading(4, "fri"), "4 eventos este viernes");
  assert.equal(heading(1, "fri"), "1 evento este viernes");
  assert.equal(heading(14, "sat"), "14 eventos este sábado");
  assert.equal(heading(10, "sun"), "10 eventos este domingo");
});

test("las métricas no contienen la consulta ni datos personales", () => {
  const applySearch = experience.slice(experience.indexOf("function applySearch"), experience.indexOf("function clearFilters"));
  const searchMetric = applySearch.match(/trackEvent\("search_events",\s*(\{[^;]+\})\);/)?.[1] ?? "";
  assert.match(applySearch, /trackEvent\("search_events"/);
  assert.ok(searchMetric);
  assert.doesNotMatch(searchMetric, /query:|q:/);
  assert.doesNotMatch(experience, /email|subscriber|recipient/i);
});
