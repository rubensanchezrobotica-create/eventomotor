import assert from "node:assert/strict";
import test from "node:test";
import {
  getOpportunityPage,
  matchesCompetitiveAutomotiveRallyOpportunity,
} from "@/lib/opportunity-pages";
import type { EventItem } from "@/types/event";

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "rally-filter-fixture",
    slug: "rally-filter-fixture-2026",
    title: "Prueba automovilística 2026",
    championship: "Campeonato de automovilismo",
    discipline: "Rally",
    start: "2026-09-01",
    end: "2026-09-01",
    venue: "Recinto municipal",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Nacional",
    source: "Fuente de prueba",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    vehicleType: "coche",
    featured: false,
    ...overrides,
  };
}

const POSITIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "Rally", event: { discipline: "Rally" } },
  { label: "Rallysprint", event: { discipline: "Rallysprint" } },
  { label: "Rally Tierra", event: { discipline: "Rally Tierra" } },
  { label: "Rally Histórico", event: { discipline: "Rally Histórico" } },
  { label: "Rally TT", event: { discipline: "Rally TT" } },
  { label: "Rallymix", event: { discipline: "Rallymix" } },
  { label: "Rallycrono", event: { discipline: "Rallycrono" } },
  { label: "Eco Rally", event: { discipline: "Eco Rally" } },
  { label: "Montaña", event: { discipline: "Montaña" } },
  { label: "Subida", event: { discipline: "Subida" } },
  { label: "Regularidad", event: { discipline: "Regularidad" } },
  {
    label: "Regularidad clásicos",
    event: { discipline: "Regularidad clásicos", championship: "Regularidad automovilística" },
  },
  {
    label: "Tramo Cronometrado de Subida",
    event: { discipline: "Tramo Cronometrado de Subida" },
  },
  {
    label: "RallyClassics Africa por regularidad estructurada",
    event: {
      title: "RallyClassics Africa 2026",
      discipline: "Clásicos",
      championship: "RallyClassics Africa",
      tags: ["clásicos", "regularidad", "rallyclassics"],
    },
  },
  {
    label: "VIII Criterium Volantia con vehículo otros",
    event: {
      title: "VIII Criterium Volantia Racing Club 2026",
      discipline: "Regularidad",
      championship: "Criterium automovilístico",
      vehicleType: "otros",
      tags: ["Regularidad", "Criterium automovilístico"],
    },
  },
];

const NEGATIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  {
    label: "XXXIX Rally Pistón",
    event: {
      title: "XXXIX Rally Pistón",
      discipline: "Mototurismo",
      championship: "Mototurismo",
      vehicleType: "moto",
      tags: ["concentracion", "motos"],
    },
  },
  {
    label: "Rally Raid Pina de Ebro de motos",
    event: {
      title: "Campeonato de España de Rally Raid Pina de Ebro 2026",
      discipline: "Rally Raid",
      championship: "Campeonato de España de Rally Raid",
      vehicleType: "moto",
      tags: ["moto", "rally raid"],
    },
  },
  {
    label: "Classic Series Calafat 2 mixto",
    event: {
      title: "Classic Series Calafat 2 2026",
      discipline: "Clásicos",
      championship: "Classic Series / MotoClassic Series",
      vehicleType: "mixto",
      tags: ["coche", "moto", "regularidad", "rallyclassics"],
    },
  },
  {
    label: "Final Classic Series Parcmotor mixto",
    event: {
      title: "Final Classic Series Parcmotor 2026",
      discipline: "Clásicos",
      championship: "Classic Series / MotoClassic Series",
      vehicleType: "mixto",
      tags: ["coche", "moto", "regularidad", "rallyclassics"],
    },
  },
  {
    label: "Rallycross MotorLand",
    event: {
      title: "Campeonato de España de Rallycross - MotorLand",
      discipline: "Rallycross",
      championship: "Campeonato de España de Rallycross",
      vehicleType: "coche",
      tags: ["Rallycross", "Coches", "Offroad"],
    },
  },
  {
    label: "tag rallyclassics no activa rally",
    event: {
      title: "Encuentro de clásicos 2026",
      discipline: "Clásicos",
      championship: "Clásicos",
      tags: ["rallyclassics"],
    },
  },
  {
    label: "venue incidental no activa rally",
    event: {
      title: "Encuentro anual 2026",
      discipline: "Otros",
      venue: "Rallycross MotorLand",
    },
  },
  {
    label: "moto con Rally en el título",
    event: { title: "Rally de verano", discipline: "Otros", vehicleType: "moto" },
  },
  {
    label: "mixto con tag rally",
    event: { title: "Evento mixto", discipline: "Otros", vehicleType: "mixto", tags: ["rally"] },
  },
];

for (const fixture of POSITIVE_CASES) {
  test(`rallyes incluye ${fixture.label}`, () => {
    assert.equal(matchesCompetitiveAutomotiveRallyOpportunity(eventFixture(fixture.event)), true);
  });
}

for (const fixture of NEGATIVE_CASES) {
  test(`rallyes excluye ${fixture.label}`, () => {
    assert.equal(matchesCompetitiveAutomotiveRallyOpportunity(eventFixture(fixture.event)), false);
  });
}

test("la landing de rallyes usa el helper y conserva el límite de 2026", () => {
  const page = getOpportunityPage("rallyes-espana-2026");
  assert.ok(page);
  assert.equal(page.filter(eventFixture(), new Date("2026-08-29")), true);
  assert.equal(
    page.filter(
      eventFixture({ start: "2027-09-01", end: "2027-09-01" }),
      new Date("2026-08-29"),
    ),
    false,
  );
});
