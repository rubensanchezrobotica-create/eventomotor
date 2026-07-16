import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildWeekendPreviewData,
  classifyWeekendFamily,
  filterWeekendEvents,
  getWeekendDayCounts,
  getWeekendRange,
  isWeekendPreviewAvailable,
  nextWeekendVisibleLimit,
  parseWeekendFilters,
  type WeekendFilters,
  weekendEventDateLabel,
} from "./weekend-preview-model";

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event",
    slug: "event-2026-07-18",
    title: "Evento de prueba",
    championship: "Campeonato nacional",
    discipline: "Rally",
    start: "2026-07-18",
    end: "2026-07-18",
    venue: "Recinto",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Nacional",
    source: "Fuente",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    vehicleType: "coche",
    vehicle_type: "coche",
    featured: false,
    ...overrides,
  };
}

const now = new Date("2026-07-16T12:00:00");
const range = getWeekendRange(now);

test("calcula el fin de semana de viernes a domingo", () => {
  assert.deepEqual(range, {
    friday: "2026-07-17",
    saturday: "2026-07-18",
    sunday: "2026-07-19",
  });
});

test("clasifica días y eventos de varios días sin duplicarlos dentro de cada vista", () => {
  const events = [
    eventFixture({ id: "friday", slug: "friday", start: "2026-07-17", end: "2026-07-17" }),
    eventFixture({ id: "saturday", slug: "saturday" }),
    eventFixture({ id: "sunday", slug: "sunday", start: "2026-07-19", end: "2026-07-19" }),
    eventFixture({ id: "multi", slug: "multi", start: "2026-07-17", end: "2026-07-19" }),
  ];
  const counts = getWeekendDayCounts(events, range);

  assert.deepEqual(counts, {
    todos: 4,
    viernes: 2,
    sabado: 2,
    domingo: 2,
    varios: 1,
  });

  for (const day of ["todos", "viernes", "sabado", "domingo", "varios"] as const) {
    const filters: WeekendFilters = { day, discipline: "", family: "", province: "", query: "" };
    const filtered = filterWeekendEvents(events, filters, range);
    assert.equal(new Set(filtered.map((event) => event.slug)).size, filtered.length);
  }
});

test("filtra por provincia, disciplina, familia y texto ignorando tildes", () => {
  const events = [
    eventFixture({
      id: "rally",
      slug: "rally",
      title: "Rally de Montaña",
      city: "Ávila",
      province: "Ávila",
    }),
    eventFixture({
      id: "moto",
      slug: "moto",
      title: "Motoalmuerzo Costa",
      discipline: "Concentración",
      province: "Valencia",
      city: "Cheste",
      vehicleType: "moto",
      vehicle_type: "moto",
    }),
  ];

  assert.deepEqual(
    filterWeekendEvents(events, {
      day: "todos",
      discipline: "rally",
      family: "rallyes",
      province: "avila",
      query: "montana",
    }, range).map((event) => event.slug),
    ["rally"],
  );
});

test("asigna una única familia principal con una prioridad determinista", () => {
  const rallyBeforeConcentration = eventFixture({
    title: "Concentración y Rally de vehículos clásicos",
    discipline: "Clásicos",
    tags: ["concentración", "rally"],
  });
  const concentrationBeforeCircuit = eventFixture({
    title: "Encuentro nacional en circuito",
    discipline: "Clásicos",
    tags: ["encuentro nacional", "circuito"],
  });

  assert.equal(classifyWeekendFamily(rallyBeforeConcentration), "rallyes");
  assert.equal(classifyWeekendFamily(concentrationBeforeCircuit), "concentraciones");
  assert.equal(classifyWeekendFamily(eventFixture({ discipline: "Superbike" })), "circuito");
  assert.equal(classifyWeekendFamily(eventFixture({ discipline: "Autocross" })), "otros");
});

test("los recuentos familiares son mutuamente excluyentes y suman el total", () => {
  const events = [
    eventFixture({ id: "rally", slug: "rally", discipline: "Rally" }),
    eventFixture({ id: "meeting", slug: "meeting", discipline: "Concentraciones" }),
    eventFixture({ id: "track", slug: "track", discipline: "Tandas" }),
    eventFixture({ id: "other", slug: "other", discipline: "Trial" }),
  ];
  const data = buildWeekendPreviewData(events, now);
  const familyTotal = data.families.reduce((total, family) => total + family.count, 0);

  assert.deepEqual(data.families.map(({ id, count }) => ({ id, count })), [
    { id: "concentraciones", count: 1 },
    { id: "rallyes", count: 1 },
    { id: "circuito", count: 1 },
    { id: "otros", count: 1 },
  ]);
  assert.equal(familyTotal, data.stats.events);

  for (const event of events) {
    const matches = data.families.filter(({ id }) => (
      filterWeekendEvents([event], {
        day: "todos",
        discipline: "",
        family: id,
        province: "",
        query: "",
      }, range).length === 1
    ));
    assert.equal(matches.length, 1);
  }
});

