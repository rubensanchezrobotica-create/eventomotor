import assert from "node:assert/strict";
import test from "node:test";
import { matchesFairOpportunity } from "@/lib/opportunity-pages";
import type { EventItem } from "@/types/event";

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "fair-filter-fixture",
    slug: "fair-filter-fixture-2026",
    title: "Evento de prueba 2026",
    championship: "",
    discipline: "Concentración",
    start: "2026-09-01",
    end: "2026-09-01",
    venue: "Recinto municipal",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Local",
    source: "Fuente de prueba",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    vehicleType: "mixto",
    featured: false,
    ...overrides,
  };
}

const POSITIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "disciplina Feria", event: { discipline: "Feria" } },
  { label: "disciplina Ferias", event: { discipline: "Ferias" } },
  { label: "AutoClassico por tag exacto feria", event: { title: "AutoClassico Porto 2026", tags: ["feria"] } },
  { label: "Lleida Retro por exposición de vehículos", event: { title: "Lleida Retro 2026", championship: "Exposición de vehículos clásicos" } },
  { label: "feria de vehículos de ocasión", event: { title: "Feria de vehículos de ocasión 2026" } },
  { label: "salón del automóvil", event: { title: "Salón del Automóvil 2026" } },
  { label: "feria de motocicletas", event: { title: "Feria de motocicletas 2026" } },
];

const NEGATIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "MotoGP", event: { title: "Gran Premio MotoGP 2026", discipline: "Velocidad", tags: ["moto"] } },
  { label: "tandas", event: { title: "Tandas libres 2026", discipline: "Tandas", tags: ["moto"] } },
  { label: "motocross", event: { title: "Campeonato de Motocross 2026", discipline: "Motocross" } },
  { label: "trial", event: { title: "Trial Nacional 2026", discipline: "Trial" } },
  { label: "rally de clásicos", event: { title: "Rally de coches clásicos 2026", discipline: "Rally" } },
  { label: "MotorLand Classic Festival", event: { title: "MotorLand Classic Festival 2026", discipline: "Clásicos" } },
  { label: "concentración motera", event: { title: "Concentración motera 2026", tags: ["moto"] } },
  { label: "vehículo como única señal", event: { title: "Encuentro anual 2026", vehicleType: "coche" } },
  { label: "moto como única señal", event: { title: "Encuentro anual 2026", vehicleType: "moto" } },
  { label: "Recinto Ferial", event: { venue: "Recinto Ferial de Madrid" } },
  { label: "Exponor como recinto", event: { venue: "Exponor" } },
  {
    label: "Custom Meeting Xàtiva",
    event: {
      title: "Custom Meeting Xàtiva 2026",
      championship: "Concentración de motos y muscle cars",
      discipline: "Custom",
      venue: "Recinto Ferial de Xàtiva",
      tags: ["moto", "custom", "concentración", "bike show", "muscle cars"],
      vehicleType: "moto",
    },
  },
  { label: "feria dentro de ferial", event: { title: "Encuentro en recinto ferial 2026" } },
  { label: "expo como subcadena", event: { title: "Expomotor Festival 2026" } },
];

for (const fixture of POSITIVE_CASES) {
  test(`ferias incluye ${fixture.label}`, () => {
    assert.equal(matchesFairOpportunity(eventFixture(fixture.event)), true);
  });
}

for (const fixture of NEGATIVE_CASES) {
  test(`ferias excluye ${fixture.label}`, () => {
    assert.equal(matchesFairOpportunity(eventFixture(fixture.event)), false);
  });
}
