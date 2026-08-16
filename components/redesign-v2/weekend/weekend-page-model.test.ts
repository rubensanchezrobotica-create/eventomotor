import assert from "node:assert/strict";
import test from "node:test";
import { buildPreviewSuggestions } from "@/components/preview/search-preview-model";
import type { PreviewEvent } from "../redesign-v2-model";
import {
  buildWeekendDayCounts,
  buildWeekendResults,
  calculateWeekendRange,
  eventIntersectsWeekend,
  eventMatchesWeekendDay,
  filterWeekendEvents,
  formatWeekendDisciplineLabel,
  paginateWeekendEvents,
  parseWeekendUrlState,
  serializeWeekendUrlState,
} from "./weekend-page-model";

function event(overrides: Partial<PreviewEvent> = {}): PreviewEvent {
  return {
    id: overrides.id ?? "event-1",
    slug: overrides.slug ?? "event-1",
    title: overrides.title ?? "Rallye de Montaña",
    championship: overrides.championship ?? "Campeonato regional",
    discipline: overrides.discipline ?? "Rallyes",
    start: overrides.start ?? "2026-08-14",
    end: overrides.end ?? "2026-08-16",
    venue: overrides.venue ?? "Circuito de León",
    city: overrides.city ?? "León",
    province: overrides.province ?? "León",
    region: overrides.region ?? "Castilla y León",
    tags: overrides.tags ?? ["rally", "montaña"],
    vehicleType: overrides.vehicleType ?? "coche",
    featured: overrides.featured ?? false,
    imageUrl: overrides.imageUrl,
  };
}

test("calcula el fin de semana civil de Europe/Madrid de jueves a lunes", () => {
  const cases = [
    ["2026-08-13T10:00:00Z", "2026-08-14", "2026-08-16"],
    ["2026-08-14T10:00:00Z", "2026-08-14", "2026-08-16"],
    ["2026-08-15T10:00:00Z", "2026-08-14", "2026-08-16"],
    ["2026-08-16T10:00:00Z", "2026-08-14", "2026-08-16"],
    ["2026-08-17T10:00:00Z", "2026-08-21", "2026-08-23"],
  ] as const;

  for (const [now, start, end] of cases) {
    const range = calculateWeekendRange(now);
    assert.equal(range.start, start);
    assert.equal(range.end, end);
  }
});

test("calcula correctamente un fin de semana que cruza de año", () => {
  const range = calculateWeekendRange("2026-12-31T10:00:00Z");
  assert.deepEqual(
    { start: range.start, end: range.end },
    { start: "2027-01-01", end: "2027-01-03" },
  );
});

test("usa Europe/Madrid cuando UTC todavía pertenece al día anterior", () => {
  const range = calculateWeekendRange("2026-08-16T22:30:00Z");
  assert.equal(range.today, "2026-08-17");
  assert.equal(range.start, "2026-08-21");
});

test("incluye por intersección eventos multidía y respeta límites inclusivos", () => {
  const range = calculateWeekendRange("2026-08-13T10:00:00Z");
  assert.equal(eventIntersectsWeekend(event({ start: "2026-08-13", end: "2026-08-17" }), range), true);
  assert.equal(eventIntersectsWeekend(event({ start: "2026-08-10", end: "2026-08-13" }), range), false);
  assert.equal(eventIntersectsWeekend(event({ start: "2026-08-17", end: "2026-08-19" }), range), false);
  assert.equal(eventIntersectsWeekend(event({ start: "2026-08-14", end: "2026-08-14" }), range), true);
  assert.equal(eventIntersectsWeekend(event({ start: "2026-08-16", end: "2026-08-16" }), range), true);
});

test("Todos conserva un multidía una sola vez y los counts lo incluyen cada día activo", () => {
  const range = calculateWeekendRange("2026-08-13T10:00:00Z");
  const events = [event({ id: "multi" })];
  const state = parseWeekendUrlState({});
  assert.deepEqual(buildWeekendResults(events, state, range).map((item) => item.id), ["multi"]);
  assert.deepEqual(buildWeekendDayCounts(events, state, range), { all: 1, fri: 1, sat: 1, sun: 1 });
});

