import assert from "node:assert/strict";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildZonePreviewData,
  classifyZoneDisciplineGroup,
  filterZoneEvents,
  getZoneWeekendRange,
  isZonePreviewAvailable,
  nextZoneVisibleLimit,
  normalizeZoneProvince,
  parseZoneFilters,
  sortUpcomingZoneEvents,
  type ZoneFilters,
  zoneEventDateLabel,
} from "./zone-preview-model";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event",
    slug: "event",
    title: "Evento de prueba",
    championship: "",
    discipline: "Rally",
    start: "2026-07-20",
    end: "2026-07-20",
    venue: "Recinto",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    level: "Nacional",
    source: "Test",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    featured: false,
    vehicleType: "coche",
    ...overrides,
  };
}

const now = new Date("2026-07-16T12:00:00");

test("asigna eventos a las seis zonas con el clasificador territorial compartido", () => {
  const fixtures = [
    event({ id: "norte", slug: "norte", province: "Navarra", region: "Navarra" }),
    event({ id: "centro", slug: "centro", province: "León", region: "Castilla y León" }),
    event({ id: "cataluna", slug: "cataluna", province: "Barcelona", region: "Cataluña" }),
    event({ id: "levante", slug: "levante", province: "Castellón", region: "Comunidad Valenciana" }),
    event({ id: "sur", slug: "sur", province: "Cáceres", region: "Extremadura" }),
    event({ id: "canarias", slug: "canarias", province: "Las Palmas", region: "Canarias" }),
  ];

  assert.deepEqual([
    buildZonePreviewData(fixtures, "norte", now).stats.total,
    buildZonePreviewData(fixtures, "centro", now).stats.total,
    buildZonePreviewData(fixtures, "cataluna-aragon", now).stats.total,
    buildZonePreviewData(fixtures, "levante", now).stats.total,
    buildZonePreviewData(fixtures, "sur", now).stats.total,
    buildZonePreviewData(fixtures, "canarias", now).stats.total,
  ], [1, 1, 1, 1, 1, 1]);
});

test("ordena futuros por inicio, fin y título normalizado", () => {
  const sorted = sortUpcomingZoneEvents([
    event({ id: "z", slug: "z", title: "Zeta", start: "2026-07-21" }),
    event({ id: "b", slug: "b", title: "Beta", start: "2026-07-20", end: "2026-07-22" }),
    event({ id: "a", slug: "a", title: "Álfa", start: "2026-07-20", end: "2026-07-21" }),
  ]);

  assert.deepEqual(sorted.map((item) => item.slug), ["a", "b", "z"]);
});

test("la vista predeterminada excluye pasados y conserva el histórico separado", () => {
  const data = buildZonePreviewData([
    event({ id: "past", slug: "past", start: "2026-07-01", end: "2026-07-02" }),
    event({ id: "future", slug: "future" }),
  ], "centro", now);

  assert.deepEqual(data.upcomingEvents.map((item) => item.slug), ["future"]);
  assert.deepEqual(data.pastEvents.map((item) => item.slug), ["past"]);
  assert.deepEqual(
    filterZoneEvents(data.events, { ...parseZoneFilters({}), period: "upcoming" }, now)
      .map((item) => item.slug),
    ["future"],
  );
});

test("normaliza Leon, León y aliases de provincias solo para presentación", () => {
  assert.equal(normalizeZoneProvince("Leon"), "León");
  assert.equal(normalizeZoneProvince("León"), "León");
  assert.equal(normalizeZoneProvince("La Coruña"), "A Coruña");
  assert.equal(normalizeZoneProvince("Castellon"), "Castellón");
});

test("deduplica provincias normalizadas y cuenta disciplinas", () => {
  const data = buildZonePreviewData([
    event({ id: "leon-1", slug: "leon-1", province: "Leon", region: "Castilla y León" }),
    event({ id: "leon-2", slug: "leon-2", province: "León", region: "Castilla y León", discipline: "Montana" }),
  ], "centro", now);

  assert.deepEqual(data.provinceOptions.map(({ label, count }) => ({ label, count })), [
    { label: "León", count: 2 },
  ]);
  assert.equal(data.stats.provinces, 1);
  assert.equal(data.stats.disciplines, 2);
});

test("filtra por provincia, disciplina, agrupación y búsqueda", () => {
  const events = [
    event({ id: "rally", slug: "rally", title: "Rally de Ávila", city: "Ávila", province: "Ávila", region: "Castilla y León" }),
    event({ id: "track", slug: "track", title: "Tandas Jarama", discipline: "Circuito" }),
  ];
  const filters: ZoneFilters = {
    discipline: "rally",
    group: "rallyes",
    period: "upcoming",
    province: "avila",
    query: "avila",
  };

  assert.deepEqual(filterZoneEvents(events, filters, now).map((item) => item.slug), ["rally"]);

  assert.deepEqual(filterZoneEvents([
    event({
      id: "coruna",
      slug: "coruna",
      city: "Moeche",
      province: "A Coruna",
      region: "Galicia",
    }),
  ], {
    discipline: "",
    group: "",
    period: "upcoming",
    province: "a-coruna",
    query: "",
  }, now).map((item) => item.slug), ["coruna"]);
});

