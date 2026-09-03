import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("app/preview/redesign-v2/disciplinas/[slug]/page.tsx");
const component = source("components/redesign-v2/discipline-detail/DisciplineDetailPage.tsx");
const assist = source("components/redesign-v2/discipline-detail/DisciplineSearchAssist.client.tsx");
const model = source("components/redesign-v2/discipline-detail/discipline-detail-model.ts");
const styles = source("components/redesign-v2/discipline-detail/DisciplineDetailPage.module.css");
const fontConfig = source("components/redesign-v2/redesign-v2-fonts.ts");
const sharedShellStyles = source("components/redesign-v2/site/V2PreviewShell.module.css");
const compactSignup = source("components/redesign-v2/newsletter/CompactAgendaSignup.client.tsx");
const compactStyles = source("components/redesign-v2/newsletter/CompactAgendaSignup.module.css");
const sitemap = source("app/sitemap.ts");
const rallyHero = readFileSync(join(
  process.cwd(),
  "public/images/redesign-v2/disciplines/hero-rallyes.png",
));
const circuitoHero = readFileSync(join(
  process.cwd(),
  "public/images/redesign-v2/disciplines/hero-circuito.png",
));
const offroadHero = readFileSync(join(
  process.cwd(),
  "public/images/redesign-v2/disciplines/hero-offroad.png",
));

