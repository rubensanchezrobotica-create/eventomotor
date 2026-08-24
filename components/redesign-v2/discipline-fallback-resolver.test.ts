import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { V2_DISCIPLINE_FALLBACKS } from "./discipline-fallback-manifest";
import {
  assignV2HomeEventImages,
  classifyV2FallbackEvent,
  isValidV2EventImageSource,
  rebalanceVisibleV2EventImages,
  resolveV2EventImageCandidates,
  stableV2EventKey,
  type V2FallbackEvent,
} from "./discipline-fallback-resolver";

const resolverSource = readFileSync(new URL("./discipline-fallback-resolver.ts", import.meta.url), "utf8");

function event(overrides: Partial<V2FallbackEvent> = {}): V2FallbackEvent {
  return {
    id: "event-1",
    slug: "event-1",
    title: "Evento de motor",
    championship: "",
    discipline: "",
    start: "2026-08-16",
    venue: "Circuito local",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    tags: [],
    vehicleType: "",
    imageUrl: "",
    ...overrides,
  };
}

function ids(candidate: V2FallbackEvent) {
  return resolveV2EventImageCandidates(candidate).map(({ id }) => id);
}

function tierOneIds(candidate: V2FallbackEvent) {
  return new Set(resolveV2EventImageCandidates(candidate).filter(({ tier }) => tier === 1).map(({ id }) => id));
}

function classificationOf(candidate: V2FallbackEvent) {
  const classification = classifyV2FallbackEvent(candidate);
  assert.ok(classification);
  return classification;
}

function assignedFallbackIds(count: number, overrides: Partial<V2FallbackEvent>): string[] {
  return assignV2HomeEventImages(Array.from({ length: count }, (_, index) => event({
    ...overrides,
    id: `closed-${index}`,
    slug: `closed-${index}`,
  }))).map(({ fallbackId }) => {
    assert.ok(fallbackId);
    return fallbackId;
  });
}

function assertClosedPool(actual: readonly string[], expected: readonly string[]) {
  assert.equal(actual.every((id) => expected.includes(id)), true);
  assert.deepEqual(new Set(actual), new Set(expected));
}

function assertNoAdjacentDuplicates(actual: readonly string[]) {
  assert.equal(actual.slice(1).some((id, index) => id === actual[index]), false);
}

function visiblePipelineFallbacks(events: readonly V2FallbackEvent[], query: string) {
  const assigned = assignV2HomeEventImages(events);
  const normalizedQuery = query.toLocaleLowerCase("es-ES");
  const visibleIndexes = events
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => String(candidate.title).toLocaleLowerCase("es-ES").includes(normalizedQuery));
  const visibleEvents = visibleIndexes.map(({ candidate }) => candidate);
  const visibleAssigned = visibleIndexes.map(({ index }) => assigned[index]);
  return {
    before: visibleAssigned.map(({ fallbackId, kind }) => fallbackId ?? kind),
    after: rebalanceVisibleV2EventImages(visibleEvents, visibleAssigned).map(({ fallbackId, kind }) => fallbackId ?? kind),
  };
}

function mixedSubtypeEvents(
  prefix: string,
  discipline: string,
  vehicleType: string,
  title: string,
  count = 3,
): V2FallbackEvent[] {
  const matching = Array.from({ length: count }, (_, index) => event({
    id: `${prefix}-${index}`,
    slug: `${prefix}-${index}`,
    title: `${title} ${index}`,
    discipline,
    vehicleType,
  }));
  return matching.flatMap((candidate, index) => index === matching.length - 1
    ? [candidate]
    : [candidate, event({
        id: `${prefix}-separator-${index}`,
        slug: `${prefix}-separator-${index}`,
        title: index % 2 === 0 ? "Rally intermedio" : "Ruta intermedia",
        discipline: index % 2 === 0 ? "Rally" : "Ruta",
        vehicleType: index % 2 === 0 ? "Coche" : "Moto",
      })]);
}

test("clasifica las ocho familias visuales sin convertir motos en disciplina", () => {
  assert.equal(classifyV2FallbackEvent(event({ title: "Rallye de montaña", discipline: "Rally" }))?.discipline, "rallyes");
  assert.equal(classifyV2FallbackEvent(event({ title: "Tandas en circuito", discipline: "Velocidad" }))?.discipline, "circuito");
  assert.equal(classifyV2FallbackEvent(event({ title: "Motoalmuerzo de verano" }))?.discipline, "concentraciones");
  assert.equal(classifyV2FallbackEvent(event({ title: "Campeonato de enduro" }))?.discipline, "offroad");
  assert.equal(classifyV2FallbackEvent(event({ title: "Rally histórico de regularidad" }))?.discipline, "clasicos");
  assert.equal(classifyV2FallbackEvent(event({ title: "Carrera de karting" }))?.discipline, "karting");
  assert.equal(classifyV2FallbackEvent(event({ title: "Ruta motera por la costa" }))?.discipline, "rutas");
  assert.equal(classifyV2FallbackEvent(event({ title: "Salón del automóvil" }))?.discipline, "ferias");
});

test("respeta vehículo y compatibilidad dentro de circuito y concentraciones", () => {
  const circuitMoto = resolveV2EventImageCandidates(event({ title: "Copa de motos", discipline: "Circuito", vehicleType: "Moto" }));
  assert.equal(circuitMoto.every(({ discipline, vehicle }) => discipline === "circuito" && ["moto", "mixto"].includes(vehicle)), true);
  assert.equal(circuitMoto.filter(({ tier }) => tier === 2).every(({ vehicle }) => vehicle === "moto"), true);

  const circuitCar = resolveV2EventImageCandidates(event({ title: "Tandas de coches", discipline: "Circuito", vehicleType: "Coche" }));
  assert.equal(circuitCar.every(({ discipline, vehicle }) => discipline === "circuito" && ["coche", "mixto"].includes(vehicle)), true);
  assert.equal(circuitCar.some(({ vehicle }) => vehicle === "moto"), false);

  const motoMeet = resolveV2EventImageCandidates(event({ title: "Concentración motera", vehicleType: "Moto" }));
  assert.deepEqual(new Set(motoMeet.filter(({ tier }) => tier === 1).map(({ id }) => id)), new Set(["concentraciones-06"]));
  assert.deepEqual(new Set(motoMeet.filter(({ tier }) => tier === 2).map(({ id }) => id)), new Set(["concentraciones-02"]));
  assert.deepEqual(new Set(motoMeet.map(({ id }) => id)), new Set(["concentraciones-02", "concentraciones-06"]));

  const carMeet = resolveV2EventImageCandidates(event({ title: "Concentración de coches", vehicleType: "Coche" }));
  assert.deepEqual(new Set(carMeet.filter(({ tier }) => tier === 2).map(({ id }) => id)), new Set(["concentraciones-01", "concentraciones-04"]));
  assert.equal(carMeet.findIndex(({ vehicle }) => vehicle === "mixto") > carMeet.findLastIndex(({ vehicle }) => vehicle === "coche"), true);

  const mixedMeet = resolveV2EventImageCandidates(event({ title: "Concentración mixta de coches y motos", vehicleType: "Mixto" }));
  assert.deepEqual(new Set(mixedMeet.filter(({ tier }) => tier <= 2).map(({ id }) => id)), new Set(["concentraciones-03", "concentraciones-05"]));
});

