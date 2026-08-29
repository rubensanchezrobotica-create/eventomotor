import assert from "node:assert/strict";
import test from "node:test";
import {
  getOpportunityPage,
  matchesMotorcycleTrackdayOpportunity,
} from "@/lib/opportunity-pages";
import type { EventItem } from "@/types/event";

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "motorcycle-trackday-filter-fixture",
    slug: "motorcycle-trackday-filter-fixture-2026",
    title: "Evento de prueba 2026",
    championship: "",
    discipline: "Circuito",
    start: "2026-09-01",
    end: "2026-09-01",
    venue: "Circuito de prueba",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Local",
    source: "Fuente de prueba",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    vehicleType: "moto",
    featured: false,
    ...overrides,
  };
}

const ORGANIZER_POSITIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "JMR Racing", event: { title: "Tandas libres Ricardo Tormo JMR Racing" } },
  { label: "Racing100", event: { title: "Tandas libres Ricardo Tormo Racing100" } },
  { label: "EasyRace", event: { title: "Tandas libres y curso Jarama EasyRace" } },
  { label: "Motor Extremo", event: { title: "Motor Extremo Jerez", tags: ["rodada"] } },
  { label: "Factoria RR", event: { title: "Tandas libres y curso Alcarràs Factoria RR" } },
  { label: "TMSR", event: { title: "Tandas libres Jerez TMSR" } },
  { label: "Vialmotor", event: { title: "Vialmotor Circuito de Navarra", tags: ["trackday"] } },
  { label: "AB Riders", event: { title: "Tandas libres y curso Albacete AB Riders" } },
];

const ACTIVITY_POSITIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "disciplina Tandas con moto", event: { discipline: "TÁNDAS" } },
  { label: "tandas libres", event: { title: "Tandas   libres en circuito" } },
  { label: "rodada", event: { title: "Rodada nocturna" } },
  { label: "trackday", event: { title: "TrackDay de verano" } },
  { label: "track day", event: { championship: "Track Day nacional" } },
  { label: "trackdays motos", event: { tags: ["Trackdays motos"] } },
  { label: "curso y tandas", event: { title: "Curso y tandas en circuito" } },
  { label: "curso más tandas", event: { title: "Curso + tandas en circuito" } },
  {
    label: "curso de conducción más tandas con acento",
    event: { title: "Curso de conducción + tandas" },
  },
  {
    label: "vehicle_type alternativo normalizado",
    event: { title: "Rodadas en circuito", vehicleType: undefined, vehicle_type: " MOTO " },
  },
];

const NEGATIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "MotoGP", event: { title: "Gran Premio MotoGP Aragón", discipline: "MotoGP" } },
  {
    label: "Copa de España de Velocidad",
    event: { title: "Copa de España de Velocidad Albacete", discipline: "Velocidad" },
  },
  {
    label: "Campeonato de España Superbike",
    event: { title: "Campeonato de España Superbike", discipline: "Superbike" },
  },
  { label: "WorldSBK", event: { title: "WorldSBK Jerez", discipline: "Circuito" } },
  { label: "motocross", event: { title: "Motocross Quinto", discipline: "Motocross" } },
  { label: "trial", event: { title: "Trial MotorLand Aragón", discipline: "Trial" } },
  {
    label: "cross country",
    event: { title: "Cross Country Cintruénigo", discipline: "Cross Country" },
  },
  {
    label: "karting",
    event: { title: "Aragón Karting Academy", discipline: "Karting", vehicleType: "karting" },
  },
  {
    label: "mini velocidad",
    event: { title: "GP Motoscoot Cup", discipline: "MiniVelocidad" },
  },
  {
    label: "copa en circuito sin tandas abiertas",
    event: { title: "Copa Motociclismo FMCV", discipline: "Circuito" },
  },
  {
    label: "moto estructurada como única señal",
    event: { title: "Jornada anual", discipline: "Circuito" },
  },
  {
    label: "Circuito como recinto",
    event: { title: "Campeonato nacional", venue: "Circuito de Navarra" },
  },
  {
    label: "Tandas TrackForce MotorLand de coches",
    event: {
      title: "Tandas TrackForce MotorLand noviembre",
      discipline: "Tandas",
      venue: "MotorLand Aragón",
      vehicleType: "coche",
    },
  },
  {
    label: "MotorLand no activa moto por substring",
    event: {
      title: "Trackday MotorLand",
      venue: "MotorLand Aragón",
      vehicleType: "coche",
    },
  },
  {
    label: "palabra track aislada",
    event: { title: "Racing Track Experience", tags: ["track"] },
  },
];

for (const fixture of ORGANIZER_POSITIVE_CASES) {
  test(`rodadas incluye muestra de ${fixture.label}`, () => {
    assert.equal(matchesMotorcycleTrackdayOpportunity(eventFixture(fixture.event)), true);
  });
}

for (const fixture of ACTIVITY_POSITIVE_CASES) {
  test(`rodadas incluye ${fixture.label}`, () => {
    assert.equal(matchesMotorcycleTrackdayOpportunity(eventFixture(fixture.event)), true);
  });
}

for (const fixture of NEGATIVE_CASES) {
  test(`rodadas excluye ${fixture.label}`, () => {
    assert.equal(matchesMotorcycleTrackdayOpportunity(eventFixture(fixture.event)), false);
  });
}

test("la landing de rodadas usa el helper y conserva el límite de 2026", () => {
  const page = getOpportunityPage("rodadas-moto-2026");
  assert.ok(page);
  assert.equal(page.filter(eventFixture({ title: "Rodada de motos" }), new Date("2026-08-29")), true);
  assert.equal(
    page.filter(
      eventFixture({ title: "Rodada de motos", start: "2027-09-01", end: "2027-09-01" }),
      new Date("2026-08-29"),
    ),
    false,
  );
});
