import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  resolveInteriorNavigationItem,
} from "@/components/redesign-v2/site/preview-navigation";
import { buildOpportunityMetadata, getOpportunityPage, OPPORTUNITY_PAGES } from "@/lib/opportunity-pages";
import { REGIONAL_CONFIGS, REGIONAL_REGION_IDS } from "@/lib/regions/regional-config";
import {
  getSpanishTerritoryById,
  matchEventToSpanishTerritory,
} from "@/lib/regions/territory-contract";
import { SITE_URL } from "@/lib/seo";
import type { EventItem } from "@/types/event";
import {
  buildTerritoryDetailPageModel,
  buildTerritorySearchSuggestions,
  parsePublicTerritoryDetailQuery,
  territoryDetailResultsHref,
} from "./territory-detail-model";
import {
  buildPreviewTerritoryRouteContext,
  buildPublicTerritoryRouteContext,
} from "./territory-route-context";

const workspace = process.cwd();
const now = "2026-09-10T10:00:00+02:00";

const PUBLIC_CCAA = {
  andalucia: "/eventos-motor-andalucia",
  aragon: "/eventos-motor-aragon",
  asturias: "/eventos-motor-asturias",
  baleares: "/eventos-motor-baleares",
  canarias: "/eventos-motor-canarias",
  cantabria: "/eventos-motor-cantabria",
  castillaLaMancha: "/eventos-motor-castilla-la-mancha",
  castillaYLeon: "/eventos-motor-castilla-y-leon",
  cataluna: "/eventos-motor-cataluna",
  comunidadValenciana: "/eventos-motor-comunidad-valenciana",
  extremadura: "/eventos-motor-extremadura",
  galicia: "/eventos-motor-galicia",
  madrid: "/eventos-motor-madrid",
  murcia: "/eventos-motor-murcia",
  navarra: "/eventos-motor-navarra",
  paisVasco: "/eventos-motor-pais-vasco",
} as const;

function source(path: string) {
  return readFileSync(join(workspace, path), "utf8");
}

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    championship: "",
    city: "Sevilla",
    country: "ES",
    discipline: "Rally",
    end: "2026-09-12",
    featured: false,
    id: "a76b-event",
    level: "Regional",
    province: "Sevilla",
    region: "Andalucía",
    slug: "a76b-event",
    source: "Fixture A7.6B",
    sourceUrl: "https://example.com/a76b",
    start: "2026-09-12",
    tags: [],
    ticketUrl: "",
    title: "Rally A7.6B",
    vehicleType: "coche",
    venue: "Recinto A7.6B",
    visible: true,
    ...overrides,
  };
}

test("A7.6B converge exactamente las 16 CCAA públicas sin tocar sus páginas", () => {
  assert.equal(REGIONAL_REGION_IDS.length, 16);
  assert.deepEqual(new Set(REGIONAL_REGION_IDS), new Set(Object.keys(PUBLIC_CCAA)));

  for (const id of REGIONAL_REGION_IDS) {
    const expectedHref = PUBLIC_CCAA[id];
    const territory = getSpanishTerritoryById(id);
    assert.ok(territory, id);
    assert.equal(territory.currentPublicCanonicalHref, expectedHref, id);
    assert.equal(buildPublicTerritoryRouteContext(territory).territoryHref, expectedHref, id);
    const route = `app${expectedHref}/page.tsx`;
    assert.equal(existsSync(join(workspace, route)), true, route);
    assert.match(source(route), /<PublicRegionalLanding/);
  }
});