test("un vehículo explícito nunca recibe el fallback del vehículo opuesto", () => {
  const pina = event({
    id: "batch-campeonato-espana-rally-raid-pina-ebro-2026-09-04",
    slug: "campeonato-espana-rally-raid-pina-ebro-2026-09-04",
    title: "Campeonato de Espana de Rally Raid Pina de Ebro 2026",
    championship: "Campeonato de Espana de Rally Raid",
    discipline: "Rally Raid",
    tags: ["moto", "rally raid", "rfme"],
    vehicleType: "moto",
  });
  assert.equal(classificationOf(pina).discipline, "rallyes");
  assert.equal(resolveV2EventImageCandidates(pina).length, 0);
  assert.deepEqual(assignV2HomeEventImages([pina]), [{ src: null, kind: "neutral", alt: "" }]);

  const explicitCar = event({
    title: "Feria de motos y coches",
    discipline: "Ferias",
    vehicleType: "coche",
  });
  const carCandidates = resolveV2EventImageCandidates(explicitCar);
  assert.equal(carCandidates.some(({ vehicle }) => vehicle === "moto"), false);
  assert.equal(carCandidates.some(({ vehicle }) => vehicle === "coche"), true);
  assert.equal(carCandidates.some(({ vehicle }) => vehicle === "mixto"), true);
});

test("mantiene mixto, inferencia de otros y la semántica especial de karting", () => {
  const explicitMoto = resolveV2EventImageCandidates(event({
    title: "Feria de coches y motos",
    discipline: "Ferias",
    vehicleType: "moto",
  }));
  assert.equal(explicitMoto.some(({ vehicle }) => vehicle === "coche"), false);
  assert.equal(explicitMoto.some(({ vehicle }) => vehicle === "moto"), true);
  assert.equal(explicitMoto.some(({ vehicle }) => vehicle === "mixto"), true);

  const inferredOther = resolveV2EventImageCandidates(event({
    title: "Salón de la moto",
    discipline: "Ferias",
    vehicleType: "otros",
  }));
  assert.equal(inferredOther.some(({ vehicle }) => vehicle === "moto"), true);

  const mixed = resolveV2EventImageCandidates(event({
    title: "Feria de coches y motos",
    discipline: "Ferias",
    vehicleType: "mixto",
  }));
  assert.deepEqual(new Set(mixed.map(({ vehicle }) => vehicle)), new Set(["coche", "moto", "mixto"]));

  const karting = resolveV2EventImageCandidates(event({
    title: "Karting FACYL Kotarr 2026",
    discipline: "Karting",
    vehicleType: "coche",
  }));
  assert.equal(karting.length > 0, true);
  assert.equal(karting.every(({ vehicle }) => vehicle === "karting"), true);
});

test("corrige MotorLand y conserva Rally Pistón en su fallback mixto", () => {
  const motorland = event({
    id: "motorland-classic-festival-2026",
    slug: "motorland-classic-festival-2026-10-24",
    title: "MotorLand Classic Festival",
    championship: "MotorLand Classic Festival",
    discipline: "Clásicos",
    tags: ["Clásicos", "Festival", "Coches", "Motos"],
    vehicleType: "moto",
  });
  const [motorlandImage] = assignV2HomeEventImages([motorland]);
  assert.equal(motorlandImage.fallbackId, "clasicos-03");
  assert.equal(motorlandImage.interpretedVehicle, "mixto");

  const rallyPiston = event({
    id: "rally-piston-2026-09-24",
    slug: "rally-piston-2026-09-24",
    title: "Rally Pistón",
    discipline: "Concentración",
    tags: ["moto", "concentración"],
    vehicleType: "moto",
  });
  const [rallyPistonImage] = assignV2HomeEventImages([rallyPiston]);
  assert.equal(
    V2_DISCIPLINE_FALLBACKS.find(({ id }) => id === rallyPistonImage.fallbackId)?.vehicle,
    "mixto",
  );
  assert.equal(rallyPistonImage.interpretedVehicle, "mixto");
});

test("los subtipos de alta confianza encabezan sus candidatos", () => {
  assert.deepEqual(tierOneIds(event({ title: "Campeonato de motocross", discipline: "Offroad", vehicleType: "Moto" })), new Set(["offroad-03", "offroad-09", "offroad-10"]));
  assert.deepEqual(tierOneIds(event({ title: "Campeonato de enduro", discipline: "Offroad", vehicleType: "Moto" })), new Set(["offroad-02", "offroad-07"]));
  assert.deepEqual(tierOneIds(event({ title: "Prueba de trial", discipline: "Offroad", vehicleType: "Moto" })), new Set(["offroad-05", "offroad-11"]));
  assert.deepEqual(tierOneIds(event({ title: "Trackday de coches", discipline: "Circuito", vehicleType: "Coche" })), new Set(["circuito-03"]));

  const fourByFour = resolveV2EventImageCandidates(event({ title: "Encuentro 4x4 de barro y trialeras", discipline: "Offroad", vehicleType: "Coche" }));
  assert.deepEqual(new Set(fourByFour.filter(({ tier }) => tier === 1).map(({ id }) => id)), new Set(["offroad-01", "offroad-06"]));
});

