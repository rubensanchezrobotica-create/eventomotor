import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildRegionalInventoryFixture,
  buildRegionalLandingModel,
  buildRegionalNoUpcomingFixture,
  buildRegionalPreviewMetadata,
  filterRegionalLandingEvents,
  isRegionalPreviewAvailable,
  parseRegionalLandingQuery,
  regionalEventBadges,
  regionalEventDateAriaLabel,
  regionalFixtureId,
  regionalFixtureNow,
  regionalFinderMode,
  selectRegionalAlternativeEvents,
  sortRegionalUpcomingEvents,
} from "./regional-landing-model";

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

const now = new Date("2026-07-27T12:00:00");

function numberedEvents(
  count: number,
  prefix: string,
  overrides: Partial<EventItem>,
) {
  return Array.from({ length: count }, (_, index) => eventFixture({
    id: `${prefix}-${index}`,
    slug: `${prefix}-${index}`,
    title: `Evento ${prefix} ${index}`,
    ...overrides,
  }));
}

test("separa 122 territoriales en 88 próximos y 34 históricos sin inflar el hero", () => {
  const data = buildRegionalLandingModel([
    ...numberedEvents(88, "future", { start: "2026-08-08", end: "2026-08-08" }),
    ...numberedEvents(34, "past", { start: "2026-06-01", end: "2026-06-01" }),
  ], "cataluna", now);

  assert.equal(data.territorialTotal, 122);
  assert.equal(data.upcomingTotal, 88);
  assert.equal(data.upcomingEvents.length, 88);
  assert.equal(data.pastEvents.length, 34);
});

test("el total del hero y del buscador proceden del inventario regional", () => {
  const componentSource = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(componentSource, /upcomingCountLabel\(model\.upcomingTotal\)/);
  assert.match(componentSource, /filteredTotal=\{filteredEvents\.length\}/);
  assert.match(componentSource, /Ver \{countLabel\(filteredTotal\)\}/);
  assert.doesNotMatch(componentSource, /Explorar próximos eventos/);
});

test("excluye cancelados, invisibles y fechas aplazadas no fiables", () => {
  const data = buildRegionalLandingModel([
    eventFixture({ id: "ok", slug: "ok" }),
    eventFixture({ id: "cancelled-status", slug: "cancelled-status", eventStatus: "cancelled" }),
    eventFixture({ id: "cancelled-quality", slug: "cancelled-quality", dataQuality: "cancelled" }),
    eventFixture({ id: "hidden", slug: "hidden", visible: false }),
    eventFixture({ id: "missing-visible", slug: "missing-visible", visible: undefined }),
    eventFixture({
      id: "postponed-pending",
      slug: "postponed-pending",
      eventStatus: "postponed",
      dataQuality: "pending_date",
    }),
  ], "cataluna", now);

  assert.deepEqual(data.upcomingEvents.map((event) => event.slug), ["ok"]);
  assert.equal(data.pastEvents.length, 0);
  assert.equal(data.weekendEvents.length, 0);
});

test("incluye un aplazado con fecha futura válida y muestra su estado", () => {
  const postponed = eventFixture({
    id: "postponed",
    slug: "postponed",
    eventStatus: "postponed",
    start: "2026-08-01",
    end: "2026-08-01",
  });
  const data = buildRegionalLandingModel([postponed], "cataluna", now);

  assert.equal(data.upcomingTotal, 1);
  assert.equal(data.weekendEvents.length, 1);
  assert.equal(regionalEventBadges(postponed).status, "Aplazado");
});

test("Cataluña puede tener próximos eventos y actividad real de fin de semana", () => {
  const data = buildRegionalLandingModel([
    eventFixture({ id: "friday", slug: "friday", start: "2026-07-31", end: "2026-07-31" }),
    eventFixture({ id: "saturday", slug: "saturday", start: "2026-08-01", end: "2026-08-01" }),
    eventFixture({ id: "later", slug: "later", start: "2026-08-08", end: "2026-08-08" }),
  ], "cataluna", now);

  assert.equal(data.upcomingTotal, 3);
  assert.deepEqual(data.weekendEvents.map((event) => event.slug), ["friday", "saturday"]);
});

