import assert from "node:assert/strict";
import test from "node:test";
import { REGIONAL_CONFIGS, REGIONAL_REGION_IDS } from "@/lib/regions/regional-config";
import type { EventItem } from "@/types/event";
import {
  buildTerritoryDirectoryModel,
  isUpcomingTerritoryEvent,
  territoryProvinceActivityLabel,
  territoryUpcomingCountLabel,
} from "./territory-directory-model";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "territory-event",
    title: "Evento territorial",
    championship: "",
    discipline: "Rally",
    start: "2026-09-12",
    end: "2026-09-12",
    venue: "Recinto",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Regional",
    source: "Fixture",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    featured: false,
    visible: true,
    ...overrides,
  };
}

const NOW = "2026-09-09T12:00:00+02:00";

test("A7.3 genera 17 comunidades ordenadas y 2 ciudades autónomas secundarias", () => {
  const model = buildTerritoryDirectoryModel([], NOW);
  const sortedNames = [
    "Andalucía",
    "Aragón",
    "Asturias",
    "Baleares",
    "Canarias",
    "Cantabria",
    "Castilla-La Mancha",
    "Castilla y León",
    "Cataluña",
    "Comunidad Valenciana",
    "Extremadura",
    "Galicia",
    "La Rioja",
    "Madrid",
    "Murcia",
    "Navarra",
    "País Vasco",
  ];

  assert.equal(model.communities.length, 17);
  assert.equal(model.autonomousCities.length, 2);
  assert.deepEqual(model.communities.map(({ displayName }) => displayName), sortedNames);
  assert.deepEqual(model.autonomousCities.map(({ displayName }) => displayName), ["Ceuta", "Melilla"]);
  assert.equal(new Set(model.communities.map(({ id }) => id)).size, 17);
});

test("A7.3 excluye Portugal y deja sin asignar la geografía española desconocida", () => {
  const model = buildTerritoryDirectoryModel([
    event({ id: "madrid" }),
    event({ id: "portugal", country: "PT" }),
    event({ id: "unknown", region: "Por confirmar", province: "Por confirmar" }),
  ], NOW);

  assert.equal(model.totalUpcomingEventCount, 3);
  assert.equal(model.totalSpanishUpcomingCount, 2);
  assert.equal(model.territoriallyAssignedSpanishEventCount, 1);
  assert.equal(model.unassignedSpanishGeographyCount, 1);
  assert.equal(model.portugueseEventCountExcluded, 1);
});

test("A7.3 renderiza La Rioja con conteo pero sin enlace roto", () => {
  const model = buildTerritoryDirectoryModel([
    event({ id: "rioja", region: "La Rioja", province: "La Rioja" }),
  ], NOW);
  const rioja = model.communities.find(({ id }) => id === "laRioja");

  assert.ok(rioja);
  assert.equal(rioja.upcomingEventCount, 1);
  assert.equal(rioja.activeProvinceCount, 1);
  assert.equal(rioja.href, null);
});

test("A7.3 conserva los 16 href públicos existentes y no enlaza Ceuta o Melilla", () => {
  const model = buildTerritoryDirectoryModel([], NOW);
  const linkedCommunities = model.communities.filter(({ href }) => href);

  assert.equal(linkedCommunities.length, 16);
  for (const id of REGIONAL_REGION_IDS) {
    assert.equal(model.communities.find((item) => item.id === id)?.href, REGIONAL_CONFIGS[id].publicPath);
  }
  assert.ok(model.autonomousCities.every(({ href }) => href === null));
});

test("A7.3 cuenta provincias distintas dentro de la comunidad asignada", () => {
  const model = buildTerritoryDirectoryModel([
    event({ id: "barcelona", region: "Cataluña", province: "Barcelona" }),
    event({ id: "barcelona-duplicate", region: "Cataluña", province: " Barcelona " }),
    event({ id: "girona", region: "Catalunya", province: "Girona" }),
    event({ id: "unknown", region: "Cataluña", province: "Por confirmar" }),
  ], NOW);

  const cataluna = model.communities.find(({ id }) => id === "cataluna");
  assert.equal(cataluna?.upcomingEventCount, 4);
  assert.equal(cataluna?.activeProvinceCount, 2);
});

test("A7.3 mantiene territorios con cero, singular y plural con gramática estable", () => {
  assert.equal(territoryUpcomingCountLabel(0), "Sin próximos eventos");
  assert.equal(territoryUpcomingCountLabel(1), "1 evento próximo");
  assert.equal(territoryUpcomingCountLabel(2), "2 eventos próximos");
  assert.equal(territoryProvinceActivityLabel(0), "Sin provincias con actividad");
  assert.equal(territoryProvinceActivityLabel(1), "1 provincia con actividad");
  assert.equal(territoryProvinceActivityLabel(2), "2 provincias con actividad");
});

test("A7.3 deduplica, excluye ocultos y conserva eventos multiday activos", () => {
  const model = buildTerritoryDirectoryModel([
    event({ id: "active", slug: "same", start: "2026-09-01", end: "2026-09-09" }),
    event({ id: "duplicate", slug: "same" }),
    event({ id: "hidden", visible: false }),
    event({ id: "past", start: "2026-09-01", end: "2026-09-08" }),
    event({ id: "invalid", start: "2026-02-30", end: "2026-02-30" }),
  ], NOW);

  assert.equal(model.totalUpcomingEventCount, 1);
  assert.equal(model.totalSpanishUpcomingCount, 1);
  assert.equal(isUpcomingTerritoryEvent(event({ start: "2026-09-01", end: "2026-09-09" }), model.today), true);
});

test("A7.3 reproduce el contrato congelado 539 ES, 535 asignados y 2 PT excluidos", () => {
  const assigned = Array.from({ length: 535 }, (_, index) => event({ id: `es-${index}` }));
  const unknown = Array.from({ length: 4 }, (_, index) => event({
    id: `unknown-${index}`,
    region: "Por confirmar",
    province: "Por confirmar",
  }));
  const portuguese = Array.from({ length: 2 }, (_, index) => event({
    id: `pt-${index}`,
    country: "Portugal",
  }));
  const model = buildTerritoryDirectoryModel([...assigned, ...unknown, ...portuguese], NOW);

  assert.equal(model.totalUpcomingEventCount, 541);
  assert.equal(model.totalSpanishUpcomingCount, 539);
  assert.equal(model.territoriallyAssignedSpanishEventCount, 535);
  assert.equal(model.unassignedSpanishGeographyCount, 4);
  assert.equal(model.portugueseEventCountExcluded, 2);
});
