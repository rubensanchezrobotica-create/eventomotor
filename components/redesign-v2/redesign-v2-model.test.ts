import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildTerritoryCards,
  filterPreviewEvents,
  isRedesignPreviewAvailable,
  projectPreviewEvent,
  resolveRedesignEventImage,
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

test("ordena próximos eventos y excluye los ya finalizados", () => {
  const current = projectPreviewEvent(event());
  const later = projectPreviewEvent(event({ id: "later", start: "2026-09-01", end: "2026-09-01" }));
  const past = projectPreviewEvent(event({ id: "past", start: "2026-07-01", end: "2026-07-02" }));
  assert.deepEqual(upcomingPreviewEvents([later, past, current], "2026-08-05T10:00:00.000Z").map(({ id }) => id), [current.id, later.id]);
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