test("Madrid conserva futuros aunque el fin de semana esté vacío", () => {
  const data = buildRegionalLandingModel([
    eventFixture({
      id: "madrid-later",
      slug: "madrid-later",
      city: "Madrid",
      province: "Madrid",
      region: "Comunidad de Madrid",
      start: "2026-08-08",
      end: "2026-08-08",
    }),
  ], "madrid", now);

  assert.equal(data.upcomingTotal, 1);
  assert.equal(data.weekendEvents.length, 0);
});

test("una región sin futuros mantiene el total regional en cero y separa alternativas nacionales", () => {
  const data = buildRegionalLandingModel([
    eventFixture({ id: "catalan-past", slug: "catalan-past", start: "2026-06-01", end: "2026-06-01" }),
    eventFixture({
      id: "national-future",
      slug: "national-future",
      city: "Sevilla",
      province: "Sevilla",
      region: "Andalucía",
      start: "2026-08-08",
      end: "2026-08-08",
    }),
  ], "cataluna", now);

  assert.equal(data.upcomingTotal, 0);
  assert.equal(data.pastEvents.length, 1);
  assert.deepEqual(data.fallbackNationalEvents.map((event) => event.slug), ["national-future"]);
  assert.deepEqual(data.alternativeEvents.map(({ originLabel }) => originLabel), ["Agenda nacional"]);
});

test("las alternativas priorizan macrozona y comunidades limítrofes configuradas", () => {
  const alternatives = selectRegionalAlternativeEvents([
    eventFixture({ id: "current", slug: "current" }),
    eventFixture({
      id: "aragon",
      slug: "aragon",
      city: "Alcañiz",
      province: "Teruel",
      region: "Aragón",
      start: "2026-08-10",
      end: "2026-08-10",
    }),
    eventFixture({
      id: "valencia",
      slug: "valencia",
      city: "Cheste",
      province: "Valencia",
      region: "Comunidad Valenciana",
      start: "2026-08-08",
      end: "2026-08-08",
    }),
    eventFixture({
      id: "national",
      slug: "national",
      city: "Sevilla",
      province: "Sevilla",
      region: "Andalucía",
      start: "2026-08-01",
      end: "2026-08-01",
    }),
    eventFixture({
      id: "cancelled",
      slug: "cancelled",
      city: "Zaragoza",
      province: "Zaragoza",
      region: "Aragón",
      eventStatus: "cancelled",
    }),
  ], "cataluna", now);

  assert.deepEqual(alternatives.map(({ event }) => event.slug), ["aragon", "valencia", "national"]);
  assert.deepEqual(alternatives.map(({ origin }) => origin), ["nearby", "nearby", "national"]);
  assert.deepEqual(alternatives.map(({ originLabel }) => originLabel), [
    "Cerca de Cataluña",
    "Cerca de Cataluña",
    "Agenda nacional",
  ]);
});

test("Madrid prioriza la macrozona Centro y excluye el inventario madrileño", () => {
  const alternatives = selectRegionalAlternativeEvents([
    eventFixture({
      id: "madrid",
      slug: "madrid",
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
    }),
    eventFixture({
      id: "mancha",
      slug: "mancha",
      city: "Toledo",
      province: "Toledo",
      region: "Castilla-La Mancha",
      start: "2026-08-09",
      end: "2026-08-09",
    }),
    eventFixture({
      id: "leon",
      slug: "leon",
      city: "Segovia",
      province: "Segovia",
      region: "Castilla y León",
      start: "2026-08-08",
      end: "2026-08-08",
    }),
    eventFixture({
      id: "sur",
      slug: "sur",
      city: "Sevilla",
      province: "Sevilla",
      region: "Andalucía",
      start: "2026-08-01",
      end: "2026-08-01",
    }),
  ], "madrid", now);

  assert.deepEqual(alternatives.map(({ event }) => event.slug), ["leon", "mancha", "sur"]);
  assert.deepEqual(alternatives.map(({ originLabel }) => originLabel), [
    "Cerca de Madrid",
    "Cerca de Madrid",
    "Agenda nacional",
  ]);
});