test("A6 crea una sola ruta dinámica, server-first y con un único fetch visible", () => {
  assert.match(route, /params:\s*Promise<\{ slug: string \}>/);
  assert.match(route, /searchParams:\s*Promise/);
  assert.match(route, /await connection\(\)/);
  assert.equal((route.match(/getVisibleEvents\(\)/g) || []).length, 1);
  assert.match(route, /resolveDisciplineDetailDefinition\(slug\)/);
  assert.match(route, /if \(!definition\) notFound\(\)/);
  assert.match(route, /buildDisciplineDetailPageModel/);
  assert.doesNotMatch(route, /["']use client["']/);
  assert.doesNotMatch(component, /["']use client["']/);
  assert.doesNotMatch(model, /["']use client["']/);
  assert.match(assist, /^["']use client["'];/);
});

test("A6 mantiene la Preview noindex, nofollow, nocache y fuera del sitemap", () => {
  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /nocache:\s*true/);
  assert.match(route, /noimageindex:\s*true/);
  assert.doesNotMatch(route, /canonical|application\/ld\+json|generateMetadata/);
  assert.doesNotMatch(sitemap, /preview\/redesign-v2\/disciplinas\/\[slug\]/);
});

test("A6 reutiliza taxonomía, clasificación, semántica upcoming y paginación V2", () => {
  assert.match(model, /SEO_DISCIPLINES/);
  assert.match(model, /isDisciplineSlug/);
  assert.match(model, /classifyEventDisciplinePage/);
  assert.match(model, /isUpcomingDisciplineEvent/);
  assert.match(model, /buildDisciplinesPageModel/);
  assert.match(model, /paginateVisibleEvents/);
  assert.match(model, /resolveRedesignEventImages/);
  assert.doesNotMatch(model, /terms:\s*\[/);
  assert.doesNotMatch(model, /title\.includes|Math\.random|Date\.now/);
});

test("A6.6.4A conecta los heroes dedicados sin condicionales de slug en JSX", () => {
  assert.match(model, /DISCIPLINE_HERO_VISUALS/);
  assert.match(model, /rallyes:\s*\{[\s\S]*hero-rallyes\.png/);
  assert.match(model, /circuito:\s*\{[\s\S]*hero-circuito\.png/);
  assert.match(model, /offroad:\s*\{[\s\S]*hero-offroad\.png/);
  assert.match(route, /resolveDisciplineHeroVisual\(definition\.slug\)/);
  assert.match(route, /heroImageSrc=\{heroVisual\?\.src\}/);
  assert.doesNotMatch(route, /definition\.slug\s*===\s*["']rallyes["']/);
  assert.doesNotMatch(route, /definition\.slug\s*===\s*["']circuito["']/);
  assert.equal(rallyHero.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(circuitoHero.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(offroadHero.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});

test("A6 enlaza cards al Event Detail V2 y no crea Search ni enlaces públicos de evento", () => {
  assert.match(component, /`\/preview\/redesign-v2\/evento\/\$\{event\.slug \|\| event\.id\}`/);
  assert.doesNotMatch(component, /previewEventHref/);
  assert.doesNotMatch(component, /href=["']\/evento\//);
  assert.doesNotMatch(route, /\/buscar|\/preview\/redesign-v2\/buscar/);
  assert.match(component, /previewEventDateLabel/);
  assert.match(component, /previewEventStatus/);
  assert.match(component, /previewVehicleLabel/);
  assert.match(component, /RedesignV2\.module\.css/);
});

test("A6 presenta hero compacto, jerarquía única y eventos antes de conversión", () => {
  assert.match(route, /title=\{definition\.title\}/);
  assert.match(route, /description=\{definition\.description\}/);
  assert.match(route, /eyebrow="Disciplina"/);
  assert.equal((route.match(/<V2PreviewShell/g) || []).length, 1);
  assert.equal((component.match(/<CompactAgendaSignup/g) || []).length, 1);
  assert.ok(component.indexOf("model.items.map") < component.indexOf("<CompactAgendaSignup"));
  assert.doesNotMatch(styles, /#redesign-v2-interior-title[^,{]*\{[^}]*font-style:\s*normal/);
  assert.match(styles, /#redesign-v2-interior-title[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /font-size:\s*clamp\(1\.625rem,\s*8vw,\s*2\.4rem\)/);
  assert.match(styles, /\.resultsHeader h2[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /min-height:\s*286px/);
  assert.match(component, /Próximos eventos de \{model\.definition\.title\}/);
  assert.doesNotMatch(component, /precio|organizador|horario/i);
});

test("A6.3.2 sitúa el CTA de Calendar después de paginación y antes de Compact Agenda", () => {
  const paginationPosition = component.indexOf("<Pagination model={model} />");
  const calendarCtaPosition = component.indexOf("className={styles.calendarLink}");
  const compactAgendaPosition = component.indexOf("<CompactAgendaSignup");

  assert.equal((component.match(/className=\{styles\.calendarLink\}/g) || []).length, 1);
  assert.ok(paginationPosition < calendarCtaPosition);
  assert.ok(calendarCtaPosition < compactAgendaPosition);
  assert.match(
    component,
    /\{model\.items\.length \? \([\s\S]*className=\{styles\.calendarLink\}[\s\S]*href="\/preview\/redesign-v2\/calendario"[\s\S]*Ver calendario completo <span aria-hidden="true">→<\/span>[\s\S]*\) : null\}/,
  );
  assert.match(styles, /\.calendarLink\s*\{[\s\S]*margin-top:\s*32px/);
  assert.doesNotMatch(
    component,
    /<header className=\{styles\.resultsHeader\}>[\s\S]*className=\{styles\.calendarLink\}[\s\S]*<\/header>/,
  );
});

test("A6.1.3 mantiene la fotografía full-width y protege el encuadre responsive", () => {
  assert.match(styles, /background-repeat:\s*no-repeat,\s*no-repeat/);
  assert.match(styles, /background-position:\s*center,\s*center/);
  assert.match(styles, /background-size:\s*100%\s+100%,\s*cover/);
  assert.match(
    styles,
    /@media \(min-width:\s*681px\) and \(max-width:\s*1100px\)[\s\S]*background-position:\s*center,\s*\d+%\s+center/,
  );
  assert.match(
    styles,
    /@media \(max-width:\s*680px\)[\s\S]*background-size:\s*100%\s+100%,\s*cover/,
  );
  assert.doesNotMatch(styles, /clamp\(700px,\s*62vw,\s*1040px\)/);
});

test("A6 usa enlaces server-side accesibles, empty state y Compact Agenda intacta", () => {
  assert.match(component, /Paginación de eventos de la disciplina/);
  assert.match(component, /aria-current=\{item === model\.page \? "page"/);
  assert.match(component, /No hay próximos eventos publicados en esta disciplina/);
  assert.match(component, /\/preview\/redesign-v2\/calendario/);
  assert.match(component, /\/preview\/redesign-v2\/disciplinas/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /@media \(max-width: 350px\)/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(compactSignup, /requestNewsletterSubscription/);
  assert.match(compactStyles, /newsletter-phone\.webp/);
});

test("A6.2 incorpora q al modelo server-side sin crear ruta Search ni enviar eventos al cliente", () => {
  assert.match(route, /q\?:\s*string\s*\|\s*string\[\]/);
  assert.match(route, /query:\s*parseDisciplineDetailQuery\(query\.q\)/);
  assert.equal((route.match(/getVisibleEvents\(\)/g) || []).length, 1);
  assert.match(model, /classifyEventDisciplinePage[\s\S]*eventMatchesDisciplineSearch/);
  assert.match(model, /event\.title[\s\S]*event\.city[\s\S]*event\.province[\s\S]*event\.venue/);
  assert.doesNotMatch(component, /["']use client["']/);
  assert.equal(existsSync(join(process.cwd(), "app/preview/redesign-v2/buscar")), false);
  assert.equal(existsSync(join(process.cwd(), "app/buscar")), false);
});

test("A6.2 usa un formulario GET accesible, resetea page y conserva la query visible", () => {
  assert.match(assist, /<form[\s\S]*method="get"[\s\S]*role="search"/);
  assert.match(assist, /Buscar eventos en esta disciplina/);
  assert.match(assist, /type="search"/);
  assert.match(assist, /name="q"/);
  assert.match(component, /initialQuery=\{model\.query\}/);
  assert.match(assist, /value=\{query\}/);
  assert.match(assist, /Busca por evento, localidad o provincia\.\.\./);
  assert.match(assist, /type="submit">Buscar<\/button>/);
  assert.doesNotMatch(assist, /name="page"/);
  assert.match(assist, /Limpiar búsqueda/);
  assert.match(assist, /<svg aria-hidden="true"[\s\S]*currentColor/);
});

test("A6.2 preserva q sólo en paginación, mantiene fichas limpias y separa el empty filtrado", () => {
  assert.match(component, /disciplineDetailPageHref\(model\.definition\.slug, model\.page - 1, model\.query\)/);
  assert.match(component, /disciplineDetailPageHref\(model\.definition\.slug, item, model\.query\)/);
  assert.match(component, /disciplineDetailPageHref\(model\.definition\.slug, model\.page \+ 1, model\.query\)/);
  assert.match(component, /No hemos encontrado próximos eventos para/);
  assert.match(component, /0 resultados para/);
  assert.match(component, /1 resultado para/);
  assert.match(component, /`\/preview\/redesign-v2\/evento\/\$\{event\.slug \|\| event\.id\}`/);
  assert.ok(component.indexOf("<DisciplineSearchAssist") < component.indexOf("model.items.map"));
});

test("A6.2 mantiene targets táctiles, foco visible y composición móvil sin overflow", () => {
  assert.match(styles, /\.searchControl[\s\S]*min-height:\s*52px/);
  assert.match(styles, /\.searchSubmit[\s\S]*min-height:\s*52px/);
  assert.match(styles, /\.clearSearch[\s\S]*min-height:\s*44px/);
  assert.match(styles, /\.searchControl:focus-within/);
  assert.match(styles, /\.searchSubmit:focus-visible/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /\.searchControl input[\s\S]*font-size:\s*16px/);
});

test("A6.3 mantiene la página servidor y entrega al island un índice mínimo de la disciplina", () => {
  assert.doesNotMatch(component, /["']use client["']/);
  assert.match(component, /<DisciplineSearchAssist/);
  assert.match(component, /source=\{model\.suggestionIndex\}/);
  assert.match(model, /buildDisciplineSearchSuggestionIndex\(disciplineEvents\)/);
  assert.match(model, /type DisciplineSearchSuggestionSource = \{[\s\S]*slug: string;[\s\S]*title: string;[\s\S]*city\?: string;[\s\S]*province\?: string;[\s\S]*venue\?: string;/);
  assert.doesNotMatch(assist, /EventItem|description|schedule|officialUrl|organizer|imageUrl|SEO/);
  assert.equal((route.match(/getVisibleEvents\(\)/g) || []).length, 1);
});

test("A6.3 conserva GET progresivo y usa destinos V2 o query contextual según el tipo", () => {
  assert.match(assist, /action=\{action\}[\s\S]*method="get"/);
  assert.match(assist, /name="q"/);
  assert.match(assist, /type="submit">Buscar<\/button>/);
  assert.match(model, /`\/preview\/redesign-v2\/evento\/\$\{event\.slug\}`/);
  assert.match(model, /disciplineDetailPageHref\(disciplineSlug, 1, location\.queryValue\)/);
  assert.match(assist, /router\.push\(suggestion\.href\)/);
  assert.doesNotMatch(assist, /window\.location|target="_blank"/);
  assert.doesNotMatch(model, /kind:\s*["']discipline["']/);
});

test("A6.3 implementa el patrón combobox accesible de Home sin IDs globales", () => {
  assert.match(assist, /useId\(\)/);
  assert.match(assist, /role="combobox"/);
  assert.match(assist, /aria-autocomplete="list"/);
  assert.match(assist, /aria-expanded=\{showSuggestions\}/);
  assert.match(assist, /aria-controls=\{listboxId\}/);
  assert.match(assist, /aria-activedescendant=/);
  assert.match(assist, /role="listbox"/);
  assert.match(assist, /role="option"/);
  assert.match(assist, /event\.key === "ArrowDown"/);
  assert.match(assist, /event\.key === "ArrowUp"/);
  assert.match(assist, /event\.key === "Enter"/);
  assert.match(assist, /event\.key === "Escape"/);
  assert.match(assist, /event\.key === "Tab"/);
  assert.match(assist, /document\.addEventListener\("pointerdown"/);
  assert.match(assist, /onMouseDown=\{preserveInputFocus\}/);
});

test("A6.3 limita el dropdown móvil sin cambiar la geometría base del buscador", () => {
  assert.match(styles, /\.suggestions[\s\S]*z-index:\s*30/);
  assert.match(styles, /\.suggestions button[\s\S]*min-height:\s*54px/);
  assert.match(styles, /\.suggestions[\s\S]*overflow-x:\s*hidden/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.suggestions[\s\S]*max-height:\s*min\(330px, 46vh\)/);
  assert.match(styles, /\.searchControl[\s\S]*min-height:\s*52px/);
  assert.match(styles, /\.searchSubmit[\s\S]*min-height:\s*52px/);
});

test("A6.3 no crea endpoints ni rutas globales de búsqueda", () => {
  assert.equal(existsSync(join(process.cwd(), "app/preview/redesign-v2/buscar")), false);
  assert.equal(existsSync(join(process.cwd(), "app/api/autocomplete")), false);
  assert.equal(existsSync(join(process.cwd(), "app/api/discipline-search")), false);
});

test("A6.3.3P2 configura Archivo estática 900 con normal e italic sin ejes variables", () => {
  assert.match(fontConfig, /import\s*\{\s*Archivo\s*\}\s*from\s*["']next\/font\/google["']/);
  assert.doesNotMatch(fontConfig, /Archivo_Narrow|Roboto_Condensed/);
  assert.match(fontConfig, /weight:\s*["']900["']/);
  assert.match(fontConfig, /style:\s*\[["']normal["'],\s*["']italic["']\]/);
  assert.match(fontConfig, /subsets:\s*\[["']latin["']\]/);
  assert.match(fontConfig, /display:\s*["']swap["']/);
  assert.match(fontConfig, /variable:\s*["']--font-v2-display-pilot["']/);
  assert.doesNotMatch(fontConfig, /axes|wdth|font-variation-settings/);
});

test("A6.3.3P2 limita el piloto tipográfico al wrapper servidor de Discipline Detail", () => {
  assert.match(route, /redesignV2DisplayPilot/);
  assert.match(route, /className=\{redesignV2DisplayPilot\.variable\}/);
  assert.match(route, /data-v2-display-font-pilot="archivo"/);
  assert.doesNotMatch(route, /["']use client["']/);
  assert.doesNotMatch(component, /redesignV2DisplayPilot|font-v2-display-pilot/);
  assert.doesNotMatch(assist, /redesignV2DisplayPilot|font-v2-display-pilot/);
  assert.doesNotMatch(compactSignup, /redesignV2DisplayPilot|font-v2-display-pilot/);
  assert.doesNotMatch(compactStyles, /font-v2-display-pilot/);
  assert.doesNotMatch(sharedShellStyles, /font-v2-display-pilot/);
});

test("A6.3.3P2 aplica Archivo sólo al H1 compartido y al H2 de resultados", () => {
  assert.equal((styles.match(/var\(--font-v2-display-pilot\)/g) || []).length, 2);
  assert.match(
    styles,
    /\.resultsHeader h2\s*\{[\s\S]*font-family:\s*var\(--font-v2-display-pilot\),\s*"Arial Narrow",\s*Arial,\s*sans-serif;[\s\S]*font-style:\s*normal;[\s\S]*font-stretch:\s*condensed;[\s\S]*font-weight:\s*900;/,
  );
  assert.match(
    styles,
    /:global\(body\):has\(\.page\)\s*:global\(#redesign-v2-interior-title\)\s*\{[\s\S]*font-family:\s*var\(--font-v2-display-pilot\),\s*"Arial Narrow",\s*Arial,\s*sans-serif;/,
  );
  assert.doesNotMatch(styles, /font-variation-settings|wdth/);
});

test("A6.3.3P2 conserva wrapping natural y la geometría editorial aprobada", () => {
  const resultsHeadingBlock = styles.match(/\.resultsHeader h2\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(resultsHeadingBlock, /max-width:\s*760px/);
  assert.match(resultsHeadingBlock, /font-size:\s*clamp\(2rem, 4vw, 3\.35rem\)/);
  assert.match(resultsHeadingBlock, /line-height:\s*0\.98/);
  assert.match(resultsHeadingBlock, /letter-spacing:\s*-0\.05em/);
  assert.match(resultsHeadingBlock, /text-wrap:\s*balance/);
  assert.doesNotMatch(resultsHeadingBlock, /white-space:\s*nowrap|word-break/);
  assert.doesNotMatch(component, /<br\s*\/?\s*>/);
});
