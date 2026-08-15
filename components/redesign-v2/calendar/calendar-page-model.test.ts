import assert from "node:assert/strict";
import test from "node:test";
import { assignV2HomeEventImages } from "../discipline-fallback-resolver";
import type { PreviewEvent } from "../redesign-v2-model";
import { paginateVisibleEvents } from "../listing/paginate-visible-events";
import { addCalendarDays, buildCalendarDayCounts, buildCalendarMonthCells, buildCalendarMonthSummary, calendarEventMatchesDate, calendarEventsForMonth, calendarEventsForSelectedDate, calendarEventsForWeek, calendarWeekDates, filterCalendarEvents, formatCalendarCount, formatCalendarMonthCompact, formatCalendarWeekCompact, isCalendarDateKey, madridCalendarDateKey, parseCalendarUrlState, serializeCalendarUrlState, shiftCalendarMonth } from "./calendar-page-model";

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
    view: "month",
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
  const state = parseCalendarUrlState({ date: "2026-08-15", place: " Asturias ", discipline: "RALLYES", vehicle: "coche", page: "2", view: "week" }, "2026-08-13");
  assert.deepEqual(state, { date: "2026-08-15", place: "Asturias", discipline: "rallyes", vehicle: "coche", page: 2, view: "week" });
  assert.equal(serializeCalendarUrlState(state), "date=2026-08-15&place=Asturias&discipline=rallyes&vehicle=coche&page=2&view=week");
});

test("una fecha, taxonomía, vista o página inválida falla de forma segura", () => assert.deepEqual(parseCalendarUrlState({ date: "2026-02-30", discipline: "inventada", vehicle: "avion", page: "-8", view: "year" }, "2026-08-13"), { date: "2026-08-13", place: "", discipline: "", vehicle: "", page: 1, view: "month" }));

test("los counts filtrados incluyen cada día activo de un evento multidía", () => {
  const counts = buildCalendarDayCounts([fixture()], "2026-08-15", { place: "", discipline: "rallyes", vehicle: "coche" });
  assert.deepEqual([counts["2026-08-02"], counts["2026-08-03"], counts["2026-08-10"], counts["2026-08-18"], counts["2026-08-19"]], [0, 1, 1, 1, 0]);
});

test("lugar, disciplina y vehículo filtran tanto lista como indicadores", () => {
  const events = [fixture(), fixture({ id: "event-2", title: "Trial indoor", discipline: "Trial", tags: ["trial"], city: "Madrid", province: "Madrid", region: "Madrid", vehicleType: "moto" })];
  const state = { date: "2026-08-10", place: "Madrid", discipline: "offroad", vehicle: "moto", page: 1, view: "month" as const };
  assert.deepEqual(calendarEventsForSelectedDate(events, state).map((event) => event.id), ["event-2"]);
  assert.equal(buildCalendarDayCounts(events, state.date, state)["2026-08-10"], 1);
});

test("el round trip conserva un estado compartible", () => {
  const original = { date: "2026-08-22", place: "A Coruña", discipline: "rutas", vehicle: "moto", page: 3, view: "list" as const };
  assert.deepEqual(parseCalendarUrlState(new URLSearchParams(serializeCalendarUrlState(original)), "2026-08-13"), original);
});

test("month es la vista por defecto y se omite de la URL", () => {
  const state = parseCalendarUrlState({ date: "2026-08-15", view: "month" }, "2026-08-14");
  assert.equal(state.view, "month");
  assert.equal(serializeCalendarUrlState(state), "date=2026-08-15");
});

test("la vista mensual incluye cada evento una sola vez aunque sea multidía", () => {
  const state = { date: "2026-08-15", place: "", discipline: "", vehicle: "", page: 1, view: "list" as const };
  const events = [fixture(), fixture({ id: "event-2", slug: "event-2", start: "2026-07-30", end: "2026-08-02" })];
  assert.deepEqual(calendarEventsForMonth(events, state).map((event) => event.id), ["event-2", "event-1"]);
});

