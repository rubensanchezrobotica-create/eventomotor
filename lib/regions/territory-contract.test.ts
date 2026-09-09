import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSpanishTerritoryPublicHref,
  EXISTING_PROVINCE_PUBLIC_HREFS,
  getSpanishTerritoryByAlias,
  getSpanishTerritoryById,
  getSpanishTerritoryBySlug,
  isSpanishTerritoryEvent,
  isSpanishTerritoryLaunchLandingEligible,
  LEGACY_MACRO_ZONE_HREFS,
  listSpanishTerritoryEventCounts,
  listSpanishTerritoryProvinces,
  matchEventToSpanishTerritory,
  normalizeTerritoryCountry,
  normalizeTerritoryValue,
  SPANISH_TERRITORIES,
} from "@/lib/regions/territory-contract";
import { REGIONAL_CONFIGS, REGIONAL_REGION_IDS } from "@/lib/regions/regional-config";
import { SEO_ZONES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "territory-event",
    title: "Evento territorial",
    championship: "",
    discipline: "Rally",
    start: "2026-09-12",
    end: "2026-09-12",
    venue: "Recinto",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Regional",
    source: "Fixture",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    featured: false,
    ...overrides,
  };
}

test("el catálogo conoce 17 comunidades y 2 ciudades autónomas", () => {
  assert.equal(SPANISH_TERRITORIES.length, 19);
  assert.equal(
    SPANISH_TERRITORIES.filter((territory) => territory.kind === "AUTONOMOUS_COMMUNITY").length,
    17,
  );
  assert.equal(
    SPANISH_TERRITORIES.filter((territory) => territory.kind === "AUTONOMOUS_CITY").length,
    2,
  );
});

test("las 16 comunidades públicas conservan sus canonicales existentes", () => {
  assert.equal(REGIONAL_REGION_IDS.length, 16);

  for (const id of REGIONAL_REGION_IDS) {
    const territory = getSpanishTerritoryById(id);
    assert.ok(territory);
    assert.equal(territory.currentPublicCanonicalHref, REGIONAL_CONFIGS[id].publicPath);
    assert.equal(territory.futurePublicCanonicalHref, REGIONAL_CONFIGS[id].publicPath);
    assert.equal(territory.indexabilityIntent, "PRESERVE_EXISTING");
  }
});

test("La Rioja queda preparada sin crear todavía una ruta", () => {
  const territory = getSpanishTerritoryBySlug("la-rioja");
  assert.ok(territory);
  assert.equal(territory.id, "laRioja");
  assert.equal(territory.kind, "AUTONOMOUS_COMMUNITY");
  assert.equal(territory.currentPublicCanonicalHref, null);
  assert.equal(territory.futurePublicCanonicalHref, "/eventos-motor-la-rioja");
  assert.equal(territory.indexabilityIntent, "ELIGIBLE_FUTURE");
  assert.equal(buildSpanishTerritoryPublicHref("laRioja"), "/eventos-motor-la-rioja");
  assert.equal(isSpanishTerritoryLaunchLandingEligible("laRioja"), true);
});

test("Ceuta y Melilla son conocidas pero sus landings quedan aplazadas", () => {
  const ceuta = getSpanishTerritoryById("ceuta");
  const melilla = getSpanishTerritoryById("melilla");
  assert.ok(ceuta);
  assert.ok(melilla);
  assert.equal(ceuta.kind, "AUTONOMOUS_CITY");
  assert.equal(melilla.kind, "AUTONOMOUS_CITY");
  assert.equal(ceuta.indexabilityIntent, "DEFERRED_LOW_INVENTORY");
  assert.equal(melilla.indexabilityIntent, "DEFERRED_ZERO_INVENTORY");
  assert.equal(buildSpanishTerritoryPublicHref("ceuta"), null);
  assert.equal(buildSpanishTerritoryPublicHref("melilla"), null);
});

test("el normalizador de país sólo reconoce representaciones aprobadas de España", () => {
  for (const alias of ["ES", " es ", "España", "ESPANA", "Spain", "  spain  "]) {
    assert.equal(normalizeTerritoryCountry(alias), "ES");
    assert.equal(isSpanishTerritoryEvent({ country: alias }), true);
  }

  assert.equal(normalizeTerritoryCountry(null), null);

  for (const value of [undefined, "", "Portugal", "PT", "France", "FR"]) {
    assert.equal(normalizeTerritoryCountry(value), null);
    assert.equal(isSpanishTerritoryEvent({ country: value }), false);
  }
});

test("Portugal y un país desconocido nunca entran en una comunidad española", () => {
  for (const country of ["PT", "Portugal", "", undefined]) {
    assert.equal(
      matchEventToSpanishTerritory(event({ country, province: "Madrid", region: "Madrid" })),
      null,
    );
  }
});

test("la geografía desconocida no se adivina desde ciudad, venue, título o tags", () => {
  const unknown = event({
    title: "Rally de Madrid",
    venue: "Circuito de Madrid",
    city: "Madrid",
    province: "Por confirmar",
    region: "Por confirmar",
    tags: ["madrid"],
  });

  assert.equal(matchEventToSpanishTerritory(unknown), null);
});

