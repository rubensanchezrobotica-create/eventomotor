import assert from "node:assert/strict";
import test from "node:test";
import { getSpanishTerritoryById } from "@/lib/regions/territory-contract";
import type { EventItem } from "@/types/event";
import {
  TERRITORY_DETAIL_PAGE_SIZE,
  TERRITORY_DETAIL_QUERY_MAX_LENGTH,
  buildTerritoryDetailPageModel,
  normalizeTerritoryDetailText,
  parseTerritoryDetailPage,
  parseTerritoryDetailQuery,
  previewTerritories,
  resolvePreviewTerritory,
  territoryDetailHeroSummary,
  territoryDetailPageHref,
  territoryDetailPaginationItems,
  territoryDetailResultsSummary,
  territoryDetailState,
} from "./territory-detail-model";

const NOW = "2026-09-10T10:00:00+02:00";

function event(index: number, overrides: Partial<EventItem> = {}): EventItem {
  const day = String(11 + index).padStart(2, "0");
  return {
    id: `territory-detail-${index}`,
    slug: `territory-detail-${index}`,
    title: `Rally territorial ${index}`,
    championship: "",
    discipline: "Rally",
    start: `2026-09-${day}`,
    end: `2026-09-${day}`,
    venue: "Recinto de pruebas",
    city: "Sevilla",
    province: "Sevilla",
    region: "Andalucía",
    country: "ES",
    level: "Regional",
    source: "Fixture A7.5B",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: ["rally"],
    vehicleType: "coche",
    featured: false,
    visible: true,
    ...overrides,
  };
}

function query(overrides: Partial<ReturnType<typeof parseTerritoryDetailQuery>> = {}) {
  return { discipline: "", page: 1, province: "", q: "", ...overrides };
}

function andaluciaModel(events: EventItem[], overrides = {}) {
  const territory = getSpanishTerritoryById("andalucia");
  assert.ok(territory);
  return buildTerritoryDetailPageModel(events, territory, {
    now: NOW,
    query: query(overrides),
  });
}

test("A7.5B resuelve sólo los 17 slugs canónicos de comunidades publicables", () => {
  const territories = previewTerritories();
  assert.equal(territories.length, 17);
  assert.deepEqual(
    territories.map(({ slug }) => resolvePreviewTerritory(slug)?.slug),
    territories.map(({ slug }) => slug),
  );
  for (const invalid of ["ceuta", "melilla", "desconocido", "La-Rioja", "la rioja", "catalunya", ""]) {
    assert.equal(resolvePreviewTerritory(invalid), null, invalid);
  }
});

test("A7.5B aplica EMPTY, MINIMAL, COMPACT y FULL con controles progresivos", () => {
  assert.equal(territoryDetailState(0), "EMPTY");
  assert.equal(territoryDetailState(1), "MINIMAL");
  assert.equal(territoryDetailState(2), "MINIMAL");
  assert.equal(territoryDetailState(3), "COMPACT");
  assert.equal(territoryDetailState(9), "COMPACT");
  assert.equal(territoryDetailState(10), "FULL");

  const minimal = andaluciaModel([event(0), event(1)]);
  const compact = andaluciaModel(Array.from({ length: 6 }, (_, index) => event(index, {
    discipline: index % 2 ? "Circuito" : "Rally",
    province: index % 2 ? "Málaga" : "Sevilla",
  })));
  const full = andaluciaModel(Array.from({ length: 10 }, (_, index) => event(index, {
    discipline: index % 2 ? "Circuito" : "Rally",
    province: index % 2 ? "Málaga" : "Sevilla",
  })));

  assert.deepEqual(
    [minimal.showTextSearch, minimal.showProvinceFilter, minimal.showDisciplineFilter],
    [false, false, false],
  );
  assert.deepEqual(
    [compact.showTextSearch, compact.showProvinceFilter, compact.showDisciplineFilter],
    [false, true, true],
  );
  assert.deepEqual(
    [full.showTextSearch, full.showProvinceFilter, full.showDisciplineFilter],
    [true, true, true],
  );
});