test("R2 mantiene en Tier 1 los subtipos exactos de circuito", () => {
  for (const candidate of [
    event({ title: "Trackday moto amateur", vehicleType: "Moto" }),
    event({ title: "Tandas moto", vehicleType: "Moto" }),
    event({ title: "Rodadas de motos", vehicleType: "Moto" }),
  ]) {
    assert.deepEqual(tierOneIds(candidate), new Set(["circuito-08"]));
  }

  for (const candidate of [
    event({ title: "Carrera Pitbike", vehicleType: "Moto" }),
    event({ championship: "Copa DrPit", vehicleType: "Moto" }),
    event({ title: "Minivelocidad", vehicleType: "Moto" }),
    event({ title: "MiniVelocidad", vehicleType: "Moto" }),
    event({ title: "Resistencia Ciclomotores", vehicleType: "Moto" }),
  ]) {
    assert.deepEqual(tierOneIds(candidate), new Set(["circuito-09", "circuito-13"]));
  }

  for (const discipline of ["Supermotard", "Supermoto", "Minimotard"]) {
    assert.deepEqual(tierOneIds(event({ discipline, vehicleType: "Moto" })), new Set(["circuito-10"]));
  }
  assert.deepEqual(tierOneIds(event({ discipline: "Slalom", vehicleType: "Coche" })), new Set(["circuito-11", "circuito-12"]));
});

test("R2 diferencia concentraciones generales, matinales y custom nocturnas", () => {
  assert.deepEqual(tierOneIds(event({ title: "Gran concentración motera", vehicleType: "Moto" })), new Set(["concentraciones-06"]));
  assert.deepEqual(tierOneIds(event({ title: "Xuntanza motera", vehicleType: "Moto" })), new Set(["concentraciones-06"]));
  for (const title of ["Motoalmuerzo", "Almuerzo motero", "Matinal motera"]) {
    assert.deepEqual(tierOneIds(event({ title, vehicleType: "Moto" })), new Set(["concentraciones-07", "concentraciones-09"]));
  }
  for (const title of ["Concentración custom", "Encuentro biker", "Concentración motera nocturna"]) {
    assert.deepEqual(tierOneIds(event({ title, vehicleType: "Moto" })), new Set(["concentraciones-08"]));
  }
  assert.deepEqual(
    tierOneIds(event({ title: "Concentración motera", venue: "Terraza Noche", vehicleType: "Moto" })),
    new Set(["concentraciones-06"]),
  );
});

test("R2 amplía los pools offroad sin mezclar subtipos", () => {
  assert.deepEqual(tierOneIds(event({ discipline: "Enduro", vehicleType: "Moto" })), new Set(["offroad-02", "offroad-07"]));
  assert.deepEqual(tierOneIds(event({ discipline: "Enduro Indoor", vehicleType: "Moto" })), new Set(["offroad-08", "offroad-17"]));
  assert.deepEqual(tierOneIds(event({ discipline: "SuperEnduro", vehicleType: "Moto" })), new Set(["offroad-08", "offroad-17"]));
  assert.deepEqual(tierOneIds(event({ discipline: "Motocross", vehicleType: "Moto" })), new Set(["offroad-03", "offroad-09", "offroad-10"]));
  assert.deepEqual(tierOneIds(event({ discipline: "Trial", vehicleType: "Moto" })), new Set(["offroad-05", "offroad-11"]));
  assert.deepEqual(tierOneIds(event({ discipline: "Trial Indoor", vehicleType: "Moto" })), new Set(["offroad-12"]));
  assert.deepEqual(tierOneIds(event({ discipline: "Autocross", vehicleType: "Coche" })), new Set(["offroad-13", "offroad-14"]));
  assert.deepEqual(tierOneIds(event({ title: "Tramo de Tierra individual", vehicleType: "Coche" })), new Set(["offroad-14"]));
  for (const discipline of ["Cross Country", "Cross-Country", "CrossCountry", "XC"]) {
    assert.deepEqual(tierOneIds(event({ discipline, vehicleType: "Moto" })), new Set(["offroad-15", "offroad-16"]));
  }
  assert.equal(tierOneIds(event({ discipline: "Enduro", vehicleType: "Moto" })).has("offroad-15"), false);
});

test("R2 no usa escenas de subtipo específico como diversidad genérica", () => {
  const trackdayIds = new Set(ids(event({ title: "Trackday de motos grandes", vehicleType: "Moto" })));
  assert.equal(trackdayIds.has("circuito-09"), false);
  assert.equal(trackdayIds.has("circuito-13"), false);
  assert.equal(trackdayIds.has("circuito-10"), false);

  const generalMeetIds = new Set(ids(event({ title: "Concentración motera", vehicleType: "Moto" })));
  assert.equal(generalMeetIds.has("concentraciones-07"), false);
  assert.equal(generalMeetIds.has("concentraciones-08"), false);
  assert.equal(generalMeetIds.has("concentraciones-09"), false);

  const enduroIds = new Set(ids(event({ discipline: "Enduro", vehicleType: "Moto" })));
  assert.equal(enduroIds.has("offroad-08"), false);
  assert.equal(enduroIds.has("offroad-15"), false);
  assert.equal(enduroIds.has("offroad-16"), false);
  assert.equal(enduroIds.has("offroad-17"), false);

  const hardEnduro = tierOneIds(event({ discipline: "Hard Enduro", vehicleType: "Moto" }));
  assert.deepEqual(hardEnduro, new Set(["offroad-02", "offroad-07"]));
});

test("Enduro exterior repite únicamente su pool cerrado", () => {
  assertClosedPool(
    assignedFallbackIds(8, { discipline: "Enduro", vehicleType: "Moto" }),
    ["offroad-02", "offroad-07"],
  );
});

test("Enduro Indoor no utiliza Trial Indoor", () => {
  assertClosedPool(
    assignedFallbackIds(8, { discipline: "Enduro Indoor", vehicleType: "Moto" }),
    ["offroad-08", "offroad-17"],
  );
});

test("Motocross repite únicamente su pool cerrado", () => {
  assertClosedPool(
    assignedFallbackIds(8, { discipline: "Motocross", vehicleType: "Moto" }),
    ["offroad-03", "offroad-09", "offroad-10"],
  );
});

test("Trial repite únicamente su pool cerrado", () => {
  assertClosedPool(
    assignedFallbackIds(8, { discipline: "Trial", vehicleType: "Moto" }),
    ["offroad-05", "offroad-11"],
  );
});

