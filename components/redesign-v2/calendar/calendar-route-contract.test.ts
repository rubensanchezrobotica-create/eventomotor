import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../../app/preview/redesign-v2/calendario/page.tsx", import.meta.url), "utf8");
const experience = readFileSync(new URL("./CalendarPageExperience.client.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./CalendarPageExperience.module.css", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../site/preview-navigation.ts", import.meta.url), "utf8");

test("Calendar V2 usa page servidor, loader real, shell A1D y cliente interactivo", () => {
  assert.match(page, /getVisibleEvents/);
  assert.match(page, /getVehicleType/);
  assert.match(page, /projectPreviewEvent/);
  assert.match(page, /<V2PreviewShell/);
  assert.match(page, /<CalendarPageExperience/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(experience, /^["']use client["']/);
});

test("la Preview Calendar es noindex, nofollow y no crea canonical ni JSON-LD", () => {
  assert.match(page, /index:\s*false/);
  assert.match(page, /follow:\s*false/);
  assert.doesNotMatch(page, /canonical|application\/ld\+json/i);
});

test("el registry enlaza Calendar a Preview y Search continúa ausente", () => {
  assert.match(navigation, /calendar:[\s\S]*?previewHref:\s*"\/preview\/redesign-v2\/calendario"/);
  assert.doesNotMatch(navigation, /["']search["']|\/buscar/i);
});

test("la interacción mantiene fecha primero, URL reproducible y teclado de grid", () => {
  assert.match(experience, /useSearchParams/);
  assert.match(experience, /router\.replace/);
  assert.match(experience, /serializeCalendarUrlState/);
  assert.match(experience, /ArrowLeft/);
  assert.match(experience, /ArrowRight/);
  assert.match(experience, /ArrowUp/);
  assert.match(experience, /ArrowDown/);
  assert.match(experience, /event\.key === "Enter"/);
  assert.match(experience, /event\.key === " "/);
  assert.match(experience, /role="grid"/);
  assert.match(experience, /aria-pressed/);
  assert.doesNotMatch(experience, /¿Qué buscas\?|\/buscar/);
});

test("Calendar sustituye EventCard por filas compactas tras slice, R3F y diversidad local", () => {
  assert.match(experience, /paginateVisibleEvents/);
  assert.match(experience, /CALENDAR_PAGE_SIZE/);
  assert.match(experience, /diversifyCalendarVisibleImages/);
  assert.match(experience, /<CalendarEventRow/);
  assert.doesNotMatch(experience, /<EventCard/);
});

test("Mes, Semana y Lista son vistas reales persistidas en URL", () => {
  assert.match(experience, /calendarEventsForWeek/);
  assert.match(experience, /calendarEventsForMonth/);
  assert.match(experience, /changeView/);
  assert.match(experience, /state\.view === "month"/);
  assert.match(experience, /state\.view === "week"/);
  assert.match(experience, /state\.view === "list"/);
});

test("la selección explícita respeta autoscroll y movimiento reducido", () => {
  assert.match(experience, /scrollIntoView/);
  assert.match(experience, /prefers-reduced-motion: reduce/);
  assert.match(experience, /pendingAgendaScroll/);
  assert.match(experience, /focus\(\{ preventScroll: true \}\)/);
  assert.match(experience, /date === state\.date/);
});

test("tablet colapsa filtros y coloca la sidebar bajo el calendario", () => {
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.mobileFilterToggle[\s\S]*?display: flex !important/);
  assert.match(styles, /@media \(max-width: 1024px\)[\s\S]*?\.monthLayout[\s\S]*?display: block/);
});

test("el disclosure móvil conserva el contrato Filtros, Aplicar y Limpiar", () => {
  assert.match(experience, /Filtros ·/);
  assert.match(experience, />Aplicar<\/button>/);
  assert.match(experience, />Limpiar<\/button>/);
});