test("A7.6B conserva metadata, canonical, Open Graph y robots indexables de las 16 CCAA", () => {
  for (const id of REGIONAL_REGION_IDS) {
    const config = REGIONAL_CONFIGS[id];
    const page = getOpportunityPage(config.publicPath.slice(1));
    assert.ok(page, id);
    const metadata = buildOpportunityMetadata(page);
    assert.deepEqual(metadata.title, { absolute: page.title }, id);
    assert.equal(metadata.description, page.description, id);
    assert.equal(metadata.alternates?.canonical, `${SITE_URL}${config.publicPath}`, id);
    assert.equal(metadata.openGraph?.title, page.title, id);
    assert.equal(metadata.openGraph?.description, page.description, id);
    assert.equal(metadata.openGraph?.url, `${SITE_URL}${config.publicPath}`, id);
    assert.equal(metadata.robots, undefined, id);
    assert.ok(OPPORTUNITY_PAGES.includes(page), id);
  }
  assert.match(source("app/layout.tsx"), /robots:\s*\{[\s\S]*?index:\s*true[\s\S]*?follow:\s*true/);
  assert.match(source("app/sitemap.ts"), /OPPORTUNITY_PAGES\.map/);
});

test("A7.6B conserva JSON-LD público y monta únicamente el renderer V2 visible", () => {
  const adapter = source("components/regions/PublicRegionalLanding.tsx");
  for (const schema of ["BreadcrumbList", "CollectionPage", "FAQPage", "ItemList"]) {
    assert.match(adapter, new RegExp(`"@type": "${schema}"`));
  }
  assert.match(adapter, /<V2InteriorShell/);
  assert.match(adapter, /navigationMode="public"/);
  assert.match(adapter, /<TerritoryDetailPage/);
  assert.doesNotMatch(adapter, /<RegionalLanding[\s>]/);
  assert.match(adapter, /model\.upcomingEvents\.slice\(0, 20\)/);
  assert.match(adapter, /\$\{SITE_URL\}\/evento\/\$\{event\.slug \|\| event\.id\}/);
});

test("A7.6B-R2 alinea el hero público con la identidad territorial A7.5", () => {
  const adapter = source("components/regions/PublicRegionalLanding.tsx");
  const previewRoute = source("app/preview/redesign-v2/zonas/[territory]/page.tsx");
  const detailPage = source("components/redesign-v2/zones/TerritoryDetailPage.tsx");

  assert.match(adapter, /description=\{model\.config\.description\}/);
  assert.match(adapter, /eyebrow="Territorio"/);
  assert.match(adapter, /title=\{territory\.displayName\}/);
  assert.doesNotMatch(adapter, /eyebrow=\{page\.eyebrow\}|title=\{page\.h1\}/);
  assert.match(previewRoute, /eyebrow="Territorio"/);
  assert.match(previewRoute, /title=\{territory\.displayName\}/);
  assert.match(detailPage, /<h2 id="territory-detail-results">Eventos de motor en \{model\.territory\.displayName\}<\/h2>/);

  assert.equal(REGIONAL_CONFIGS.andalucia.description, "Agenda de motor en Almería, Cádiz, Córdoba, Granada, Huelva, Jaén, Málaga y Sevilla.");
  assert.equal(getSpanishTerritoryById("andalucia")?.displayName, "Andalucía");
  assert.equal(getSpanishTerritoryById("castillaLaMancha")?.displayName, "Castilla-La Mancha");
  assert.equal(getSpanishTerritoryById("paisVasco")?.displayName, "País Vasco");

  for (const id of REGIONAL_REGION_IDS) {
    const territory = getSpanishTerritoryById(id);
    assert.ok(territory?.displayName, id);
    assert.equal(buildPublicTerritoryRouteContext(territory).territorySlug, territory.slug, id);
  }
});

test("A7.6B resuelve navegación de shell y breadcrumb sin fugas Preview", () => {
  assert.equal(resolveInteriorNavigationItem("home", "public").href, "/");
  assert.equal(resolveInteriorNavigationItem("calendar", "public").href, "/#calendario");
  assert.equal(resolveInteriorNavigationItem("territories", "public").href, "/zonas");
  assert.equal(resolveInteriorNavigationItem("home", "preview").href, "/preview/redesign-v2");
  assert.equal(resolveInteriorNavigationItem("calendar", "preview").href, "/preview/redesign-v2/calendario");
  assert.equal(resolveInteriorNavigationItem("territories", "preview").href, "/preview/redesign-v2/zonas");

  const adapter = source("components/regions/PublicRegionalLanding.tsx");
  assert.match(adapter, /\{ label: "Inicio", navigationId: "home" \}/);
  assert.match(adapter, /\{ label: "Zonas", navigationId: "territories" \}/);
  assert.match(adapter, /\{ label: territory\.displayName \}/);
});

test("A7.6B mantiene formularios, paginación, reset y ubicación en la ruta pública", () => {
  const territory = getSpanishTerritoryById("andalucia");
  assert.ok(territory);
  const context = buildPublicTerritoryRouteContext(territory);
  const query = parsePublicTerritoryDetailQuery({
    discipline: "rallyes",
    page: "2",
    province: "sevilla",
    q: "Sierra",
    show: "all",
    vehicle: "coche",
    when: "next30",
  });
  const href = territoryDetailResultsHref(context, query);
  assert.match(href, /^\/eventos-motor-andalucia\?/);
  assert.match(href, /vehicle=coche/);
  assert.match(href, /when=next30/);
  assert.match(href, /page=2/);
  assert.doesNotMatch(href, /show=|\/preview\/redesign-v2/);
  assert.equal(territoryDetailResultsHref(context), "/eventos-motor-andalucia#eventos");
});

test("A7.6B conserva filtros combinados vehicle/when y semántica territorial española", () => {
  const territory = getSpanishTerritoryById("andalucia");
  assert.ok(territory);
  const context = buildPublicTerritoryRouteContext(territory);
  const events = [
    event(),
    event({ id: "moto", slug: "moto", vehicleType: "moto", province: "Cádiz", city: "Cádiz" }),
    event({ id: "later", slug: "later", start: "2026-11-01", end: "2026-11-01" }),
    event({ id: "portugal", slug: "portugal", country: "PT" }),
  ];
  const vehicleProvince = buildTerritoryDetailPageModel(events, territory, {
    now,
    query: parsePublicTerritoryDetailQuery({ province: "cadiz", vehicle: "moto" }),
    routeContext: context,
  });
  const whenDiscipline = buildTerritoryDetailPageModel(events, territory, {
    now,
    query: parsePublicTerritoryDetailQuery({ discipline: "rallyes", when: "next30" }),
    routeContext: context,
  });

  assert.deepEqual(vehicleProvince.items.map(({ event: item }) => item.slug), ["moto"]);
  assert.deepEqual(whenDiscipline.items.map(({ event: item }) => item.slug), ["a76b-event", "moto"]);
  assert.equal(matchEventToSpanishTerritory(events[3])?.id, undefined);
});

test("A7.6B separa typeahead de evento y ubicación por contexto", () => {
  const territory = getSpanishTerritoryById("andalucia");
  assert.ok(territory);
  const previewContext = buildPreviewTerritoryRouteContext(territory);
  const publicContext = buildPublicTerritoryRouteContext(territory);
  const source = [{ city: "Sevilla", province: "Sevilla", slug: "rally-a76b", title: "Rally A7.6B", venue: "Circuito" }];

  assert.equal(buildTerritorySearchSuggestions(source, "Rally", previewContext)[0]?.href, "/preview/redesign-v2/evento/rally-a76b");
  assert.equal(buildTerritorySearchSuggestions(source, "Rally", publicContext)[0]?.href, "/evento/rally-a76b");
  const publicLocation = buildTerritorySearchSuggestions(
    source,
    "Sevilla",
    publicContext,
    { discipline: "rallyes", province: "sevilla", vehicle: "coche", when: "weekend" },
  ).find(({ kind }) => kind === "location");
  assert.match(publicLocation?.href ?? "", /^\/eventos-motor-andalucia\?/);
  assert.doesNotMatch(publicLocation?.href ?? "", /\/preview\/redesign-v2/);
});

test("A7.6B protege La Rioja, ciudades autónomas, macrozonas y opportunities provinciales", () => {
  for (const absent of [
    "app/eventos-motor-la-rioja",
    "app/eventos-motor-ceuta",
    "app/eventos-motor-melilla",
  ]) {
    assert.equal(existsSync(join(workspace, absent)), false, absent);
  }
  assert.equal(existsSync(join(workspace, "app/zonas/[slug]/page.tsx")), true);
  for (const provinceRoute of ["barcelona", "valencia"]) {
    const route = source(`app/eventos-motor-${provinceRoute}/page.tsx`);
    assert.match(route, /components\/public\/seo\/OpportunityPage/);
    assert.doesNotMatch(route, /PublicRegionalLanding|TerritoryDetailPage/);
  }
});

test("A7.6B conserva Preview noindex y sin canonical", () => {
  const previewRoute = source("app/preview/redesign-v2/zonas/[territory]/page.tsx");
  assert.match(previewRoute, /index:\s*false/);
  assert.match(previewRoute, /follow:\s*false/);
  assert.match(previewRoute, /nocache:\s*true/);
  assert.doesNotMatch(previewRoute, /canonical|application\/ld\+json|generateMetadata/);
  assert.match(previewRoute, /buildPreviewTerritoryRouteContext\(territory\)/);
});