test("el fixture visual sin futuros deriva el estado sin duplicar datos", () => {
  const data = buildRegionalLandingModel([
    eventFixture({
      id: "regional",
      slug: "regional",
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
    }),
    eventFixture({
      id: "national",
      slug: "national",
      city: "Sevilla",
      province: "Sevilla",
      region: "Andalucía",
    }),
  ], "madrid", now);
  const fixture = buildRegionalNoUpcomingFixture(data);

  assert.equal(fixture.upcomingTotal, 0);
  assert.deepEqual(fixture.upcomingEvents, []);
  assert.deepEqual(fixture.weekendEvents, []);
  assert.deepEqual(fixture.provinceCounts, []);
  assert.deepEqual(fixture.disciplineCounts, []);
  assert.deepEqual(fixture.vehicleCounts, []);
  assert.equal(fixture.finderMode, "empty");
  assert.equal(fixture.fallbackNationalEvents.length, 1);
});

test("los fixtures visuales cubren inventario amplio, sin fin de semana, uno, dos y cero", () => {
  const data = buildRegionalLandingModel([
    ...numberedEvents(12, "regional", {}),
    eventFixture({
      id: "national",
      slug: "national",
      city: "Sevilla",
      province: "Sevilla",
      region: "Andalucía",
    }),
  ], "cataluna", now);

  assert.equal(buildRegionalInventoryFixture(data, "cataluna-amplia").upcomingTotal, 12);
  assert.equal(buildRegionalInventoryFixture(data, "madrid-sin-finde").weekendEvents.length, 0);
  assert.equal(buildRegionalInventoryFixture(data, "un-evento").upcomingTotal, 1);
  assert.equal(buildRegionalInventoryFixture(data, "dos-eventos").upcomingTotal, 2);
  assert.equal(buildRegionalInventoryFixture(data, "madrid-sin-futuros").upcomingTotal, 0);
  assert.equal(regionalFixtureId({ fixture: "cataluna-amplia" }), "cataluna-amplia");
  assert.equal(regionalFixtureId({ fixture: "sin-futuros" }), "madrid-sin-futuros");
  assert.equal(regionalFixtureId({ fixture: "desconocido" }), null);
  assert.equal(regionalFixtureNow("un-evento", now).getFullYear(), 2026);
  assert.equal(regionalFixtureNow("un-evento", now).getMonth(), 0);
  assert.equal(regionalFixtureNow("un-evento", now).getDate(), 1);
  assert.equal(regionalFixtureNow(null, now), now);

  const fixtureSources = [
    "app/preview/regiones/[region]/page.tsx",
    "components/preview/regions/regional-landing-model.ts",
  ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  for (const fixture of [
    "cataluna-amplia",
    "madrid-sin-finde",
    "madrid-sin-futuros",
    "un-evento",
    "dos-eventos",
  ]) {
    assert.match(fixtureSources, new RegExp(fixture));
  }
});

test("calcula las cuatro variantes de finderMode en sus límites", () => {
  assert.equal(regionalFinderMode(10), "full");
  assert.equal(regionalFinderMode(9), "compact");
  assert.equal(regionalFinderMode(3), "compact");
  assert.equal(regionalFinderMode(2), "hidden");
  assert.equal(regionalFinderMode(1), "hidden");
  assert.equal(regionalFinderMode(0), "empty");

  for (const [total, expected] of [[10, "full"], [6, "compact"], [2, "hidden"], [0, "empty"]] as const) {
    const data = buildRegionalLandingModel(
      numberedEvents(total, `mode-${total}`, {}),
      "cataluna",
      now,
    );
    assert.equal(data.finderMode, expected);
  }
});

test("uno o dos eventos se muestran completos sin buscador ni ampliación", () => {
  for (const total of [1, 2]) {
    const data = buildRegionalLandingModel(numberedEvents(total, `small-${total}`, {}), "cataluna", now);
    const query = parseRegionalLandingQuery({});

    assert.equal(data.finderMode, "hidden");
    assert.equal(filterRegionalLandingEvents(data, query).length, total);
    assert.equal(query.showAll, false);
  }
});

test("los accesos regionales se derivan solo de opciones con resultados positivos", () => {
  const data = buildRegionalLandingModel([
    eventFixture({ id: "barcelona", slug: "barcelona", province: "Barcelona" }),
    eventFixture({ id: "girona", slug: "girona", city: "Girona", province: "Girona", discipline: "Karting" }),
    eventFixture({ id: "barcelona-2", slug: "barcelona-2", province: "Barcelona", discipline: "Karting" }),
  ], "cataluna", now);

  assert.deepEqual(data.provinceCounts.map(({ label, count }) => ({ label, count })), [
    { label: "Barcelona", count: 2 },
    { label: "Girona", count: 1 },
  ]);
  assert.ok(data.provinceCounts.every((item) => item.count > 0));
  assert.ok(data.disciplineCounts.every((item) => item.count > 0));
});

test("deduplica Karting y karting y limita las etiquetas visibles", () => {
  const karting = eventFixture({
    discipline: "Karting",
    vehicleType: "karting",
    vehicle_type: "karting",
    eventStatus: "postponed",
  });
  const badges = regionalEventBadges(karting);

  assert.deepEqual(badges, {
    informational: ["Karting"],
    status: "Aplazado",
  });
  assert.ok(badges.informational.length <= 2);
  const cardSource = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalEventCard.tsx"),
    "utf8",
  );
  assert.match(cardSource, /badges\.informational[\s\S]*\.map/);
  assert.doesNotMatch(cardSource, /emc-badge[^]*event\.province/);
  assert.match(cardSource, /Ver detalles/);
});