test("el rail semanal conserva siete días y sus counts diarios", () => {
  const state = { date: "2026-08-15", place: "", discipline: "", vehicle: "", page: 1, view: "week" as const };
  assert.deepEqual(calendarWeekDates(state.date), ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"]);
  const week = calendarEventsForWeek([fixture()], state);
  assert.equal(Object.keys(week).length, 7);
  assert.deepEqual(Object.values(week).map((events) => events.length), [1, 1, 1, 1, 1, 1, 1]);
});

test("la agenda semanal usa sólo selectedDate y no duplica un multidía", () => {
  const events = [
    fixture({ id: "multi", slug: "multi", title: "Evento multidía", start: "2026-08-14", end: "2026-08-16" }),
    fixture({ id: "only-15", slug: "only-15", title: "Evento del sábado", start: "2026-08-15", end: "2026-08-15" }),
    fixture({ id: "only-16", slug: "only-16", title: "Evento del domingo", start: "2026-08-16", end: "2026-08-16" }),
  ];
  const state = { date: "2026-08-14", place: "", discipline: "", vehicle: "", page: 1, view: "week" as const };
  const selectedIds = (date: string) => calendarEventsForSelectedDate(events, { ...state, date }).map((event) => event.id);

  assert.deepEqual(selectedIds("2026-08-14"), ["multi"]);
  assert.deepEqual(selectedIds("2026-08-15"), ["multi", "only-15"]);
  assert.deepEqual(selectedIds("2026-08-16"), ["multi", "only-16"]);
  assert.deepEqual(selectedIds("2026-08-17"), []);
  assert.equal(selectedIds("2026-08-15").filter((id) => id === "multi").length, 1);
});

test("el resumen mensual cuenta eventos únicos, días activos y provincias filtradas", () => {
  const state = { date: "2026-08-15", place: "", discipline: "rallyes", vehicle: "coche", page: 1, view: "month" as const };
  const events = [fixture(), fixture({ id: "event-2", slug: "event-2", start: "2026-08-18", end: "2026-08-20", province: "León" }), fixture({ id: "moto", slug: "moto", discipline: "Trial", vehicleType: "moto" })];
  assert.deepEqual(buildCalendarMonthSummary(events, state), { events: 2, activeDays: 18, provinces: 2 });
});

test("el copy de cantidades distingue singular y plural sin i18n adicional", () => {
  assert.equal(formatCalendarCount(1, "evento único", "eventos únicos"), "1 evento único");
  assert.equal(formatCalendarCount(2, "evento único", "eventos únicos"), "2 eventos únicos");
  assert.equal(formatCalendarCount(1, "filtro activo", "filtros activos"), "1 filtro activo");
  assert.equal(formatCalendarCount(3, "filtro activo", "filtros activos"), "3 filtros activos");
});

test("el toolbar usa mes compacto y la semana móvil conserva rango y año", () => {
  assert.equal(formatCalendarMonthCompact("2026-08-14"), "AGOSTO 2026");
  assert.equal(formatCalendarWeekCompact("2026-08-10", "2026-08-16"), "10–16 AGO 2026");
  assert.equal(formatCalendarWeekCompact("2026-08-31", "2026-09-06"), "31 AGO–6 SEPT 2026");
});

test("Supercross se filtra con Offroad y Moto usando el mismo contrato visible", () => {
  const supercross = fixture({ id: "supercross", slug: "supercross", title: "Supercross Castrojeriz 2026", discipline: "Supercross", championship: "Castilla y León", tags: ["Supercross"], vehicleType: "Moto" });
  assert.deepEqual(filterCalendarEvents([supercross], { place: "", discipline: "", vehicle: "" }).map(({ id }) => id), ["supercross"]);
  assert.deepEqual(filterCalendarEvents([supercross], { place: "", discipline: "", vehicle: "moto" }).map(({ id }) => id), ["supercross"]);
  assert.deepEqual(filterCalendarEvents([supercross], { place: "", discipline: "offroad", vehicle: "" }).map(({ id }) => id), ["supercross"]);
  assert.deepEqual(filterCalendarEvents([supercross], { place: "", discipline: "offroad", vehicle: "moto" }).map(({ id }) => id), ["supercross"]);
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
