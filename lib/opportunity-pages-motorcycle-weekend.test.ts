import assert from "node:assert/strict";
import test from "node:test";
import { motorcycleWeekendRange } from "@/lib/concentrations/motorcycle-concentrations-model";
import {
  getOpportunityPage,
  matchesMotorcycleWeekendOpportunity,
} from "@/lib/opportunity-pages";
import type { EventItem } from "@/types/event";

function event(
  id: string,
  overrides: Partial<EventItem> = {},
): EventItem {
  return {
    id,
    slug: id,
    title: "Concentración motera de prueba",
    championship: "Encuentro motero",
    discipline: "Concentraciones",
    start: "2026-09-05",
    end: "2026-09-05",
    venue: "Recinto de prueba",
    city: "Madrid",
    province: "Madrid",
    region: "Madrid",
    level: "Local",
    source: "Fuente oficial",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: ["moto", "concentracion"],
    vehicleType: "moto",
    vehicle_type: "moto",
    featured: false,
    visible: true,
    eventStatus: "confirmed",
    dataQuality: "reviewed",
    ...overrides,
  };
}

const THURSDAY = new Date("2026-09-03T10:00:00+02:00");
const FRIDAY = new Date("2026-09-04T10:00:00+02:00");
const SATURDAY = new Date("2026-09-05T10:00:00+02:00");
const SUNDAY_MORNING = new Date("2026-09-06T09:00:00+02:00");
const SUNDAY_NIGHT = new Date("2026-09-06T23:30:00+02:00");
const MONDAY = new Date("2026-09-07T09:00:00+02:00");

test("usa Europe/Madrid y mantiene el mismo viernes-domingo hasta acabar el domingo", () => {
  for (const now of [THURSDAY, FRIDAY, SATURDAY, SUNDAY_MORNING, SUNDAY_NIGHT]) {
    assert.deepEqual(motorcycleWeekendRange(now), {
      friday: "2026-09-04",
      sunday: "2026-09-06",
    });
  }

  assert.deepEqual(motorcycleWeekendRange(MONDAY), {
    friday: "2026-09-11",
    sunday: "2026-09-13",
  });
});

test("incluye viernes y domingo actuales sin adelantar el fin de semana siguiente", () => {
  assert.equal(matchesMotorcycleWeekendOpportunity(event("friday", {
    start: "2026-09-04",
    end: "2026-09-04",
  }), FRIDAY), true, "FRIDAY_ONLY_ON_FRIDAY");
  assert.equal(matchesMotorcycleWeekendOpportunity(event("sunday", {
    start: "2026-09-06",
    end: "2026-09-06",
  }), SUNDAY_MORNING), true, "SUNDAY_ONLY_ON_SUNDAY");
  assert.equal(matchesMotorcycleWeekendOpportunity(event("next-saturday", {
    start: "2026-09-12",
    end: "2026-09-12",
  }), SUNDAY_MORNING), false, "NEXT_SATURDAY_ON_SUNDAY");
});

test("aplica intersección de intervalos a eventos multiday", () => {
  const cases: Array<[string, string, string, boolean]> = [
    ["thursday-friday", "2026-09-03", "2026-09-04", true],
    ["friday-only", "2026-09-04", "2026-09-04", true],
    ["friday-saturday", "2026-09-04", "2026-09-05", true],
    ["saturday-only", "2026-09-05", "2026-09-05", true],
    ["saturday-sunday", "2026-09-05", "2026-09-06", true],
    ["sunday-only", "2026-09-06", "2026-09-06", true],
    ["thursday-only", "2026-09-03", "2026-09-03", false],
    ["following-monday", "2026-09-07", "2026-09-07", false],
  ];

  for (const [id, start, end, expected] of cases) {
    assert.equal(
      matchesMotorcycleWeekendOpportunity(event(id, { start, end }), THURSDAY),
      expected,
      id,
    );
  }
});

test("acepta planes moteros inmediatos y excluye coches, competición, cancelados y ocultos", () => {
  const positives = [
    event("gathering"),
    event("motoalmuerzo", { title: "Motoalmuerzo de prueba" }),
    event("meetup", { title: "Quedada motera de prueba" }),
    event("route", {
      title: "Ruta en moto por la sierra",
      championship: "Ruta recreativa",
      discipline: "Rutas",
      tags: ["moto", "ruta"],
    }),
    event("custom", {
      title: "Custom Meeting Biker",
      championship: "Encuentro custom",
      tags: ["moto", "custom", "biker"],
    }),
  ];
  const negatives = [
    event("espinosa-cars", {
      title: "Concentración de Coches Clásicos Espinosa de los Monteros",
      championship: "Clásicos",
      discipline: "Clásicos",
      vehicleType: "coche",
      vehicle_type: "coche",
      tags: ["coche", "concentracion", "clasicos"],
    }),
    event("car-fair", {
      title: "Feria de coches",
      championship: "Feria del automóvil",
      discipline: "Ferias",
      vehicleType: "coche",
      vehicle_type: "coche",
      tags: ["coche", "feria"],
    }),
    event("rally", {
      title: "Rally competitivo de motos",
      championship: "Campeonato de Rally Raid",
      discipline: "Rally Raid",
      tags: ["moto", "rally raid"],
    }),
    event("motogp", {
      title: "MotoGP de prueba",
      championship: "MotoGP",
      discipline: "Velocidad",
      tags: ["moto", "motogp"],
    }),
    event("motocross", {
      title: "Campeonato de Motocross",
      championship: "Motocross",
      discipline: "Motocross",
      tags: ["moto", "motocross"],
    }),
    event("trackday", {
      title: "Trackday de motos",
      championship: "Tandas libres",
      discipline: "Tandas",
      tags: ["moto", "trackday", "tandas"],
    }),
    event("cancelled", { eventStatus: "cancelled" }),
    event("hidden", { visible: false }),
  ];

  for (const item of positives) {
    assert.equal(matchesMotorcycleWeekendOpportunity(item, THURSDAY), true, item.id);
  }
  for (const item of negatives) {
    assert.equal(matchesMotorcycleWeekendOpportunity(item, THURSDAY), false, item.id);
  }
});

test("la opportunity page utiliza el wrapper compartido", () => {
  const page = getOpportunityPage("concentraciones-moteras-este-fin-de-semana");
  assert.ok(page);
  assert.equal(page.filter(event("friday", {
    start: "2026-09-04",
    end: "2026-09-04",
  }), FRIDAY), true);
  assert.equal(page.filter(event("cars", {
    title: "Concentración de coches clásicos",
    discipline: "Clásicos",
    vehicleType: "coche",
    vehicle_type: "coche",
    tags: ["coche", "concentracion"],
  }), FRIDAY), false);
});
