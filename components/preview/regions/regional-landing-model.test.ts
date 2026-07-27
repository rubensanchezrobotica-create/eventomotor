import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildRegionalLandingModel,
  buildRegionalNoUpcomingFixture,
  buildRegionalPreviewMetadata,
  filterRegionalLandingEvents,
  isRegionalPreviewAvailable,
  nextRegionalShowLimit,
  parseRegionalLandingQuery,
  regionalEventBadges,
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

test("el total del CTA y el hero proceden del mismo upcomingTotal", () => {
  const componentSource = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(componentSource, /upcomingCountLabel\(model\.upcomingTotal\)/);
  assert.match(componentSource, /Explorar próximos eventos/);
  assert.match(componentSource, /href="#eventos"/);
  assert.doesNotMatch(componentSource, /Explorar próximos eventos[\s\S]{0,120}PUBLIC_NAVIGATION\.calendar/);
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
  assert.equal(fixture.fallbackNationalEvents.length, 1);
});

test("uno o dos eventos se muestran completos y no requieren ampliación", () => {
  for (const total of [1, 2]) {
    const data = buildRegionalLandingModel(
      numberedEvents(total, `small-${total}`, {}),
      "cataluna",
      now,
    );
    const query = parseRegionalLandingQuery({});
    const filtered = filterRegionalLandingEvents(data, query);

    assert.equal(filtered.length, total);
    assert.equal(nextRegionalShowLimit(query.show, filtered.length), total);
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
  assert.match(cardSource, /badges\.informational\.map/);
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

test("la carga progresiva y los accesos usan query parameters SSR regionales", () => {
  assert.deepEqual(parseRegionalLandingQuery({
    disciplina: "Clásicos",
    provincia: "Lleida",
    mostrar: "24",
    vista: "fin-de-semana",
  }), {
    discipline: "clasicos",
    province: "lleida",
    show: 24,
    thirtyDaysOnly: false,
    weekendOnly: true,
  });
  assert.equal(parseRegionalLandingQuery({ vista: "30-dias" }).thirtyDaysOnly, true);
  assert.equal(nextRegionalShowLimit(8, 88), 16);
  assert.equal(nextRegionalShowLimit(80, 88), 88);
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

  assert.match(component, /query\.show === 8 && index >= 6/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.mobileInitialHidden\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.eventCard\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /\.cardBody\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /\.eventGrid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.eventGrid,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /overflow-x:\s*clip/);
});

test("el hero destaca exactamente el primer evento cronológico y conserva contexto regional", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(component, /const nextEvent = model\.upcomingEvents\[0\]/);
  assert.match(component, /event=\{nextEvent\}[\s\S]*variant="hero"/);
  assert.match(component, /href="#eventos"[\s\S]*Explorar próximos eventos/);
  assert.doesNotMatch(component, /Explorar próximos eventos[\s\S]{0,160}PUBLIC_NAVIGATION\.calendar/);
});

test("la franja de fin de semana tiene estado positivo y alternativa discreta", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );
  const css = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.module.css"),
    "utf8",
  );

  assert.match(component, /planes"} este fin de semana/);
  assert.match(component, /Ver planes/);
  assert.match(component, /Tu próxima cita en \{model\.config\.name\} es el/);
  assert.match(component, /Todavía no hay eventos publicados para este fin de semana/);
  assert.match(css, /\.weekendStripQuiet\s*\{/);
});

test("Madrid vacío mantiene utilidad y limita el fallback nacional a tres planes", () => {
  const component = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalLandingPreview.tsx"),
    "utf8",
  );

  assert.match(component, /Próximas fechas en \$\{model\.config\.name\}/);
  assert.match(component, /Todavía no hay nuevos eventos confirmados en \{model\.config\.name\}/);
  assert.match(component, /Planes próximos en España/);
  assert.match(component, /fallbackNationalEvents\.slice\(0, 3\)/);
  assert.doesNotMatch(component, />0 próximos eventos</);
});

test("las tarjetas cubren imagen real, fallback visual y guardado accesible", () => {
  const card = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalEventCard.tsx"),
    "utf8",
  );
  const saveButton = readFileSync(
    path.join(process.cwd(), "components/preview/regions/RegionalSaveButton.tsx"),
    "utf8",
  );

  assert.match(card, /import Image from "next\/image"/);
  assert.match(card, /getEventImage\(event\)/);
  assert.match(card, /event\.image_url \|\| event\.imageUrl/);
  assert.match(card, /eventCardWithOriginalImage/);
  assert.match(card, /eventCardWithFallback/);
  assert.match(card, /fill/);
  assert.match(saveButton, /aria-label=\{saved \?/);
  assert.match(saveButton, /aria-pressed=\{saved\}/);
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
  assert.match(component, /aria-label="Vistas rápidas de la agenda"/);
  assert.match(component, /aria-current=/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.saveButton\s*\{[\s\S]*min-height:\s*44px/);
});