test("resuelve periodos de fin de semana, próximos 30 días, mes y todos", () => {
  const events = [
    event({ id: "weekend", slug: "weekend", start: "2026-07-18", end: "2026-07-18" }),
    event({ id: "thirty", slug: "thirty", start: "2026-08-10", end: "2026-08-10" }),
    event({ id: "later", slug: "later", start: "2026-09-10", end: "2026-09-10" }),
    event({ id: "past", slug: "past", start: "2026-06-01", end: "2026-06-01" }),
  ];
  const base = { discipline: "", group: "", province: "", query: "" } as const;

  assert.deepEqual(filterZoneEvents(events, { ...base, period: "weekend" }, now).map((item) => item.slug), ["weekend"]);
  assert.deepEqual(filterZoneEvents(events, { ...base, period: "next30" }, now).map((item) => item.slug), ["weekend", "thirty"]);
  assert.deepEqual(filterZoneEvents(events, { ...base, period: "month" }, now).map((item) => item.slug), ["weekend"]);
  assert.deepEqual(filterZoneEvents(events, { ...base, period: "all" }, now).map((item) => item.slug), ["weekend", "thirty", "later", "past"]);
});

test("calcula el próximo fin de semana de viernes a domingo", () => {
  assert.deepEqual(getZoneWeekendRange(now), {
    friday: "2026-07-17",
    saturday: "2026-07-18",
    sunday: "2026-07-19",
  });
});

test("deduplica eventos por slug dentro de la zona", () => {
  const duplicate = event({ id: "one", slug: "same" });
  const data = buildZonePreviewData([duplicate, { ...duplicate, id: "two" }], "centro", now);
  assert.equal(data.stats.total, 1);
});

test("asigna cada evento a una única agrupación de disciplina", () => {
  assert.equal(classifyZoneDisciplineGroup(event({ title: "Concentración y Rally", discipline: "Clásicos" })), "rallyes");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Tandas" })), "circuito");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Motocross" })), "offroad");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Ferias" })), "clasicos-ferias");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Drift" })), "otros");
});

test("los recuentos de agrupaciones suman los próximos eventos", () => {
  const data = buildZonePreviewData([
    event({ id: "rally", slug: "rally", discipline: "Rally" }),
    event({ id: "track", slug: "track", discipline: "Circuito" }),
    event({ id: "offroad", slug: "offroad", discipline: "Trial" }),
    event({ id: "other", slug: "other", discipline: "Drift" }),
  ], "centro", now);

  assert.equal(
    data.disciplineGroups.reduce((total, group) => total + group.count, 0),
    data.stats.future,
  );
});

test("calcula vehículos y estados públicos relevantes sin exponer estados internos", () => {
  const data = buildZonePreviewData([
    event({ id: "car", slug: "car", vehicleType: "coche", eventStatus: "tentative" }),
    event({ id: "bike", slug: "bike", vehicleType: "moto", eventStatus: "postponed" }),
    event({ id: "review", slug: "review", vehicleType: "moto", dataQuality: "needs_review" }),
  ], "centro", now);

  assert.deepEqual(data.vehicleOptions.map(({ label, count }) => ({ label, count })), [
    { label: "Moto", count: 2 },
    { label: "Coche", count: 1 },
  ]);
  assert.deepEqual(data.statusOptions.map(({ label, count }) => ({ label, count })), [
    { label: "Aplazado", count: 1 },
    { label: "Fecha provisional", count: 1 },
  ]);
});

test("normaliza parámetros, carga progresiva y disponibilidad local", () => {
  assert.deepEqual(parseZoneFilters({
    disciplina: "Clásicos",
    periodo: "next30",
    provincia: "León",
    q: "  jarama ",
    tipo: "circuito",
  }), {
    discipline: "clasicos",
    group: "circuito",
    period: "next30",
    province: "leon",
    query: "jarama",
  });
  assert.equal(nextZoneVisibleLimit(12, 12, 31), 24);
  assert.equal(nextZoneVisibleLimit(24, 12, 31), 31);
  assert.equal(isZonePreviewAvailable("development", undefined), true);
  assert.equal(isZonePreviewAvailable("production", "preview"), false);
  assert.equal(isZonePreviewAvailable("development", "production"), false);
});

test("formatea rangos de tarjeta sin saltos automáticos", () => {
  assert.deepEqual(zoneEventDateLabel(event({ start: "2026-07-18", end: "2026-07-18" })), {
    kind: "single",
    day: "18",
    month: "JUL",
  });
  assert.deepEqual(zoneEventDateLabel(event({ start: "2026-07-17", end: "2026-07-19" })), {
    kind: "range",
    day: "17–19",
    month: "JUL",
  });
  assert.deepEqual(zoneEventDateLabel(event({ start: "2026-06-30", end: "2026-07-01" })), {
    kind: "cross-month",
    endDay: "01",
    endMonth: "JUL",
    startDay: "30",
    startMonth: "JUN",
  });
});
