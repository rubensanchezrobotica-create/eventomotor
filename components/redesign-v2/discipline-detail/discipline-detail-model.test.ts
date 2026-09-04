import assert from "node:assert/strict";
import test from "node:test";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";
import { projectPreviewEvent } from "@/components/redesign-v2/redesign-v2-model";
import {
  DISCIPLINE_HERO_VISUALS,
  DISCIPLINE_DETAIL_PAGE_SIZE,
  DISCIPLINE_DETAIL_QUERY_MAX_LENGTH,
  DISCIPLINE_SEARCH_MAX_SUGGESTIONS,
  DISCIPLINE_SEARCH_MIN_CHARS,
  buildDisciplineDetailPageModel,
  buildDisciplineSearchSuggestions,
  disciplineDetailPageHref,
  disciplineDetailPaginationItems,
  eventMatchesDisciplineSearch,
  normalizeDisciplineSearchText,
  parseDisciplineDetailPage,
  parseDisciplineDetailQuery,
  resolveDisciplineDetailEventImage,
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

test("A6.7.4A asigna heroes propios a las cinco disciplinas visualmente cerradas mediante metadata", () => {
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS), ["rallyes", "circuito", "concentraciones", "offroad", "clasicos"]);
  assert.deepEqual(resolveDisciplineHeroVisual("rallyes"), {
    src: "/images/redesign-v2/disciplines/hero-rallyes.png",
  });
  assert.deepEqual(resolveDisciplineHeroVisual("circuito"), {
    src: "/images/redesign-v2/disciplines/hero-circuito.png",
  });
  assert.deepEqual(resolveDisciplineHeroVisual("concentraciones"), {
    src: "/images/redesign-v2/disciplines/hero-concentraciones.png",
  });
  assert.deepEqual(resolveDisciplineHeroVisual("offroad"), {
    src: "/images/redesign-v2/disciplines/hero-offroad.png",
  });
  assert.deepEqual(resolveDisciplineHeroVisual("clasicos"), {
    src: "/images/redesign-v2/disciplines/hero-clasicos.png",
  });

  const otherDisciplines = SEO_DISCIPLINES
    .map(({ slug }) => slug)
    .filter((slug) => !["rallyes", "circuito", "concentraciones", "offroad", "clasicos"].includes(slug));

  assert.equal(otherDisciplines.length, 3);
  for (const slug of otherDisciplines) {
    assert.equal(resolveDisciplineHeroVisual(slug), null, slug);
  }
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS.rallyes ?? {}), ["src"]);
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS.circuito ?? {}), ["src"]);
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS.concentraciones ?? {}), ["src"]);
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS.offroad ?? {}), ["src"]);
  assert.deepEqual(Object.keys(DISCIPLINE_HERO_VISUALS.clasicos ?? {}), ["src"]);
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

test("A6.2 normaliza query de forma local, estable y limitada sin alterar espacios interiores útiles", () => {
  assert.equal(parseDisciplineDetailQuery(undefined), "");
  assert.equal(parseDisciplineDetailQuery("   "), "");
  assert.equal(parseDisciplineDetailQuery("  Bien   Aparecida  "), "Bien Aparecida");
  assert.equal(parseDisciplineDetailQuery(["Ferrol", "Ourense"]), "Ferrol");
  assert.equal(parseDisciplineDetailQuery("x".repeat(180)).length, DISCIPLINE_DETAIL_QUERY_MAX_LENGTH);
  assert.equal(normalizeDisciplineSearchText("  LA   BAÑEZA  "), "la baneza");
});

test("A6.2 busca sin distinguir mayúsculas ni acentos en título, ciudad, provincia y venue", () => {
  const fixture = event("ferrol", "Rally", "2026-08-22", {
    title: "Rallye de La Bañeza",
    city: "Ferrol",
    province: "A Coruña",
    venue: "Recinto Ferial de FIMO",
  });

  for (const query of ["banEza", "FERROL", "a coruna", "fimo"]) {
    assert.equal(eventMatchesDisciplineSearch(fixture, query), true, query);
  }
  assert.equal(eventMatchesDisciplineSearch(fixture, "organizador invisible"), false);
});