test("las competiciones clásicas conservan su modalidad deportiva principal", () => {
  for (const candidate of [
    event({ title: "Motocross Clásico Arceniega 2026", discipline: "Motocross", vehicleType: "Moto" }),
    event({ title: "Motocross Classic", discipline: "Motocross Clásico", vehicleType: "Moto" }),
  ]) {
    assert.equal(classificationOf(candidate).discipline, "offroad");
    assert.equal(classificationOf(candidate).subtype, "motocross");
    assert.deepEqual(new Set(ids(candidate)), new Set(["offroad-03", "offroad-09", "offroad-10"]));
  }
  for (const candidate of [
    event({ title: "Trial Clásico Catalunya", discipline: "Trial Clásicas", vehicleType: "Moto" }),
    event({ title: "Trial de clásicas", vehicleType: "Moto" }),
  ]) {
    assert.equal(classificationOf(candidate).discipline, "offroad");
    assert.equal(classificationOf(candidate).subtype, "trial");
    assert.deepEqual(new Set(ids(candidate)), new Set(["offroad-05", "offroad-11"]));
  }
  const classicEnduro = event({ title: "Enduro Sprint y TT Clásico", discipline: "Enduro", vehicleType: "Moto" });
  assert.equal(classificationOf(classicEnduro).subtype, "enduro");
  assert.deepEqual(new Set(ids(classicEnduro)), new Set(["offroad-02", "offroad-07"]));
});

test("la taxonomía clásica no deportiva y la velocidad clásica permanecen intactas", () => {
  for (const candidate of [
    event({ title: "Encuentro de vehículos clásicos" }),
    event({ discipline: "Velocidad Clásicas", vehicleType: "Moto" }),
    event({ discipline: "Resistencia Clásicas Asfalto", vehicleType: "Moto" }),
    event({ discipline: "Rally Histórico", vehicleType: "Coche" }),
  ]) {
    assert.equal(classificationOf(candidate).discipline, "clasicos");
  }
});

test("las concentraciones inequívocamente moteras repiten sólo escenas de motos", () => {
  const general = assignedFallbackIds(8, { title: "Concentración motera", vehicleType: "Moto" });
  assertClosedPool(general, ["concentraciones-02", "concentraciones-06"]);
  assert.equal(general.includes("concentraciones-03"), false);
  assert.equal(general.includes("concentraciones-05"), false);

  const motoBreakfast = assignedFallbackIds(6, { title: "Motoalmuerzo", vehicleType: "Moto" });
  assertClosedPool(motoBreakfast, ["concentraciones-02", "concentraciones-06", "concentraciones-07", "concentraciones-09"]);

  const customNight = assignedFallbackIds(6, { title: "Concentración biker nocturna", vehicleType: "Moto" });
  assertClosedPool(customNight, ["concentraciones-02", "concentraciones-06", "concentraciones-08"]);
});

test("las concentraciones mixtas conservan escenas de coches y motos", () => {
  const mixedIds = new Set(ids(event({ title: "Concentración de coches y motos", vehicleType: "Mixto" })));
  assert.equal(mixedIds.has("concentraciones-03"), true);
  assert.equal(mixedIds.has("concentraciones-05"), true);
});

test("Trial general y TrialGP usan naturaleza mientras Trial Indoor conserva módulos", () => {
  for (const discipline of ["Trial", "TrialGP"]) {
    assertClosedPool(
      assignedFallbackIds(8, { discipline, vehicleType: "Moto" }),
      ["offroad-05", "offroad-11"],
    );
  }
  assert.deepEqual(
    assignedFallbackIds(5, { discipline: "Trial Indoor", vehicleType: "Moto" }),
    Array(5).fill("offroad-12"),
  );
  assert.deepEqual(
    assignedFallbackIds(5, { title: "Trial en pabellón sobre módulos artificiales", vehicleType: "Moto" }),
    Array(5).fill("offroad-12"),
  );
});

test("Cross Country reparte y repite únicamente sus dos fallbacks especializados", () => {
  assertClosedPool(
    assignedFallbackIds(10, { discipline: "Cross Country", vehicleType: "Moto" }),
    ["offroad-15", "offroad-16"],
  );
});

test("Autocross repite únicamente su pool cerrado", () => {
  assertClosedPool(
    assignedFallbackIds(6, { discipline: "Autocross", vehicleType: "Coche" }),
    ["offroad-13", "offroad-14"],
  );
});

test("Pitbike reparte y repite únicamente sus dos fallbacks de moto pequeña", () => {
  assertClosedPool(
    assignedFallbackIds(8, { discipline: "Pitbike", vehicleType: "Moto" }),
    ["circuito-09", "circuito-13"],
  );
});

test("Minivelocidad reparte y repite únicamente sus dos fallbacks de moto pequeña", () => {
  assertClosedPool(
    assignedFallbackIds(8, { discipline: "Minivelocidad", vehicleType: "Moto" }),
    ["circuito-09", "circuito-13"],
  );
});

test("Supermotard repite su único fallback de trazado mixto", () => {
  assert.deepEqual(
    assignedFallbackIds(6, { discipline: "Supermotard", vehicleType: "Moto" }),
    Array(6).fill("circuito-10"),
  );
});

test("Slalom repite únicamente sus dos escenas con conos", () => {
  assertClosedPool(
    assignedFallbackIds(6, { discipline: "Slalom", vehicleType: "Coche" }),
    ["circuito-11", "circuito-12"],
  );
});

test("Trackday conserva un pool abierto de circuito para motos grandes", () => {
  const trackdayIds = new Set(ids(event({ discipline: "Trackday", vehicleType: "Moto" })));
  for (const id of ["circuito-08", "circuito-02", "circuito-05", "circuito-06"]) {
    assert.equal(trackdayIds.has(id), true);
  }
  assert.equal(trackdayIds.has("circuito-09"), false);
  assert.equal(trackdayIds.has("circuito-10"), false);
});

test("los demás subtipos cerrados conservan sus pools editoriales explícitos", () => {
  assertClosedPool(
    assignedFallbackIds(6, { discipline: "Hard Enduro", vehicleType: "Moto" }),
    ["offroad-02", "offroad-07"],
  );
  assert.deepEqual(
    assignedFallbackIds(4, { discipline: "Trial Indoor", vehicleType: "Moto" }),
    Array(4).fill("offroad-12"),
  );
  assertClosedPool(
    assignedFallbackIds(4, { discipline: "Resistencia Ciclomotores", vehicleType: "Moto" }),
    ["circuito-09", "circuito-13"],
  );
  assert.deepEqual(
    assignedFallbackIds(4, { discipline: "Minimotard", vehicleType: "Moto" }),
    Array(4).fill("circuito-10"),
  );
  assertClosedPool(
    assignedFallbackIds(6, { title: "Tramo de Tierra", vehicleType: "Coche" }),
    ["offroad-13", "offroad-14"],
  );
  assert.deepEqual(
    assignedFallbackIds(4, { title: "Tramo de Tierra individual", vehicleType: "Coche" }),
    Array(4).fill("offroad-14"),
  );
});

