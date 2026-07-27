import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  assertRegionalLandingModelTerritorial,
  buildRegionalInventoryFixture,
  buildRegionalLandingModel,
  buildRegionalNoUpcomingFixture,
  buildRegionalPreviewMetadata,
  eventBelongsToRegionalLanding,
  filterRegionalLandingEvents,
  isRegionalPreviewAvailable,
  parseRegionalLandingQuery,
  regionalEventBadges,
  regionalEventDateAriaLabel,
  regionalEventDateLabel,
  regionalFinderMode,
  regionalFixtureId,
  regionalFixtureNow,
  sortRegionalUpcomingEvents,
} from "./regional-landing-model";

const now = new Date("2026-07-27T12:00:00");

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event",
    slug: "event",
    title: "Evento de prueba",
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

function numberedEvents(
  count: number,
  prefix: string,
  overrides: Partial<EventItem> = {},
) {
  return Array.from({ length: count }, (_, index) => eventFixture({
    id: `${prefix}-${index}`,
    slug: `${prefix}-${index}`,
    title: `Evento ${prefix} ${index}`,
    ...overrides,
  }));
}

const sourceAliases: Record<string, string> = {
  "components/preview/regions/RegionalEventCard.tsx": "components/regions/RegionalEventCard.tsx",
  "components/preview/regions/RegionalFilterDisclosure.tsx": "components/regions/RegionalFilterDisclosure.tsx",
  "components/preview/regions/RegionalLandingPreview.module.css": "components/regions/RegionalLanding.module.css",
  "components/preview/regions/RegionalLandingPreview.tsx": "components/regions/RegionalLanding.tsx",
  "components/preview/regions/RegionalSaveButton.tsx": "components/regions/RegionalSaveButton.tsx",
};

function source(...files: string[]) {
  return files
    .map((file) => readFileSync(path.join(process.cwd(), sourceAliases[file] || file), "utf8"))
    .join("\n");
}

const regionalSourceFiles = [
  "app/preview/regiones/[region]/page.tsx",
  "components/preview/regions/RegionalLandingPreview.tsx",
  "components/preview/regions/RegionalFilterDisclosure.tsx",
  "components/preview/regions/RegionalEventCard.tsx",
  "components/preview/regions/regional-landing-model.ts",
];

test("separa el inventario territorial futuro e histórico sin inflar el hero", () => {
  const model = buildRegionalLandingModel([
    ...numberedEvents(88, "future"),
    ...numberedEvents(34, "past", { start: "2026-06-01", end: "2026-06-01" }),
  ], "cataluna", now);

  assert.equal(model.territorialTotal, 122);
  assert.equal(model.upcomingTotal, 88);
  assert.equal(model.pastEvents.length, 34);

  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  assert.doesNotMatch(component, /inventoryPill|upcomingCountLabel/);
  assert.match(component, /filteredTotal=\{filteredEvents\.length\}/);
  assert.match(component, /Aplicar filtros/);
  assert.doesNotMatch(component, /Ver \{countLabel\(filteredTotal\)\}/);
});

test("Cataluña y Madrid aíslan un fixture mixto por territorio", () => {
  const mixed = [
    eventFixture({ id: "cat", slug: "cat" }),
    eventFixture({
      id: "madrid",
      slug: "madrid",
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
    }),
    eventFixture({
      id: "toledo",
      slug: "toledo",
      city: "Toledo",
      province: "Toledo",
      region: "Castilla-La Mancha",
    }),
    eventFixture({
      id: "aragon",
      slug: "aragon",
      city: "Alcañiz",
      province: "Teruel",
      region: "Aragón",
    }),
  ];

  const cataluna = assertRegionalLandingModelTerritorial(
    buildRegionalLandingModel(mixed, "cataluna", now),
  );
  const madrid = assertRegionalLandingModelTerritorial(
    buildRegionalLandingModel(mixed, "madrid", now),
  );

  assert.deepEqual(cataluna.upcomingEvents.map((event) => event.slug), ["cat"]);
  assert.deepEqual(madrid.upcomingEvents.map((event) => event.slug), ["madrid"]);
  assert.equal(cataluna.upcomingTotal, 1);
  assert.equal(madrid.upcomingTotal, 1);
  assert.ok(cataluna.upcomingEvents.every((event) => eventBelongsToRegionalLanding(event, "cataluna")));
  assert.ok(madrid.upcomingEvents.every((event) => eventBelongsToRegionalLanding(event, "madrid")));
});