test("ordena primero eventos en curso y después por fecha ascendente", () => {
  const sorted = sortRegionalUpcomingEvents([
    eventFixture({ id: "later", slug: "later", start: "2026-08-03", end: "2026-08-03" }),
    eventFixture({ id: "ongoing", slug: "ongoing", start: "2026-07-26", end: "2026-07-28" }),
    eventFixture({ id: "next", slug: "next", start: "2026-08-01", end: "2026-08-01" }),
  ], now);

  assert.deepEqual(sorted.map((event) => event.slug), ["ongoing", "next", "later"]);
});

test("los filtros y la vista completa usan query parameters SSR regionales", () => {
  assert.deepEqual(parseRegionalLandingQuery({
    discipline: "Clásicos",
    province: "Lleida",
    q: "Circuit de Barcelona",
    show: "all",
    vehicle: "Coche",
    when: "weekend",
  }), {
    discipline: "clasicos",
    province: "lleida",
    query: "Circuit de Barcelona",
    showAll: true,
    vehicle: "coche",
    when: "weekend",
  });
  assert.equal(parseRegionalLandingQuery({ when: "next30" }).when, "next30");
  assert.equal(parseRegionalLandingQuery({ when: "desconocido" }).when, "upcoming");
});

test("la búsqueda SSR combina texto, provincia, disciplina, vehículo y periodo", () => {
  const data = buildRegionalLandingModel([
    eventFixture({
      id: "jarama",
      slug: "jarama",
      title: "Tandas en el Jarama",
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
      discipline: "Circuito",
      vehicleType: "coche",
      vehicle_type: "coche",
      start: "2026-08-01",
      end: "2026-08-01",
    }),
    eventFixture({
      id: "karting",
      slug: "karting",
      title: "Trofeo de karting",
      city: "Madrid",
      province: "Madrid",
      region: "Madrid",
      discipline: "Karting",
      vehicleType: "karting",
      vehicle_type: "karting",
      start: "2026-08-01",
      end: "2026-08-01",
    }),
  ], "madrid", now);
  const query = parseRegionalLandingQuery({
    discipline: "Circuito",
    province: "Madrid",
    q: "Jarama",
    vehicle: "coche",
    when: "weekend",
  });

  assert.deepEqual(filterRegionalLandingEvents(data, query).map((event) => event.slug), ["jarama"]);
});

test("la preview está bloqueada en Vercel Production y su metadata omite canonical", () => {
  assert.equal(isRegionalPreviewAvailable("production"), false);
  assert.equal(isRegionalPreviewAvailable("preview"), true);
  assert.equal(isRegionalPreviewAvailable(undefined), true);

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
});