test("clasifica las modalidades P0 de circuito con vehiculo y subtipo", () => {
  const cases = [
    [event({ discipline: "Slalom", vehicleType: "Coche" }), "coche", "slalom"],
    [event({ discipline: "Drift", vehicleType: "Coche" }), "coche", "drift"],
    [event({ discipline: "Automovilismo", vehicleType: "Coche" }), "coche", "automovilismo"],
    [event({ discipline: "Pitbike", vehicleType: "Otros" }), "moto", "pitbike"],
    [event({ championship: "Copa Centro DrPit", vehicleType: "Otros" }), "moto", "pitbike"],
    [event({ discipline: "MiniVelocidad", vehicleType: "Moto" }), "moto", "minivelocidad"],
    [event({ discipline: "Minivelocidad", vehicleType: "Moto" }), "moto", "minivelocidad"],
    [event({ discipline: "Minimotard", vehicleType: "Moto" }), "moto", "minimotard"],
    [event({ discipline: "Supermotard", vehicleType: "Moto", tags: ["minimotard"] }), "moto", "supermotard"],
    [event({ discipline: "Supermoto", vehicleType: "Moto" }), "moto", "supermotard"],
    [event({ discipline: "Resistencia Ciclomotores", vehicleType: "Moto" }), "moto", "resistencia-ciclomotores"],
  ] as const;

  for (const [candidate, vehicle, subtype] of cases) {
    assert.deepEqual(classificationOf(candidate), {
      discipline: "circuito",
      vehicle,
      subtype,
      reason: classificationOf(candidate).reason,
    });
  }
});

test("clasifica las modalidades P0 offroad y conserva la intencion principal", () => {
  const cases = [
    ["Autocross", "coche", "autocross"],
    ["Cross Country", "moto", "cross-country"],
    ["Tramo de Tierra", "coche", "tramo-tierra"],
    ["Freestyle", "moto", "freestyle"],
    ["Resistencia Tierra", "moto", "resistencia-tierra"],
    ["Enduret", "moto", "enduro"],
  ] as const;

  for (const [discipline, vehicleType, subtype] of cases) {
    const result = classificationOf(event({ discipline, vehicleType }));
    assert.equal(result.discipline, "offroad");
    assert.equal(result.vehicle, vehicleType);
    assert.equal(result.subtype, subtype);
  }

  assert.equal(classificationOf(event({ discipline: "Rally Tierra", vehicleType: "Coche", tags: ["offroad"] })).discipline, "rallyes");
  assert.equal(classificationOf(event({ discipline: "Resistencia Tierra", vehicleType: "Moto", tags: ["circuito"] })).discipline, "offroad");
});

test("clasifica las modalidades P0 de rallyes sin depender del titulo", () => {
  const cases = [
    ["Cronometrada", "cronometrada"],
    ["Montana", "subida"],
    ["Rallycrono", "rallycrono"],
    ["Rallymix", "rallymix"],
  ] as const;

  for (const [discipline, subtype] of cases) {
    const result = classificationOf(event({ discipline, vehicleType: "Coche" }));
    assert.equal(result.discipline, "rallyes");
    assert.equal(result.vehicle, "coche");
    assert.equal(result.subtype, subtype);
  }
});

test("la precedencia mantiene las modalidades existentes por delante de reglas genericas", () => {
  const protectedCases = [
    [event({ discipline: "Rally", tags: ["automovilismo"] }), "rallyes"],
    [event({ discipline: "Rallysprint", tags: ["automovilismo"] }), "rallyes"],
    [event({ discipline: "Rally Tierra", tags: ["cross country"] }), "rallyes"],
    [event({ discipline: "Rally TT", tags: ["offroad"] }), "rallyes"],
    [event({ discipline: "Subida", tags: ["automovilismo"] }), "rallyes"],
    [event({ discipline: "Motocross", vehicleType: "Moto" }), "offroad"],
    [event({ discipline: "Enduro", vehicleType: "Moto" }), "offroad"],
    [event({ discipline: "Trial", vehicleType: "Moto" }), "offroad"],
    [event({ discipline: "Tandas", vehicleType: "Moto" }), "circuito"],
    [event({ discipline: "Trackday", vehicleType: "Coche" }), "circuito"],
    [event({ discipline: "MotoGP", vehicleType: "Moto" }), "circuito"],
    [event({ discipline: "WorldSBK", vehicleType: "Moto" }), "circuito"],
    [event({ discipline: "Motoalmuerzo", vehicleType: "Moto" }), "concentraciones"],
    [event({ discipline: "Karting", vehicleType: "Karting" }), "karting"],
    [event({ discipline: "Rutas", vehicleType: "Moto" }), "rutas"],
    [event({ discipline: "Clasicos", vehicleType: "Coche" }), "clasicos"],
    [event({ discipline: "Ferias", vehicleType: "Mixto" }), "ferias"],
  ] as const;

  for (const [candidate, discipline] of protectedCases) {
    assert.equal(classificationOf(candidate).discipline, discipline);
  }

  assert.equal(classificationOf(event({ discipline: "Rally Historico", tags: ["automovilismo"] })).discipline, "clasicos");
  assert.equal(classificationOf(event({ discipline: "Motocross Clasico", tags: ["offroad"] })).discipline, "offroad");
  assert.equal(classificationOf(event({ title: "Rally Piston", discipline: "Concentracion", tags: ["motos"] })).discipline, "concentraciones");
  assert.equal(classificationOf(event({ title: "Rally nacional", discipline: "Automovilismo", vehicleType: "Coche" })).discipline, "rallyes");
});

