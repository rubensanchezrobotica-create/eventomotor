import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPreviewSuggestions } from "@/components/preview/search-preview-model";
import type { PreviewEvent } from "../redesign-v2-model";

const calendarSearch = readFileSync(new URL("./CalendarSearchExperience.client.tsx", import.meta.url), "utf8");
const homeSearch = readFileSync(new URL("../SearchExperience.client.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./CalendarPageExperience.module.css", import.meta.url), "utf8");

const events: PreviewEvent[] = [
  {
    id: "event-rally",
    slug: "subida-fito",
    title: "Subida al Fito",
    championship: "Montaña",
    discipline: "Montana",
    start: "2026-08-15",
    end: "2026-08-15",
    venue: "Sierra del Sueve",
    city: "Arriondas",
    province: "Asturias",
    region: "Asturias",
    tags: ["subida"],
    vehicleType: "Coche",
    featured: false,
  },
];

test("Calendar replica el lenguaje y el motor incremental de Home sin importarla", () => {
  for (const source of [homeSearch, calendarSearch]) {
    assert.match(source, />¿Qué buscas\?</);
    assert.match(source, /placeholder="Evento, ciudad o ubicación"/);
    assert.match(source, /buildPreviewSuggestions/);
    assert.match(source, /aria-autocomplete="list"/);
    assert.match(source, /role="combobox"/);
    assert.match(source, /role="listbox"/);
  }
  assert.doesNotMatch(calendarSearch, /RedesignV2\.module\.css|from ["']\.\.\/SearchExperience/);
});

test("el autocomplete comparte Evento, Ubicación y Disciplina con matching sin acentos", () => {
  const eventSuggestion = buildPreviewSuggestions(events, "subida").find(({ kind }) => kind === "evento");
  const locationSuggestion = buildPreviewSuggestions(events, "astur").find(({ kind }) => kind === "ubicacion");
  const disciplineSuggestion = buildPreviewSuggestions(events, "montana").find(({ kind }) => kind === "disciplina");

  assert.equal(eventSuggestion?.label, "Subida al Fito");
  assert.equal(locationSuggestion?.label, "Asturias");
  assert.equal(disciplineSuggestion?.label, "Montana");
  assert.match(calendarSearch, /suggestion\.kind === "disciplina"[\s\S]*?formatCalendarDisciplineLabel/);
});

test("el teclado, selección, clear y submit conservan el contrato Home", () => {
  assert.match(calendarSearch, /event\.key === "Escape"/);
  assert.match(calendarSearch, /event\.key === "ArrowDown"/);
  assert.match(calendarSearch, /event\.key === "ArrowUp"/);
  assert.match(calendarSearch, /event\.key === "Enter" && activeSuggestion >= 0/);
  assert.match(calendarSearch, /chooseSuggestion\(suggestions\[activeSuggestion\]\)/);
  assert.match(calendarSearch, /onApply\(next\)/);
  assert.match(calendarSearch, /if \(!nextQuery && state\.q\) onClearQuery\(\)/);
  assert.match(calendarSearch, /onSubmit=\{submit\}/);
  assert.match(calendarSearch, />Buscar eventos <span aria-hidden="true">→<\/span>/);
});

test("Más filtros sincroniza fecha, disciplina y vehículo con targets táctiles", () => {
  assert.match(calendarSearch, /advancedFilterCount = \[draft\.date, draft\.discipline, draft\.vehicle\]/);
  assert.match(calendarSearch, /type="date"/);
  assert.match(calendarSearch, /value=\{draft\.date\}/);
  assert.match(calendarSearch, /name="discipline"/);
  assert.match(calendarSearch, /name="vehicle"/);
  assert.match(styles, /\.queryFilter input[\s\S]*?min-height:\s*54px/);
  assert.match(styles, /\.primaryButton[\s\S]*?min-height:\s*49px/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.primaryButton[\s\S]*?min-height:\s*46px/);
});
