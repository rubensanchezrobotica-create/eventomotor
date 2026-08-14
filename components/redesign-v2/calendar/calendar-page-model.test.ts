import assert from "node:assert/strict";
import test from "node:test";
import { assignV2HomeEventImages } from "../discipline-fallback-resolver";
import type { PreviewEvent } from "../redesign-v2-model";
import { paginateVisibleEvents } from "../listing/paginate-visible-events";
import { addCalendarDays, buildCalendarDayCounts, buildCalendarMonthCells, calendarEventMatchesDate, calendarEventsForSelectedDate, isCalendarDateKey, madridCalendarDateKey, parseCalendarUrlState, serializeCalendarUrlState, shiftCalendarMonth } from "./calendar-page-model";

function fixture(overrides: Partial<PreviewEvent> = {}): PreviewEvent {
  return { id: "event-1", slug: "event-1", title: "Rallye de prueba", championship: "Regional", discipline: "Rallyes", start: "2026-08-03", end: "2026-08-18", venue: "Circuito", city: "Oviedo", province: "Asturias", region: "Asturias", tags: ["rally"], vehicleType: "coche", featured: false, ...overrides };
}

test("valida fechas reales y rechaza fechas imposibles", () => {
  assert.equal(isCalendarDateKey("2028-02-29"), true);
  assert.equal(isCalendarDateKey("2027-02-29"), false);
  assert.equal(isCalendarDateKey("2026-13-01"), false);
});

test("resuelve hoy con Europe/Madrid y no con el día UTC", () => assert.equal(madridCalendarDateKey("2026-08-12T22:30:00.000Z"), "2026-08-13"));

test("sin date selecciona el hoy determinista de Europe/Madrid", () => {
  const today = madridCalendarDateKey("2026-08-13T22:30:00.000Z");
  assert.equal(today, "2026-08-14");
  assert.deepEqual(parseCalendarUrlState({}, today), {
    date: "2026-08-14",
    place: "",
    discipline: "",
    vehicle: "",
    page: 1,
  });
});

test("el contrato multidía incluye inicio, interior y final", () => {
  const event = fixture();
  assert.equal(calendarEventMatchesDate(event, "2026-08-02"), false);
  assert.equal(calendarEventMatchesDate(event, "2026-08-03"), true);
  assert.equal(calendarEventMatchesDate(event, "2026-08-10"), true);
  assert.equal(calendarEventMatchesDate(event, "2026-08-18"), true);
  assert.equal(calendarEventMatchesDate(event, "2026-08-19"), false);
});

test("incluye rangos en límites de mes y año", () => {
  assert.equal(calendarEventMatchesDate(fixture({ start: "2026-08-30", end: "2026-09-02" }), "2026-09-01"), true);
  assert.equal(calendarEventMatchesDate(fixture({ start: "2026-12-31", end: "2027-01-02" }), "2027-01-01"), true);
});

test("genera matrices con lunes primero para meses de 28, 29, 30 y 31 días", () => {
  assert.equal(buildCalendarMonthCells("2027-02-01").filter(Boolean).length, 28);
  assert.equal(buildCalendarMonthCells("2028-02-01").filter(Boolean).length, 29);
  assert.equal(buildCalendarMonthCells("2026-09-01").filter(Boolean).length, 30);
  assert.equal(buildCalendarMonthCells("2026-08-01").filter(Boolean).length, 31);
  assert.equal(buildCalendarMonthCells("2026-06-15")[0]?.date, "2026-06-01");
  assert.equal(buildCalendarMonthCells("2026-08-15")[0], null);
});

test("navega meses manteniendo día y hace clamp al final del mes", () => {
  assert.equal(shiftCalendarMonth("2026-08-15", 1), "2026-09-15");
  assert.equal(shiftCalendarMonth("2027-01-31", 1), "2027-02-28");
  assert.equal(shiftCalendarMonth("2028-01-31", 1), "2028-02-29");
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
});

test("parsea, normaliza y serializa el estado URL sin parámetros vacíos", () => {
  const state = parseCalendarUrlState({ date: "2026-08-15", place: " Asturias ", discipline: "RALLYES", vehicle: "coche", page: "2" }, "2026-08-13");
  assert.deepEqual(state, { date: "2026-08-15", place: "Asturias", discipline: "rallyes", vehicle: "coche", page: 2 });
  assert.equal(serializeCalendarUrlState(state), "date=2026-08-15&place=Asturias&discipline=rallyes&vehicle=coche&page=2");
});

test("una fecha, taxonomía o página inválida falla de forma segura", () => assert.deepEqual(parseCalendarUrlState({ date: "2026-02-30", discipline: "inventada", vehicle: "avion", page: "-8" }, "2026-08-13"), { date: "2026-08-13", place: "", discipline: "", vehicle: "", page: 1 }));

test("los counts filtrados incluyen cada día activo de un evento multidía", () => {
  const counts = buildCalendarDayCounts([fixture()], "2026-08-15", { place: "", discipline: "rallyes", vehicle: "coche" });
  assert.deepEqual([counts["2026-08-02"], counts["2026-08-03"], counts["2026-08-10"], counts["2026-08-18"], counts["2026-08-19"]], [0, 1, 1, 1, 0]);
});

test("lugar, disciplina y vehículo filtran tanto lista como indicadores", () => {
  const events = [fixture(), fixture({ id: "event-2", title: "Trial indoor", discipline: "Trial", tags: ["trial"], city: "Madrid", province: "Madrid", region: "Madrid", vehicleType: "moto" })];
  const state = { date: "2026-08-10", place: "Madrid", discipline: "offroad", vehicle: "moto", page: 1 };
  assert.deepEqual(calendarEventsForSelectedDate(events, state).map((event) => event.id), ["event-2"]);
  assert.equal(buildCalendarDayCounts(events, state.date, state)["2026-08-10"], 1);
});

test("el round trip conserva un estado compartible", () => {
  const original = { date: "2026-08-22", place: "A Coruña", discipline: "rutas", vehicle: "moto", page: 3 };
  assert.deepEqual(parseCalendarUrlState(new URLSearchParams(serializeCalendarUrlState(original)), "2026-08-13"), original);
});

test("26 eventos del mismo día se paginan 12, 12 y 2 sin reasignar antes del slice", () => {
  const events = Array.from({ length: 26 }, (_, index) => fixture({
    id: `event-${index + 1}`,
    slug: `event-${index + 1}`,
    start: "2026-08-15",
    end: "2026-08-15",
  }));
  const images = assignV2HomeEventImages(events);
  const imageByEventId = Object.fromEntries(events.map((event, index) => [event.id, images[index]]));

  assert.deepEqual(
    [1, 2, 3].map((page) => paginateVisibleEvents({ events, imageByEventId, page, pageSize: 12 }).visible.length),
    [12, 12, 2],
  );
});
