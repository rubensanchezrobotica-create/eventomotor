import assert from "node:assert/strict";
import test from "node:test";
import {
  getOpportunityPage,
  matchesTrackdayOpportunity,
} from "@/lib/opportunity-pages";
import type { EventItem } from "@/types/event";

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "trackday-filter-fixture",
    slug: "trackday-filter-fixture-2026",
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
    vehicleType: "coche",
    featured: false,
    ...overrides,
  };
}

const CONCEPTUAL_POSITIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "disciplina Tandas con coche", event: { discipline: "TÁNDAS", vehicleType: "coche" } },
  { label: "disciplina Tandas con moto", event: { discipline: "Tandas", vehicleType: "moto" } },
  { label: "trackday con coche", event: { title: "Trackday nacional", vehicleType: "coche" } },
  { label: "track day con moto", event: { title: "Track Day nacional", vehicleType: "moto" } },
  { label: "trackdays en tags", event: { tags: ["Trackdays"], vehicleType: "coche" } },
  { label: "tandas libres con coche", event: { title: "Tandas libres", vehicleType: "coche" } },
  { label: "tandas libres con moto", event: { championship: "Tandas libres", vehicleType: "moto" } },
  { label: "rodada con moto", event: { title: "Rodada nocturna", vehicleType: "moto" } },
  { label: "open pit lane con coche", event: { title: "Open Pit Lane", vehicleType: "coche" } },
  { label: "curso de conducción con coche", event: { title: "Curso de conducción", vehicleType: "coche" } },
  { label: "curso de conduccion con moto", event: { title: "Curso de conduccion", vehicleType: "moto" } },
  { label: "racing experience", event: { championship: "Racing Experience", vehicleType: "coche" } },
  { label: "drift day participativo", event: { title: "Drift Day participativo", vehicleType: "coche" } },
  { label: "mixto con actividad fuerte", event: { title: "Tandas libres", vehicleType: "mixto" } },
  {
    label: "vehicle_type alternativo normalizado",
    event: { title: "Trackday", vehicleType: undefined, vehicle_type: " MOTO " },
  },
];

const LIVE_POSITIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "EasyRace Jarama", event: { title: "EasyRace Jarama", discipline: "Tandas", vehicleType: "moto" } },
  { label: "Motor Extremo", event: { title: "Motor Extremo", tags: ["rodada"], vehicleType: "moto" } },
  { label: "Amazing Drives Navarra", event: { title: "Amazing Drives Navarra", discipline: "Tandas", vehicleType: "coche" } },
  { label: "Vialmotor", event: { title: "Vialmotor Navarra", tags: ["trackday"], vehicleType: "moto" } },
  { label: "TMSR", event: { title: "TMSR Jerez", championship: "Tandas libres", vehicleType: "moto" } },
  { label: "Factoria RR", event: { title: "Factoria RR Alcarràs", discipline: "Tandas", vehicleType: "moto" } },
  { label: "Racing100", event: { title: "Racing100 Navarra", discipline: "Tandas", vehicleType: "moto" } },
  { label: "AB Riders", event: { title: "AB Riders Albacete", discipline: "Tandas", vehicleType: "moto" } },
  { label: "PPO Track Days", event: { title: "PPO Track Days", vehicleType: "coche" } },
  { label: "OpenTrack", event: { title: "OpenTrack", tags: ["trackday"], vehicleType: "coche" } },
  { label: "TrackTool Planet", event: { title: "TrackTool Planet", discipline: "Tandas", vehicleType: "coche" } },
  { label: "Ducati Riding Camp", event: { title: "Ducati Riding Camp", discipline: "Tandas", vehicleType: "moto" } },
  { label: "Jarama Experience Ferrari", event: { title: "Jarama Experience Ferrari", championship: "Racing Experience", vehicleType: "coche" } },
  { label: "JMR Racing", event: { title: "JMR Racing", championship: "Tandas libres", vehicleType: "moto" } },
  { label: "TrackForce MotorLand", event: { title: "TrackForce MotorLand", discipline: "Tandas", vehicleType: "coche" } },
  { label: "Tandas deportivas Jerez", event: { title: "Tandas deportivas para coches Jerez", vehicleType: "coche" } },
];

const CORRECTED_ARCHIVE_POSITIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "Tandas privadas Jarama", event: { title: "Tandas privadas Jarama junio 2026", championship: "Tandas libres", vehicleType: "coche" } },
  { label: "DrPitBike", event: { title: "Rodada Nocturna DrPitBike AF Karting 2026", discipline: "Pitbike", vehicleType: "moto" } },
  { label: "ADNZERO", event: { title: "ADNZERO Jarama 18 julio 2026", discipline: "Tandas", vehicleType: "moto" } },
  { label: "BMW M Club", event: { title: "Especial Track Day 18 Julio Jarama", discipline: "Tandas", vehicleType: "coche" } },
  { label: "FCMM 18 julio", event: { title: "FCMM Circuito de Albacete 18 julio 2026", discipline: "Tandas", vehicleType: "moto" } },
  { label: "FCMM 19 julio", event: { title: "FCMM Circuito de Albacete 19 julio 2026", discipline: "Tandas", vehicleType: "moto" } },
];

const NEGATIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "Copa España Velocidad", event: { title: "Copa de España de Velocidad", discipline: "Velocidad", vehicleType: "moto" } },
  { label: "Campeonato RACE", event: { title: "Campeonato RACE", discipline: "Circuito", vehicleType: "coche" } },
  { label: "F1 MADRING", event: { title: "Gran Premio de España de F1 MADRING", vehicleType: "coche" } },
  { label: "MotoGP", event: { title: "Gran Premio de España de MotoGP", vehicleType: "moto" } },
  { label: "ESBK", event: { title: "Campeonato de España de Superbikes ESBK", vehicleType: "moto" } },
  { label: "WorldSBK", event: { title: "WorldSBK Jerez", vehicleType: "moto" } },
  { label: "JuniorGP", event: { title: "FIM JuniorGP Jerez", vehicleType: "moto" } },
  { label: "GT", event: { title: "GT Winter Series", vehicleType: "coche" } },
  { label: "TCR", event: { title: "TCR+ Ricardo Tormo", vehicleType: "coche" } },
  { label: "F4", event: { title: "F4 Spain Jarama", vehicleType: "coche" } },
  { label: "24H competitivas", event: { title: "24H Moto Barcelona", vehicleType: "moto" } },
  { label: "karting", event: { title: "Campeonato de karting", vehicleType: "karting" } },
  { label: "motocross", event: { title: "Campeonato de Motocross", vehicleType: "moto" } },
  { label: "trial", event: { title: "Trial nacional", vehicleType: "moto" } },
  { label: "cross country", event: { title: "Cross Country nacional", vehicleType: "moto" } },
  { label: "Hot Wheels Legends Tour", event: { title: "Hot Wheels Legends Tour", venue: "Circuito del Jarama", vehicleType: "coche" } },
  { label: "Jarama Classic", event: { title: "Jarama Classic", venue: "Circuito del Jarama", vehicleType: "coche" } },
  { label: "RPM FEST", event: { title: "RPM FEST Night Demons", tags: ["circuito", "racing"], vehicleType: "mixto" } },
  { label: "drift competitivo", event: { title: "Drift Masters", championship: "Drift", vehicleType: "coche" } },
  { label: "Circuito sólo en recinto", event: { title: "Campeonato nacional", discipline: "Circuito", venue: "Circuito de Navarra", vehicleType: "coche" } },
  { label: "palabra track aislada", event: { title: "Racing Track Experience", tags: ["track"], vehicleType: "coche" } },
  { label: "substring de trackday", event: { title: "Trackdaymania Festival", vehicleType: "coche" } },
  { label: "karting con trackday", event: { title: "Trackday de karting", vehicleType: "karting" } },
  { label: "otros con trackday", event: { title: "Trackday anual", vehicleType: "otros" } },
  { label: "camión con trackday", event: { title: "Trackday de camiones", vehicleType: "camion" } },
];

const MIXED_NEGATIVE_CASES: Array<{ label: string; event: Partial<EventItem> }> = [
  { label: "Classic Series Calafat", event: { title: "Classic Series Calafat", championship: "Regularidad", vehicleType: "mixto" } },
  { label: "Classic Series Alcarràs", event: { title: "Classic Series Alcarràs", championship: "Regularidad", vehicleType: "mixto" } },
  { label: "Classic Series Parcmotor", event: { title: "Classic Series Parcmotor", championship: "Regularidad", vehicleType: "mixto" } },
  { label: "Final Classic Series Parcmotor", event: { title: "Final Classic Series Parcmotor", championship: "Regularidad", vehicleType: "mixto" } },
  { label: "Hot Wheels mixto", event: { title: "Hot Wheels Legends Tour", discipline: "Exhibición", vehicleType: "mixto" } },
];

for (const fixture of [...CONCEPTUAL_POSITIVE_CASES, ...LIVE_POSITIVE_CASES, ...CORRECTED_ARCHIVE_POSITIVE_CASES]) {
  test(`trackdays incluye ${fixture.label}`, () => {
    assert.equal(matchesTrackdayOpportunity(eventFixture(fixture.event)), true);
  });
}

for (const fixture of [...NEGATIVE_CASES, ...MIXED_NEGATIVE_CASES]) {
  test(`trackdays excluye ${fixture.label}`, () => {
    assert.equal(matchesTrackdayOpportunity(eventFixture(fixture.event)), false);
  });
}

test("la landing de Trackdays usa el helper y conserva el límite de 2026", () => {
  const page = getOpportunityPage("trackdays-espana-2026");
  assert.ok(page);
  assert.equal(page.filter(eventFixture({ title: "Trackday nacional" }), new Date("2026-09-04")), true);
  assert.equal(
    page.filter(
      eventFixture({ title: "Trackday nacional", start: "2027-09-01", end: "2027-09-01" }),
      new Date("2026-09-04"),
    ),
    false,
  );
});
