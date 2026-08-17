import assert from "node:assert/strict";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildDisciplinesPageModel,
  disciplineUpcomingCountLabel,
  isUpcomingDisciplineEvent,
} from "./disciplines-model";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event-1",
    title: "Evento de prueba",
    championship: "",
    discipline: "Rally",
    start: "2026-08-20",
    end: "2026-08-20",
    venue: "Circuito",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    level: "Nacional",
    source: "Fuente oficial",
    sourceUrl: "https://example.com/evento",
    ticketUrl: "",
    tags: [],
    featured: false,
    visible: true,
    ...overrides,
  };
}

test("A5 conserva las ocho disciplinas canónicas, su orden, iconos y rutas públicas", () => {
  const model = buildDisciplinesPageModel([], "2026-08-17T10:00:00+02:00");

  assert.deepEqual(model.cards.map(({ slug }) => slug), [
    "rallyes",
    "circuito",
    "concentraciones",
    "offroad",
    "clasicos",
    "karting",
    "rutas",
    "ferias",
  ]);
  assert.deepEqual(model.cards.map(({ href }) => href), model.cards.map(({ slug }) => `/disciplinas/${slug}`));
  assert.ok(model.cards.every(({ icon, slug }) => icon === `/images/disciplines/icons/web/discipline-${slug}.png`));
  assert.ok(model.cards.every(({ upcomingCount }) => upcomingCount === 0));
});

test("A5 cuenta sólo eventos visibles y próximos, incluidos los multiday activos", () => {
  const model = buildDisciplinesPageModel([
    event({ id: "active", start: "2026-08-15", end: "2026-08-18" }),
    event({ id: "past", start: "2026-08-01", end: "2026-08-16" }),
    event({ id: "future", discipline: "Circuito", start: "2026-08-22", end: "2026-08-22" }),
    event({ id: "hidden", visible: false, start: "2026-08-23", end: "2026-08-23" }),
    event({ id: "invalid", start: "2026-02-30", end: "2026-02-30" }),
  ], "2026-08-17T12:00:00+02:00");

  assert.equal(model.cards.find(({ slug }) => slug === "rallyes")?.upcomingCount, 1);
  assert.equal(model.cards.find(({ slug }) => slug === "circuito")?.upcomingCount, 1);
  assert.equal(model.totalVisibleEventCount, 4);
  assert.equal(model.totalUpcomingEventCount, 2);
  assert.equal(isUpcomingDisciplineEvent(event({ start: "2026-08-15", end: "2026-08-17" }), model.today), true);
});

test("A5 deduplica por slug o id y no reparte eventos sin clasificación canónica", () => {
  const model = buildDisciplinesPageModel([
    event({ id: "one", slug: "same", discipline: "Rally" }),
    event({ id: "two", slug: "same", discipline: "Circuito" }),
    event({ id: "unknown", slug: "unknown", discipline: "Disciplina futura" }),
    event({ id: "kart", slug: "kart", discipline: "Otra", vehicleType: "Karting" }),
  ], "2026-08-17T10:00:00+02:00");

  assert.equal(model.totalVisibleEventCount, 3);
  assert.equal(model.totalUpcomingEventCount, 3);
  assert.equal(model.unmappedUpcomingCount, 1);
  assert.equal(model.cards.find(({ slug }) => slug === "rallyes")?.upcomingCount, 1);
  assert.equal(model.cards.find(({ slug }) => slug === "circuito")?.upcomingCount, 0);
  assert.equal(model.cards.find(({ slug }) => slug === "karting")?.upcomingCount, 1);
});

test("A5 calcula hoy en Europe/Madrid de forma determinista", () => {
  const model = buildDisciplinesPageModel([
    event({ start: "2026-08-17", end: "2026-08-17" }),
  ], "2026-08-16T22:30:00.000Z");

  assert.equal(model.today, "2026-08-17");
  assert.equal(model.totalUpcomingEventCount, 1);
});

test("A5 pluraliza el contador sin inventar actividad para estados cero", () => {
  assert.equal(disciplineUpcomingCountLabel(0), "Sin próximos eventos");
  assert.equal(disciplineUpcomingCountLabel(1), "1 evento próximo");
  assert.equal(disciplineUpcomingCountLabel(2), "2 eventos próximos");
});
