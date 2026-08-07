import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../../app/preview/redesign-v2/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("./RedesignV2Home.tsx", import.meta.url), "utf8");
const eventCard = readFileSync(new URL("./EventCard.tsx", import.meta.url), "utf8");
const search = readFileSync(new URL("./SearchExperience.client.tsx", import.meta.url), "utf8");
const menu = readFileSync(new URL("./MobileNavigation.client.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("./redesign-v2-model.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("./RedesignV2.module.css", import.meta.url), "utf8");
const signup = readFileSync(new URL("../newsletter/NewsletterSignupForm.tsx", import.meta.url), "utf8");
const signupStyles = readFileSync(new URL("../newsletter/NewsletterPreview.module.css", import.meta.url), "utf8");

test("la ruta conserva el límite Server Component y la consulta pública actual", () => {
  assert.doesNotMatch(route, /["']use client["']/);
  assert.match(route, /getVisibleEvents\(\)/);
  assert.match(route, /await connection\(\)/);
  assert.match(route, /isRedesignPreviewAvailable\(\)/);
  assert.match(route, /notFound\(\)/);
});

test("la metadata interna impide indexación sin crear canonical", () => {
  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /noimageindex:\s*true/);
  assert.doesNotMatch(route, /canonical|alternates/);
});

test("el hero usa exactamente el recurso y API de Next 16 aprobados", () => {
  assert.match(home, /src="\/images\/redesign-v2\/hero-eventomotor\.webp"/);
  assert.match(home, /preload/);
  assert.match(home, /quality=\{75\}/);
  assert.match(home, /sizes="100vw"/);
  assert.doesNotMatch(home, /priority/);
});

test("la home conserva el límite servidor y delega la interactividad", () => {
  assert.doesNotMatch(home, /["']use client["']/);
  assert.match(search, /^["']use client["']/);
  assert.match(menu, /^["']use client["']/);
  assert.match(signup, /^["']use client["']/);
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /buttonRef\.current\?\.focus\(\)/);
});

test("newsletter unifica contenido, formulario real y fotografía aprobada", () => {
  assert.match(home, /import NewsletterSignupForm/);
  assert.match(home, /La Agenda Motor, por EventoMotor/);
  assert.match(home, /<NewsletterSignupForm appearance="homeEditorial" \/>/);
  assert.match(home, /newsletter-phone\.webp/);
  assert.match(home, /sizes="\(max-width: 800px\) 100vw, 45vw"/);
  assert.doesNotMatch(home, /NewsletterCaptureCard|Descubrir la newsletter/);
  assert.match(signup, /requestNewsletterSubscription\(\{/);
  assert.match(signup, /province:\s*province \|\| undefined/);
  assert.match(signup, /consentVersion:\s*NEWSLETTER_CONSENT_VERSION/);
  assert.match(signup, /data-newsletter-surface=\{appearance === "homeEditorial"/);
  assert.match(signupStyles, /\.homeEditorial \.formGrid/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.newsletterVisual\s*\{[\s\S]*?grid-row:\s*1/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.newsletterCopy\s*\{[\s\S]*?grid-row:\s*2/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.newsletterVisual::after[\s\S]*?linear-gradient/);
});

test("el buscador V2 reutiliza el motor de sugerencias y deja los filtros en segunda capa", () => {
  assert.match(search, /buildPreviewSuggestions/);
  assert.match(search, /@\/components\/preview\/search-preview-model/);
  assert.match(search, />¿Qué buscas\?</);
  assert.match(search, /placeholder="Evento, ciudad o ubicación"/);
  assert.match(search, /role="combobox"/);
  assert.match(search, /role="listbox"/);
  assert.match(search, /SUGGESTION_KIND_ORDER/);
  assert.match(search, /event\.key === "Escape"/);
  assert.match(search, /event\.key === "ArrowDown"/);
  assert.match(search, /Limpiar fecha/);
  assert.match(search, /reconcileAppliedTextFilter\(current, nextPlace\)/);
  assert.match(search, /type="search"/);
  assert.match(search, /setSuggestionsOpen\(nextPlace !== ""\)/);
  assert.ok(search.indexOf("redesign-v2-query") < search.indexOf("redesign-v2-advanced-filters"));
  assert.ok(search.indexOf("redesign-v2-advanced-filters") < search.indexOf('name="date"'));
  assert.doesNotMatch(search, /<span>Dónde<\/span>/);
  assert.doesNotMatch(search, /<span>Cuándo<\/span>/);
});

test("los enlaces de ficha y fallbacks respetan el contrato público", () => {
  assert.match(model, /`\/evento\/\$\{event\.slug \|\| event\.id\}`/);
  assert.match(model, /kind:\s*"representative"/);
  assert.match(model, /label:\s*"Imagen representativa"/);
});

test("las tarjetas comparten una fecha accesible para día y rangos reales", () => {
  assert.match(eventCard, /previewEventDateLabel\(event\)/);
  assert.match(eventCard, /date\.kind === "range"/);
  assert.match(eventCard, /date\.kind === "cross-month"/);
  assert.match(eventCard, /aria-label=\{date\.ariaLabel\}/);
  assert.match(styles, /\.dateBlockRange/);
  assert.match(styles, /\.dateBlockCrossMonth/);
  assert.match(styles, /\.dateLine/);
});

test("el destacado queda fuera de la agenda inmediata sin alterar el recuento total", () => {
  assert.match(home, /<EventCard[\s\S]*?event=\{featured\.event\}[\s\S]*?featured/);
  assert.match(home, /excludeEventId=\{featured\.event\?\.id\}/);
  assert.match(search, /excludePreviewEventById\(events, excludeEventId\)/);
  assert.match(search, /`\$\{events\.length\}[^`]+próximo evento/);
  assert.match(search, /"próximos eventos"/);
  assert.match(search, /"resultados"\} para tu búsqueda/);
});

test("móvil conserva un solo destacado dentro del hero y antes de la búsqueda", () => {
  assert.equal(search.match(/<form/g)?.length, 1);
  assert.equal(home.match(/event=\{featured\.event\}/g)?.length, 1);
  assert.ok(home.indexOf("className={`${styles.shell} ${styles.heroLayout}`}") < home.indexOf("{featured.event ?"));
  assert.ok(home.indexOf("{featured.event ?") < home.indexOf("className={`${styles.shell} ${styles.eventsSection}`}"));
  assert.doesNotMatch(search, /featuredEvent|featuredLabel|featuredWrap/);
  assert.match(search, /aria-controls="redesign-v2-advanced-filters"/);
  assert.match(search, /aria-expanded=\{advancedOpen\}/);
  assert.match(search, /data-open=\{advancedOpen\}/);
  assert.match(eventCard, /Destacado esta semana/);
  assert.match(eventCard, /className=\{styles\.featuredDesktopLabel\}/);
  assert.match(eventCard, /className=\{styles\.featuredMobileLabel\}/);
  assert.match(styles, /\.featuredMobileLabel\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.eventCardFeatured \.eventCardLink\s*\{[\s\S]*?grid-template-columns:\s*112px minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.eventCardFeatured \.eventCardBody h3\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.searchPanel\s*\{[\s\S]*?margin-top:\s*0/);
});

test("la cadena geométrica del selector de fecha contiene el control nativo de WebKit sin recortarlo", () => {
  const panelRule = styles.match(/\.searchPanel\s*\{([^}]*)\}/)?.[1] ?? "";
  const labelRule = styles.match(/\.searchPanel label\s*\{([^}]*)\}/)?.[1] ?? "";
  const dateRule = styles.match(/\.searchPanel input\[type="date"\]\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(panelRule, /max-inline-size:\s*100%/);
  assert.match(panelRule, /min-inline-size:\s*0/);
  assert.match(labelRule, /display:\s*block/);
  assert.match(labelRule, /max-inline-size:\s*100%/);
  assert.match(labelRule, /min-inline-size:\s*0/);
  assert.match(styles, /\.searchPanel input,[\s\S]*?box-sizing:\s*border-box/);
  assert.match(styles, /\.searchPanel input,[\s\S]*?display:\s*block/);
  assert.match(styles, /\.searchPanel input,[\s\S]*?max-width:\s*100%/);
  assert.match(styles, /\.searchPanel input,[\s\S]*?min-inline-size:\s*0/);
  assert.match(dateRule, /inline-size:\s*100%/);
  assert.match(dateRule, /max-inline-size:\s*100%/);
  assert.match(dateRule, /box-sizing:\s*border-box/);
  assert.match(dateRule, /-webkit-appearance:\s*none/);
  assert.doesNotMatch(dateRule, /overflow/);
  assert.match(styles, /::-webkit-date-and-time-value,[\s\S]*?min-inline-size:\s*0/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.searchPanel input,[\s\S]*?font-size:\s*16px/);
});

test("el modo móvil reduce la cabecera y colapsa filtros avanzados", () => {
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.utilityBar\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.advancedToggle\s*\{[\s\S]*?display:\s*flex/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.advancedFilters\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /\.advancedFilters\[data-open="true"\][\s\S]*?display:\s*grid/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*?\.searchPrimary\s*\{[\s\S]*?minmax\(0, 1fr\) auto auto/);
  assert.match(styles, /\.footer nav a,[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px/);
});

test("la resolución de imágenes es estable y contempla un fallback neutro", () => {
  assert.match(model, /function stableHash\(/);
  assert.match(model, /resolveRedesignEventImages/);
  assert.match(model, /kind:\s*"neutral"/);
  assert.match(model, /src:\s*null/);
});