test("A7.5B mantiene los filtros en datos estructurados del territorio exacto", () => {
  const fixtures = Array.from({ length: 10 }, (_, index) => event(index, {
    city: index % 2 ? "Málaga" : "Sevilla",
    discipline: index % 2 ? "Circuito" : "Rally",
    province: index % 2 ? "Málaga" : "Sevilla",
    title: index === 4 ? "Rally Sierra Morena" : `Evento andaluz ${index}`,
  }));
  const model = andaluciaModel(fixtures, { discipline: "rallyes", province: "sevilla", q: "sierra" });

  assert.equal(model.totalUpcomingCount, 10);
  assert.equal(model.filteredCount, 1);
  assert.equal(model.items[0]?.event.title, "Rally Sierra Morena");
  assert.deepEqual(model.provinceOptions.map(({ key, count }) => [key, count]), [["malaga", 5], ["sevilla", 5]]);
  assert.deepEqual(model.disciplineOptions.map(({ key, count }) => [key, count]), [["circuito", 5], ["rallyes", 5]]);
});

test("A7.5B ignora filtros inválidos y desactiva q por debajo de FULL", () => {
  const full = andaluciaModel(Array.from({ length: 10 }, (_, index) => event(index)), {
    discipline: "inventada",
    province: "inventada",
  });
  const compact = andaluciaModel(Array.from({ length: 4 }, (_, index) => event(index)), {
    q: "Rally",
  });

  assert.equal(full.query.discipline, "");
  assert.equal(full.query.province, "");
  assert.equal(full.filteredCount, 10);
  assert.equal(compact.query.q, "");
  assert.equal(compact.filteredCount, 4);
});

test("A7.5B filtra país y territorio antes de buscar sin inferir desde texto libre", () => {
  const model = andaluciaModel([
    event(0),
    event(1, { country: "PT", region: "Andalucía", province: "Sevilla" }),
    event(2, {
      title: "Andalucía Rally Festival",
      region: "Por confirmar",
      province: "Por confirmar",
    }),
    event(3, { region: "Madrid", province: "Madrid" }),
    event(4, { visible: false }),
    event(5, { eventStatus: "cancelled" }),
    event(6, { dataQuality: "cancelled" }),
    { ...event(7), id: "duplicate", slug: event(0).slug },
  ]);

  assert.deepEqual(model.items.map(({ event: item }) => item.id), ["territory-detail-0"]);
  assert.equal(model.totalUpcomingCount, 1);
});

test("A7.5B pagina en servidor hasta 12 eventos y normaliza páginas fuera de rango", () => {
  const fixtures = Array.from({ length: 25 }, (_, index) => event(index, {
    start: `2026-10-${String(index + 1).padStart(2, "0")}`,
    end: `2026-10-${String(index + 1).padStart(2, "0")}`,
  }));
  const second = andaluciaModel(fixtures, { page: 2 });
  const overflow = andaluciaModel(fixtures, { page: 900 });

  assert.equal(TERRITORY_DETAIL_PAGE_SIZE, 12);
  assert.equal(second.page, 2);
  assert.equal(second.pageCount, 3);
  assert.equal(second.items.length, 12);
  assert.equal(second.items[0]?.event.id, "territory-detail-12");
  assert.equal(overflow.page, 3);
  assert.equal(overflow.items.length, 1);
  assert.equal(overflow.items[0]?.event.id, "territory-detail-24");
});