test("A6.2 limita búsqueda a la disciplina actual, conserva upcoming multidía y orden cronológico", () => {
  const active = event("active", "Rally", "2026-08-16", {
    end: "2026-08-19",
    title: "Rallye Ferrol activo",
  });
  const future = event("future", "Rally", "2026-08-23", { title: "Rallye Ferrol futuro" });
  const duplicate = { ...future };
  const cantabria = event("cantabria", "Rally", "2026-08-24", {
    title: "Subida a la Bien Aparecida",
    city: "Ampuero",
    province: "Cantabria",
  });
  const past = event("past", "Rally", "2026-08-10", {
    end: "2026-08-17",
    title: "Rallye Ferrol pasado",
  });
  const crossDiscipline = event("circuit", "Circuito", "2026-08-20", {
    title: "Circuito Ferrol",
  });

  const model = buildDisciplineDetailPageModel(
    [future, duplicate, past, crossDiscipline, active, cantabria],
    "rallyes",
    { now: NOW, page: 1, query: "ferrol" },
  );
  const cantabriaModel = buildDisciplineDetailPageModel(
    [future, active, cantabria],
    "rallyes",
    { now: NOW, page: 1, query: "CANTABRIA" },
  );

  assert.deepEqual(model.items.map(({ event: item }) => item.id), ["active", "future"]);
  assert.equal(model.totalUpcomingCount, 3);
  assert.equal(model.filteredCount, 2);
  assert.equal(model.query, "ferrol");
  assert.deepEqual(cantabriaModel.items.map(({ event: item }) => item.id), ["cantabria"]);
});

test("A6.2 aplica la misma plantilla de búsqueda en Concentraciones y Ferias", () => {
  const fixtures = [
    event("cambrils", "Concentracion", "2026-08-22", {
      title: "Concentración Motera de Cambrils",
      city: "Cambrils",
      province: "Tarragona",
    }),
    event("oviedo", "Ferias", "2026-08-23", {
      title: "Feria del Vehículo Clásico",
      city: "Oviedo",
      province: "Asturias",
    }),
  ];

  const concentrations = buildDisciplineDetailPageModel(fixtures, "concentraciones", {
    now: NOW,
    page: 1,
    query: "cambrils",
  });
  const fairs = buildDisciplineDetailPageModel(fixtures, "ferias", {
    now: NOW,
    page: 1,
    query: "OVIEDO",
  });

  assert.deepEqual(concentrations.items.map(({ event: item }) => item.id), ["cambrils"]);
  assert.deepEqual(fairs.items.map(({ event: item }) => item.id), ["oviedo"]);
});

test("A6.2 trata una query vacía como listing normal", () => {
  const fixtures = [event("one", "Rally"), event("two", "Rally", "2026-08-23")];
  const normal = buildDisciplineDetailPageModel(fixtures, "rallyes", { now: NOW, page: 1 });
  const empty = buildDisciplineDetailPageModel(fixtures, "rallyes", {
    now: NOW,
    page: 1,
    query: "   ",
  });

  assert.equal(empty.query, "");
  assert.deepEqual(empty.items, normal.items);
  assert.equal(empty.filteredCount, normal.totalUpcomingCount);
});

test("A6.2 pagina resultados filtrados, hace clamp y conserva q con encoding seguro", () => {
  const fixtures = Array.from({ length: 26 }, (_, index) => event(
    String(index + 1).padStart(2, "0"),
    "Rally",
    `2026-09-${String(index + 1).padStart(2, "0")}`,
    { title: `Rally Ferrol ${index + 1}` },
  ));
  const second = buildDisciplineDetailPageModel(fixtures, "rallyes", {
    now: NOW,
    page: 2,
    query: "Ferrol",
  });
  const overflow = buildDisciplineDetailPageModel(fixtures, "rallyes", {
    now: NOW,
    page: 500,
    query: "Ferrol",
  });

  assert.equal(second.items.length, 12);
  assert.equal(second.filteredCount, 26);
  assert.equal(second.page, 2);
  assert.equal(overflow.page, 3);
  assert.equal(overflow.items.length, 2);
  assert.equal(
    disciplineDetailPageHref("rallyes", 2, "A Coruña & Ferrol?"),
    "/preview/redesign-v2/disciplinas/rallyes?q=A+Coru%C3%B1a+%26+Ferrol%3F&page=2",
  );
  assert.equal(
    disciplineDetailPageHref("rallyes", 1, "Ferrol"),
    "/preview/redesign-v2/disciplinas/rallyes?q=Ferrol",
  );
});

