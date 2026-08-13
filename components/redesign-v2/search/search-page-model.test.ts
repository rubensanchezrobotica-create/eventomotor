import assert from "node:assert/strict";
import test from "node:test";
import type { EventItem } from "@/types/event";
import { assignV2HomeEventImages } from "../discipline-fallback-resolver";
import { projectPreviewEvent, type PreviewEvent } from "../redesign-v2-model";
import {
  buildSearchPageHref,
  buildSearchPageResults,
  EMPTY_SEARCH_PAGE_STATE,
  filterSearchPageEvents,
  parseSearchPageState,
  resetSearchPage,
  SEARCH_PAGE_SIZE,
  serializeSearchPageState,
  type SearchPageState,
} from "./search-page-model";

function event(overrides: Partial<EventItem> = {}): PreviewEvent {
  return projectPreviewEvent({
    id: "rally-madrid",
    slug: "rally-madrid",
    title: "Rallye Villa de Madrid",
    championship: "Campeonato regional",
    discipline: "Rally",
    start: "2026-08-20",
    end: "2026-08-22",
    venue: "Circuito del Jarama",
    city: "San Sebastián de los Reyes",
    province: "Madrid",
    region: "Comunidad de Madrid",
    level: "Regional",
    source: "Federación",
    sourceUrl: "https://example.com/source",
    ticketUrl: "",
    tags: ["rally", "asfalto", "coches"],
    vehicleType: "Coche",
    featured: false,
    ...overrides,
  });
}

function state(overrides: Partial<SearchPageState> = {}): SearchPageState {
  return { ...EMPTY_SEARCH_PAGE_STATE, ...overrides };
}

function imageMap(events: readonly PreviewEvent[]) {
  const images = assignV2HomeEventImages(events);
  return Object.fromEntries(events.map((candidate, index) => [candidate.id, images[index]]));
}

test("parsea una URL sin parámetros como estado base reproducible", () => {
  assert.deepEqual(parseSearchPageState(new URLSearchParams()), EMPTY_SEARCH_PAGE_STATE);
});

test("parsea q, place, date, discipline, vehicle y page", () => {
  const parsed = parseSearchPageState(new URLSearchParams(
    "q=Rally&place=Madrid&date=2026-08-21&discipline=rally&vehicle=coche&page=3",
  ));
  assert.deepEqual(parsed, state({
    q: "Rally",
    place: "Madrid",
    date: "2026-08-21",
    discipline: "rally",
    vehicle: "coche",
    page: 3,
  }));
});

test("admite searchParams del servidor y usa el primer valor repetido", () => {
  assert.deepEqual(
    parseSearchPageState({ q: ["Pitbike", "ignorado"], place: "Asturias", page: "2" }),
    state({ q: "Pitbike", place: "Asturias", page: 2 }),
  );
});

test("omite valores vacíos y page=1 al serializar", () => {
  assert.equal(serializeSearchPageState(state()).toString(), "");
  assert.equal(buildSearchPageHref(state()), "/preview/redesign-v2/buscar");
});

test("serializa los seis parámetros en orden estable", () => {
  const value = state({ q: "Trial", place: "León", date: "2026-08-21", discipline: "offroad", vehicle: "moto", page: 4 });
  assert.equal(
    serializeSearchPageState(value).toString(),
    "q=Trial&place=Le%C3%B3n&date=2026-08-21&discipline=offroad&vehicle=moto&page=4",
  );
});

test("parse y serialize conservan un estado válido", () => {
  const original = state({ q: "Clásicos", place: "A Coruña", date: "2026-09-01", discipline: "clasico", vehicle: "mixto", page: 2 });
  assert.deepEqual(parseSearchPageState(serializeSearchPageState(original)), original);
});

test("fecha, taxonomías y página desconocidas fallan de forma segura", () => {
  assert.deepEqual(
    parseSearchPageState(new URLSearchParams("date=2026-02-31&discipline=nueva&vehicle=avion&page=-4")),
    EMPTY_SEARCH_PAGE_STATE,
  );
});

test("un cambio de filtros siempre reinicia la página a uno", () => {
  assert.deepEqual(resetSearchPage(state({ q: "Rally", page: 8 }), { place: "Madrid" }), state({ q: "Rally", place: "Madrid" }));
});

test("q reutiliza el motor global para título, disciplina y ubicación", () => {
  const events = [event(), event({ id: "trial", title: "Trial Indoor", discipline: "Trial", city: "Oviedo", province: "Asturias", region: "Asturias", venue: "Palacio de deportes" })];
  assert.deepEqual(filterSearchPageEvents(events, state({ q: "trial" })).map(({ id }) => id), ["trial"]);
  assert.deepEqual(filterSearchPageEvents(events, state({ q: "jarama" })).map(({ id }) => id), ["rally-madrid"]);
});