test("la aserción de desarrollo detecta cualquier evento renderizable externo", () => {
  const model = buildRegionalLandingModel([eventFixture()], "cataluna", now);
  const external = eventFixture({
    id: "madrid",
    slug: "madrid",
    city: "Madrid",
    province: "Madrid",
    region: "Madrid",
  });

  assert.throws(
    () => assertRegionalLandingModelTerritorial({
      ...model,
      upcomingEvents: [...model.upcomingEvents, external],
    }),
    /no pertenece a Cataluña/,
  );
});

test("excluye cancelados, invisibles y fechas no fiables", () => {
  const model = buildRegionalLandingModel([
    eventFixture({ id: "valid", slug: "valid" }),
    eventFixture({ id: "cancelled", slug: "cancelled", eventStatus: "cancelled" }),
    eventFixture({ id: "hidden", slug: "hidden", visible: false }),
    eventFixture({ id: "pending", slug: "pending", dataQuality: "pending_date" }),
  ], "cataluna", now);

  assert.deepEqual(model.upcomingEvents.map((event) => event.slug), ["valid"]);
});

test("mantiene estados fiables y deduplica badges", () => {
  const postponed = eventFixture({
    discipline: "Karting",
    vehicleType: "karting",
    vehicle_type: "karting",
    eventStatus: "postponed",
  });
  const model = buildRegionalLandingModel([postponed], "cataluna", now);

  assert.equal(model.upcomingTotal, 1);
  assert.deepEqual(regionalEventBadges(postponed), {
    informational: ["Karting"],
    status: "Aplazado",
  });
});

test("Cataluña puede tener fin de semana y Madrid conservar futuros sin él", () => {
  const cataluna = buildRegionalLandingModel([
    eventFixture({ start: "2026-08-01", end: "2026-08-01" }),
  ], "cataluna", now);
  const madrid = buildRegionalLandingModel([
    eventFixture({
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
      start: "2026-08-08",
      end: "2026-08-08",
    }),
  ], "madrid", now);

  assert.equal(cataluna.weekendEvents.length, 1);
  assert.equal(madrid.upcomingTotal, 1);
  assert.equal(madrid.weekendEvents.length, 0);
});

test("el estado sin próximos conserva únicamente historial regional", () => {
  const base = buildRegionalLandingModel([
    eventFixture({
      id: "past-madrid",
      slug: "past-madrid",
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
      start: "2026-06-01",
      end: "2026-06-01",
    }),
    eventFixture({
      id: "sevilla",
      slug: "sevilla",
      city: "Sevilla",
      province: "Sevilla",
      region: "Andalucía",
    }),
  ], "madrid", now);
  const empty = buildRegionalNoUpcomingFixture(base);

  assert.equal(empty.upcomingTotal, 0);
  assert.equal(empty.finderMode, "empty");
  assert.deepEqual(empty.upcomingEvents, []);
  assert.deepEqual(empty.weekendEvents, []);
  assert.deepEqual(empty.nextThirtyDaysEvents, []);
  assert.deepEqual(empty.pastEvents.map((event) => event.slug), ["past-madrid"]);
});

test("los fixtures cubren amplio, sin fin de semana, cero, uno, dos y aislamiento", () => {
  const model = buildRegionalLandingModel(numberedEvents(12, "regional"), "cataluna", now);

  assert.equal(buildRegionalInventoryFixture(model, "cataluna-amplia").upcomingTotal, 12);
  assert.equal(buildRegionalInventoryFixture(model, "madrid-sin-finde").weekendEvents.length, 0);
  assert.equal(buildRegionalInventoryFixture(model, "madrid-sin-futuros").upcomingTotal, 0);
  assert.equal(buildRegionalInventoryFixture(model, "un-evento").upcomingTotal, 1);
  assert.equal(buildRegionalInventoryFixture(model, "dos-eventos").upcomingTotal, 2);
  assert.equal(regionalFixtureId({ fixture: "aislamiento-territorial" }), "aislamiento-territorial");
  assert.equal(regionalFixtureId({ fixture: "sin-futuros" }), "madrid-sin-futuros");
  assert.equal(regionalFixtureId({ fixture: "desconocido" }), null);
  assert.equal(regionalFixtureNow("un-evento", now).getFullYear(), 2026);
  assert.equal(regionalFixtureNow("madrid-sin-futuros", now).getMonth(), 6);
  assert.equal(regionalFixtureNow(null, now), now);

  const fixtureSources = source(
    "app/preview/regiones/[region]/page.tsx",
    "components/preview/regions/regional-landing-model.ts",
  );
  for (const fixture of [
    "cataluna-amplia",
    "madrid-sin-finde",
    "madrid-sin-futuros",
    "un-evento",
    "dos-eventos",
    "aislamiento-territorial",
  ]) {
    assert.match(fixtureSources, new RegExp(fixture));
  }
  assert.match(fixtureSources, /assertRegionalLandingModelTerritorial/);
});