test("ordena por fecha y prioriza varios días dentro de la misma fecha", () => {
  const data = buildWeekendPreviewData([
    eventFixture({ id: "single", slug: "single", title: "Single", start: "2026-07-18" }),
    eventFixture({ id: "multi", slug: "multi", title: "Multi", start: "2026-07-18", end: "2026-07-19" }),
    eventFixture({ id: "featured", slug: "featured", title: "Featured", featured: true, start: "2026-07-19", end: "2026-07-19" }),
    eventFixture({ id: "outside", slug: "outside", title: "Outside", start: "2026-07-25", end: "2026-07-25" }),
  ], now);

  assert.deepEqual(data.events.map((event) => event.slug), ["multi", "single", "featured"]);
  assert.equal(data.stats.events, 3);
  assert.equal(data.rangeLabel, "Agenda del 17 al 19 de julio");
});

test("compone las fechas de tarjeta sin depender de saltos automáticos", () => {
  assert.deepEqual(weekendEventDateLabel(eventFixture({
    start: "2026-07-18",
    end: "2026-07-18",
  })), {
    kind: "single",
    day: "18",
    month: "JUL",
  });

  assert.deepEqual(weekendEventDateLabel(eventFixture({
    start: "2026-07-17",
    end: "2026-07-19",
  })), {
    kind: "range",
    day: "17–19",
    month: "JUL",
  });

  assert.deepEqual(weekendEventDateLabel(eventFixture({
    start: "2026-06-30",
    end: "2026-07-01",
  })), {
    kind: "cross-month",
    startDay: "30",
    startMonth: "JUN",
    endDay: "01",
    endMonth: "JUL",
  });
});

test("normaliza parámetros compartibles y descarta valores desconocidos", () => {
  assert.deepEqual(parseWeekendFilters({
    dia: "sabado",
    disciplina: "Clásicos",
    provincia: "A Coruña",
    q: "  ruta  ",
    tipo: "otros",
  }), {
    day: "sabado",
    discipline: "clasicos",
    family: "otros",
    province: "a-coruna",
    query: "ruta",
  });

  assert.equal(parseWeekendFilters({ dia: "lunes", tipo: "inventado" }).day, "todos");
  assert.equal(parseWeekendFilters({ dia: "lunes", tipo: "inventado" }).family, "");
});

test("la preview solo está disponible en ejecución local de desarrollo", () => {
  assert.equal(isWeekendPreviewAvailable("development", undefined), true);
  assert.equal(isWeekendPreviewAvailable("development", "preview"), true);
  assert.equal(isWeekendPreviewAvailable("production", "preview"), false);
  assert.equal(isWeekendPreviewAvailable("production", "production"), false);
  assert.equal(isWeekendPreviewAvailable("development", "production"), false);
});

test("mostrar más incrementa por tamaño de página y respeta el total", () => {
  assert.equal(nextWeekendVisibleLimit(12, 12, 38), 24);
  assert.equal(nextWeekendVisibleLimit(8, 8, 38), 16);
  assert.equal(nextWeekendVisibleLimit(32, 12, 38), 38);
});

test("no muestra estados editoriales internos en las tarjetas", async () => {
  const { weekendEventStatusLabel } = await import("./weekend-preview-model");

  assert.equal(weekendEventStatusLabel(eventFixture({ needsReview: true })), "");
  assert.equal(weekendEventStatusLabel(eventFixture({ dataQuality: "needs_review" })), "");
  assert.equal(weekendEventStatusLabel(eventFixture({ eventStatus: "tentative" })), "Fecha provisional");
  assert.equal(weekendEventStatusLabel(eventFixture({ eventStatus: "postponed" })), "Aplazado");
  assert.equal(weekendEventStatusLabel(eventFixture({ eventStatus: "cancelled" })), "Cancelado");
});

test("la ruta pública y la preview comparten la implementación sin perder SEO", () => {
  const publicRoute = readFileSync(
    path.join(process.cwd(), "app/eventos-motor-este-fin-de-semana/page.tsx"),
    "utf8",
  );
  const previewRoute = readFileSync(
    path.join(process.cwd(), "app/preview/eventos-motor-este-fin-de-semana/page.tsx"),
    "utf8",
  );
  const pageComponent = readFileSync(
    path.join(process.cwd(), "components/preview/weekend/WeekendPreviewPage.tsx"),
    "utf8",
  );

  assert.match(publicRoute, /buildOpportunityMetadata\(page\)/);
  assert.match(publicRoute, /<WeekendPreviewPage/);
  assert.equal((publicRoute.match(/type="application\/ld\+json"/g) || []).length, 4);
  assert.match(previewRoute, /<WeekendPreviewPage/);
  assert.match(previewRoute, /isWeekendPreviewAvailable/);
  assert.match(pageComponent, /<h2>Sobre esta agenda<\/h2>/);
  assert.match(pageComponent, /Añade tu evento a EventoMotor/);
});