test("la preview queda fuera del sitemap y de la navegación pública", () => {
  const sitemap = readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");
  const navigationFiles = [
    "components/public/concept/ConceptHeader.tsx",
    "components/public/concept/ConceptStaticHeader.tsx",
    "components/public/concept/ConceptFooter.tsx",
    "lib/public-navigation.ts",
  ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

  assert.doesNotMatch(sitemap, /preview\/regiones/);
  assert.doesNotMatch(navigationFiles, /preview\/regiones/);
});

test("las rutas públicas conservan metadata, canonical y JSON-LD sin reutilizar la preview", () => {
  const catalunaRoute = readFileSync(
    path.join(process.cwd(), "app/eventos-motor-cataluna/page.tsx"),
    "utf8",
  );
  const madridRoute = readFileSync(
    path.join(process.cwd(), "app/eventos-motor-madrid/page.tsx"),
    "utf8",
  );
  const publicComponent = readFileSync(
    path.join(process.cwd(), "components/public/seo/OpportunityPage.tsx"),
    "utf8",
  );
  const opportunityModel = readFileSync(
    path.join(process.cwd(), "lib/opportunity-pages.ts"),
    "utf8",
  );

  for (const route of [catalunaRoute, madridRoute]) {
    assert.match(route, /buildOpportunityMetadata\(page\)/);
    assert.match(route, /<OpportunityPage page=\{page\} \/>/);
    assert.doesNotMatch(route, /RegionalLandingPreview/);
  }
  assert.match(opportunityModel, /alternates:\s*\{[\s\S]*canonical: url/);
  assert.match(publicComponent, /breadcrumbJsonLd\(page\)/);
  assert.match(publicComponent, /collectionPageJsonLd\(page\)/);
  assert.match(publicComponent, /itemListJsonLd\(page, mainEvents\)/);
});

test("las rutas regionales solo leen eventos y no contienen escrituras de Supabase", () => {
  const sources = [
    "app/preview/regiones/[region]/page.tsx",
    "components/preview/regions/regional-landing-model.ts",
    "components/preview/regions/RegionalLandingPreview.tsx",
  ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

  assert.match(sources, /getVisibleEvents/);
  assert.doesNotMatch(sources, /\.from\(["']events["']\)\s*\.(insert|update|delete|upsert)/i);
  assert.doesNotMatch(sources, /\.(insert|update|delete|upsert|rpc)\s*\(/i);
});

test("el layout limita seis tarjetas móviles, ocho desktop y evita overflow horizontal", () => {
  const css = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.module.css"),
    "utf8",
  );
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(component, /index >= REGIONAL_MOBILE_LIMIT/);
  assert.match(component, /filteredEvents\.slice\(0, REGIONAL_DESKTOP_LIMIT\)/);
  assert.match(component, /show:\s*"all"/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.mobileInitialHidden\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.eventCard\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /\.cardBody\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /\.eventGrid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.eventGrid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /overflow-x:\s*clip/);
});

test("los estados escasos usan hero y tarjetas móviles compactos", () => {
  const css = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.module.css"),
    "utf8",
  );

  assert.match(css, /@media \(max-width: 760px\)[\s\S]*font-size:\s*clamp\(44px,\s*12vw,\s*48px\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.eventCard\s*\{[\s\S]*height:\s*146px/);
  assert.match(css, /\.sparseEventsSection \+ \.alternativesSection\s*\{[\s\S]*padding-top:\s*24px/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sparseEventsSection \+ \.alternativesSection\s*\{[\s\S]*padding-top:\s*20px/);
});

test("el hero es compacto, textual y no repite el primer evento", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(component, /<section className=\{styles\.hero\}>/);
  assert.match(component, /model\.config\.description/);
  assert.doesNotMatch(component, /nextEvent|variant="hero"|Próxima cita en|Explorar próximos eventos/);
  assert.doesNotMatch(component, /import Image from "next\/image"/);
});

test("el fin de semana solo aparece como chip cuando tiene resultados", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );
  const css = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.module.css"),
    "utf8",
  );

  assert.match(component, /model\.weekendEvents\.length > 0/);
  assert.match(component, /Fin de semana <strong>/);
  assert.doesNotMatch(component, /Todavía no hay eventos publicados para este fin de semana|weekendStrip/);
  assert.doesNotMatch(css, /\.weekendStrip/);
});

test("el módulo Encuentra un evento respeta los modos, elecciones reales y GET SSR", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(component, /model\.finderMode === "full" \|\| model\.finderMode === "compact"/);
  assert.match(component, /const showSearch = isFull \|\| model\.upcomingTotal >= 6/);
  assert.match(component, /model\.provinceCounts\.length > 1/);
  assert.match(component, /model\.disciplineCounts\.length > 1/);
  assert.match(component, /model\.vehicleCounts\.length > 1/);
  assert.match(component, /method="get"/);
  for (const name of ["q", "province", "discipline", "vehicle", "when"]) {
    assert.match(component, new RegExp(`name="${name}"`));
  }
  assert.match(component, /model\.weekendEvents\.length > 0/);
  assert.match(component, /model\.nextThirtyDaysEvents\.length !== model\.upcomingTotal/);
  assert.doesNotMatch(component, /EventFinder[\s\S]{0,300}PUBLIC_NAVIGATION\.calendar/);
});

test("Madrid vacío salta la sección regional y abre directamente la agenda cercana", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(component, /model\.upcomingTotal > 0 \? \(\s*<section[\s\S]*styles\.eventsSection/);
  assert.match(component, /Agenda cerca de ti/);
  assert.match(component, /Eventos próximos cerca de \$\{model\.config\.name\}/);
  assert.match(component, /La agenda de \{model\.config\.name\} se está actualizando/);
  assert.match(component, /model\.alternativeEvents\.slice\(0, isEmpty \? 6 : 4\)/);
  assert.match(component, /¿Organizas un evento en \{model\.config\.name\}\?/);
  assert.match(component, /Publícalo gratis\./);
  assert.doesNotMatch(component, /Planes próximos en España|Alternativas reales|Aún no hay próximos eventos confirmados/);
  assert.doesNotMatch(component, />0 próximos eventos</);
});

test("uno y dos eventos eliminan redundancias y mantienen jerarquía singular o plural", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(component, /model\.upcomingTotal >= 3 \? \(\s*<strong className=\{styles\.inventoryPill\}/);
  assert.match(component, /model\.upcomingTotal === 1[\s\S]*`Próximo evento en \$\{model\.config\.name\}`/);
  assert.match(component, /`Próximos eventos en \$\{model\.config\.name\}`/);
  assert.match(component, /hasActiveFilters \? \(\s*<p>\{countLabel\(filteredEvents\.length\)\}/);
  assert.match(component, /model\.upcomingTotal === 1[\s\S]*`Más planes cerca de \$\{model\.config\.name\}`/);
  assert.match(component, /También puede interesarte/);
  assert.doesNotMatch(component, /ALTERNATIVAS REALES/);
});

test("las tarjetas no usan imágenes y conservan fecha y guardado accesibles", () => {
  const card = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalEventCard.tsx"),
    "utf8",
  );
  const saveButton = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalSaveButton.tsx"),
    "utf8",
  );

  assert.doesNotMatch(card, /next\/image|getEventImage|cardMedia/);
  assert.match(card, /aria-label=\{regionalEventDateAriaLabel\(event\)\}/);
  assert.match(card, /Math\.max\(0, 2 - Number\(Boolean\(originLabel\)\)/);
  assert.match(card, /className=\{styles\.originBadge\}/);
  assert.match(saveButton, /aria-label=\{saved \?/);
  assert.match(saveButton, /aria-pressed=\{saved\}/);
  assert.match(regionalEventDateAriaLabel(eventFixture()), /8 de agosto de 2026/);
});

test("la jerarquía y los controles conservan accesibilidad básica", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );
  const css = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.module.css"),
    "utf8",
  );

  assert.match(component, /<h1>/);
  assert.match(component, /<h2>/);
  assert.match(component, /<h3/);
  assert.match(component, /aria-labelledby="regional-finder-title"/);
  assert.match(component, /aria-current=/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.saveButton\s*\{[\s\S]*min-height:\s*44px/);
});