test("región y provincia almacenadas tienen precedencia y los conflictos fallan cerrado", () => {
  assert.equal(
    matchEventToSpanishTerritory(event({ region: "Catalunya", province: "Barcelona" }))?.id,
    "cataluna",
  );
  assert.equal(
    matchEventToSpanishTerritory(event({ region: "Por confirmar", province: "La Rioja" }))?.id,
    "laRioja",
  );
  assert.equal(
    matchEventToSpanishTerritory(event({ region: "Comunidad de Madrid", province: "Barcelona" })),
    null,
  );
});

test("los aliases probados conservan acentos y denominaciones bilingües", () => {
  const fixtures = [
    ["Galicia", event({ region: "Por confirmar", province: "La Coruña" })],
    ["Cataluña", event({ region: "Por confirmar", province: "Gerona" })],
    ["Comunidad Valenciana", event({ region: "Por confirmar", province: "Alacant" })],
    ["País Vasco", event({ region: "Euskadi", province: "Bizkaia" })],
    ["Baleares", event({ region: "Illes Balears", province: "Illes Balears" })],
  ] as const;

  for (const [expectedName, fixture] of fixtures) {
    assert.equal(matchEventToSpanishTerritory(fixture)?.displayName, expectedName);
  }

  assert.equal(normalizeTerritoryValue("  País   Vasco  "), "pais vasco");
  assert.equal(getSpanishTerritoryByAlias("EUSKADI")?.id, "paisVasco");
});

test("IDs, slugs y canonicales públicos no contienen conflictos", () => {
  const ids = SPANISH_TERRITORIES.map((territory) => territory.id);
  const slugs = SPANISH_TERRITORIES.map((territory) => territory.slug);
  const hrefs = SPANISH_TERRITORIES.flatMap((territory) => (
    territory.futurePublicCanonicalHref ? [territory.futurePublicCanonicalHref] : []
  ));

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.ok(EXISTING_PROVINCE_PUBLIC_HREFS.every((href) => !hrefs.includes(href)));
});

test("Barcelona y Valencia siguen siendo rutas provinciales independientes", () => {
  assert.deepEqual(EXISTING_PROVINCE_PUBLIC_HREFS, [
    "/eventos-motor-barcelona",
    "/eventos-motor-valencia",
  ]);
  assert.equal(getSpanishTerritoryById("cataluna")?.currentPublicCanonicalHref, "/eventos-motor-cataluna");
  assert.equal(
    getSpanishTerritoryById("comunidadValenciana")?.currentPublicCanonicalHref,
    "/eventos-motor-comunidad-valenciana",
  );
});

test("las seis rutas de macrozona permanecen como referencias legacy", () => {
  const legacyHrefs = new Set<string>(LEGACY_MACRO_ZONE_HREFS);

  assert.deepEqual(
    LEGACY_MACRO_ZONE_HREFS,
    SEO_ZONES.map((zone) => `/zonas/${zone.slug}`),
  );
  assert.equal(LEGACY_MACRO_ZONE_HREFS.length, 6);
  assert.ok(SPANISH_TERRITORIES.every((territory) => (
    territory.legacyRouteReferences.every((href) => legacyHrefs.has(href))
  )));
});

test("la API lista provincias, elegibilidad y conteos sin inventar territorios", () => {
  assert.ok(listSpanishTerritoryProvinces("galicia").includes("la coruna"));
  assert.equal(isSpanishTerritoryLaunchLandingEligible("ceuta"), false);
  assert.equal(isSpanishTerritoryLaunchLandingEligible("unknown"), false);

  const counts = listSpanishTerritoryEventCounts([
    event(),
    event({ id: "rioja", region: "La Rioja", province: "La Rioja" }),
    event({ id: "ceuta", region: "Ceuta", province: "Ceuta" }),
    event({ id: "portugal", country: "PT", region: "Madrid", province: "Madrid" }),
    event({ id: "unknown", region: "Por confirmar", province: "Por confirmar" }),
  ]);

  assert.equal(counts.length, 19);
  assert.equal(counts.find(({ territory }) => territory.id === "madrid")?.count, 1);
  assert.equal(counts.find(({ territory }) => territory.id === "laRioja")?.count, 1);
  assert.equal(counts.find(({ territory }) => territory.id === "ceuta")?.count, 1);
  assert.equal(counts.reduce((total, entry) => total + entry.count, 0), 3);
});

test("el contrato congelado 539 ES + 2 PT mantiene cero fugas portuguesas", () => {
  const spanish = Array.from({ length: 539 }, (_, index) => event({
    id: `es-${index}`,
    country: "ES",
  }));
  const portuguese = Array.from({ length: 2 }, (_, index) => event({
    id: `pt-${index}`,
    country: "PT",
    province: "Madrid",
    region: "Comunidad de Madrid",
  }));
  const counts = listSpanishTerritoryEventCounts([...spanish, ...portuguese]);

  assert.equal(spanish.filter(isSpanishTerritoryEvent).length, 539);
  assert.equal(portuguese.filter(isSpanishTerritoryEvent).length, 0);
  assert.equal(counts.find(({ territory }) => territory.id === "madrid")?.count, 539);
  assert.equal(counts.reduce((total, entry) => total + entry.count, 0), 539);
});
