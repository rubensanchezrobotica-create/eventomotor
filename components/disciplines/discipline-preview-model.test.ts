import assert from "node:assert/strict";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildDisciplinePreviewData,
  buildDisciplinePreviewMetadata,
  buildDisciplinePublicMetadata,
  classifyDisciplineModality,
  classifyEventDisciplinePage,
  DEFAULT_DISCIPLINE_FILTERS,
  disciplineEditorial,
  disciplineEventCount,
  disciplineFiltersToSearchParams,
  disciplineModalities,
  disciplineResultMeta,
  disciplineResultTitle,
  eventBelongsToDiscipline,
  featuredDisciplineProvinces,
  filterDisciplineEvents,
  hasAdvancedDisciplineFilters,
  isDisciplinePreviewAvailable,
  isDisciplineSlug,
  nextDisciplineVisibleLimit,
  parseDisciplineFilters,
  periodDisciplineEvents,
} from "./discipline-preview-model";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";

const NOW = new Date("2026-07-19T12:00:00+02:00");

function event(
  id: string,
  discipline: string,
  start = "2026-07-25",
  overrides: Partial<EventItem> = {},
): EventItem {
  return {
    championship: "Campeonato",
    city: "Madrid",
    discipline,
    end: start,
    featured: false,
    id,
    level: "regional",
    province: "Madrid",
    region: "Comunidad de Madrid",
    source: "test",
    sourceUrl: "https://example.com",
    start,
    tags: [],
    ticketUrl: "",
    title: `Evento ${id}`,
    vehicleType: "Coche",
    venue: "Recinto",
    visible: true,
    ...overrides,
  };
}

test("reconoce exclusivamente los ocho slugs públicos", () => {
  assert.deepEqual(
    SEO_DISCIPLINES.map(({ slug }) => slug),
    ["rallyes", "circuito", "concentraciones", "offroad", "clasicos", "karting", "rutas", "ferias"],
  );
  assert.equal(isDisciplineSlug("rallyes"), true);
  assert.equal(isDisciplineSlug("concentraciones"), true);
  assert.equal(isDisciplineSlug("motos"), false);
});

test("clasifica por el campo estructurado y no por título, campeonato o etiquetas", () => {
  const laurel = event("laurel", "Clásicos", "2026-07-25", {
    championship: "XVII Rally de Vehículos Antiguos",
    tags: ["Concentración", "Rally"],
    title: "XXXIII Concentración y XVII Rally de Vehículos Antiguos Laurel de Baco",
  });
  assert.equal(classifyEventDisciplinePage(laurel), "clasicos");
  assert.equal(eventBelongsToDiscipline(laurel, "rallyes"), false);
  assert.equal(eventBelongsToDiscipline(laurel, "concentraciones"), false);
});

test("utiliza el tipo de vehículo estructurado como excepción segura para karting", () => {
  assert.equal(classifyEventDisciplinePage(event("kart", "Circuito", "2026-07-25", {
    vehicleType: "Karting",
  })), "karting");
});

test("no asigna valores estructurados dudosos", () => {
  assert.equal(classifyEventDisciplinePage(event("auto", "Automovilismo")), null);
});

test("cada evento pertenece como máximo a una landing", () => {
  const candidate = event("rally", "Rally");
  const matches = ["rallyes", "circuito", "concentraciones", "offroad", "clasicos", "karting", "rutas", "ferias"]
    .filter((slug) => eventBelongsToDiscipline(candidate, slug as never));
  assert.deepEqual(matches, ["rallyes"]);
});

test("asigna una única modalidad comprensible", () => {
  const rallysprint = event("rs", "Rallysprint");
  assert.equal(classifyDisciplineModality(rallysprint, "rallyes"), "rallysprint-rallycrono");
  assert.equal(classifyDisciplineModality(rallysprint, "circuito"), null);
});

test("la suma de modalidades coincide con el total próximo", () => {
  const data = buildDisciplinePreviewData([
    event("a", "Rally"),
    event("b", "Rallysprint"),
    event("c", "Slalom"),
  ], "rallyes", NOW);
  assert.equal(data.modalities.reduce((sum, modality) => sum + modality.count, 0), data.stats.upcoming);
});

test("separa próximos y anteriores, incluyendo eventos en curso", () => {
  const data = buildDisciplinePreviewData([
    event("past", "Rally", "2026-07-18"),
    event("ongoing", "Rally", "2026-07-18", { end: "2026-07-19" }),
    event("future", "Rally", "2026-07-25"),
  ], "rallyes", NOW);
  assert.deepEqual(data.upcomingEvents.map(({ id }) => id), ["ongoing", "future"]);
  assert.deepEqual(data.pastEvents.map(({ id }) => id), ["past"]);
});

