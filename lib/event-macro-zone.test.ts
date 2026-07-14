import assert from "node:assert/strict";
import test from "node:test";
import { buildZones } from "@/components/public/concept/concept-model";
import { classifyEventMacroZone } from "@/lib/event-macro-zone";
import type { EventItem } from "@/types/event";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event-1",
    title: "Evento de prueba",
    championship: "Campeonato de prueba",
    discipline: "Rallyes",
    start: "2099-01-10",
    end: "2099-01-10",
    venue: "Recinto de prueba",
    city: "Ciudad de prueba",
    province: "Por confirmar",
    region: "Por confirmar",
    level: "Nacional",
    source: "test",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    featured: false,
    ...overrides,
  };
}

test("clasifica por provincia antes que por menciones editoriales o competitivas", () => {
  assert.equal(classifyEventMacroZone(event({
    province: "Álava",
    region: "País Vasco",
    championship: "Copa de Castilla y León de Motocross Clásico",
  })), "norte");
  assert.equal(classifyEventMacroZone(event({
    province: "Asturias",
    region: "Asturias",
    championship: "Campeonato de Castilla-La Mancha de Enduro",
  })), "norte");
  assert.equal(classifyEventMacroZone(event({
    province: "Navarra",
    region: "Navarra",
    championship: "Campeonato de Aragón de Cross Country",
  })), "norte");
});

test("evita coincidencias parciales de municipios con nombres de provincia", () => {
  assert.equal(classifyEventMacroZone(event({
    title: "VII Rallysprint Salvaleón 2026",
    city: "Salvaleón",
    province: "Badajoz",
    region: "Extremadura",
  })), "sur");
});

test("Castilla y León pertenece de forma única a Centro", () => {
  for (const province of ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"]) {
    assert.equal(classifyEventMacroZone(event({ province, region: "Castilla y León" })), "centro");
  }
});

test("usa la comunidad cuando falta una provincia fiable", () => {
  assert.equal(classifyEventMacroZone(event({ province: "Por confirmar", region: "Catalunya" })), "cataluna-aragon");
  assert.equal(classifyEventMacroZone(event({ province: "Por confirmar", region: "Islas Canarias" })), "canarias");
});

test("no usa título, campeonato, sede ni una región extranjera como fallback", () => {
  assert.equal(classifyEventMacroZone(event({
    title: "Rallye de Madrid",
    championship: "Campeonato de Aragón",
    venue: "Circuito de Navarra",
  })), null);
  assert.equal(classifyEventMacroZone(event({
    city: "Matosinhos",
    province: "Porto",
    region: "Norte",
  })), null);
});

test("buildZones asigna cada evento como máximo a una macrozona", () => {
  const events = [
    event({ id: "norte", province: "Navarra", region: "Navarra" }),
    event({ id: "centro", province: "León", region: "Castilla y León" }),
    event({ id: "sur", city: "Salvaleón", province: "Badajoz", region: "Extremadura" }),
    event({ id: "sin-zona" }),
  ];
  const zones = buildZones(events);
  const classifiedIds = zones.flatMap((zone) => zone.events.map((item) => item.id));

  assert.deepEqual(classifiedIds.sort(), ["centro", "norte", "sur"]);
  assert.equal(new Set(classifiedIds).size, classifiedIds.length);
});