test("place sólo busca en campos territoriales y de recinto", () => {
  const events = [
    event({ id: "place", title: "Rallye Norte", city: "Madrid" }),
    event({ id: "title-only", title: "Trofeo Madrid", city: "Oviedo", province: "Asturias", region: "Asturias", venue: "El Caleyu" }),
  ];
  assert.deepEqual(filterSearchPageEvents(events, state({ place: "Madrid" })).map(({ id }) => id), ["place"]);
});

test("la fecha seleccionada incluye un evento activo dentro de un rango multidía", () => {
  assert.equal(filterSearchPageEvents([event()], state({ date: "2026-08-21" })).length, 1);
  assert.equal(filterSearchPageEvents([event()], state({ date: "2026-08-23" })).length, 0);
});

test("la clasificación real incluye DrPit, pitbike y minimotard como MOTO", () => {
  const variants = ["DrPit Cup", "Pitbike Challenge", "Minimotard Series"].map((title, index) => event({
    id: `pitbike-${index}`,
    title,
    discipline: "Minivelocidad",
    vehicleType: "Otros",
    tags: [],
  }));
  assert.deepEqual(filterSearchPageEvents(variants, state({ vehicle: "moto" })).map(({ id }) => id), ["pitbike-0", "pitbike-1", "pitbike-2"]);
});

test("los filtros combinados no alteran el orden estable", () => {
  const events = [
    event({ id: "first", title: "Rallye A" }),
    event({ id: "second", title: "Rallye B" }),
    event({ id: "other", title: "Trial C", discipline: "Trial", vehicleType: "Moto" }),
  ];
  assert.deepEqual(
    filterSearchPageEvents(events, state({ q: "rally", place: "Madrid", vehicle: "coche" })).map(({ id }) => id),
    ["first", "second"],
  );
});

test("una búsqueda sin coincidencias entrega total cero y página normalizada", () => {
  const events = [event()];
  const results = buildSearchPageResults(events, state({ q: "inexistente", page: 99 }), imageMap(events));
  assert.equal(results.total, 0);
  assert.equal(results.visible.length, 0);
  assert.equal(results.page, 1);
  assert.equal(results.pageCount, 1);
});

test("pagina exactamente 12 resultados y conserva el total filtrado", () => {
  const events = Array.from({ length: 26 }, (_, index) => event({
    id: `rally-${index + 1}`,
    slug: `rally-${index + 1}`,
    title: `Rallye ${String(index + 1).padStart(2, "0")}`,
  }));
  const results = buildSearchPageResults(events, state({ q: "rally", page: 2 }), imageMap(events));
  assert.equal(SEARCH_PAGE_SIZE, 12);
  assert.equal(results.total, 26);
  assert.equal(results.visible.length, 12);
  assert.deepEqual(results.visible.map(({ id }) => id), events.slice(12, 24).map(({ id }) => id));
});

test("normaliza una página fuera de rango a la última disponible", () => {
  const events = Array.from({ length: 13 }, (_, index) => event({ id: `event-${index}`, slug: `event-${index}` }));
  const results = buildSearchPageResults(events, state({ page: 99 }), imageMap(events));
  assert.equal(results.page, 2);
  assert.equal(results.pageCount, 2);
  assert.equal(results.visible.length, 1);
});

test("R3F se aplica tras el slice a cada secuencia final visible", () => {
  const targetEvents = Array.from({ length: 14 }, (_, index) => event({
    id: `cross-${index + 1}`,
    slug: `cross-${index + 1}`,
    title: `Cross Country ${index + 1}`,
    discipline: "Cross Country",
    vehicleType: "Moto",
    tags: ["cross country", "moto"],
  }));
  const globalEvents = targetEvents.flatMap((target, index) => [
    target,
    event({ id: `separator-${index + 1}`, slug: `separator-${index + 1}`, title: `Rallye separador ${index + 1}` }),
  ]);
  const images = imageMap(globalEvents);
  const firstPage = buildSearchPageResults(globalEvents, state({ q: "cross country" }), images);
  const secondPage = buildSearchPageResults(globalEvents, state({ q: "cross country", page: 2 }), images);

  assert.deepEqual(firstPage.visible.map(({ id }) => id), targetEvents.slice(0, 12).map(({ id }) => id));
  assert.deepEqual(secondPage.visible.map(({ id }) => id), targetEvents.slice(12).map(({ id }) => id));
  for (const page of [firstPage, secondPage]) {
    const ids = page.visibleImages.map(({ fallbackId }) => fallbackId);
    assert.equal(ids.slice(1).some((id, index) => id === ids[index]), false);
    assert.equal(page.visibleImages.every((image) => image.interpretedDiscipline === "offroad"), true);
  }
});
