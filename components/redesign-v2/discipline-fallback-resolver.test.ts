import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { V2_DISCIPLINE_FALLBACKS } from "./discipline-fallback-manifest";
import {
  assignV2HomeEventImages,
  classifyV2FallbackEvent,
  isValidV2EventImageSource,
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

function classificationOf(candidate: V2FallbackEvent) {
  const classification = classifyV2FallbackEvent(candidate);
  assert.ok(classification);
  return classification;
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
  assert.equal(motoMeet[0].id, "concentraciones-02");
  assert.deepEqual(new Set(motoMeet.filter(({ tier }) => tier === 3).map(({ id }) => id)), new Set(["concentraciones-03", "concentraciones-05"]));

  const carMeet = resolveV2EventImageCandidates(event({ title: "Concentración de coches", vehicleType: "Coche" }));
  assert.deepEqual(new Set(carMeet.filter(({ tier }) => tier === 2).map(({ id }) => id)), new Set(["concentraciones-01", "concentraciones-04"]));
  assert.equal(carMeet.findIndex(({ vehicle }) => vehicle === "mixto") > carMeet.findLastIndex(({ vehicle }) => vehicle === "coche"), true);

  const mixedMeet = resolveV2EventImageCandidates(event({ title: "Concentración mixta de coches y motos", vehicleType: "Mixto" }));
  assert.deepEqual(new Set(mixedMeet.filter(({ tier }) => tier <= 2).map(({ id }) => id)), new Set(["concentraciones-03", "concentraciones-05"]));
});

test("los subtipos de alta confianza encabezan sus candidatos", () => {
  assert.equal(ids(event({ title: "Campeonato de motocross", discipline: "Offroad", vehicleType: "Moto" }))[0], "offroad-03");
  assert.equal(ids(event({ title: "Campeonato de enduro", discipline: "Offroad", vehicleType: "Moto" }))[0], "offroad-02");
  assert.equal(ids(event({ title: "Prueba de trial", discipline: "Offroad", vehicleType: "Moto" }))[0], "offroad-05");
  assert.equal(ids(event({ title: "Trackday de coches", discipline: "Circuito", vehicleType: "Coche" }))[0], "circuito-03");

  const fourByFour = resolveV2EventImageCandidates(event({ title: "Encuentro 4x4 de barro y trialeras", discipline: "Offroad", vehicleType: "Coche" }));
  assert.deepEqual(new Set(fourByFour.filter(({ tier }) => tier === 1).map(({ id }) => id)), new Set(["offroad-01", "offroad-06"]));
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
  assert.equal(classificationOf(event({ discipline: "Motocross Clasico", tags: ["offroad"] })).discipline, "clasicos");
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
  assert.deepEqual(new Set(first.slice(0, 3).map(({ fallbackId }) => fallbackId)), new Set([
    "concentraciones-02", "concentraciones-03", "concentraciones-05",
  ]));
  assert.equal(new Set(first.map(({ fallbackId }) => fallbackId)).size, 3);

  const circuitMotos = Array.from({ length: 3 }, (_, index) => event({
    id: `circuit-${index}`,
    slug: `circuit-${index}`,
    title: `Copa de motos ${index}`,
    discipline: "Circuito",
    vehicleType: "Moto",
  }));
  assert.deepEqual(new Set(assignV2HomeEventImages(circuitMotos).map(({ fallbackId }) => fallbackId)), new Set([
    "circuito-02", "circuito-05", "circuito-06",
  ]));
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
