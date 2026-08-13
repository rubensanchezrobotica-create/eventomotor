import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { getVehicleType } from "@/lib/event-classification";
import type { EventItem } from "@/types/event";
import { assignV2HomeEventImages } from "./discipline-fallback-resolver";
import {
  buildVisiblePreviewResults,
  buildDisciplineCards,
  buildTerritoryCards,
  clearAppliedDateFilter,
  excludePreviewEventById,
  filterPreviewEvents,
  formatPreviewSelectedDate,
  isEditoriallyComplete,
  isRedesignPreviewAvailable,
  previewEventDateLabel,
  previewVehicleLabel,
  previewEventStatus,
  prioritizeEditorialEvents,
  projectPreviewEvent,
  reconcileAppliedTextFilter,
  resolveRedesignEventImage,
  resolveRedesignEventImages,
  selectFeaturedEvent,
  upcomingPreviewEvents,
} from "./redesign-v2-model";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "rally-levante-2026",
    slug: "rally-levante-2026",
    title: "Rallye Sierra de Levante",
    championship: "Campeonato regional",
    discipline: "Rally",
    start: "2026-08-08",
    end: "2026-08-09",
    venue: "Sierra de Levante",
    city: "Murcia",
    province: "Murcia",
    region: "Región de Murcia",
    level: "Regional",
    source: "Federación",
    sourceUrl: "https://example.com/source",
    ticketUrl: "",
    tags: ["rally", "asfalto", "coches"],
    vehicleType: "Coche",
    featured: false,
    ...overrides,
  };
}

function mixedVisibleResults(events: readonly EventItem[], place: string) {
  const projected = events.map(projectPreviewEvent);
  const assigned = assignV2HomeEventImages(projected);
  const imageByEventId = Object.fromEntries(projected.map((candidate, index) => [candidate.id, assigned[index]]));
  const results = buildVisiblePreviewResults(
    projected,
    { place, date: "", discipline: "", vehicle: "" },
    imageByEventId,
  );
  return {
    ...results,
    baseVisibleImages: results.visible.map((candidate) => imageByEventId[candidate.id]),
  };
}

test("prioriza la imagen real y no la etiqueta como representativa", () => {
  const resolved = resolveRedesignEventImage(projectPreviewEvent(event({ imageUrl: "/event-images/rally.webp" })));
  assert.deepEqual(resolved, {
    src: "/event-images/rally.webp",
    kind: "event",
    alt: "Imagen del evento Rallye Sierra de Levante",
  });
});

test("resuelve un fallback determinista sin atribuirlo al evento", () => {
  const projected = projectPreviewEvent(event());
  const first = resolveRedesignEventImage(projected);
  const second = resolveRedesignEventImage(projected);
  assert.deepEqual(first, second);
  assert.equal(first.kind, "representative");
  assert.equal(first.label, "Imagen representativa");
  assert.match(first.src ?? "", /^\/images\/disciplines\/fallbacks\/rallyes\/rallyes-[0-9]{2}-/);
  assert.equal(first.alt, "");
});

test("selecciona el destacado real y usa el próximo como reserva", () => {
  const regular = projectPreviewEvent(event());
  const featured = projectPreviewEvent(event({ id: "featured", title: "Evento destacado", featured: true }));
  assert.equal(selectFeaturedEvent([regular, featured]).event?.id, "featured");
  assert.equal(selectFeaturedEvent([regular]).eyebrow, "Próximo evento");
});

test("excluye de la parrilla únicamente el evento destacado por su identificador estable", () => {
  const featured = projectPreviewEvent(event({ id: "featured", title: "Título compartido", featured: true }));
  const sameTitle = projectPreviewEvent(event({ id: "same-title", title: "Título compartido" }));
  const regular = projectPreviewEvent(event({ id: "regular", title: "Otra cita" }));
  const original = [featured, sameTitle, regular];

  assert.deepEqual(excludePreviewEventById(original, featured.id).map(({ id }) => id), [sameTitle.id, regular.id]);
  assert.deepEqual(excludePreviewEventById(original, null).map(({ id }) => id), [featured.id, sameTitle.id, regular.id]);
  assert.equal(original.length, 3);
});