test("finderMode y los estados uno/dos respetan sus límites", () => {
  assert.equal(regionalFinderMode(10), "full");
  assert.equal(regionalFinderMode(9), "compact");
  assert.equal(regionalFinderMode(3), "compact");
  assert.equal(regionalFinderMode(2), "hidden");
  assert.equal(regionalFinderMode(1), "hidden");
  assert.equal(regionalFinderMode(0), "empty");

  for (const count of [1, 2]) {
    const model = buildRegionalLandingModel(numberedEvents(count, `small-${count}`), "cataluna", now);
    assert.equal(model.finderMode, "hidden");
    assert.equal(filterRegionalLandingEvents(model, parseRegionalLandingQuery({})).length, count);
  }
});

test("los accesos regionales se derivan solo de opciones con resultados", () => {
  const model = buildRegionalLandingModel([
    eventFixture({ id: "barcelona", slug: "barcelona" }),
    eventFixture({
      id: "girona",
      slug: "girona",
      city: "Girona",
      province: "Girona",
      discipline: "Karting",
    }),
  ], "cataluna", now);

  assert.deepEqual(model.provinceCounts.map(({ label, count }) => ({ label, count })), [
    { label: "Barcelona", count: 1 },
    { label: "Girona", count: 1 },
  ]);
  assert.ok(model.provinceCounts.every((item) => item.count > 0));
  assert.ok(model.disciplineCounts.every((item) => item.count > 0));
});

test("los filtros SSR incluyen una segunda defensa territorial", () => {
  const model = buildRegionalLandingModel([eventFixture()], "cataluna", now);
  const madrid = eventFixture({
    id: "madrid",
    slug: "madrid",
    city: "Madrid",
    province: "Madrid",
    region: "Madrid",
  });
  const tampered = {
    ...model,
    upcomingEvents: [...model.upcomingEvents, madrid],
  };

  assert.deepEqual(
    filterRegionalLandingEvents(tampered, parseRegionalLandingQuery({})).map((event) => event.slug),
    ["event"],
  );
  assert.deepEqual(parseRegionalLandingQuery({
    discipline: "Clásicos",
    province: "Lleida",
    q: "Circuit",
    show: "all",
    vehicle: "Coche",
    when: "weekend",
  }), {
    discipline: "clasicos",
    province: "lleida",
    query: "Circuit",
    showAll: true,
    vehicle: "coche",
    when: "weekend",
  });
});

test("ordena eventos en curso primero y después por fecha", () => {
  const sorted = sortRegionalUpcomingEvents([
    eventFixture({ id: "later", slug: "later", start: "2026-08-03", end: "2026-08-03" }),
    eventFixture({ id: "ongoing", slug: "ongoing", start: "2026-07-26", end: "2026-07-28" }),
    eventFixture({ id: "next", slug: "next", start: "2026-08-01", end: "2026-08-01" }),
  ], now);

  assert.deepEqual(sorted.map((event) => event.slug), ["ongoing", "next", "later"]);
});

test("formatea un día y un rango del mismo mes con abreviaturas españolas", () => {
  assert.deepEqual(regionalEventDateLabel(eventFixture({
    start: "2026-08-01",
    end: "2026-08-01",
  })), {
    lines: [{ day: "1", month: "AGO" }],
    splitRange: false,
  });
  assert.deepEqual(regionalEventDateLabel(eventFixture({
    start: "2026-09-19",
    end: "2026-09-20",
  })), {
    lines: [{ day: "19–20", month: "SEP" }],
    splitRange: false,
  });
});

