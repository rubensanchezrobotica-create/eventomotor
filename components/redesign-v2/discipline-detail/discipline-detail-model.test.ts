import assert from "node:assert/strict";
import test from "node:test";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";
import {
  DISCIPLINE_HERO_VISUALS,
  DISCIPLINE_DETAIL_PAGE_SIZE,
  buildDisciplineDetailPageModel,
  disciplineDetailPageHref,
  disciplineDetailPaginationItems,
  parseDisciplineDetailPage,
  resolveDisciplineDetailDefinition,
  resolveDisciplineHeroVisual,
} from "./discipline-detail-model";

const NOW = "2026-08-18T10:00:00.000Z";

function event(
  id: string,
  discipline: string,
  start = "2026-08-22",
  overrides: Partial<EventItem> = {},
): EventItem {
  return {
    id,
    slug: `evento-${id}`,
    title: `Evento ${id}`,
    championship: discipline,
    discipline,
    start,
    end: start,
    venue: "Recinto",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    level: "Publicado",
    source: "Test",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [discipline],
    vehicleType: discipline === "Karting" ? "karting" : "coche",
    vehicle_type: discipline === "Karting" ? "karting" : "coche",
    featured: false,
    visible: true,
    ...overrides,
  } as EventItem;
}

test("A6 resuelve exactamente las ocho disciplinas canónicas sin duplicar taxonomía", () => {
  assert.equal(SEO_DISCIPLINES.length, 8);
  assert.deepEqual(
    SEO_DISCIPLINES.map(({ slug }) => resolveDisciplineDetailDefinition(slug)?.slug),
    ["rallyes", "circuito", "concentraciones", "offroad", "clasicos", "karting", "rutas", "ferias"],
  );
  assert.equal(resolveDisciplineDetailDefinition("freestyle"), null);
});

test("A6.1 asigna el hero atmosférico únicamente a Rallyes mediante metadata visual", () => {
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS), ["rallyes"]);
  assert.deepEqual(resolveDisciplineHeroVisual("rallyes"), {
    src: "/images/redesign-v2/disciplines/hero-rallyes.png",
  });

  const otherDisciplines = SEO_DISCIPLINES
    .map(({ slug }) => slug)
    .filter((slug) => slug !== "rallyes");

  assert.equal(otherDisciplines.length, 7);
  for (const slug of otherDisciplines) {
    assert.equal(resolveDisciplineHeroVisual(slug), null, slug);
  }
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS.rallyes ?? {}), ["src"]);
});

test("A6 filtra exclusivamente con el clasificador canónico para las ocho disciplinas", () => {
  const fixtures = [
    event("rally", "Rally"),
    event("circuito", "Circuito"),
    event("concentracion", "Concentracion"),
    event("offroad", "Motocross"),
    event("clasicos", "Clasicos"),
    event("karting", "Circuito", "2026-08-22", { vehicleType: "karting", vehicle_type: "karting" }),
    event("rutas", "Rutas"),
    event("ferias", "Ferias"),
  ];

  for (const definition of SEO_DISCIPLINES) {
    const model = buildDisciplineDetailPageModel(fixtures, definition.slug, { now: NOW, page: 1 });
    assert.equal(model.totalUpcomingCount, 1, definition.slug);
  }
});

test("A6 excluye pasado, incluye multidía activo, deduplica y ordena cronológicamente", () => {
  const active = event("active", "Rally", "2026-08-16", { end: "2026-08-19" });
  const future = event("future", "Rally", "2026-08-23");
  const later = event("later", "Rally", "2026-08-24");
  const duplicate = { ...future };
  const past = event("past", "Rally", "2026-08-10", { end: "2026-08-17" });
  const hidden = event("hidden", "Rally", "2026-08-20", { visible: false });
  const other = event("other", "Circuito", "2026-08-21");

  const model = buildDisciplineDetailPageModel(
    [later, future, duplicate, active, past, hidden, other],
    "rallyes",
    { now: NOW, page: 1 },
  );

  assert.deepEqual(model.items.map(({ event: item }) => item.id), ["active", "future", "later"]);
  assert.equal(model.totalUpcomingCount, 3);
});

test("A6 pagina doce resultados en servidor y normaliza páginas fuera de rango", () => {
  const events = Array.from({ length: 26 }, (_, index) => (
    event(String(index + 1).padStart(2, "0"), "Rally", `2026-09-${String(index + 1).padStart(2, "0")}`)
  ));
  const second = buildDisciplineDetailPageModel(events, "rallyes", { now: NOW, page: 2 });
  const overflow = buildDisciplineDetailPageModel(events, "rallyes", { now: NOW, page: 500 });

  assert.equal(DISCIPLINE_DETAIL_PAGE_SIZE, 12);
  assert.equal(second.items.length, 12);
  assert.equal(second.page, 2);
  assert.equal(second.pageCount, 3);
  assert.equal(overflow.page, 3);
  assert.equal(overflow.items.length, 2);
});

test("A6 maneja query page inválida y construye enlaces estables", () => {
  assert.equal(parseDisciplineDetailPage(undefined), 1);
  assert.equal(parseDisciplineDetailPage("abc"), 1);
  assert.equal(parseDisciplineDetailPage("0"), 1);
  assert.equal(parseDisciplineDetailPage("-1"), 1);
  assert.equal(parseDisciplineDetailPage(["2", "3"]), 2);
  assert.equal(disciplineDetailPageHref("rallyes", 1), "/preview/redesign-v2/disciplinas/rallyes");
  assert.equal(disciplineDetailPageHref("rallyes", 2), "/preview/redesign-v2/disciplinas/rallyes?page=2");
  assert.deepEqual(disciplineDetailPaginationItems(9, 18), [1, "ellipsis", 8, 9, 10, "ellipsis", 18]);
});

test("A6 conserva un empty state válido", () => {
  const model = buildDisciplineDetailPageModel(
    [event("circuito", "Circuito")],
    "rallyes",
    { now: NOW, page: 1 },
  );

  assert.equal(model.totalUpcomingCount, 0);
  assert.equal(model.items.length, 0);
  assert.equal(model.page, 1);
  assert.equal(model.pageCount, 1);
});