test("el pipeline real reequilibra Super Enduro despues de filtrar un dataset mixto", () => {
  const events = [
    event({ id: "hidden-indoor", slug: "hidden-indoor", title: "Copa Indoor", discipline: "Enduro Indoor", vehicleType: "Moto" }),
    event({ id: "super-enduro-lanzahita-2026-09-05", slug: "super-enduro-lanzahita-2026-09-05", title: "Super Enduro Lanzahita 2026", discipline: "Super Enduro", vehicleType: "Moto" }),
    event({ id: "super-rally", slug: "super-rally", title: "Rally intermedio", discipline: "Rally", vehicleType: "Coche" }),
    event({ id: "super-enduro-de-potes-2026-09-13", slug: "super-enduro-de-potes-2026-09-13", title: "Super Enduro de Potes 2026", discipline: "Super Enduro", vehicleType: "Moto" }),
    event({ id: "super-route", slug: "super-route", title: "Ruta intermedia", discipline: "Ruta", vehicleType: "Moto" }),
    event({ id: "super-enduro-de-reinosa-2026-09-26", slug: "super-enduro-de-reinosa-2026-09-26", title: "Super Enduro de Reinosa 2026", discipline: "Super Enduro", vehicleType: "Moto" }),
  ];
  const { baseVisibleImages, filtered, visible, visibleImages } = mixedVisibleResults(events, "super enduro");
  assert.deepEqual(filtered.map(({ id }) => id), [
    "super-enduro-lanzahita-2026-09-05",
    "super-enduro-de-potes-2026-09-13",
    "super-enduro-de-reinosa-2026-09-26",
  ]);
  assert.deepEqual(visible, filtered);
  assert.deepEqual(baseVisibleImages.map(({ fallbackId }) => fallbackId), ["offroad-17", "offroad-17", "offroad-08"]);
  assert.deepEqual(visibleImages.map(({ fallbackId }) => fallbackId), ["offroad-17", "offroad-08", "offroad-17"]);
});

test("el pipeline real corrige Cross Country visible sin cambiar orden ni cantidad", () => {
  const events = [
    event({ id: "cross-a", slug: "cross-a", title: "Cross Country A", discipline: "Cross Country", vehicleType: "Moto" }),
    event({ id: "cross-rally", slug: "cross-rally", title: "Rally intermedio", discipline: "Rally", vehicleType: "Coche" }),
    event({ id: "cross-b", slug: "cross-b", title: "Cross Country B", discipline: "Cross Country", vehicleType: "Moto" }),
    event({ id: "cross-route", slug: "cross-route", title: "Ruta intermedia", discipline: "Ruta", vehicleType: "Moto" }),
    event({ id: "cross-c", slug: "cross-c", title: "Cross Country C", discipline: "Cross Country", vehicleType: "Moto" }),
  ];
  const { baseVisibleImages, filtered, visible, visibleImages } = mixedVisibleResults(events, "cross country");
  assert.deepEqual(visible.map(({ id }) => id), filtered.map(({ id }) => id));
  assert.equal(visible.length, 3);
  assert.equal(baseVisibleImages.slice(1).some(({ fallbackId }, index) => fallbackId === baseVisibleImages[index].fallbackId), true);
  assert.equal(visibleImages.every(({ fallbackId }) => ["offroad-15", "offroad-16"].includes(String(fallbackId))), true);
  assert.equal(visibleImages.slice(1).some(({ fallbackId }, index) => fallbackId === visibleImages[index].fallbackId), false);
});