test("A6.2 distingue cero coincidencias de una disciplina sin próximos eventos", () => {
  const model = buildDisciplineDetailPageModel(
    [event("rally", "Rally", "2026-08-22", { title: "Rallye de Cantabria" })],
    "rallyes",
    { now: NOW, page: 18, query: "zzzz-no-existe" },
  );

  assert.equal(model.totalUpcomingCount, 1);
  assert.equal(model.filteredCount, 0);
  assert.equal(model.items.length, 0);
  assert.equal(model.page, 1);
  assert.equal(model.pageCount, 1);
});

test("A6.3 crea un índice cliente mínimo sólo con próximos eventos de la disciplina actual", () => {
  const active = event("active", "Rally", "2026-08-16", {
    end: "2026-08-19",
    title: "Rallye Ferrol activo",
    city: "Ferrol",
    province: "A Coruña",
    venue: "FIMO",
  });
  const duplicate = { ...active };
  const future = event("future", "Rally", "2026-08-24", { title: "Subida Cantabria" });
  const past = event("past", "Rally", "2026-08-10", { end: "2026-08-17" });
  const circuit = event("circuit", "Circuito", "2026-08-22", { title: "Circuito Ferrol" });

  const model = buildDisciplineDetailPageModel(
    [duplicate, past, circuit, future, active],
    "rallyes",
    { now: NOW, page: 1 },
  );

  assert.deepEqual(model.suggestionIndex, [
    {
      slug: "evento-active",
      title: "Rallye Ferrol activo",
      city: "Ferrol",
      province: "A Coruña",
      venue: "FIMO",
    },
    {
      slug: "evento-future",
      title: "Subida Cantabria",
      city: "Madrid",
      province: "Madrid",
      venue: "Recinto",
    },
  ]);
  assert.deepEqual(Object.keys(model.suggestionIndex[0]), ["slug", "title", "city", "province", "venue"]);
});

test("A6.3 sugiere eventos y ubicaciones con ranking prefix y destinos distintos", () => {
  const source = [
    { slug: "rallye-ferrol", title: "Rallye Ferrol 2026", city: "Ferrol", province: "A Coruña", venue: "FIMO" },
    { slug: "subida-bien-aparecida", title: "Subida a la Bien Aparecida", city: "Ampuero", province: "Cantabria" },
  ];

  const ferrol = buildDisciplineSearchSuggestions(source, "fer", "rallyes");
  assert.deepEqual(ferrol.map(({ kind, label }) => ({ kind, label })), [
    { kind: "event", label: "Rallye Ferrol 2026" },
    { kind: "location", label: "Ferrol, A Coruña" },
  ]);
  assert.equal(ferrol[0].href, "/preview/redesign-v2/evento/rallye-ferrol");
  assert.equal(ferrol[1].href, "/preview/redesign-v2/disciplinas/rallyes?q=Ferrol");

  const cantabria = buildDisciplineSearchSuggestions(source, "CANT", "rallyes");
  assert.equal(cantabria.some(({ label }) => label === "Cantabria"), true);
});

test("A6.3 comparte normalización sin acentos y conserva ubicación humana", () => {
  const source = [
    { slug: "la-baneza", title: "Rallye de La Bañeza", city: "La Bañeza", province: "León" },
  ];

  const suggestions = buildDisciplineSearchSuggestions(source, "banez", "rallyes");
  assert.equal(suggestions[0].label, "Rallye de La Bañeza");
  assert.equal(suggestions.some(({ label }) => label === "La Bañeza, León"), true);
});