test("cada vista de día incluye sólo los eventos activos ese día", () => {
  const range = calculateWeekendRange("2026-08-13T10:00:00Z");
  const events = [
    event({ id: "fri", start: range.friday, end: range.friday }),
    event({ id: "sat", start: range.saturday, end: range.saturday }),
    event({ id: "sun", start: range.sunday, end: range.sunday }),
    event({ id: "multi" }),
  ];
  assert.deepEqual(events.filter((item) => eventMatchesWeekendDay(item, "sat", range)).map((item) => item.id), ["sat", "multi"]);
});

test("q, disciplina y vehículo filtran resultados y counts de días", () => {
  const range = calculateWeekendRange("2026-08-13T10:00:00Z");
  const events = [
    event({ id: "rally", title: "Subida de León", start: range.friday, end: range.saturday }),
    event({ id: "supercross", title: "Supercross de Madrid", discipline: "Offroad", tags: ["supercross"], vehicleType: "moto", city: "Madrid", province: "Madrid", start: range.sunday, end: range.sunday }),
  ];
  const filters = { q: "madrid", discipline: "offroad", vehicle: "moto" };
  assert.deepEqual(filterWeekendEvents(events, filters).map((item) => item.id), ["supercross"]);
  assert.deepEqual(buildWeekendDayCounts(events, filters, range), { all: 1, fri: 0, sat: 0, sun: 1 });
});

test("la búsqueda y sugerencias son insensibles a acentos y conservan los tres tipos", () => {
  const events = [event()];
  assert.equal(filterWeekendEvents(events, { q: "leon", discipline: "", vehicle: "" }).length, 1);
  const suggestions = buildPreviewSuggestions(events, "le");
  assert.deepEqual(new Set(suggestions.map((item) => item.kind)), new Set(["evento", "ubicacion"]));
  assert.equal(buildPreviewSuggestions(events, "rall").some((item) => item.kind === "disciplina"), true);
  assert.equal(buildPreviewSuggestions(events, "le", 8).length <= 8, true);
});

test("Supercross pertenece a Offroad y Moto", () => {
  const supercross = event({ title: "Supercross nocturno", discipline: "Offroad", tags: ["supercross"], vehicleType: "moto" });
  assert.deepEqual(filterWeekendEvents([supercross], { q: "", discipline: "offroad", vehicle: "moto" }).map((item) => item.id), ["event-1"]);
  assert.equal(filterWeekendEvents([supercross], { q: "", discipline: "circuito", vehicle: "moto" }).length, 0);
});

test("parsea y serializa q, discipline, vehicle, day y page con fail-closed", () => {
  const state = parseWeekendUrlState({ q: "  León ", discipline: "OFFROAD", vehicle: "moto", day: "sat", page: "3" });
  assert.deepEqual(state, { q: "León", discipline: "offroad", vehicle: "moto", day: "sat", page: 3 });
  assert.equal(serializeWeekendUrlState(state), "q=Le%C3%B3n&discipline=offroad&vehicle=moto&day=sat&page=3");
  assert.deepEqual(parseWeekendUrlState({ discipline: "unknown", vehicle: "kart", day: "martes", page: "-2" }), { q: "", discipline: "", vehicle: "", day: "all", page: 1 });
  assert.equal(serializeWeekendUrlState(parseWeekendUrlState({})), "");
});

test("pagina 26 eventos en 12, 12 y 2", () => {
  const events = Array.from({ length: 26 }, (_, index) => index + 1);
  assert.equal(paginateWeekendEvents(events, 1).visible.length, 12);
  assert.equal(paginateWeekendEvents(events, 2).visible.length, 12);
  assert.equal(paginateWeekendEvents(events, 3).visible.length, 2);
});

test("las etiquetas públicas corrigen ortografía sin alterar el dato fuente", () => {
  assert.equal(formatWeekendDisciplineLabel("Montana"), "Montaña");
  assert.equal(formatWeekendDisciplineLabel("Concentracion"), "Concentración");
  assert.equal(formatWeekendDisciplineLabel("Exhibicion"), "Exhibición");
  assert.equal(formatWeekendDisciplineLabel("Clasicos"), "Clásicos");
});