test("rutas, clásicos, ferias y karting mantienen su semántica de vehículo", () => {
  const routeMoto = resolveV2EventImageCandidates(event({ title: "Ruta de motos", discipline: "Rutas", vehicleType: "Moto" }));
  assert.deepEqual(new Set(routeMoto.filter(({ tier }) => tier === 2).map(({ id }) => id)), new Set(["rutas-01", "rutas-03", "rutas-05"]));
  const routeCar = resolveV2EventImageCandidates(event({ title: "Ruta de coches", discipline: "Rutas", vehicleType: "Coche" }));
  assert.deepEqual(new Set(routeCar.filter(({ tier }) => tier === 2).map(({ id }) => id)), new Set(["rutas-02", "rutas-04"]));
  assert.equal(ids(event({ title: "Encuentro de motos clásicas", discipline: "Clásicos", vehicleType: "Moto" }))[0], "clasicos-03");
  assert.equal(ids(event({ title: "Salón de la moto", discipline: "Ferias", vehicleType: "Moto" }))[0], "ferias-02");
  assert.deepEqual(new Set(ids(event({ title: "Carrera de karting", discipline: "Karting", vehicleType: "Karting" }))), new Set([
    "karting-01", "karting-02", "karting-03", "karting-04", "karting-05",
  ]));
});

test("la asignación de lista es estable y sólo repite al agotar candidatos compatibles", () => {
  const motoMeets = Array.from({ length: 4 }, (_, index) => event({
    id: `meet-${index}`,
    slug: `meet-${index}`,
    title: `Concentración motera ${index}`,
    vehicleType: "Moto",
  }));
  const first = assignV2HomeEventImages(motoMeets);
  const second = assignV2HomeEventImages(motoMeets);
  assert.deepEqual(first, second);
  assert.equal(first[0].fallbackId, "concentraciones-06");
  assert.deepEqual(new Set(first.map(({ fallbackId }) => fallbackId)), new Set(["concentraciones-02", "concentraciones-06"]));
  assert.equal(new Set(first.map(({ fallbackId }) => fallbackId)).size, 2);
  assert.equal(first.some(({ fallbackId }) => fallbackId === "concentraciones-03" || fallbackId === "concentraciones-05"), false);

  const circuitMotos = Array.from({ length: 3 }, (_, index) => event({
    id: `circuit-${index}`,
    slug: `circuit-${index}`,
    title: `Copa de motos ${index}`,
    discipline: "Circuito",
    vehicleType: "Moto",
  }));
  const circuitAssignments = assignV2HomeEventImages(circuitMotos);
  assert.equal(new Set(circuitAssignments.map(({ fallbackId }) => fallbackId)).size, 3);
  assert.equal(circuitAssignments.every(({ interpretedDiscipline, interpretedVehicle }) => interpretedDiscipline === "circuito" && interpretedVehicle === "moto"), true);
});

test("la asignación no cruza disciplinas y conserva la misma imagen para el mismo evento", () => {
  const events = [
    event({ id: "rally", slug: "rally", title: "Rallye nacional", discipline: "Rally", vehicleType: "Coche" }),
    event({ id: "enduro", slug: "enduro", title: "Enduro nacional", discipline: "Enduro", vehicleType: "Moto" }),
    event({ id: "kart", slug: "kart", title: "Karting nacional", discipline: "Karting", vehicleType: "Karting" }),
  ];
  const assigned = assignV2HomeEventImages(events);
  assert.equal(new Set(assigned.map(({ fallbackId }) => fallbackId)).size, 3);
  assert.equal(assigned[0].interpretedDiscipline, "rallyes");
  assert.equal(assigned[1].interpretedDiscipline, "offroad");
  assert.equal(assigned[2].interpretedDiscipline, "karting");

  const duplicate = assignV2HomeEventImages([events[0], { ...events[0], id: "another-id" }]);
  assert.equal(duplicate[0].src, duplicate[1].src);
  assert.equal(duplicate[0].fallbackId, duplicate[1].fallbackId);
});

test("una imagen real válida gana siempre y una fuente inválida no se propaga", () => {
  const real = event({ imageUrl: "https://images.example.com/event.webp" });
  assert.deepEqual(assignV2HomeEventImages([real])[0], {
    src: "https://images.example.com/event.webp",
    kind: "event",
    alt: "Imagen del evento Evento de motor",
  });
  assert.equal(isValidV2EventImageSource("/images/events/local.webp"), true);
  assert.equal(isValidV2EventImageSource("https://images.example.com/event.webp"), true);
  assert.equal(isValidV2EventImageSource("javascript:alert(1)"), false);
  assert.equal(isValidV2EventImageSource("//unexpected.example/event.webp"), false);
  assert.equal(assignV2HomeEventImages([event({ title: "Rallye", imageUrl: "not a url" })])[0].kind, "representative");
});

test("la identidad estable prioriza slug, luego id y por último el fingerprint", () => {
  assert.equal(stableV2EventKey(event({ slug: "stable-slug", id: "stable-id" })), "slug:stable-slug");
  assert.equal(stableV2EventKey(event({ slug: "", id: "stable-id" })), "id:stable-id");
  assert.equal(
    stableV2EventKey(event({ slug: "", id: "", title: "Ruta Norte", start: "2026-08-16", city: "Oviedo" })),
    "event:ruta norte|2026 08 16|oviedo",
  );
  assert.doesNotMatch(resolverSource, /Math\.random|Date\.now/);
});

test("el ranking no depende del orden físico del manifiesto", () => {
  const candidate = event({ title: "Copa de motos", discipline: "Circuito", vehicleType: "Moto" });
  const natural = resolveV2EventImageCandidates(candidate).map(({ id }) => id);
  const reversed = resolveV2EventImageCandidates(candidate, [...V2_DISCIPLINE_FALLBACKS].reverse()).map(({ id }) => id);
  assert.deepEqual(reversed, natural);
});

test("evita un fallback adyacente identico cuando existe una alternativa same-tier", () => {
  const sequence = assignedFallbackIds(8, { discipline: "Slalom", vehicleType: "Coche" });
  assertClosedPool(sequence, ["circuito-11", "circuito-12"]);
  assertNoAdjacentDuplicates(sequence);
});

test("agota los candidatos no usados antes de reutilizar una alternativa adyacente", () => {
  const sequence = assignedFallbackIds(4, { discipline: "Motocross", vehicleType: "Moto" });
  assert.deepEqual(new Set(sequence.slice(0, 3)), new Set(["offroad-03", "offroad-09", "offroad-10"]));
  assertNoAdjacentDuplicates(sequence);
});

test("la proteccion adyacente no baja de tier para ganar variedad", () => {
  const assigned = assignV2HomeEventImages(Array.from({ length: 8 }, (_, index) => event({
    id: `motoalmuerzo-tier-${index}`,
    slug: `motoalmuerzo-tier-${index}`,
    title: `Motoalmuerzo ${index}`,
    discipline: "Concentraciones",
    vehicleType: "Moto",
  })));
  assert.deepEqual(new Set(assigned.filter(({ fallbackTier }) => fallbackTier === 1).map(({ fallbackId }) => fallbackId)), new Set([
    "concentraciones-07",
    "concentraciones-09",
  ]));
  assert.equal(assigned.slice(4).every(({ fallbackTier }) => fallbackTier === 1), true);
  assertNoAdjacentDuplicates(assigned.slice(4).map(({ fallbackId }) => String(fallbackId)));
});