test("el pipeline visible clasifica como moto los tres eventos reales de DrPit y Minimotard", () => {
  const fixtures = [
    {
      id: "copa-centro-drpit-fk1-villaverde-medina-2026-09-05",
      title: "Copa Centro DrPit FK1 2026",
      discipline: "Pitbike",
      tags: ["pitbike", "minimotard", "minimoto", "minigp", "supermotard", "copa centro", "fk1"],
      expectedFallbacks: new Set(["circuito-09", "circuito-13"]),
    },
    {
      id: "copa-centro-drpit-f430-arapiles-2026-10-03",
      title: "Copa Centro DrPit F430 2026",
      discipline: "Pitbike",
      tags: ["pitbike", "minimotard", "minimoto", "minigp", "supermotard", "copa centro", "f430"],
      expectedFallbacks: new Set(["circuito-09", "circuito-13"]),
    },
    {
      id: "iv-carrera-minimotard-challenge-alcarras-2026-09-13",
      title: "IV Carrera Minimotard Challenge Alcarràs 2026",
      discipline: "Minimotard",
      tags: ["minimotard", "pitbike", "challenge", "alcarràs"],
      expectedFallbacks: new Set(["circuito-10"]),
    },
  ];
  const projected = fixtures.map((fixture) => {
    const vehicleType = getVehicleType({
      title: fixture.title,
      discipline: fixture.discipline,
      tags: fixture.tags,
      vehicle_type: "Motos",
    });
    return projectPreviewEvent(event({
      id: fixture.id,
      slug: fixture.id,
      title: fixture.title,
      championship: "",
      discipline: fixture.discipline,
      tags: fixture.tags,
      vehicleType,
      vehicle_type: vehicleType,
    }));
  });
  const assigned = assignV2HomeEventImages(projected);

  assert.deepEqual(projected.map(previewVehicleLabel), ["moto", "moto", "moto"]);
  assert.deepEqual(projected.map(({ discipline }) => discipline), ["Pitbike", "Pitbike", "Minimotard"]);
  projected.forEach((_, index) => {
    assert.equal(assigned[index]?.interpretedDiscipline, "circuito");
    assert.equal(fixtures[index]?.expectedFallbacks.has(String(assigned[index]?.fallbackId)), true);
  });
  assert.deepEqual(
    filterPreviewEvents(projected, { place: "pitbike", date: "", discipline: "", vehicle: "" }).map(({ id }) => id),
    fixtures.map(({ id }) => id),
  );
});

test("normaliza variantes inequívocas de pitbike y minimotard sin perder positivos existentes", () => {
  const motorcycleFixtures = [
    { title: "Copa Centro DrPit 2026" },
    { title: "Copa Centro Dr Pit 2026" },
    { title: "Rodada Nocturna DrPitBike 2026" },
    { title: "Copa de Pitbike 2026" },
    { title: "Copa de Pit Bike 2026" },
    { title: "Copa de Pit-bike 2026" },
    { title: "Challenge Minimotard 2026" },
    { title: "Challenge Mini Motard 2026" },
    { title: "Challenge Mini-motard 2026" },
    { title: "GP Polini Motoscoot Cup Campillos", discipline: "MiniVelocidad" },
    { title: "MiniVelocidad InterOpen Villena" },
    { title: "Mini Velocidad InterOpen Chiva" },
    { title: "GP J.Costa Motoscoot Cup DR7", tags: ["scooter"] },
  ];

  for (const fixture of motorcycleFixtures) {
    assert.equal(getVehicleType(fixture), "moto", fixture.title);
  }
  assert.equal(getVehicleType({ title: "Cita sin clasificar", vehicle_type: "Motos" }), "moto");
  assert.equal(getVehicleType({ title: "Pitbike sin tipo", vehicle_type: "otros" }), "moto");
});

test("preserva COCHE y MIXTO explícitos y evita falsos positivos en controles realistas", () => {
  const controls = [
    { title: "Autocross MotorLand", vehicle_type: "Coches", expected: "coche" },
    { title: "Slalom de A Estrada", vehicle_type: "Coches", expected: "coche" },
    { title: "Rallye Sierra Morena", vehicle_type: "Coches", expected: "coche" },
    { title: "Encuentro de clásicos deportivos", tags: ["coches clasicos"], expected: "mixto" },
    { title: "Feria del Motor de Galicia", expected: "otros" },
    { title: "Exposición DrPit del equipo", vehicle_type: "Coches", expected: "coche" },
    { title: "Feria Pitbike y automóviles", vehicle_type: "Mixto", expected: "mixto" },
  ];

  for (const fixture of controls) {
    assert.equal(getVehicleType(fixture), fixture.expected, fixture.title);
  }
});