test("calcula el siguiente fin de semana", () => {
  const result = periodDisciplineEvents([
    event("friday", "Rally", "2026-07-24"),
    event("sunday", "Rally", "2026-07-26"),
    event("later", "Rally", "2026-07-30"),
  ], "weekend", NOW);
  assert.deepEqual(result.map(({ id }) => id), ["friday", "sunday"]);
});

test("calcula los próximos 30 días", () => {
  const result = periodDisciplineEvents([
    event("inside", "Rally", "2026-08-18"),
    event("outside", "Rally", "2026-08-19"),
  ], "next30", NOW);
  assert.deepEqual(result.map(({ id }) => id), ["inside"]);
});

test("calcula el periodo de este mes", () => {
  const result = periodDisciplineEvents([
    event("july", "Rally", "2026-07-31"),
    event("august", "Rally", "2026-08-01"),
  ], "month", NOW);
  assert.deepEqual(result.map(({ id }) => id), ["july"]);
});

test("filtra por provincia normalizada", () => {
  const events = [
    event("a", "Rally", "2026-07-25", { province: "Álava" }),
    event("b", "Rally", "2026-07-25", { province: "Madrid" }),
  ];
  assert.deepEqual(filterDisciplineEvents(events, {
    ...DEFAULT_DISCIPLINE_FILTERS,
    province: "alava",
  }, NOW).map(({ id }) => id), ["a"]);
});

test("filtra por localidad", () => {
  const events = [event("a", "Rally", "2026-07-25", { city: "Alcañiz" })];
  assert.equal(filterDisciplineEvents(events, {
    ...DEFAULT_DISCIPLINE_FILTERS,
    locality: "alcaniz",
  }, NOW).length, 1);
});

test("filtra por vehículo", () => {
  const events = [event("a", "Rally", "2026-07-25", { vehicleType: "Moto" })];
  assert.equal(filterDisciplineEvents(events, {
    ...DEFAULT_DISCIPLINE_FILTERS,
    vehicle: "moto",
  }, NOW).length, 1);
});

test("busca solo en contenido útil del evento", () => {
  const events = [event("a", "Rally", "2026-07-25", { city: "Córdoba", title: "Subida nocturna" })];
  assert.equal(filterDisciplineEvents(events, {
    ...DEFAULT_DISCIPLINE_FILTERS,
    query: "cordoba",
  }, NOW).length, 1);
});

test("normaliza provincia y localidad sin cambiar el dato fuente", () => {
  const source = event("a", "Rally", "2026-07-25", { city: "Alcaniz", province: "Alava" });
  const data = buildDisciplinePreviewData([source], "rallyes", NOW);
  assert.equal(data.provinceOptions[0].label, "Álava");
  assert.equal(data.localityOptions.length, 0);
  assert.equal(source.province, "Alava");
});

test("resuelve singular y plural", () => {
  assert.equal(disciplineEventCount(1), "1 evento");
  assert.equal(disciplineEventCount(2), "2 eventos");
});

test("usa títulos naturales y con género correcto por disciplina", () => {
  assert.equal(disciplineResultTitle("upcoming", "Concentraciones", true, "concentraciones"), "Próximas concentraciones");
  assert.equal(disciplineResultTitle("upcoming", "Circuito", true, "circuito"), "Próximos eventos de circuito");
  assert.equal(disciplineResultTitle("all", "Ferias", true, "ferias"), "Todas las ferias");
  assert.equal(disciplineResultTitle("weekend", "Rallyes", false, "rallyes"), "Rallyes este fin de semana");
  assert.equal(disciplineResultTitle("next30", "Rutas", false, "rutas"), "Rutas de los próximos 30 días");
  assert.equal(disciplineResultTitle("month", "Clásicos", false, "clasicos"), "Eventos de clásicos de este mes");
  assert.equal(disciplineResultMeta(1), "1 evento en España · Ordenado por fecha");
  assert.equal(disciplineResultMeta(12), "12 eventos en España · Ordenados por fecha");
});

test("incrementa la carga progresiva sin superar el total", () => {
  assert.equal(nextDisciplineVisibleLimit(8, 8, 21), 16);
  assert.equal(nextDisciplineVisibleLimit(16, 8, 21), 21);
});

