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
  assert.match(component, /model\.description \|\| model\.practicalItems\.length/);
  assert.match(component, /model\.practicalItems\.length \? \(/);
  assert.match(component, /<h2>Información útil<\/h2>/);
  assert.doesNotMatch(component, /model\.info|<h2>Datos del evento<\/h2>/);
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