test("limpiar la query restaura el mismo orden y cantidad de la Home", () => {
  const events = [
    event({ id: "reset-super", slug: "reset-super", title: "Super Enduro reset", discipline: "Super Enduro", vehicleType: "Moto" }),
    event({ id: "reset-rally", slug: "reset-rally", title: "Rally reset", discipline: "Rally", vehicleType: "Coche" }),
    event({ id: "reset-route", slug: "reset-route", title: "Ruta reset", discipline: "Ruta", vehicleType: "Moto" }),
  ];
  const projected = events.map(projectPreviewEvent);
  const assigned = assignV2HomeEventImages(projected);
  const imageByEventId = Object.fromEntries(projected.map((candidate, index) => [candidate.id, assigned[index]]));
  const filtered = buildVisiblePreviewResults(projected, { place: "super enduro", date: "", discipline: "", vehicle: "" }, imageByEventId);
  const restored = buildVisiblePreviewResults(projected, { place: "", date: "", discipline: "", vehicle: "" }, imageByEventId);
  assert.equal(filtered.visible.length, 1);
  assert.deepEqual(restored.visible.map(({ id }) => id), projected.map(({ id }) => id));
});

test("ordena próximos eventos y excluye los ya finalizados", () => {
  const current = projectPreviewEvent(event());
  const later = projectPreviewEvent(event({ id: "later", start: "2026-09-01", end: "2026-09-01" }));
  const past = projectPreviewEvent(event({ id: "past", start: "2026-07-01", end: "2026-07-02" }));
  assert.deepEqual(upcomingPreviewEvents([later, past, current], "2026-08-05T10:00:00.000Z").map(({ id }) => id), [current.id, later.id]);
});

test("clasifica futuro, en curso, finalizado y día único con fecha española", () => {
  const now = "2026-08-06T08:00:00.000Z";
  const future = projectPreviewEvent(event({ id: "future", start: "2026-08-08", end: "2026-08-09" }));
  const ongoing = projectPreviewEvent(event({ id: "ongoing", start: "2026-08-05", end: "2026-08-07" }));
  const past = projectPreviewEvent(event({ id: "past", start: "2026-08-04", end: "2026-08-05" }));
  const today = projectPreviewEvent(event({ id: "today", start: "2026-08-06", end: "2026-08-06" }));

  assert.equal(previewEventStatus(future, now), "Próximamente");
  assert.equal(previewEventStatus(ongoing, now), "En curso");
  assert.equal(previewEventStatus(today, now), "Hoy");
  assert.deepEqual(upcomingPreviewEvents([future, ongoing, past, today], now).map(({ id }) => id), [ongoing.id, today.id, future.id]);
});

test("resuelve el cambio de día con Europe/Madrid y sin desfase UTC", () => {
  const previousDay = projectPreviewEvent(event({ id: "previous", start: "2026-08-05", end: "2026-08-05" }));
  const spanishToday = projectPreviewEvent(event({ id: "spanish-today", start: "2026-08-06", end: "2026-08-06" }));
  const afterMidnightInSpain = "2026-08-05T22:30:00.000Z";

  assert.deepEqual(upcomingPreviewEvents([previousDay, spanishToday], afterMidnightInSpain).map(({ id }) => id), [spanishToday.id]);
  assert.equal(previewEventStatus(spanishToday, afterMidnightInSpain), "Hoy");
});

test("un evento sin fecha final se trata de forma conservadora como evento de un día", () => {
  const noEnd = projectPreviewEvent(event({ id: "no-end", start: "2026-08-06", end: "" }));
  assert.equal(previewEventStatus(noEnd, "2026-08-06T10:00:00.000Z"), "Hoy");
  assert.deepEqual(upcomingPreviewEvents([noEnd], "2026-08-07T10:00:00.000Z"), []);
});

test("prioriza eventos editoriales completos sin eliminarlos del conjunto", () => {
  const incomplete = projectPreviewEvent(event({ id: "incomplete", title: "Por confirmar", start: "2026-08-07", featured: true }));
  const complete = projectPreviewEvent(event({ id: "complete", start: "2026-08-08" }));
  const original = [incomplete, complete];
  const prioritized = prioritizeEditorialEvents(original);

  assert.equal(isEditoriallyComplete(incomplete), false);
  assert.equal(isEditoriallyComplete(complete), true);
  assert.deepEqual(prioritized.map(({ id }) => id), [complete.id, incomplete.id]);
  assert.equal(selectFeaturedEvent(prioritized).event?.id, complete.id);
  assert.equal(original.length, prioritized.length);
  assert.equal(original[0].id, incomplete.id);
});