test("A7.5B conserva imagen real y usa el resolver V2 para fallbacks", () => {
  const model = andaluciaModel([
    event(0, { imageUrl: "https://images.example.com/evento-real.webp" }),
    event(1),
  ]);

  assert.deepEqual(model.items[0]?.image, {
    alt: "Imagen del evento Rally territorial 0",
    kind: "event",
    src: "https://images.example.com/evento-real.webp",
  });
  assert.equal(model.items[1]?.image.kind, "representative");
  assert.match(String(model.items[1]?.image.src), /^\/images\/disciplines\/fallbacks\//);
});

test("A7.5B construye query estable, paginación enlazable y reseteo implícito de page", () => {
  assert.equal(parseTerritoryDetailPage(undefined), 1);
  assert.equal(parseTerritoryDetailPage("-1"), 1);
  assert.equal(parseTerritoryDetailPage("0"), 1);
  assert.equal(parseTerritoryDetailPage("abc"), 1);
  assert.equal(parseTerritoryDetailPage(["3", "4"]), 3);
  assert.equal(parseTerritoryDetailQuery({ q: `  ${"x".repeat(200)}  ` }).q.length, TERRITORY_DETAIL_QUERY_MAX_LENGTH);
  assert.equal(normalizeTerritoryDetailText("  LA   BAÑEZA  "), "la baneza");
  assert.equal(
    territoryDetailPageHref("andalucia", { q: "Sierra & Mar", province: "malaga", discipline: "rallyes", page: 2 }),
    "/preview/redesign-v2/zonas/andalucia?q=Sierra+%26+Mar&province=malaga&discipline=rallyes&page=2",
  );
  assert.deepEqual(territoryDetailPaginationItems(8, 16), [1, "ellipsis", 7, 8, 9, "ellipsis", 16]);
});

test("A7.5B diferencia resumen corto, paginado, vacío y filtrado", () => {
  const minimal = andaluciaModel([event(0)]);
  const full = andaluciaModel(Array.from({ length: 13 }, (_, index) => event(index)));
  const filteredEmpty = andaluciaModel(Array.from({ length: 10 }, (_, index) => event(index)), { q: "no existe" });
  const empty = andaluciaModel([]);

  assert.equal(territoryDetailResultsSummary(minimal), "1 evento próximo, ordenado por fecha.");
  assert.equal(territoryDetailResultsSummary(full), "Mostrando 1–12 de 13 eventos próximos, ordenados por fecha.");
  assert.equal(territoryDetailResultsSummary(filteredEmpty), "No hay próximos eventos que coincidan con los filtros seleccionados.");
  assert.equal(territoryDetailResultsSummary(empty), "Sin próximos eventos publicados en este territorio.");
  assert.equal(
    territoryDetailHeroSummary(minimal),
    "1 evento próximo · 1 provincia con actividad. Descubre los próximos eventos de motor en Andalucía.",
  );
});

test("A7.5B-R1 separa actividad real de la descripción neutral del territorio", () => {
  const model = andaluciaModel([
    event(0, { province: "Almería" }),
    event(1, { province: "Cádiz" }),
    event(2, { province: "Granada" }),
    event(3, { province: "Sevilla" }),
  ]);
  const summary = territoryDetailHeroSummary(model);

  assert.equal(
    summary,
    "4 eventos próximos · 4 provincias con actividad. Descubre los próximos eventos de motor en Andalucía.",
  );
  assert.doesNotMatch(summary, /Almería, Cádiz|Córdoba|Huelva|Jaén|Málaga/);
});

test("A7.5B reutiliza el mismo contenido regional y la misma plantilla para La Rioja", () => {
  const madrid = getSpanishTerritoryById("madrid");
  const rioja = getSpanishTerritoryById("laRioja");
  assert.ok(madrid);
  assert.ok(rioja);
  const madridModel = buildTerritoryDetailPageModel([], madrid, { now: NOW, query: query() });
  const riojaModel = buildTerritoryDetailPageModel([], rioja, { now: NOW, query: query() });

  assert.ok(madridModel.guideParagraphs.length > 0);
  assert.ok(madridModel.faqs.length > 0);
  assert.equal(riojaModel.description, "Consulta los próximos eventos de motor en La Rioja.");
  assert.deepEqual(riojaModel.guideParagraphs, []);
  assert.deepEqual(riojaModel.faqs, []);
});