test("conserva la repeticion del mejor tier si la unica alternativa es inferior", () => {
  const assigned = assignV2HomeEventImages(Array.from({ length: 4 }, (_, index) => event({
    id: `generic-meet-tier-${index}`,
    slug: `generic-meet-tier-${index}`,
    title: `Concentracion motera ${index}`,
    discipline: "Concentraciones",
    vehicleType: "Moto",
  })));
  assert.deepEqual(assigned.map(({ fallbackTier }) => fallbackTier), [1, 2, 1, 1]);
  assert.deepEqual(assigned.slice(2).map(({ fallbackId }) => fallbackId), [
    "concentraciones-06",
    "concentraciones-06",
  ]);
});

test("permite la repeticion cuando el pool efectivo tiene un unico candidato", () => {
  assert.deepEqual(
    assignedFallbackIds(5, { discipline: "Supermotard", vehicleType: "Moto" }),
    Array(5).fill("circuito-10"),
  );
});

test("la proteccion adyacente mantiene el determinismo para el mismo dataset y orden", () => {
  const events = Array.from({ length: 10 }, (_, index) => event({
    id: `deterministic-cross-country-${index}`,
    slug: `deterministic-cross-country-${index}`,
    discipline: "Cross Country",
    vehicleType: "Moto",
  }));
  assert.deepEqual(assignV2HomeEventImages(events), assignV2HomeEventImages(events));
});

test("una imagen real conserva prioridad y separa la comparacion entre fallbacks", () => {
  const fallbackBefore = event({
    id: "fallback-before-real",
    slug: "fallback-before-real",
    discipline: "Supermotard",
    vehicleType: "Moto",
  });
  const fallbackAfter = event({
    id: "fallback-after-real",
    slug: "fallback-after-real",
    discipline: "Supermotard",
    vehicleType: "Moto",
  });
  const assigned = assignV2HomeEventImages([
    fallbackBefore,
    event({ id: "real-between", slug: "real-between", imageUrl: "https://images.example.com/real-between.webp" }),
    fallbackAfter,
  ]);
  assert.equal(assigned[1].kind, "event");
  assert.equal(assigned[1].src, "https://images.example.com/real-between.webp");
  assert.equal(assigned[0].fallbackId, assigned[2].fallbackId);
});

test("Super Enduro alterna exclusivamente sus dos candidatos equivalentes", () => {
  const sequence = assignedFallbackIds(8, { discipline: "SuperEnduro", vehicleType: "Moto" });
  assertClosedPool(sequence, ["offroad-08", "offroad-17"]);
  assertNoAdjacentDuplicates(sequence);
});

test("Cross Country evita duplicados adyacentes dentro de su pool cerrado", () => {
  const sequence = assignedFallbackIds(10, { discipline: "Cross Country", vehicleType: "Moto" });
  assertClosedPool(sequence, ["offroad-15", "offroad-16"]);
  assertNoAdjacentDuplicates(sequence);
});

test("Pitbike evita duplicados adyacentes dentro de su pool cerrado", () => {
  const sequence = assignedFallbackIds(8, { discipline: "Pitbike", vehicleType: "Moto" });
  assertClosedPool(sequence, ["circuito-09", "circuito-13"]);
  assertNoAdjacentDuplicates(sequence);
});

test("Trial Indoor conserva correctamente su unico fallback aunque se repita", () => {
  assert.deepEqual(
    assignedFallbackIds(8, { discipline: "Trial Indoor", vehicleType: "Moto" }),
    Array(8).fill("offroad-12"),
  );
});

test("Motoalmuerzo no promociona secundarios para corregir una repeticion exacta", () => {
  const assigned = assignV2HomeEventImages(Array.from({ length: 8 }, (_, index) => event({
    id: `motoalmuerzo-adjacent-${index}`,
    slug: `motoalmuerzo-adjacent-${index}`,
    title: `Motoalmuerzo ${index}`,
    discipline: "Concentraciones",
    vehicleType: "Moto",
  })));
  const tail = assigned.slice(4);
  assert.equal(tail.every(({ fallbackTier }) => fallbackTier === 1), true);
  assert.equal(tail.every(({ fallbackId }) => ["concentraciones-07", "concentraciones-09"].includes(String(fallbackId))), true);
  assertNoAdjacentDuplicates(tail.map(({ fallbackId }) => String(fallbackId)));
});

test("Autocross evita duplicados adyacentes sin salir de su pool", () => {
  const sequence = assignedFallbackIds(8, { discipline: "Autocross", vehicleType: "Coche" });
  assertClosedPool(sequence, ["offroad-13", "offroad-14"]);
  assertNoAdjacentDuplicates(sequence);
});

test("un cambio de subtipo entre tarjetas no contamina la seleccion siguiente", () => {
  const events = [
    event({ id: "cross-1", slug: "cross-1", discipline: "Cross Country", vehicleType: "Moto" }),
    event({ id: "cross-2", slug: "cross-2", discipline: "Cross Country", vehicleType: "Moto" }),
    event({ id: "trial-indoor", slug: "trial-indoor", discipline: "Trial Indoor", vehicleType: "Moto" }),
    event({ id: "cross-3", slug: "cross-3", discipline: "Cross Country", vehicleType: "Moto" }),
  ];
  const assigned = assignV2HomeEventImages(events);
  assert.equal(assigned[2].fallbackId, "offroad-12");
  assert.equal(["offroad-15", "offroad-16"].includes(String(assigned[3].fallbackId)), true);
  assert.equal(assigned[3].interpretedSubtype, "cross-country");
});

