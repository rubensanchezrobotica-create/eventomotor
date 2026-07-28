import assert from "node:assert/strict";
import test from "node:test";
import {
  REGIONAL_CONFIGS,
  REGIONAL_REGION_IDS,
  type RegionalRegionId,
} from "@/lib/regions/regional-config";
import {
  buildRegionalLandingModel,
  eventBelongsToRegionalLanding,
} from "@/lib/regions/regional-landing-model";
import type { EventItem } from "@/types/event";

const now = new Date("2026-07-28T12:00:00");

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event",
    slug: "event",
    title: "Evento territorial",
    championship: "",
    discipline: "Rally",
    start: "2026-08-08",
    end: "2026-08-08",
    venue: "",
    city: "Por confirmar",
    province: "Por confirmar",
    region: "Por confirmar",
    level: "Regional",
    source: "Fixture",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    vehicleType: "coche",
    vehicle_type: "coche",
    featured: false,
    visible: true,
    eventStatus: "confirmed",
    ...overrides,
  };
}

function eventForRegion(id: RegionalRegionId, suffix: string) {
  const config = REGIONAL_CONFIGS[id];
  return eventFixture({
    id: `${id}-${suffix}`,
    slug: `${id}-${suffix}`,
    province: config.provinces[0],
    region: config.aliases[0],
  });
}

test("cada región incluye provincias y aliases oficiales y excluye las demás", () => {
  for (const id of REGIONAL_REGION_IDS) {
    const config = REGIONAL_CONFIGS[id];
    for (const province of config.provinces) {
      assert.equal(
        eventBelongsToRegionalLanding(eventFixture({ province }), id),
        true,
        `${id} debe incluir ${province}`,
      );
    }
    for (const alias of config.aliases) {
      assert.equal(
        eventBelongsToRegionalLanding(eventFixture({ region: alias }), id),
        true,
        `${id} debe incluir ${alias}`,
      );
    }

    const foreignId = REGIONAL_REGION_IDS.find((candidate) => candidate !== id);
    assert.ok(foreignId);
    assert.equal(eventBelongsToRegionalLanding(eventForRegion(foreignId, "foreign"), id), false);
  }
});

test("la matriz territorial mixta entrega cada evento a una sola comunidad", () => {
  const events = REGIONAL_REGION_IDS.map((id) => eventForRegion(id, "matrix"));
  for (const id of REGIONAL_REGION_IDS) {
    const matches = events.filter((event) => eventBelongsToRegionalLanding(event, id));
    assert.deepEqual(matches.map((event) => event.id), [`${id}-matrix`]);
  }
});

test("una ciudad homónima no vence a una región o provincia estructurada ajena", () => {
  const madridFuera = eventFixture({
    city: "Madrid",
    province: "Toledo",
    region: "Castilla-La Mancha",
  });
  assert.equal(eventBelongsToRegionalLanding(madridFuera, "madrid"), false);
  assert.equal(eventBelongsToRegionalLanding(madridFuera, "castillaLaMancha"), true);

  const murciaFuera = eventFixture({
    city: "Murcia",
    province: "Albacete",
    region: "Castilla-La Mancha",
  });
  assert.equal(eventBelongsToRegionalLanding(murciaFuera, "murcia"), false);
  assert.equal(eventBelongsToRegionalLanding(murciaFuera, "castillaLaMancha"), true);
});

test("cada modelo excluye cancelados y pending_date, separa históricos y deduplica", () => {
  for (const id of REGIONAL_REGION_IDS) {
    const base = eventForRegion(id, "future");
    const model = buildRegionalLandingModel([
      base,
      { ...base, id: `${id}-duplicate` },
      eventForRegion(id, "postponed"),
      eventForRegion(id, "cancelled"),
      eventForRegion(id, "pending"),
      eventForRegion(id, "past"),
    ].map((event) => {
      if (event.id.endsWith("-postponed")) return { ...event, eventStatus: "postponed" };
      if (event.id.endsWith("-cancelled")) return { ...event, eventStatus: "cancelled" };
      if (event.id.endsWith("-pending")) return { ...event, dataQuality: "pending_date" };
      if (event.id.endsWith("-past")) return { ...event, start: "2026-06-01", end: "2026-06-01" };
      return event;
    }), id, now);

    assert.deepEqual(
      model.upcomingEvents.map((event) => event.slug),
      [`${id}-future`, `${id}-postponed`],
    );
    assert.deepEqual(model.pastEvents.map((event) => event.slug), [`${id}-past`]);
    assert.equal(model.territorialTotal, 3);
  }
});

test("la ordenación cronológica y los conteos permanecen exactos por región", () => {
  for (const id of REGIONAL_REGION_IDS) {
    const events = [
      { ...eventForRegion(id, "late"), start: "2026-09-01", end: "2026-09-01" },
      { ...eventForRegion(id, "early"), start: "2026-08-01", end: "2026-08-01" },
      { ...eventForRegion(id, "middle"), start: "2026-08-15", end: "2026-08-15" },
    ];
    const model = buildRegionalLandingModel(events, id, now);
    assert.deepEqual(
      model.upcomingEvents.map((event) => event.slug),
      [`${id}-early`, `${id}-middle`, `${id}-late`],
    );
    assert.equal(model.upcomingTotal, 3);
    assert.equal(model.finderMode, "compact");
  }
});
