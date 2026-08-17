import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("app/preview/redesign-v2/evento/[slug]/page.tsx");
const component = source("components/redesign-v2/event-detail/EventDetailV2.tsx");
const styles = source("components/redesign-v2/event-detail/EventDetailV2.module.css");
const actionPanel = component.slice(component.indexOf("<aside"), component.indexOf("</aside>"));

test("A4 es una ruta dinámica servidor con loader público directo y notFound", () => {
  assert.match(route, /params: Promise<\{ slug: string \}>/);
  assert.match(route, /await connection\(\)/);
  assert.match(route, /getVisibleEvents\(\)/);
  assert.match(route, /candidate\.slug === slug/);
  assert.match(route, /if \(!event\) notFound\(\)/);
  assert.match(route, /if \(!model\) notFound\(\)/);
  assert.doesNotMatch(route, /"use client"/);
});

test("la Preview es noindex, nofollow y nocache sin canonical ni JSON-LD", () => {
  assert.match(route, /index: false/);
  assert.match(route, /follow: false/);
  assert.match(route, /nocache: true/);
  assert.doesNotMatch(route, /canonical|application\/ld\+json|generateMetadata/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});

test("A4 reutiliza el shell, favorito, ICS y compartir existentes", () => {
  assert.match(component, /V2PreviewShell/);
  assert.match(component, /EventRetentionActions/);
  assert.match(component, /calendarLabel="Añadir al calendario"/);
  assert.match(component, /compactIcons/);
  assert.match(component, /ShareEventButton/);
  assert.match(component, /url=\{model\.publicUrl\}/);
});

test("las acciones y fuentes externas mantienen semántica y rel seguro", () => {
  assert.match(component, /<a className=\{styles\.primaryAction\}/);
  assert.match(component, /rel="noopener noreferrer" target="_blank"/);
  assert.match(component, /aria-label="Acciones del evento"/);
  assert.match(actionPanel, /styles\.sourceLink/);
});

test("A4.1 convierte el panel en contexto de acción sin repetir hero metadata", () => {
  assert.doesNotMatch(actionPanel, /model\.date|model\.location|model\.discipline|model\.status/);
  assert.match(actionPanel, /model\.vehicle/);
  assert.match(actionPanel, /EventRetentionActions/);
  assert.match(actionPanel, /ShareEventButton/);
  assert.match(actionPanel, /model\.primaryAction/);
  assert.match(actionPanel, /model\.source/);
});

test("A4.1 renderiza Practical sólo con items adicionales", () => {
  assert.match(component, /model\.description \|\| model\.programSection \|\| model\.practicalItems\.length/);
  assert.match(component, /model\.practicalItems\.length \? \(/);
  assert.match(component, /<h2>Información útil<\/h2>/);
  assert.doesNotMatch(component, /model\.info|<h2>Datos del evento<\/h2>/);
});

test("A4.3 presenta estados excepcionales y oculta los estados ordinarios desde el modelo", () => {
  assert.match(actionPanel, /model\.exceptionalStatus/);
  assert.match(actionPanel, /Estado del evento/);
  assert.match(actionPanel, /data-status=\{model\.exceptionalStatus\.kind\}/);
  assert.doesNotMatch(actionPanel, /role="alert"|aria-live/);
});

test("A4.3 añade sólo contexto útil resuelto por el view model", () => {
  assert.match(actionPanel, /model\.distinctChampionship/);
  assert.match(actionPanel, /model\.countryContext/);
  assert.match(actionPanel, /model\.organizerContext/);
  assert.match(actionPanel, /rel="noopener noreferrer" target="_blank"/);
  assert.doesNotMatch(component, /needsReview|confidenceScore|verifiedAt|model\.tags|model\.latitude|model\.longitude|Precio/);
});

test("A4.3 usa acciones compactas existentes sin degradar Share ni el CTA", () => {
  assert.match(actionPanel, /<EventRetentionActions[\s\S]*?compactIcons[\s\S]*?directChildren/);
  assert.match(actionPanel, /ShareEventButton/);
  assert.match(actionPanel, /model\.primaryAction/);
  assert.match(styles, /\.actions :global\(\.emc-icon-action\)[\s\S]*?width: 48px/);
});

test("A4.3.1 usa un SVG decorativo currentColor para enlaces externos sin glifos Unicode", () => {
  assert.match(component, /function ExternalLinkIcon\(\)/);
  assert.match(component, /<svg[\s\S]*?aria-hidden="true"[\s\S]*?fill="none"[\s\S]*?focusable="false"/);
  assert.match(component, /stroke="currentColor"/);
  assert.match(component, /width="15"[\s\S]*?height="15"|height="15"[\s\S]*?width="15"/);
  assert.equal((`${component}\n${styles}`.match(/↗️?/gu) || []).length, 0);
  assert.match(actionPanel, /model\.organizerContext\.label[\s\S]*?<ExternalLinkIcon \/>/);
  assert.match(actionPanel, /model\.primaryAction\.label[\s\S]*?<ExternalLinkIcon \/>/);
  assert.match(actionPanel, /Fuente: \{model\.source\.label\}[\s\S]*?<ExternalLinkIcon \/>/);
});

test("A4.3 presenta el programa largo una vez y conserva Practical condicional", () => {
  assert.equal((component.match(/model\.programSection \? \(/g) || []).length, 1);
  assert.match(component, /<h2>Horarios y programa<\/h2>/);
  assert.match(styles, /\.program > p[\s\S]*?white-space: pre-line/);
  assert.match(component, /model\.practicalItems\.length \? \(/);
});

test("A4.3 aplica ritmo Related explícito sólo a fichas sin contenido intermedio", () => {
  assert.match(component, /model\.compactRelatedFlow \? styles\.relatedCompact/);
  assert.match(styles, /\.relatedCompact\s*\{[\s\S]*?margin-top/);
  assert.doesNotMatch(styles, /\.media(?:Real|Fallback)?\s*\{[^}]*height:\s*auto/);
});

test("A4.2 muestra venue como metadata secundaria del hero y no dentro de Practical", () => {
  assert.match(component, /model\.venue \? \(/);
  assert.match(component, /className=\{styles\.heroVenue\}>\{model\.venue\}/);
  assert.match(styles, /\.heroVenue\s*\{[^}]*display: inline-block/);
  assert.doesNotMatch(component.slice(component.indexOf("model.practicalItems.map")), /model\.venue/);
});

test("A4.2 usa el label relacionado ya deduplicado por el view model", () => {
  assert.match(component, /\{related\.label\}/);
  assert.doesNotMatch(component, /\{related\.context\} · \{related\.discipline\}/);
});

test("el breadcrumb móvil oculta el título actual sin dejar separador final", () => {
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /nav\[aria-label="Migas de pan"\] li:last-child\s*\{[\s\S]*?display: none/);
  assert.match(styles, /li:nth-last-child\(2\)::after\s*\{[\s\S]*?display: none/);
});

test("related usa la ruta A4 local y no construye un listado ficticio", () => {
  assert.match(component, /model\.related\.map/);
  assert.match(component, /href=\{related\.href\}/);
  assert.doesNotMatch(component, /mock|fixture|lorem ipsum/i);
});

test("el CSS local protege 44px, foco, responsive, wrapping y overflow", () => {
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.match(styles, /@media \(max-width: 350px\)/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /min-width: 0/);
});

test("la imagen principal reserva dimensiones, usa sizes y sólo ella tiene priority", () => {
  assert.match(component, /height=\{800\}[\s\S]*priority[\s\S]*sizes=/);
  assert.match(component, /width=\{1200\}/);
  assert.equal((component.match(/\bpriority\b/g) || []).length, 1);
});