test("formatea rangos entre meses y años en dos líneas inequívocas", () => {
  assert.deepEqual(regionalEventDateLabel(eventFixture({
    start: "2026-02-28",
    end: "2026-03-01",
  })), {
    lines: [
      { day: "28", month: "FEB" },
      { day: "1", month: "MAR" },
    ],
    splitRange: true,
  });
  assert.deepEqual(regionalEventDateLabel(eventFixture({
    start: "2026-12-31",
    end: "2027-01-01",
  })), {
    lines: [
      { day: "31", month: "DIC" },
      { day: "1", month: "ENE" },
    ],
    splitRange: true,
  });
});

test("Madrid vacío presenta el estado compacto exacto y acciones requeridas", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const css = source("components/preview/regions/RegionalLandingPreview.module.css");
  const modelSource = source("lib/regions/regional-landing-model.ts");

  assert.match(modelSource, /eyebrow: "Agenda en actualización"/);
  assert.match(modelSource, /title: "Agenda de Madrid en actualización"/);
  assert.match(modelSource, /Ahora mismo no hay próximas fechas confirmadas\. Actualizamos la agenda cuando organizadores, clubes y circuitos publican nuevos eventos\./);
  assert.match(component, /model\.config\.emptyState\.eyebrow/);
  assert.match(component, /model\.config\.emptyState\.title/);
  assert.match(component, /model\.config\.emptyState\.description/);
  assert.match(component, /Publicar un evento en \{model\.config\.name\}/);
  assert.match(component, /Ver calendario nacional/);
  assert.match(component, /href=\{PUBLIC_NAVIGATION\.publish\}/);
  assert.match(component, /href=\{PUBLIC_NAVIGATION\.calendar\}/);
  assert.match(css, /\.emptyPrimaryLink\s*\{[\s\S]*min-height:\s*48px[\s\S]*background:\s*#ff5416/);
  assert.match(css, /\.emptySecondaryLink\s*\{/);
  assert.doesNotMatch(component, />0 eventos</);
});

test("uno y dos eventos mantienen jerarquía, sin finder ni recomendaciones", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const css = source("components/preview/regions/RegionalLandingPreview.module.css");

  assert.match(component, /model\.upcomingTotal === 1[\s\S]*`Próximo evento en \$\{model\.config\.name\}`/);
  assert.match(component, /`Próximos eventos en \$\{model\.config\.name\}`/);
  assert.match(component, /model\.upcomingTotal === 1 \? styles\.singleEventGrid/);
  assert.match(component, /model\.upcomingTotal === 1[\s\S]*styles\.singleEventContainer/);
  assert.match(component, /model\.upcomingTotal === 2[\s\S]*styles\.twoEventContainer/);
  assert.match(css, /\.singleEventContainer\s*\{[\s\S]*max-width:\s*900px/);
  assert.match(css, /\.twoEventContainer\s*\{[\s\S]*max-width:\s*1100px/);
  assert.match(css, /\.eventGrid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(component, /Más planes cerca|También puede interesarte|RegionalAlternatives/);
});

test("no quedan campos, lógica ni etiquetas de alternativas externas", () => {
  const sources = source(...regionalSourceFiles);

  assert.doesNotMatch(
    sources,
    /alternativeEvents|fallbackNationalEvents|originLabel|selectRegionalAlternativeEvents|Agenda cerca de ti|Agenda nacional|Cerca de (Cataluña|Madrid)|También puede interesarte/,
  );
  assert.doesNotMatch(sources, /classifyEventMacroZone|MacroZoneId/);
});

test("el finder móvil está plegado y abre un panel completo sin overflow", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const css = source("components/preview/regions/RegionalLandingPreview.module.css");
  const disclosure = source("components/preview/regions/RegionalFilterDisclosure.tsx");

  assert.match(disclosure, /useState\(false\)/);
  assert.match(disclosure, /aria-expanded=\{expanded\}/);
  assert.match(disclosure, /setExpanded\(\(current\) => \{[\s\S]*return !current/);
  assert.match(disclosure, /Filtrar/);
  assert.match(disclosure, /<strong>\{totalLabel\}<\/strong>/);
  assert.match(disclosure, /sortLabel.*Ordenados por fecha/);
  assert.match(component, /\{showSearch \? \([\s\S]*\{showProvince \? \([\s\S]*<span>Cuándo<\/span>[\s\S]*styles\.applyFilters/);
  assert.match(component, /styles\.filterFooter[\s\S]*styles\.applyFilters[\s\S]*styles\.resetFilters/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.filterFooter\s*\{[\s\S]*order:\s*2/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.applyFilters\s*\{[\s\S]*order:\s*3/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.resetFilters\s*\{[\s\S]*order:\s*4/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.sortLabel\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.filterSummary\s*\{[\s\S]*min-height:\s*56px/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.filterPanel\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.filterPanelOpen\s*\{[\s\S]*display:\s*block/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.finderControls\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.finderField input,[\s\S]*font-size:\s*16px/);
});

test("el layout conserva límites, cuadrícula responsive y ausencia de overflow global", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const css = source("components/preview/regions/RegionalLandingPreview.module.css");

  assert.match(component, /index >= REGIONAL_MOBILE_LIMIT/);
  assert.match(component, /filteredEvents\.slice\(0, REGIONAL_DESKTOP_LIMIT\)/);
  assert.match(component, /show:\s*"all"/);
  assert.match(css, /\.eventCard\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /\.eventGrid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.eventGrid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /overflow-x:\s*clip/);
});

test("el breadcrumb usa Inicio / Zonas / región y la tarjeta mantiene accesibilidad", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const card = source("components/preview/regions/RegionalEventCard.tsx");
  const saveButton = source("components/preview/regions/RegionalSaveButton.tsx");

  assert.match(component, /<li><Link href="\/">Inicio<\/Link><\/li>/);
  assert.match(component, /<li><Link href="\/zonas">Zonas<\/Link><\/li>/);
  assert.doesNotMatch(card, /next\/image|getEventImage|originLabel|originBadge/);
  assert.match(card, /aria-label=\{regionalEventDateAriaLabel\(event\)\}/);
  assert.match(card, /date\.lines\.map/);
  assert.match(saveButton, /aria-label=\{saved \?/);
  assert.match(saveButton, /aria-pressed=\{saved\}/);
  assert.match(regionalEventDateAriaLabel(eventFixture()), /8 de agosto de 2026/);
});

test("el finder compacto usa elecciones reales y conserva GET SSR", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const css = source("components/preview/regions/RegionalLandingPreview.module.css");

  assert.match(component, /model\.finderMode === "full" \|\| model\.finderMode === "compact"/);
  assert.match(component, /const showSearch = isFull/);
  assert.match(component, /model\.provinceCounts\.length > 1/);
  assert.match(component, /model\.disciplineCounts\.length > 1/);
  assert.match(component, /model\.vehicleCounts\.length > 1/);
  assert.match(component, /method="get"/);
  assert.match(component, /aria-label="Filtrar eventos"/);
  assert.match(component, /Aplicar filtros/);
  assert.match(component, /Restablecer/);
  assert.match(component, /model\.weekendEvents\.length > 0/);
  assert.match(component, /model\.nextThirtyDaysEvents\.length !== model\.upcomingTotal/);
  assert.match(component, /\{showDiscipline \|\| showVehicle \? \([\s\S]*<details className=\{styles\.moreFilters\}/);
  assert.match(css, /\.finderPanel\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(css, /\.page \.applyFilters\s*\{[\s\S]*height:\s*46px[\s\S]*min-height:\s*46px/);
  assert.doesNotMatch(component, /Encuentra un evento|Agenda a tu medida|Ver \{countLabel\(filteredTotal\)\}/);
  assert.match(css, /\.finderPanel\s*\{[\s\S]*padding:\s*5px[\s\S]*border-radius:\s*16px/);
});

test("el total se presenta una sola vez por finderMode antes de las tarjetas", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const disclosure = source("components/preview/regions/RegionalFilterDisclosure.tsx");

  assert.match(component, /totalLabel=\{countLabel\(filteredTotal\)\}/);
  assert.equal((disclosure.match(/\{totalLabel\}/g) || []).length, 1);
  assert.match(disclosure, /· Ordenados por fecha/);
  assert.match(component, /model\.finderMode === "hidden" && model\.upcomingTotal > 1/);
  assert.doesNotMatch(component, /inventoryPill|upcomingCountLabel|Ver \{countLabel\(filteredTotal\)\}/);
});

test("la guía usa copy natural, details móviles y solo grupos con datos", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const css = source("components/preview/regions/RegionalLandingPreview.module.css");

  assert.match(component, /Guía de motor en \{model\.config\.name\}/);
  assert.match(component, /Provincias, disciplinas, circuitos y recursos para descubrir la agenda de motor de la región\./);
  assert.doesNotMatch(component, /Motor, territorio y próximos planes/);
  for (const group of ["Provincias", "Disciplinas", "Recintos"]) {
    assert.match(component, new RegExp(`<summary>${group}`));
  }
  assert.match(component, /model\.provinceCounts\.length > 0/);
  assert.match(component, /model\.disciplineCounts\.length > 0/);
  assert.match(component, /venueHighlights\.length > 0/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.guideGroups\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});

test("el histórico resuelve singular y plural y permanece plegado", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");

  assert.match(component, /model\.pastEvents\.length === 1 \? "evento celebrado" : "eventos celebrados"/);
  assert.doesNotMatch(component, /<(?:details|RegionalTrackedDetails)[^>]*open[^>]*className=\{styles\.historyDetails\}/);
  assert.doesNotMatch(component, /Ver \{model\.pastEvents\.length\} eventos celebrados/);
  assert.ok(component.indexOf("<RegionalHistory model={model} />") < component.indexOf("styles.editorialSection"));
});

test("la preview es noindex, sin canonical, sitemap ni navegación pública", () => {
  assert.equal(isRegionalPreviewAvailable("production"), false);
  assert.equal(isRegionalPreviewAvailable("preview"), true);

  const metadata = buildRegionalPreviewMetadata("cataluna");
  assert.deepEqual(metadata.robots, {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  });
  assert.equal(metadata.alternates, undefined);

  assert.doesNotMatch(source("app/sitemap.ts"), /preview\/regiones/);
  assert.doesNotMatch(source(
    "components/public/concept/ConceptHeader.tsx",
    "components/public/concept/ConceptStaticHeader.tsx",
    "components/public/concept/ConceptFooter.tsx",
    "lib/public-navigation.ts",
  ), /preview\/regiones/);
});

test("las landings públicas conservan metadata, canonical y JSON-LD", () => {
  const catalunaRoute = source("app/eventos-motor-cataluna/page.tsx");
  const madridRoute = source("app/eventos-motor-madrid/page.tsx");
  const publicComponent = source("components/public/seo/OpportunityPage.tsx");
  const opportunityModel = source("lib/opportunity-pages.ts");

  for (const route of [catalunaRoute, madridRoute]) {
    assert.match(route, /buildOpportunityMetadata\(page\)/);
    assert.match(route, /<PublicRegionalLanding/);
    assert.doesNotMatch(route, /RegionalLandingPreview/);
  }
  assert.match(opportunityModel, /alternates:\s*\{[\s\S]*canonical: url/);
  const pilotComponent = source("components/regions/PublicRegionalLanding.tsx");
  assert.match(pilotComponent, /breadcrumbJsonLd\(page\)/);
  assert.match(pilotComponent, /collectionPageJsonLd\(page\)/);
  assert.match(pilotComponent, /itemListJsonLd\(page, model\)/);
  assert.match(publicComponent, /export default async function OpportunityPage/);
});

test("las rutas regionales son de solo lectura y no escriben en Supabase", () => {
  const sources = source(
    "app/preview/regiones/[region]/page.tsx",
    "components/preview/regions/regional-landing-model.ts",
    "components/preview/regions/RegionalLandingPreview.tsx",
  );

  assert.match(sources, /getVisibleEvents/);
  assert.doesNotMatch(sources, /\.from\(["']events["']\)\s*\.(insert|update|delete|upsert)/i);
  assert.doesNotMatch(sources, /\.(insert|update|delete|upsert|rpc)\s*\(/i);
});

test("la jerarquía y los controles conservan accesibilidad básica", () => {
  const component = source("components/preview/regions/RegionalLandingPreview.tsx");
  const css = source("components/preview/regions/RegionalLandingPreview.module.css");

  assert.match(component, /<h1>/);
  assert.match(component, /<h2>/);
  assert.match(component, /<h3/);
  assert.match(component, /aria-label="Filtrar eventos"/);
  assert.match(component, /aria-current=/);
  assert.match(source("components/preview/regions/RegionalFilterDisclosure.tsx"), /aria-expanded=\{expanded\}/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.saveButton\s*\{[\s\S]*min-height:\s*44px/);
});
