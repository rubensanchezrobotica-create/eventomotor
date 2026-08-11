import assert from "node:assert/strict";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildMotorcycleConcentrationsModel,
  effectiveMotorcycleEventEnd,
  filterMotorcycleConcentrations,
  isMotorcycleEvent,
  isMotorcycleGatheringEvent,
  isValidIsoDate,
  madridIsoDate,
  motorcycleTemporalStatus,
  motorcycleWeekendRange,
  parseMotorcycleLandingQuery,
} from "./motorcycle-concentrations-model";

function event(
  id: string,
  overrides: Partial<EventItem> = {},
): EventItem {
  return {
    championship: "",
    city: "Madrid",
    discipline: "Concentración",
    end: "2026-09-12",
    featured: false,
    id,
    level: "",
    province: "Madrid",
    region: "Comunidad de Madrid",
    source: "test",
    sourceUrl: "https://example.com/source",
    start: "2026-09-12",
    tags: [],
    ticketUrl: "",
    title: "Concentración motera",
    vehicleType: "moto",
    venue: "Plaza Mayor",
    visible: true,
    ...overrides,
  };
}

test("clasificación A-H aplica vehículo, señales explícitas y exclusiones", () => {
  const cases: Array<[string, EventItem, boolean]> = [
    ["A concentración exclusivamente de coches", event("a", { title: "Concentración de coches", vehicleType: "coche" }), false],
    ["B Seat 600", event("b", { title: "Concentración nacional Seat 600", vehicleType: "otros" }), false],
    ["C vehículos clásicos sin señal moto", event("c", { title: "Concentración de vehículos clásicos", vehicleType: undefined }), false],
    ["D vehicle_type moto", event("d", { title: "Encuentro anual", vehicleType: "moto" }), true],
    ["E motoalmuerzo", event("e", { title: "X Motoalmuerzo solidario", vehicleType: undefined }), true],
    ["F ruta motera", event("f", { title: "Ruta motera por la sierra", vehicleType: "otros" }), true],
    ["G mixto sin señal moto", event("g", { title: "III Encuentro de vehículos clásicos", vehicleType: "mixto" }), false],
    ["H mixto con señal moto", event("h", { title: "Encuentro de motos y coches clásicos", vehicleType: "mixto" }), true],
  ];

  for (const [label, fixture, expected] of cases) {
    assert.equal(isMotorcycleEvent(fixture), expected, label);
  }
});

test("las señales genéricas no bastan y las señales moteras respetan palabras completas", () => {
  for (const title of [
    "Matinal solidaria",
    "Quedada custom",
    "Concentración de vehículos clásicos",
    "Encuentro del mundo del motor",
  ]) {
    assert.equal(isMotorcycleEvent(event(title, { title, vehicleType: "otros" })), false, title);
  }

  for (const overrides of [
    { title: "Ruta motera por la sierra", vehicleType: "otros" },
    { discipline: "Mototurismo", title: "Ruta anual", vehicleType: "mixto" },
    { tags: ["evento biker"], title: "Encuentro solidario", vehicleType: undefined },
    { longDescription: "Punto de encuentro para motoristas y motos.", title: "Matinal", vehicleType: "otros" },
  ] satisfies Array<Partial<EventItem>>) {
    assert.equal(isMotorcycleEvent(event(overrides.title || "signal", overrides)), true);
  }
});

test("el contrato de reunión admite solo concentraciones y equivalentes sociales moteros", () => {
  const positives: Array<[string, Partial<EventItem>]> = [
    ["concentración motera", { title: "XX Concentración motera", discipline: "Otros" }],
    ["concentración de motos", { title: "Concentración de motos clásicas", discipline: "Clásicos" }],
    ["motoalmuerzo", { title: "X Motoalmuerzo solidario", discipline: "Otros" }],
    ["matinal motera", { title: "Matinal motera de verano", discipline: "Otros" }],
    ["quedada motera", { title: "Quedada motera nocturna", discipline: "Otros" }],
    ["encuentro biker", { title: "Encuentro biker nacional", discipline: "Custom" }],
    ["concentración biker", { title: "Concentración biker", discipline: "Custom" }],
    ["disciplina estructurada", { title: "Rally Pistón", discipline: "Concentración" }],
  ];

  for (const [label, overrides] of positives) {
    assert.equal(isMotorcycleGatheringEvent(event(label, overrides)), true, label);
  }

  const negatives: Array<[string, Partial<EventItem>]> = [
    ["trackday", { title: "Trackday de motos", discipline: "Circuito" }],
    ["tandas", { title: "Tandas libres", discipline: "Tandas" }],
    ["carrera de velocidad", { title: "Carrera de velocidad", discipline: "Velocidad" }],
    ["motocross", { title: "Campeonato de motocross", discipline: "Motocross" }],
    ["enduro", { title: "Copa de enduro", discipline: "Enduro" }],
    ["trial", { title: "Trofeo de trial", discipline: "Trial" }],
    ["raid", { title: "Raid off road", discipline: "Rally Raid" }],
    ["curso", { title: "Curso de conducción de motos", discipline: "Circuito" }],
    ["feria", { title: "Feria de la moto", discipline: "Ferias" }],
    ["salón", { title: "Salón comercial de la moto", discipline: "Otros" }],
    ["ruta pura", { title: "Ruta Transpirenaica en moto", discipline: "Mototurismo" }],
    ["ruta descrita solo como evento motero", {
      discipline: "Ruta motera",
      shortDescription: "Evento motero con rutas de 300 y 500 km.",
      title: "Bizkaia Rider 2026",
    }],
  ];

  for (const [label, overrides] of negatives) {
    const fixture = event(label, overrides);
    assert.equal(isMotorcycleEvent(fixture), true, `${label}: sigue siendo evento de moto`);
    assert.equal(isMotorcycleGatheringEvent(fixture), false, label);
  }
});