test("A6.3 deduplica eventos y ubicaciones normalizadas", () => {
  const source = [
    { slug: "ferrol", title: "Rallye Ferrol", city: " Ferrol ", province: "A Coruña" },
    { slug: "ferrol", title: "Rallye Ferrol duplicado", city: "FERROL", province: "A Coruña" },
    { slug: "otro", title: "Otro Rally Ferrol", city: "Ferrol", province: "A Coruña" },
  ];
  const suggestions = buildDisciplineSearchSuggestions(source, "fer", "rallyes");

  assert.equal(suggestions.filter(({ kind }) => kind === "event").length, 2);
  assert.equal(suggestions.filter(({ kind }) => kind === "location").length, 1);
});

test("A6.3 no abre autocomplete antes del mínimo ni supera el cap móvil", () => {
  const source = Array.from({ length: 12 }, (_, index) => ({
    slug: `rally-${index}`,
    title: `Rally Ferrol ${index}`,
    city: `Ferrol ${index}`,
    province: "A Coruña",
  }));

  assert.equal(DISCIPLINE_SEARCH_MIN_CHARS, 2);
  assert.equal(buildDisciplineSearchSuggestions(source, "f", "rallyes").length, 0);
  assert.equal(DISCIPLINE_SEARCH_MAX_SUGGESTIONS, 6);
  assert.equal(buildDisciplineSearchSuggestions(source, "fer", "rallyes").length, 6);
});

test("A6.3 aplica la disciplina del modelo también a destinos de ubicación", () => {
  const source = [{ slug: "trackday", title: "Trackday Jarama", city: "San Sebastián de los Reyes", province: "Madrid" }];
  const suggestions = buildDisciplineSearchSuggestions(source, "madrid", "circuito");

  assert.equal(suggestions.some(({ href }) => href.includes("/disciplinas/rallyes")), false);
  assert.equal(
    suggestions.find(({ kind }) => kind === "location")?.href,
    "/preview/redesign-v2/disciplinas/circuito?q=Madrid",
  );
});

test("A6.3.3B mantiene el fallback de cada slug al cambiar query, página y orden", () => {
  const target = event("campo-lopez", "Subida", "2026-09-12", {
    slug: "subida-a-campo-lopez-2026-09-12",
    title: "Subida a Campo López",
    city: "Murcia",
    province: "Murcia",
    tags: ["coche", "subida", "montaña"],
  });
  const fillers = Array.from({ length: 13 }, (_, index) => event(
    `filler-${index}`,
    "Rally",
    `2026-09-${String(index + 13).padStart(2, "0")}`,
    { city: "Lugo", province: "Lugo" },
  ));
  const all = [target, ...fillers];
  const unfiltered = buildDisciplineDetailPageModel(all, "rallyes", { now: NOW, page: 1 });
  const filtered = buildDisciplineDetailPageModel(all, "rallyes", { now: NOW, page: 1, query: "Murcia" });
  const reordered = buildDisciplineDetailPageModel([...all].reverse(), "rallyes", { now: NOW, page: 1, query: "Murcia" });
  const shiftedToSecondPage = buildDisciplineDetailPageModel([
    ...Array.from({ length: 12 }, (_, index) => event(
      `earlier-${index}`,
      "Rally",
      `2026-08-${String(index + 19).padStart(2, "0")}`,
    )),
    target,
  ], "rallyes", { now: NOW, page: 2 });

  const expected = resolveDisciplineDetailEventImage(projectPreviewEvent(target));
  const reloads = Array.from(
    { length: 10 },
    () => resolveDisciplineDetailEventImage(projectPreviewEvent(target)).src,
  );
  assert.deepEqual(unfiltered.items.find(({ event: item }) => item.slug === target.slug)?.image, expected);
  assert.deepEqual(filtered.items[0].image, expected);
  assert.deepEqual(reordered.items[0].image, expected);
  assert.deepEqual(shiftedToSecondPage.items.find(({ event: item }) => item.slug === target.slug)?.image, expected);
  assert.equal(new Set(reloads).size, 1);
});