test("el buscador filtra datos reales por lugar, fecha, disciplina y vehículo", () => {
  const projected = [projectPreviewEvent(event())];
  const matches = filterPreviewEvents(projected, {
    place: "Murcia",
    date: "2026-08-09",
    discipline: "rally",
    vehicle: "coche",
  });
  assert.equal(matches.length, 1);
  assert.equal(filterPreviewEvents(projected, { place: "Asturias", date: "", discipline: "", vehicle: "" }).length, 0);
});

test("vaciar la búsqueda aplicada restaura resultados sin borrar los filtros secundarios", () => {
  const applied = {
    place: "La Bañeza",
    date: "2026-08-09",
    discipline: "rally",
    vehicle: "coche",
  };

  assert.equal(reconcileAppliedTextFilter(applied, "La Ba"), applied);
  assert.deepEqual(reconcileAppliedTextFilter(applied, ""), {
    place: "",
    date: "2026-08-09",
    discipline: "rally",
    vehicle: "coche",
  });
  assert.equal(applied.place, "La Bañeza");
});

test("quitar la fecha aplicada conserva disciplina, vehículo y texto", () => {
  const applied = {
    place: "Murcia",
    date: "2026-08-31",
    discipline: "rally",
    vehicle: "coche",
  };

  assert.deepEqual(clearAppliedDateFilter(applied), {
    place: "Murcia",
    date: "",
    discipline: "rally",
    vehicle: "coche",
  });
  assert.equal(clearAppliedDateFilter({ ...applied, date: "" }).date, "");
  assert.equal(applied.date, "2026-08-31");
});

test("La Bañeza pasa de dos resultados a la agenda general al borrar el texto", () => {
  const events = [
    projectPreviewEvent(event({ id: "baneza-rally", city: "La Bañeza", province: "León" })),
    projectPreviewEvent(event({
      id: "baneza-moto",
      title: "Encuentro de motos de La Bañeza",
      championship: "",
      city: "La Bañeza",
      province: "León",
      discipline: "Motos",
      tags: ["motos"],
      vehicleType: "Moto",
    })),
    projectPreviewEvent(event({ id: "madrid-rally", city: "Madrid", province: "Madrid" })),
  ];
  const textOnly = { place: "La Bañeza", date: "", discipline: "", vehicle: "" };
  const withDiscipline = { ...textOnly, discipline: "rally" };

  assert.equal(filterPreviewEvents(events, textOnly).length, 2);
  assert.equal(filterPreviewEvents(events, reconcileAppliedTextFilter(textOnly, "")).length, 3);
  assert.equal(filterPreviewEvents(events, withDiscipline).length, 1);
  assert.equal(filterPreviewEvents(events, reconcileAppliedTextFilter(withDiscipline, "")).length, 2);
});

test("formatea fechas de un día y rangos sin inventar una fecha final", () => {
  const single = projectPreviewEvent(event({ start: "2026-08-07", end: "" }));
  const equal = projectPreviewEvent(event({ start: "2026-08-07", end: "2026-08-07" }));
  const sameMonth = projectPreviewEvent(event({ start: "2026-08-07", end: "2026-08-09" }));
  const crossMonth = projectPreviewEvent(event({ start: "2026-08-31", end: "2026-09-02" }));

  assert.deepEqual(previewEventDateLabel(single), {
    kind: "single",
    day: "07",
    month: "AGO",
    ariaLabel: "Fecha: 7 de agosto",
  });
  assert.deepEqual(previewEventDateLabel(equal), previewEventDateLabel(single));
  assert.deepEqual(previewEventDateLabel(sameMonth), {
    kind: "range",
    day: "07–09",
    month: "AGO",
    ariaLabel: "Fecha: del 7 al 9 de agosto",
  });
  assert.deepEqual(previewEventDateLabel(crossMonth), {
    kind: "cross-month",
    startDay: "31",
    startMonth: "AGO",
    endDay: "02",
    endMonth: "SEP",
    ariaLabel: "Fecha: del 31 de agosto al 2 de septiembre",
  });
});