test("los casos mixtos y las menciones secundarias respetan la intención principal", () => {
  const mixedExplicit = event("mixed-explicit", {
    discipline: "Clásicos",
    title: "Concentración de coches y motos clásicas",
    vehicleType: "mixto",
  });
  assert.equal(isMotorcycleEvent(mixedExplicit), true);
  assert.equal(isMotorcycleGatheringEvent(mixedExplicit), true);

  const mixedGeneric = event("mixed-generic", {
    discipline: "Clásicos",
    title: "Encuentro de vehículos clásicos",
    vehicleType: "mixto",
  });
  assert.equal(isMotorcycleEvent(mixedGeneric), false);

  const jointDescription = event("joint-description", {
    discipline: "Clásicos",
    longDescription: "Concentración conjunta de coches y motos clásicas.",
    title: "Encuentro nacional de vehículos clásicos",
    vehicleType: "mixto",
  });
  assert.equal(isMotorcycleEvent(jointDescription), true);
  assert.equal(isMotorcycleGatheringEvent(jointDescription), true);

  assert.equal(isMotorcycleGatheringEvent(event("social-route", {
    discipline: "Ruta motera",
    title: "Quedada motera con ruta por la sierra",
  })), true);
  assert.equal(isMotorcycleGatheringEvent(event("secondary-social", {
    discipline: "Circuito",
    longDescription: "Al terminar habrá un encuentro motero en el paddock.",
    title: "Trackday y tandas libres",
  })), false);
  assert.equal(isMotorcycleGatheringEvent(event("circuit-venue", {
    discipline: "Concentración",
    title: "Concentración motera en Circuito de Navarra",
  })), true);

  const model = buildMotorcycleConcentrationsModel([
    mixedExplicit,
    mixedGeneric,
    jointDescription,
    event("moto-trackday", { discipline: "Circuito", title: "Trackday de motos" }),
  ], new Date("2026-08-11T10:00:00.000Z"));
  assert.deepEqual(model.allEvents.map((item) => item.id), ["mixed-explicit", "joint-description"]);
});