test("serializa y analiza filtros URL", () => {
  const filters = parseDisciplineFilters({
    modalidad: "slalom",
    periodo: "month",
    provincia: "madrid",
    q: "jarama",
    vehiculo: "coche",
  });
  const params = disciplineFiltersToSearchParams(filters);
  assert.equal(params.get("modalidad"), "slalom");
  assert.equal(params.get("periodo"), "month");
  assert.equal(params.get("provincia"), "madrid");
  assert.equal(params.get("q"), "jarama");
  assert.equal(params.get("vehiculo"), "coche");
});

test("descarta periodos URL inválidos", () => {
  assert.equal(parseDisciplineFilters({ periodo: "ayer" }).period, "upcoming");
});

test("abre filtros avanzados cuando contienen estado", () => {
  assert.equal(hasAdvancedDisciplineFilters({ ...DEFAULT_DISCIPLINE_FILTERS, vehicle: "moto" }), true);
  assert.equal(hasAdvancedDisciplineFilters(DEFAULT_DISCIPLINE_FILTERS), false);
});

test("mantiene eventos sin provincia en totales pero no los destaca", () => {
  const data = buildDisciplinePreviewData([
    event("unknown", "Rally", "2026-07-25", { province: "Por confirmar" }),
    event("known", "Rally", "2026-07-25", { province: "Madrid" }),
  ], "rallyes", NOW);
  assert.equal(data.stats.upcoming, 2);
  assert.equal(data.stats.unknownProvince, 1);
  assert.deepEqual(featuredDisciplineProvinces(data.provinceOptions).map(({ label }) => label), ["Madrid"]);
});

test("deduplica eventos por slug o id", () => {
  const duplicate = event("a", "Rally", "2026-07-25", { slug: "mismo" });
  const data = buildDisciplinePreviewData([duplicate, { ...duplicate, id: "b" }], "rallyes", NOW);
  assert.equal(data.stats.total, 1);
});

test("calcula otras disciplinas sin mostrar la actual", () => {
  const data = buildDisciplinePreviewData([
    event("r", "Rally"),
    event("c", "Circuito"),
  ], "rallyes", NOW);
  assert.equal(data.otherDisciplines.some(({ slug }) => slug === "rallyes"), false);
  assert.equal(data.otherDisciplines.find(({ slug }) => slug === "circuito")?.count, 1);
});

test("usa CTA editorial explícito por disciplina", () => {
  assert.equal(disciplineEditorial("concentraciones").ctaTitle, "¿Organizas una concentración?");
  assert.equal(disciplineEditorial("offroad").ctaTitle, "¿Organizas una prueba offroad?");
});

test("conserva la descripción editorial final de Rallyes", () => {
  assert.equal(
    disciplineEditorial("rallyes").heroDescription,
    "Rallyes, rallysprint, subidas, slalom, regularidad, bajas y pruebas de tierra en toda España.",
  );
});

test("expone modalidades configuradas para el selector", () => {
  assert.equal(disciplineModalities("rallyes").some(({ id }) => id === "slalom"), true);
});

test("permite localhost, development y Vercel Preview", () => {
  assert.equal(isDisciplinePreviewAvailable(undefined), true);
  assert.equal(isDisciplinePreviewAvailable("development"), true);
  assert.equal(isDisciplinePreviewAvailable("preview"), true);
});

test("bloquea únicamente Vercel Production", () => {
  assert.equal(isDisciplinePreviewAvailable("production"), false);
});

test("metadata de preview conserva noindex, nofollow y no canonical", () => {
  const metadata = buildDisciplinePreviewMetadata("rallyes");
  assert.deepEqual(metadata.robots, { follow: false, index: false });
  assert.equal("alternates" in metadata, false);
});

test("metadata pública es indexable y usa canonical, Open Graph y Twitter públicos", () => {
  const metadata = buildDisciplinePublicMetadata("rallyes");
  const canonical = "https://www.eventomotor.com/disciplinas/rallyes";

  assert.deepEqual(metadata.robots, { follow: true, index: true });
  assert.equal(metadata.alternates?.canonical, canonical);
  assert.equal(metadata.openGraph?.url, canonical);
  assert.equal(metadata.openGraph?.locale, "es_ES");
  assert.equal((metadata.twitter as { card?: string } | undefined)?.card, "summary_large_image");
  assert.equal(metadata.title, SEO_DISCIPLINES[0].metaTitle);
  assert.equal(metadata.description, SEO_DISCIPLINES[0].metaDescription);
});

test("metadata pública no genera datos para un slug inválido", () => {
  assert.deepEqual(buildDisciplinePublicMetadata("invalida"), {});
});

test("metadata de slug inválido sigue protegida", () => {
  assert.deepEqual(buildDisciplinePreviewMetadata("invalida"), {
    robots: { follow: false, index: false },
  });
});
