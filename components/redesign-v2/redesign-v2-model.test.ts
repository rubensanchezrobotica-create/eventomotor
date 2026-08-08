import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildTerritoryCards,
  clearAppliedDateFilter,
  excludePreviewEventById,
  filterPreviewEvents,
  formatPreviewSelectedDate,
  isEditoriallyComplete,
  isRedesignPreviewAvailable,
  previewEventDateLabel,
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
  assert.equal(first.src, "/images/redesign-v2/disciplines/rally-asphalt.webp");
  assert.doesNotMatch(first.alt, /Sierra de Levante/);
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
  const cars = Array.from({ length: 5 }, (_, index) => projectPreviewEvent(event({
    id: `car-${index}`,
    championship: "",
    discipline: "",
    tags: [],
    title: "Cita de automovilismo",
    vehicleType: "Coche",
  })));
  const first = resolveRedesignEventImages(cars);
  const second = resolveRedesignEventImages(cars);

  assert.deepEqual(first, second);
  assert.equal(new Set(first.map(({ src }) => src)).size, cars.length);
  assert.equal(cars.every((candidate, index) => candidate.id === `car-${index}`), true);
});

test("al agotarse el banco reutiliza una variante coherente y segura", () => {
  const cars = Array.from({ length: 6 }, (_, index) => projectPreviewEvent(event({
    id: `bank-${index}`,
    championship: "",
    discipline: "",
    tags: [],
    title: "Cita de automovilismo",
    vehicleType: "Coche",
  })));
  const resolved = resolveRedesignEventImages(cars);
  assert.equal(resolved.every(({ kind, src }) => kind === "representative" && Boolean(src)), true);
  assert.equal(new Set(resolved.map(({ src }) => src)).size, 5);
});

test("mantiene coherencia entre vehículo y fallback y usa uno neutro si faltan datos", () => {
  const motorcycle = projectPreviewEvent(event({
    id: "motorcycle",
    championship: "",
    discipline: "",
    tags: [],
    title: "Cita sobre dos ruedas",
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
  assert.equal([
    "/images/redesign-v2/disciplines/motorcycles.webp",
    "/images/redesign-v2/disciplines/offroad.webp",
    "/images/redesign-v2/disciplines/circuit.webp",
  ].includes(motoImage.src ?? ""), true);
  assert.equal([
    "/images/redesign-v2/disciplines/motorcycles.webp",
    "/images/redesign-v2/disciplines/offroad.webp",
  ].includes(resolveRedesignEventImage(enduro).src ?? ""), true);
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