test("calidad, visibilidad, año y fechas fiables se aplican antes de intención", () => {
  assert.equal(isMotorcycleEvent(event("hidden", { visible: false })), false);
  assert.equal(isMotorcycleEvent(event("pending", { dataQuality: "pending_date" })), false);
  assert.equal(isMotorcycleEvent(event("cancelled", { dataQuality: "cancelled" })), false);
  assert.equal(isMotorcycleEvent(event("old", { start: "2025-09-12", end: "2025-09-12" })), false);
  assert.equal(isMotorcycleEvent(event("bad-start", { start: "2026-02-30", end: "2026-03-01" })), false);
  assert.equal(isMotorcycleEvent(event("reversed-range", { start: "2026-09-12", end: "2026-09-01" })), false);
  assert.equal(isMotorcycleEvent(event("bad-end-falls-back", { start: "2026-09-12", end: "2026-02-30" })), true);
  assert.equal(isValidIsoDate("2026-02-28"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
});

test("Europe/Madrid, fin de semana y extremos temporales son deterministas", () => {
  assert.equal(madridIsoDate(new Date("2026-08-10T22:30:00.000Z")), "2026-08-11");
  assert.deepEqual(
    motorcycleWeekendRange(new Date("2026-08-11T10:00:00.000Z")),
    { friday: "2026-08-14", sunday: "2026-08-16" },
  );
  assert.deepEqual(
    motorcycleWeekendRange(new Date("2026-08-13T10:00:00.000Z")),
    { friday: "2026-08-14", sunday: "2026-08-16" },
  );
  assert.deepEqual(
    motorcycleWeekendRange(new Date("2026-08-15T10:00:00.000Z")),
    { friday: "2026-08-14", sunday: "2026-08-16" },
  );
  for (const date of ["2026-08-14", "2026-08-15", "2026-08-16"]) {
    assert.deepEqual(
      motorcycleWeekendRange(new Date(`${date}T10:00:00.000Z`)),
      { friday: "2026-08-14", sunday: "2026-08-16" },
      date,
    );
  }
  assert.equal(motorcycleTemporalStatus(event("future", { start: "2026-08-12", end: "2026-08-12" }), "2026-08-11"), "future");
  assert.equal(motorcycleTemporalStatus(event("starts-today", { start: "2026-08-11", end: "2026-08-13" }), "2026-08-11"), "ongoing");
  assert.equal(motorcycleTemporalStatus(event("ends-today", { start: "2026-08-10", end: "2026-08-11" }), "2026-08-11"), "ongoing");
  assert.equal(motorcycleTemporalStatus(event("multi-day", { start: "2026-08-03", end: "2026-08-18" }), "2026-08-11"), "ongoing");
  assert.equal(motorcycleTemporalStatus(event("past", { start: "2026-08-09", end: "2026-08-10" }), "2026-08-11"), "past");
  assert.equal(motorcycleTemporalStatus(event("bad-end", { start: "2026-08-12", end: "2026-02-30" }), "2026-08-11"), "future");
  assert.equal(effectiveMotorcycleEventEnd(event("bad-end", { start: "2026-08-12", end: "2026-02-30" })), "2026-08-12");
  assert.equal(effectiveMotorcycleEventEnd(event("single", { start: "2026-08-12", end: "" })), "2026-08-12");
  const weekendOverlap = buildMotorcycleConcentrationsModel([
    event("spans-weekend", { start: "2026-08-13", end: "2026-08-17" }),
  ], new Date("2026-08-13T10:00:00.000Z"));
  assert.deepEqual(weekendOverlap.weekendEvents.map((item) => item.id), ["spans-weekend"]);
});

test("un único modelo alimenta orden, KPIs, provincias, meses, fin de semana y archivo", () => {
  const now = new Date("2026-08-11T10:00:00.000Z");
  const model = buildMotorcycleConcentrationsModel([
    event("ongoing", { start: "2026-08-10", end: "2026-08-11" }),
    event("weekend", { start: "2026-08-14", end: "2026-08-14", province: "A Coruna", region: "Galicia" }),
    event("later", { start: "2026-09-12", end: "2026-09-12", province: "A Coruña", region: "Galicia" }),
    event("lleida", { start: "2026-10-03", end: "2026-10-03", province: "Lérida", region: "Cataluña" }),
    event("past", { start: "2026-08-09", end: "2026-08-10" }),
    event("ongoing", { start: "2026-08-10", end: "2026-08-11", title: "Duplicado ignorado" }),
    event("car-leak", { start: "2026-08-15", end: "2026-08-15", title: "Concentración Seat 600", vehicleType: "otros" }),
  ], now);

  assert.deepEqual(model.upcomingEvents.map((item) => item.id), ["ongoing", "weekend", "later", "lleida"]);
  assert.deepEqual(model.weekendEvents.map((item) => item.id), ["weekend"]);
  assert.deepEqual(model.pastEvents.map((item) => item.id), ["past"]);
  assert.equal(model.upcomingTotal, 4);
  assert.deepEqual(model.monthCounts.map(({ month, count }) => [month, count]), [
    ["2026-08", 2],
    ["2026-09", 1],
    ["2026-10", 1],
  ]);
  assert.deepEqual(model.provinceCounts.map(({ key, count }) => [key, count]), [
    ["a-coruna", 2],
    ["lleida", 1],
    ["madrid", 1],
  ]);
  assert.ok(model.territories.some((item) => item.id === "galicia" && item.count === 2));
  assert.ok(model.territories.some((item) => item.id === "cataluna" && item.count === 1));
  assert.ok(!model.allEvents.some((item) => item.id === "car-leak"));
});

test("la query GET se normaliza y cada filtro opera solo sobre inventario motero", () => {
  const model = buildMotorcycleConcentrationsModel([
    event("madrid", { start: "2026-08-14", end: "2026-08-14", title: "Motoalmuerzo Centro" }),
    event("galicia", { start: "2026-09-05", end: "2026-09-05", province: "A Coruña", region: "Galicia", title: "Quedada motera Atlántica" }),
    event("car", { start: "2026-08-14", end: "2026-08-14", title: "Concentración Seat 600", vehicleType: "otros" }),
  ], new Date("2026-08-11T10:00:00.000Z"));

  const query = parseMotorcycleLandingQuery({
    archive: "all",
    month: "2026-09",
    province: "A CorUÑA",
    q: "atlántica",
    show: "all",
    type: "coche",
    vehicle: "coche",
    when: "upcoming",
  });
  assert.deepEqual(query, {
    archiveAll: true,
    month: "2026-09",
    province: "a-coruna",
    query: "atlántica",
    showAll: true,
    when: "upcoming",
  });
  assert.deepEqual(filterMotorcycleConcentrations(model, query).map((item) => item.id), ["galicia"]);
  assert.deepEqual(
    filterMotorcycleConcentrations(model, parseMotorcycleLandingQuery({ when: "weekend" })).map((item) => item.id),
    ["madrid"],
  );
});
