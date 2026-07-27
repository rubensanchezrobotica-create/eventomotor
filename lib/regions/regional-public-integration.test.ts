import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";
import {
  buildRegionalLandingModel,
  eventBelongsToRegionalLanding,
  filterRegionalLandingEvents,
  parseRegionalLandingQuery,
  regionalFinderMode,
} from "@/lib/regions/regional-landing-model";
import type { EventItem } from "@/types/event";

const now = new Date("2026-07-27T12:00:00");

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event",
    slug: "event",
    title: "Evento regional",
    championship: "Campeonato",
    discipline: "Rally",
    start: "2026-08-08",
    end: "2026-08-08",
    venue: "Recinto",
    city: "Barcelona",
    province: "Barcelona",
    region: "Cataluña",
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

test("la configuración neutral preserva metadata y canonical públicos", () => {
  for (const [id, slug] of [
    ["cataluna", "eventos-motor-cataluna"],
    ["madrid", "eventos-motor-madrid"],
  ] as const) {
    const model = buildRegionalLandingModel([], id, now);
    const page = getOpportunityPage(slug);
    assert.ok(page);
    assert.equal(model.config.publicMetadata.title, page.title);
    assert.equal(model.config.publicMetadata.description, page.description);
    assert.equal(model.config.publicMetadata.canonical, `/${page.slug}`);
    assert.equal(buildOpportunityMetadata(page).alternates?.canonical, `https://www.eventomotor.com/${page.slug}`);
  }
});

test("los aliases válidos no permiten contaminación territorial", () => {
  const catalunaAliases = [
    eventFixture({ id: "cat", slug: "cat", region: "Catalunya" }),
    eventFixture({ id: "lleida", slug: "lleida", province: "Lérida", region: "Por confirmar" }),
  ];
  const madridAliases = [
    eventFixture({
      id: "madrid",
      slug: "madrid",
      city: "San Sebastián de los Reyes",
      province: "Madrid",
      region: "Comunidad de Madrid",
    }),
  ];
  const external = eventFixture({
    id: "toledo",
    slug: "toledo",
    city: "Toledo",
    province: "Toledo",
    region: "Castilla-La Mancha",
  });

  assert.ok(catalunaAliases.every((event) => eventBelongsToRegionalLanding(event, "cataluna")));
  assert.ok(madridAliases.every((event) => eventBelongsToRegionalLanding(event, "madrid")));
  assert.equal(eventBelongsToRegionalLanding(external, "madrid"), false);
});

test("deduplica, separa históricos y conserva aplazados futuros fiables", () => {
  const future = eventFixture({ id: "future", slug: "same", eventStatus: "postponed" });
  const duplicate = eventFixture({ id: "duplicate", slug: "same" });
  const past = eventFixture({
    id: "past",
    slug: "past",
    start: "2026-06-01",
    end: "2026-06-01",
  });
  const pending = eventFixture({ id: "pending", slug: "pending", dataQuality: "pending_date" });
  const cancelled = eventFixture({ id: "cancelled", slug: "cancelled", eventStatus: "cancelled" });
  const model = buildRegionalLandingModel(
    [future, duplicate, past, pending, cancelled],
    "cataluna",
    now,
  );

  assert.deepEqual(model.upcomingEvents.map((event) => event.slug), ["same"]);
  assert.deepEqual(model.pastEvents.map((event) => event.slug), ["past"]);
  assert.equal(model.upcomingEvents[0]?.eventStatus, "postponed");
});

test("finderMode cubre 0, 1, 2, 3-9 y 10 o más", () => {
  assert.equal(regionalFinderMode(0), "empty");
  assert.equal(regionalFinderMode(1), "hidden");
  assert.equal(regionalFinderMode(2), "hidden");
  assert.equal(regionalFinderMode(3), "compact");
  assert.equal(regionalFinderMode(9), "compact");
  assert.equal(regionalFinderMode(10), "full");
});

