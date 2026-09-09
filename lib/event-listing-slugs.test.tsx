import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DisciplineListingAction from "@/components/events/detail/DisciplineListingAction";
import {
  CANONICAL_DISCIPLINE_HREFS,
  getCanonicalDisciplineHref,
} from "./event-listing-slugs";

type MappingCase = {
  discipline: string;
  expected: string | null;
  vehicleType?: string;
};

const mappingCases: MappingCase[] = [
  ...[
    "Rally",
    "Rallysprint",
    "Rally Histórico",
    "Rally Tierra",
    "Rally TT",
    "Rally Raid",
    "Eco Rally",
    "Rallymix",
    "Rallycrono",
    "Rallycross",
    "Slalom",
    "Subida",
    "Montana",
    "Cronometrada",
    "Regularidad",
    "Tramo de Tierra",
    "Tramo Cronometrado de Subida",
  ].map((discipline) => ({ discipline, expected: "/disciplinas/rallyes" })),
  ...[
    "Circuito",
    "Tandas",
    "Trackday",
    "Velocidad",
    "MiniVelocidad",
    "Superbike",
    "MotoGP",
    "JuniorGP",
    "WorldSBK",
    "Pitbike",
    "Minimotard",
    "Supermotard",
    "Supermoto",
    "Drift",
    "Resistencia",
    "Resistencia Ciclomotores",
  ].map((discipline) => ({ discipline, expected: "/disciplinas/circuito" })),
  ...[
    "Motocross",
    "Trial",
    "TrialGP",
    "Trial Clasicas",
    "Autocross",
    "Enduro",
    "Enduret",
    "Enduro Indoor",
    "Enduro Country",
    "Hard Enduro",
    "Enduro Clasicas",
    "Cross Country",
    "Supercross",
    "Resistencia Tierra",
    "Todo Terreno Clasico",
    "Todoterreno",
    "Off Road",
    "Offroad",
  ].map((discipline) => ({ discipline, expected: "/disciplinas/offroad" })),
  { discipline: "Karting", expected: "/disciplinas/karting" },
  { discipline: "Ferias", expected: "/disciplinas/ferias" },
  { discipline: "Feria", expected: "/disciplinas/ferias" },
  { discipline: "Rutas", vehicleType: "moto", expected: "/disciplinas/rutas" },
  { discipline: "Ruta motera", vehicleType: "Motos", expected: "/disciplinas/rutas" },
  { discipline: "Mototurismo", vehicleType: "moto", expected: "/disciplinas/rutas" },
  { discipline: "Concentración", vehicleType: "moto", expected: "/disciplinas/concentraciones" },
  { discipline: "Concentración", vehicleType: "Motos", expected: "/disciplinas/concentraciones" },
  { discipline: "Concentraciones", vehicleType: "moto", expected: "/disciplinas/concentraciones" },
  { discipline: "Motoalmuerzo", vehicleType: "moto", expected: "/disciplinas/concentraciones" },
  { discipline: "Custom", vehicleType: "moto", expected: "/disciplinas/concentraciones" },
  { discipline: "Clásicos", vehicleType: "coche", expected: "/disciplinas/clasicos" },
  { discipline: "Clasicos", vehicleType: "Coches", expected: "/disciplinas/clasicos" },
  { discipline: "Clásicos", vehicleType: "mixto", expected: "/disciplinas/clasicos" },
  { discipline: "Regularidad clásicos", vehicleType: "coche", expected: "/disciplinas/clasicos" },
];

test("mapea únicamente modalidades explícitas hacia familias canónicas", () => {
  for (const mapping of mappingCases) {
    assert.equal(getCanonicalDisciplineHref(mapping), mapping.expected, mapping.discipline);
  }
});

test("aplica guardas de vehículo y no inventa destinos para valores desconocidos", () => {
  const noLinkCases: MappingCase[] = [
    { discipline: "Concentración", vehicleType: "coche", expected: null },
    { discipline: "Concentración", vehicleType: "mixto", expected: null },
    { discipline: "Custom", vehicleType: "mixto", expected: null },
    { discipline: "Rutas", vehicleType: "coche", expected: null },
    { discipline: "Clásicos", vehicleType: "moto", expected: null },
    { discipline: "Clásicas", vehicleType: "moto", expected: null },
    { discipline: "Velocidad Clasicas", vehicleType: "moto", expected: null },
    { discipline: "Resistencia Clasicas Asfalto", vehicleType: "moto", expected: null },
    { discipline: "Freestyle", vehicleType: "moto", expected: null },
    { discipline: "Automovilismo", vehicleType: "coche", expected: null },
    { discipline: "Trail", vehicleType: "moto", expected: null },
    { discipline: "Karting / Minivelocidad", vehicleType: "moto", expected: null },
    { discipline: "Otros", vehicleType: "otros", expected: null },
    { discipline: "Valor futuro desconocido", vehicleType: "moto", expected: null },
  ];

  for (const mapping of noLinkCases) {
    assert.equal(getCanonicalDisciplineHref(mapping), null, mapping.discipline);
  }
});

test("normaliza case, acentos y espacios sin recurrir a coincidencias parciales", () => {
  assert.equal(
    getCanonicalDisciplineHref({ discipline: "  RALLY   HISTÓRICO  ", vehicleType: "COCHE" }),
    "/disciplinas/rallyes",
  );
  assert.equal(
    getCanonicalDisciplineHref({ discipline: "MONTAÑA", vehicleType: "coche" }),
    "/disciplinas/rallyes",
  );
  assert.equal(
    getCanonicalDisciplineHref({ discipline: "  concentración ", vehicleType: " MOTOS " }),
    "/disciplinas/concentraciones",
  );
  assert.equal(getCanonicalDisciplineHref({ discipline: "MotorLand", vehicleType: "moto" }), null);
});

test("todo resultado no nulo pertenece al conjunto cerrado de ocho rutas", () => {
  const allowed = new Set<string>(CANONICAL_DISCIPLINE_HREFS);

  for (const mapping of mappingCases) {
    const href = getCanonicalDisciplineHref(mapping);
    assert.ok(href && allowed.has(href), mapping.discipline);
  }
});

test("el consumidor conserva el texto y sólo renderiza anchor cuando existe destino", () => {
  const linkableMarkup = renderToStaticMarkup(createElement(DisciplineListingAction, {
    className: "emc-btn emc-btn-dark",
    discipline: "Rallysprint",
    vehicleType: "coche",
  }));
  const nonLinkableMarkup = renderToStaticMarkup(createElement(DisciplineListingAction, {
    className: "emc-btn emc-btn-dark",
    discipline: "Freestyle",
    vehicleType: "moto",
  }));

  assert.match(linkableMarkup, /<a[^>]+href="\/disciplinas\/rallyes"[^>]*>Ver más de Rallysprint<\/a>/);
  assert.equal((linkableMarkup.match(/<a\b/g) || []).length, 1);
  assert.match(nonLinkableMarkup, /<span[^>]*>Ver más de Freestyle<\/span>/);
  assert.equal((nonLinkableMarkup.match(/<a\b/g) || []).length, 0);
});