test("corrige la secuencia visible real de Super Enduro tras buscar en un dataset mixto", () => {
  const events = [
    event({ id: "hidden-indoor", slug: "hidden-indoor", title: "Copa Indoor", discipline: "Enduro Indoor", vehicleType: "Moto" }),
    event({ id: "super-enduro-lanzahita-2026-09-05", slug: "super-enduro-lanzahita-2026-09-05", title: "Super Enduro Lanzahita 2026", discipline: "Super Enduro", vehicleType: "Moto" }),
    event({ id: "super-rally", slug: "super-rally", title: "Rally intermedio", discipline: "Rally", vehicleType: "Coche" }),
    event({ id: "super-enduro-de-potes-2026-09-13", slug: "super-enduro-de-potes-2026-09-13", title: "Super Enduro de Potes 2026", discipline: "Super Enduro", vehicleType: "Moto" }),
    event({ id: "super-route", slug: "super-route", title: "Ruta intermedia", discipline: "Ruta", vehicleType: "Moto" }),
    event({ id: "super-enduro-de-reinosa-2026-09-26", slug: "super-enduro-de-reinosa-2026-09-26", title: "Super Enduro de Reinosa 2026", discipline: "Super Enduro", vehicleType: "Moto" }),
  ];
  const sequences = visiblePipelineFallbacks(events, "super enduro");
  assert.deepEqual(sequences.before, ["offroad-17", "offroad-17", "offroad-08"]);
  assert.deepEqual(sequences.after, ["offroad-17", "offroad-08", "offroad-17"]);
});

test("corrige Cross Country visible y mantiene Pitbike, Slalom y Autocross en su pool exacto", () => {
  for (const scenario of [
    ["cross", "Cross Country", "Moto", "Cross Country", ["offroad-15", "offroad-16"]],
    ["pitbike", "Pitbike", "Moto", "Pitbike", ["circuito-09", "circuito-13"]],
    ["slalom", "Slalom", "Coche", "Slalom", ["circuito-11", "circuito-12"]],
    ["autocross", "Autocross", "Coche", "Autocross", ["offroad-13", "offroad-14"]],
  ] as const) {
    const [prefix, discipline, vehicle, query, pool] = scenario;
    const sequences = visiblePipelineFallbacks(mixedSubtypeEvents(prefix, discipline, vehicle, query), query);
    if (query === "Cross Country") {
      assert.equal(sequences.before.slice(1).some((id, index) => id === sequences.before[index]), true, `${query} reproduce la colision visible`);
    }
    assert.equal(sequences.after.every((id) => pool.includes(id as never)), true, `${query} conserva el pool exacto`);
    assertNoAdjacentDuplicates(sequences.after);
  }
});

test("un filtro que reduce A-X-A produce A-B si hay alternativa equivalentemente valida", () => {
  const events = [
    event({ id: "reduced-a", slug: "reduced-a", title: "Objetivo Slalom A", discipline: "Slalom", vehicleType: "Coche" }),
    event({ id: "reduced-x", slug: "reduced-x", title: "Copa de conos", discipline: "Slalom", vehicleType: "Coche" }),
    event({ id: "reduced-b", slug: "reduced-b", title: "Objetivo Slalom B", discipline: "Slalom", vehicleType: "Coche" }),
  ];
  const sequences = visiblePipelineFallbacks(events, "objetivo");
  assert.equal(sequences.before[0], sequences.before[1]);
  assert.notEqual(sequences.after[0], sequences.after[1]);
  assertClosedPool(sequences.after, ["circuito-11", "circuito-12"]);
});

test("una imagen real visible rompe la adyacencia y no se reequilibra", () => {
  const first = event({ id: "real-break-a", slug: "real-break-a", title: "Super Enduro A", discipline: "Super Enduro", vehicleType: "Moto" });
  const real = event({ id: "real-break-image", slug: "real-break-image", title: "Super Enduro con imagen real", discipline: "Super Enduro", vehicleType: "Moto", imageUrl: "https://images.example.com/super-enduro.webp" });
  const third = event({ id: "real-break-b", slug: "real-break-b", title: "Super Enduro B", discipline: "Super Enduro", vehicleType: "Moto" });
  const assigned = assignV2HomeEventImages([first, real, third]);
  const visible = rebalanceVisibleV2EventImages([first, real, third], assigned);
  assert.deepEqual(visible, assigned);
  assert.equal(visible[1].kind, "event");
});

test("Trial Indoor visible conserva su unico candidato aunque quede adyacente", () => {
  const sequences = visiblePipelineFallbacks(mixedSubtypeEvents("trial-filter", "Trial Indoor", "Moto", "Trial Indoor"), "trial indoor");
  assert.deepEqual(sequences.before, ["offroad-12", "offroad-12", "offroad-12"]);
  assert.deepEqual(sequences.after, sequences.before);
});

test("cambiar query A-B-A conserva exactamente el resultado determinista de A", () => {
  const events = [
    ...mixedSubtypeEvents("query-super", "Super Enduro", "Moto", "Super Enduro"),
    ...mixedSubtypeEvents("query-cross", "Cross Country", "Moto", "Cross Country"),
  ];
  const firstA = visiblePipelineFallbacks(events, "super enduro").after;
  const queryB = visiblePipelineFallbacks(events, "cross country").after;
  const secondA = visiblePipelineFallbacks(events, "super enduro").after;
  assert.deepEqual(secondA, firstA);
  assertNoAdjacentDuplicates(queryB);
});

test("el rebalanceo visible preserva assignedByEvent para una stableKey repetida", () => {
  const repeated = event({ id: "same-visible-event", slug: "same-visible-event", title: "Super Enduro repetido", discipline: "Super Enduro", vehicleType: "Moto" });
  const other = event({ id: "other-visible-event", slug: "other-visible-event", title: "Super Enduro distinto", discipline: "Super Enduro", vehicleType: "Moto" });
  const assigned = assignV2HomeEventImages([repeated, other, repeated]);
  const visible = rebalanceVisibleV2EventImages([repeated, other, repeated], assigned);
  assert.deepEqual(visible[2], visible[0]);
});

test("Motoalmuerzo visible no baja de tier para obtener diversidad", () => {
  const events = mixedSubtypeEvents("motoalmuerzo-filter", "Concentraciones", "Moto", "Motoalmuerzo", 6);
  const assigned = assignV2HomeEventImages(events);
  const visibleEvents = events.filter(({ title }) => String(title).includes("Motoalmuerzo"));
  const visibleAssigned = events.map((candidate, index) => ({ candidate, image: assigned[index] }))
    .filter(({ candidate }) => String(candidate.title).includes("Motoalmuerzo"))
    .map(({ image }) => image);
  const rebalanced = rebalanceVisibleV2EventImages(visibleEvents, visibleAssigned);
  assert.deepEqual(rebalanced.map(({ fallbackTier }) => fallbackTier), visibleAssigned.map(({ fallbackTier }) => fallbackTier));
});