test("formatea la fecha seleccionada sin depender de UTC", () => {
  assert.equal(formatPreviewSelectedDate("2026-08-31"), "31 ago 2026");
  assert.equal(formatPreviewSelectedDate("2026-01-01"), "1 ene 2026");
  assert.equal(formatPreviewSelectedDate("2026-02-30"), null);
  assert.equal(formatPreviewSelectedDate(""), null);
});

test("el filtro de fecha incluye todo el rango real y excluye el día posterior", () => {
  const longRange = projectPreviewEvent(event({ id: "long-range", start: "2026-08-03", end: "2026-08-18" }));
  const shortRange = projectPreviewEvent(event({ id: "short-range", start: "2026-08-07", end: "2026-08-09" }));
  const singleDay = projectPreviewEvent(event({ id: "single-day", start: "2026-08-10", end: "" }));
  const events = [longRange, shortRange, singleDay];
  const idsFor = (date: string) => filterPreviewEvents(events, {
    place: "",
    date,
    discipline: "",
    vehicle: "",
  }).map(({ id }) => id);

  assert.deepEqual(idsFor("2026-08-08"), ["long-range", "short-range"]);
  assert.deepEqual(idsFor("2026-08-10"), ["long-range", "single-day"]);
  assert.deepEqual(idsFor("2026-08-11"), ["long-range"]);
});

test("la asignación por lote es estable y no repite imágenes mientras hay alternativas", () => {
  const motorcycles = Array.from({ length: 3 }, (_, index) => projectPreviewEvent(event({
    id: `moto-${index}`,
    slug: `moto-${index}`,
    championship: "",
    discipline: "Circuito",
    tags: [],
    title: `Copa de motos ${index}`,
    vehicleType: "Moto",
  })));
  const first = resolveRedesignEventImages(motorcycles);
  const second = resolveRedesignEventImages(motorcycles);

  assert.deepEqual(first, second);
  assert.equal(new Set(first.map(({ src }) => src)).size, motorcycles.length);
  assert.equal(motorcycles.every((candidate, index) => candidate.id === `moto-${index}`), true);
});

test("las concentraciones moteras repiten sólo los dos fallbacks de motos protagonistas", () => {
  const motorcycles = Array.from({ length: 4 }, (_, index) => projectPreviewEvent(event({
    id: `bank-${index}`,
    slug: `bank-${index}`,
    championship: "",
    discipline: "Concentraciones",
    tags: [],
    title: `Concentración motera ${index}`,
    vehicleType: "Moto",
  })));
  const first = resolveRedesignEventImages(motorcycles);
  const second = resolveRedesignEventImages(motorcycles);
  const allowed = new Set([
    "/images/disciplines/fallbacks/concentraciones/concentraciones-02-motos-encuentro-paseo-maritimo.webp",
    "/images/disciplines/fallbacks/concentraciones/concentraciones-06-gran-concentracion-motera-diurna-alta-participacion.webp",
  ]);
  assert.deepEqual(first, second);
  assert.equal(first.every(({ kind, src }) => kind === "representative" && Boolean(src) && allowed.has(String(src))), true);
  assert.equal(new Set(first.map(({ src }) => src)).size, 2);
  assert.equal(first.some(({ src }) => String(src).includes("concentraciones-03")), false);
  assert.equal(first.some(({ src }) => String(src).includes("concentraciones-05")), false);
});

test("mantiene coherencia entre vehículo y fallback y usa uno neutro si faltan datos", () => {
  const motorcycle = projectPreviewEvent(event({
    id: "motorcycle",
    championship: "",
    discipline: "",
    tags: [],
    title: "Concentración motera",
    vehicleType: "Moto",
  }));
  const unknown = projectPreviewEvent(event({
    id: "unknown",
    championship: "",
    discipline: "",
    tags: [],
    title: "Cita especial",
    vehicleType: "",
  }));
  const enduro = projectPreviewEvent(event({
    id: "enduro",
    championship: "Campeonato de España de Enduro",
    discipline: "Enduro",
    tags: [],
    title: "Campeonato de España de Enduro - Oristà",
    vehicleType: "",
  }));
  const motoImage = resolveRedesignEventImage(motorcycle);
  assert.match(motoImage.src ?? "", /\/images\/disciplines\/fallbacks\/concentraciones\/concentraciones-06-/);
  assert.match(resolveRedesignEventImage(enduro).src ?? "", /\/offroad\/offroad-0[27]-/);
  assert.deepEqual(resolveRedesignEventImage(unknown), { src: null, kind: "neutral", alt: "" });
});