test("los filtros SSR ignoran parámetros desconocidos y nunca añaden fallback", () => {
  const model = buildRegionalLandingModel([
    eventFixture(),
    eventFixture({
      id: "madrid",
      slug: "madrid",
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
    }),
  ], "cataluna", now);
  const query = parseRegionalLandingQuery({
    fixture: "madrid-sin-futuros",
    province: "Barcelona",
    unknown: "value",
  });

  assert.equal(query.province, "barcelona");
  assert.equal((query as Record<string, unknown>).fixture, undefined);
  assert.deepEqual(filterRegionalLandingEvents(model, query).map((event) => event.slug), ["event"]);
  const disclosure = source("components/regions/RegionalFilterDisclosure.tsx");
  assert.match(disclosure, /!field\.value \|\| \(field\.name === "when" && field\.value === "upcoming"\)/);
  assert.match(disclosure, /field\.disabled = true/);
});

test("producción usa solo capas neutrales y no admite fixtures ni preview", () => {
  const production = [
    source("app/eventos-motor-cataluna/page.tsx"),
    source("app/eventos-motor-madrid/page.tsx"),
    source("components/regions/PublicRegionalLanding.tsx"),
    source("components/regions/RegionalLanding.tsx"),
    source("lib/regions/regional-landing-model.ts"),
  ].join("\n");

  assert.doesNotMatch(production, /@\/components\/preview|\/preview\//);
  assert.doesNotMatch(production, /fixture|madrid-sin-futuros|cataluna-amplia/);
  assert.doesNotMatch(production, /noindex|nofollow/);
  assert.doesNotMatch(production, /\.(insert|update|delete|upsert|rpc)\s*\(/i);
});

test("las rutas piloto mantienen metadata y montan el adaptador público explícito", () => {
  const routes = [
    source("app/eventos-motor-cataluna/page.tsx"),
    source("app/eventos-motor-madrid/page.tsx"),
  ];
  for (const route of routes) {
    assert.match(route, /buildOpportunityMetadata\(page\)/);
    assert.match(route, /<PublicRegionalLanding/);
    assert.match(route, /searchParams=\{searchParams\}/);
  }
});

test("JSON-LD público conserva CollectionPage, BreadcrumbList, FAQPage e ItemList", () => {
  const component = source("components/regions/PublicRegionalLanding.tsx");
  for (const schema of ["CollectionPage", "BreadcrumbList", "FAQPage", "ItemList"]) {
    assert.match(component, new RegExp(`"@type": "${schema}"`));
  }
  assert.match(component, /\$\{SITE_URL\}\/evento\/\$\{event\.slug \|\| event\.id\}/);
  assert.match(component, /model\.upcomingEvents\.slice\(0, 20\)/);
});

test("sitemap y robots mantienen indexables las dos URLs", () => {
  const sitemap = source("app/sitemap.ts");
  const robots = source("app/robots.ts");
  const pages = ["eventos-motor-cataluna", "eventos-motor-madrid"]
    .map((slug) => getOpportunityPage(slug));

  assert.ok(pages.every(Boolean));
  assert.match(sitemap, /OPPORTUNITY_PAGES\.map/);
  assert.doesNotMatch(robots, /eventos-motor-(?:cataluna|madrid)/);
});

test("tres regiones no piloto continúan usando OpportunityPage", () => {
  for (const route of [
    "app/eventos-motor-andalucia/page.tsx",
    "app/eventos-motor-comunidad-valenciana/page.tsx",
    "app/eventos-motor-galicia/page.tsx",
  ]) {
    const routeSource = source(route);
    assert.match(routeSource, /OpportunityPage/);
    assert.doesNotMatch(routeSource, /PublicRegionalLanding/);
  }
});

test("la analítica regional cubre vista, filtros, evento, guardado, publicación, calendario e histórico", () => {
  const analyticsSources = [
    source("components/regions/RegionalLanding.tsx"),
    source("components/regions/RegionalLandingAnalytics.tsx"),
    source("components/regions/RegionalFilterDisclosure.tsx"),
    source("components/regions/RegionalTrackedDetails.tsx"),
    source("components/regions/RegionalEventCard.tsx"),
    source("components/regions/RegionalSaveButton.tsx"),
  ].join("\n");

  for (const eventName of [
    "view_region_landing",
    "toggle_region_filters",
    "filter_region",
    "click_event_detail",
    "save_event",
    "click_publish_event",
    "click_region_calendar",
    "open_region_history",
  ]) {
    assert.match(analyticsSources, new RegExp(eventName));
  }
  assert.doesNotMatch(source("components/regions/RegionalFilterDisclosure.tsx"), /query\.query|search_text/);
});