test("A6.3.3B diversifica subidas similares sin salir del banco semántico de Rallyes", () => {
  const subidas = [
    event("aguilas", "Montana", "2026-09-05", {
      slug: "subida-aguilas-2026-09-05",
      title: "Subida Águilas 2026",
      city: "Águilas",
      province: "Murcia",
      tags: ["coche", "montaña", "subida"],
    }),
    event("campo-lopez", "Subida", "2026-09-12", {
      slug: "subida-a-campo-lopez-2026-09-12",
      title: "Subida a Campo López",
      city: "Murcia",
      province: "Murcia",
      tags: ["coche", "subida", "montaña"],
    }),
    event("la-santa", "Montana", "2026-11-07", {
      slug: "subida-la-santa-2026-11-07",
      title: "Subida a La Santa 2026",
      city: "Totana",
      province: "Murcia",
      tags: ["coche", "montaña", "subida"],
    }),
  ];
  const images = subidas.map((fixture) => resolveDisciplineDetailEventImage(projectPreviewEvent(fixture)));

  assert.equal(new Set(images.map(({ src }) => src)).size, 3);
  assert.equal(images.every(({ kind }) => kind === "representative"), true);
  assert.equal(images.every(({ label }) => label === "Imagen representativa"), true);
  assert.equal(images.every(({ src }) => /\/rallyes\/rallyes-(?:0[1-9]|1[01])-/.test(String(src))), true);
});

test("A6.3.3B conserva sin cambios la imagen real del evento", () => {
  const real = event("real", "Rally", "2026-09-12", {
    slug: "rally-con-imagen-real",
    imageUrl: "https://images.example.com/rally-real.webp",
  });

  assert.deepEqual(resolveDisciplineDetailEventImage(projectPreviewEvent(real)), {
    src: "https://images.example.com/rally-real.webp",
    kind: "event",
    alt: "Imagen del evento Evento real",
  });
});

test("A6.7.4A hace que Tier 1 gane a Tier 2 sólo en la selección semántica de Clásicos", () => {
  const historicRally = event("historico", "Rally Histórico", "2026-09-12", {
    title: "II Rallye Histórico Fuente de Cantos 2026",
    tags: ["coche", "rally", "histórico"],
    vehicleType: "coche",
    vehicle_type: "coche",
  });
  const image = resolveDisciplineDetailEventImage(projectPreviewEvent(historicRally));

  assert.match(String(image.src), /\/clasicos\/clasicos-05-/);
  assert.equal(image.kind, "representative");
});

test("A6.7.4A mantiene públicas las disciplinas de los cruces autorizados", () => {
  const fixtures = [
    event("todo-terreno", "Todo Terreno Clasico", "2026-09-19", {
      title: "Copa de España de Todo Terreno Clásico Amurrio 2026",
      tags: ["moto", "todo terreno clasico"],
      vehicleType: "moto",
      vehicle_type: "moto",
    }),
    event("velocidad-clasica", "Velocidad", "2026-10-11", {
      title: "Jornada de Velocidad Catalunya Calafat 2026",
      tags: ["moto", "velocidad", "velocidad clasicas", "calafat"],
      vehicleType: "moto",
      vehicle_type: "moto",
    }),
    event("eco-rally", "Eco Rally", "2026-09-19", {
      title: "Eco Rallye A Coruña - FIA EcoRally Cup",
      tags: ["coche", "eco-rally", "regularidad"],
      vehicleType: "coche",
      vehicle_type: "coche",
    }),
  ];

  assert.equal(buildDisciplineDetailPageModel(fixtures, "offroad", { now: NOW, page: 1 }).items[0]?.event.id, "todo-terreno");
  assert.equal(buildDisciplineDetailPageModel(fixtures, "circuito", { now: NOW, page: 1 }).items[0]?.event.id, "velocidad-clasica");
  assert.equal(buildDisciplineDetailPageModel(fixtures, "rallyes", { now: NOW, page: 1 }).items[0]?.event.id, "eco-rally");
  assert.equal(buildDisciplineDetailPageModel(fixtures, "clasicos", { now: NOW, page: 1 }).totalUpcomingCount, 0);
});