test("la imagen propia conserva prioridad también en la asignación por lote", () => {
  const owned = projectPreviewEvent(event({ id: "owned", imageUrl: "/event-images/owned.webp" }));
  assert.deepEqual(resolveRedesignEventImages([owned]), [{
    src: "/event-images/owned.webp",
    kind: "event",
    alt: "Imagen del evento Rallye Sierra de Levante",
  }]);
});

test("los conteos territoriales proceden del conjunto recibido", () => {
  const cards = buildTerritoryCards([
    projectPreviewEvent(event()),
    projectPreviewEvent(event({ id: "madrid", city: "Madrid", province: "Madrid", region: "Comunidad de Madrid" })),
  ]);
  assert.equal(cards.find(({ name }) => name === "Murcia")?.count, 1);
  assert.equal(cards.find(({ name }) => name === "Madrid")?.count, 1);
  assert.equal(cards.find(({ name }) => name === "Asturias")?.count, 0);
});

test("la franja R5 usa la taxonomía pública exacta, conteos reales e iconos web", () => {
  const cards = buildDisciplineCards([
    projectPreviewEvent(event({ id: "rally", discipline: "Rally", tags: ["rally"] })),
    projectPreviewEvent(event({
      id: "route",
      title: "Ruta del Norte",
      championship: "Encuentro touring",
      discipline: "Mototurismo",
      tags: ["ruta motera"],
    })),
  ]);
  const expected = [
    ["Rallyes", "/disciplinas/rallyes", "discipline-rallyes.png"],
    ["Circuito", "/disciplinas/circuito", "discipline-circuito.png"],
    ["Concentraciones", "/disciplinas/concentraciones", "discipline-concentraciones.png"],
    ["Offroad", "/disciplinas/offroad", "discipline-offroad.png"],
    ["Clásicos", "/disciplinas/clasicos", "discipline-clasicos.png"],
    ["Karting", "/disciplinas/karting", "discipline-karting.png"],
    ["Rutas", "/disciplinas/rutas", "discipline-rutas.png"],
    ["Ferias", "/disciplinas/ferias", "discipline-ferias.png"],
  ];

  assert.deepEqual(cards.map(({ name, href, image }) => [name, href, image.split("/").at(-1)]), expected);
  assert.equal(cards.find(({ name }) => name === "Rallyes")?.count, 1);
  assert.equal(cards.find(({ name }) => name === "Rutas")?.count, 1);
  assert.equal(cards.some(({ name }) => String(name) === "Motos"), false);
  for (const card of cards) {
    assert.equal(existsSync(new URL(`../../public${card.image}`, import.meta.url)), true);
  }
});

test("cada territorio enlaza a su landing pública real", () => {
  const expectedHrefs = new Map([
    ["Madrid", "/eventos-motor-madrid"],
    ["Barcelona", "/eventos-motor-cataluna"],
    ["Valencia", "/eventos-motor-valencia"],
    ["Asturias", "/eventos-motor-asturias"],
    ["Murcia", "/eventos-motor-murcia"],
    ["Andalucía", "/eventos-motor-andalucia"],
  ]);

  const cards = buildTerritoryCards([]);
  assert.equal(cards.length, expectedHrefs.size);
  for (const card of cards) assert.equal(card.href, expectedHrefs.get(card.name));
});

test("las landings territoriales existen y no recuperan el patrón inexistente", () => {
  for (const card of buildTerritoryCards([])) {
    assert.doesNotMatch(card.href, /^\/eventos\//);
    assert.equal(
      existsSync(new URL(`../../app${card.href}/page.tsx`, import.meta.url)),
      true,
      `Falta la ruta pública ${card.href}`,
    );
  }
});

test("la preview queda bloqueada en producción", () => {
  assert.equal(isRedesignPreviewAvailable("production"), false);
  assert.equal(isRedesignPreviewAvailable("preview"), true);
  assert.equal(isRedesignPreviewAvailable(undefined), true);
});
