import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("app/preview/redesign-v2/disciplinas/[slug]/page.tsx");
const component = source("components/redesign-v2/discipline-detail/DisciplineDetailPage.tsx");
const model = source("components/redesign-v2/discipline-detail/discipline-detail-model.ts");
const styles = source("components/redesign-v2/discipline-detail/DisciplineDetailPage.module.css");
const compactSignup = source("components/redesign-v2/newsletter/CompactAgendaSignup.client.tsx");
const compactStyles = source("components/redesign-v2/newsletter/CompactAgendaSignup.module.css");
const sitemap = source("app/sitemap.ts");
const rallyHero = readFileSync(join(
  process.cwd(),
  "public/images/redesign-v2/disciplines/hero-rallyes.png",
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

test("A6.1 conecta el recurso Rallyes exacto sin condicionales de slug en JSX", () => {
  assert.match(model, /DISCIPLINE_HERO_VISUALS/);
  assert.match(model, /rallyes:\s*\{[\s\S]*hero-rallyes\.png/);
  assert.match(route, /resolveDisciplineHeroVisual\(definition\.slug\)/);
  assert.match(route, /heroImageSrc=\{heroVisual\?\.src\}/);
  assert.doesNotMatch(route, /definition\.slug\s*===\s*["']rallyes["']/);
  assert.equal(rallyHero.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
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
  assert.match(styles, /#redesign-v2-interior-title[\s\S]*font-style:\s*normal/);
  assert.match(styles, /#redesign-v2-interior-title[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /font-size:\s*clamp\(1\.625rem,\s*8vw,\s*2\.4rem\)/);
  assert.match(styles, /\.resultsHeader h2[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /min-height:\s*286px/);
  assert.match(component, /Próximos eventos de \{model\.definition\.title\}/);
  assert.doesNotMatch(component, /precio|organizador|horario/i);
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
  assert.match(component, /<form[\s\S]*method="get"[\s\S]*role="search"/);
  assert.match(component, /Buscar eventos en esta disciplina/);
  assert.match(component, /type="search"/);
  assert.match(component, /name="q"/);
  assert.match(component, /defaultValue=\{model\.query\}/);
  assert.match(component, /Busca por evento, localidad o provincia\.\.\./);
  assert.match(component, /<button type="submit">Buscar<\/button>/);
  assert.doesNotMatch(component, /name="page"/);
  assert.match(component, /Limpiar búsqueda/);
  assert.match(component, /<svg aria-hidden="true"[\s\S]*currentColor/);
});

test("A6.2 preserva q sólo en paginación, mantiene fichas limpias y separa el empty filtrado", () => {
  assert.match(component, /disciplineDetailPageHref\(model\.definition\.slug, model\.page - 1, model\.query\)/);
  assert.match(component, /disciplineDetailPageHref\(model\.definition\.slug, item, model\.query\)/);
  assert.match(component, /disciplineDetailPageHref\(model\.definition\.slug, model\.page \+ 1, model\.query\)/);
  assert.match(component, /No hemos encontrado próximos eventos para/);
  assert.match(component, /0 resultados para/);
  assert.match(component, /1 resultado para/);
  assert.match(component, /`\/preview\/redesign-v2\/evento\/\$\{event\.slug \|\| event\.id\}`/);
  assert.ok(component.indexOf("className={styles.searchForm}") < component.indexOf("model.items.map"));
});

test("A6.2 mantiene targets táctiles, foco visible y composición móvil sin overflow", () => {
  assert.match(styles, /\.searchControl[\s\S]*min-height:\s*52px/);
  assert.match(styles, /\.searchForm button[\s\S]*min-height:\s*52px/);
  assert.match(styles, /\.clearSearch[\s\S]*min-height:\s*44px/);
  assert.match(styles, /\.searchControl:focus-within/);
  assert.match(styles, /\.searchForm button:focus-visible/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /\.searchControl input[\s\S]*font-size:\s*16px/);
});
