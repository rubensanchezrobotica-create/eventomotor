import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPreviewSuggestions } from "@/components/preview/search-preview-model";
import { countCalendarSecondaryFilters } from "./calendar-page-model";
import { countWeekendSecondaryFilters } from "../weekend/weekend-page-model";
import type { PreviewEvent } from "../redesign-v2-model";

const calendarSearch = readFileSync(new URL("./CalendarSearchExperience.client.tsx", import.meta.url), "utf8");
const weekendSearch = readFileSync(new URL("../weekend/WeekendSearchExperience.client.tsx", import.meta.url), "utf8");
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
  assert.match(calendarSearch, /advancedFilterCount = countCalendarSecondaryFilters\(draft\)/);
  assert.match(calendarSearch, /type="date"/);
  assert.match(calendarSearch, /value=\{draft\.date\}/);
  assert.match(calendarSearch, /name="discipline"/);
  assert.match(calendarSearch, /name="vehicle"/);
  assert.match(styles, /\.queryFilter input[\s\S]*?min-height:\s*49px/);
  assert.match(styles, /\.primaryButton[\s\S]*?min-height:\s*49px/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.primaryButton[\s\S]*?min-height:\s*46px/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 0\.82fr\) minmax\(0, 1\.18fr\)/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.suggestions\s*\{[\s\S]*?position:\s*static[\s\S]*?margin-top:\s*8px/);
  assert.match(styles, /\.dateHint\s*\{[\s\S]*?position:\s*absolute[\s\S]*?clip:\s*rect\(0, 0, 0, 0\)/);
});

test("Calendar y Weekend conservan el count y la semántica accesible con badge compacto sólo en móvil", () => {
  assert.equal(countCalendarSecondaryFilters({ q: "", date: "2026-09-22", discipline: "", vehicle: "" }), 0);
  assert.equal(countCalendarSecondaryFilters({ q: "", date: "2026-09-22", discipline: "rallyes", vehicle: "" }), 1);
  assert.equal(countCalendarSecondaryFilters({ q: "", date: "2026-09-22", discipline: "rallyes", vehicle: "moto" }), 2);
  assert.equal(countWeekendSecondaryFilters({ discipline: "", vehicle: "" }), 0);
  assert.equal(countWeekendSecondaryFilters({ discipline: "rallyes", vehicle: "" }), 1);
  assert.equal(countWeekendSecondaryFilters({ discipline: "rallyes", vehicle: "moto" }), 2);

  for (const source of [calendarSearch, weekendSearch]) {
    assert.match(source, /aria-label=\{advancedFilterCount \? `Más filtros, \$\{advancedFilterCount\} \$\{advancedFilterCount === 1 \? "filtro activo" : "filtros activos"\}` : "Más filtros"\}/);
    assert.match(source, /\$\{advancedFilterCount\} \$\{advancedFilterCount === 1 \? "activo" : "activos"\}/);
    assert.match(source, /<span aria-hidden="true">[\s\S]*?<span className="max-\[760px\]:hidden">/);
    assert.match(source, /rounded-full[^"\n]*max-\[760px\]:inline-flex/);
    assert.match(source, /max-\[760px\]:gap-1! max-\[760px\]:px-2!/);
  }
  assert.match(weekendSearch, /\[draft\.province, draft\.discipline, draft\.family\]\.filter\(Boolean\)\.length/);
});
