import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import type { SpanishTerritory } from "@/lib/regions/territory-contract";

export type TerritoryRouteMode = "preview" | "public";

export type TerritoryRouteContext = Readonly<{
  calendarHref: string;
  eventDetailBaseHref: string;
  homeHref: string;
  mode: TerritoryRouteMode;
  territoryHref: string;
  territorySlug: string;
  zonesHref: string;
}>;

export type TerritoryRouteQuery = Readonly<{
  discipline?: string;
  page?: number;
  province?: string;
  q?: string;
  vehicle?: string;
  when?: "upcoming" | "weekend" | "next30";
}>;

function assertInternalRoute(href: string, label: string) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    throw new Error(`La ruta ${label} debe ser una ruta interna absoluta.`);
  }
  return href;
}

export function buildPreviewTerritoryRouteContext(
  territory: Pick<SpanishTerritory, "slug">,
): TerritoryRouteContext {
  return {
    calendarHref: "/preview/redesign-v2/calendario",
    eventDetailBaseHref: "/preview/redesign-v2/evento",
    homeHref: "/preview/redesign-v2",
    mode: "preview",
    territoryHref: `/preview/redesign-v2/zonas/${territory.slug}`,
    territorySlug: territory.slug,
    zonesHref: "/preview/redesign-v2/zonas",
  };
}

export function buildPublicTerritoryRouteContext(
  territory: Pick<SpanishTerritory, "currentPublicCanonicalHref" | "kind" | "slug">,
): TerritoryRouteContext {
  if (territory.kind !== "AUTONOMOUS_COMMUNITY" || !territory.currentPublicCanonicalHref) {
    throw new Error(`El territorio ${territory.slug} no dispone de ruta pública existente.`);
  }

  return {
    calendarHref: assertInternalRoute(PUBLIC_NAVIGATION.calendar, "calendar"),
    eventDetailBaseHref: "/evento",
    homeHref: assertInternalRoute(PUBLIC_NAVIGATION.home, "home"),
    mode: "public",
    territoryHref: assertInternalRoute(territory.currentPublicCanonicalHref, "territory"),
    territorySlug: territory.slug,
    zonesHref: assertInternalRoute(PUBLIC_NAVIGATION.zones, "zones"),
  };
}

export function territoryRoutePageHref(
  context: TerritoryRouteContext,
  query: TerritoryRouteQuery = {},
) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.province) params.set("province", query.province);
  if (query.discipline) params.set("discipline", query.discipline);
  if (query.vehicle) params.set("vehicle", query.vehicle);
  if (query.when && query.when !== "upcoming") params.set("when", query.when);
  if ((query.page ?? 1) > 1) params.set("page", String(query.page));
  const search = params.toString();
  return search ? `${context.territoryHref}?${search}` : context.territoryHref;
}

export function territoryRouteEventHref(
  context: TerritoryRouteContext,
  slugOrId: string,
) {
  const identity = slugOrId.trim();
  if (!identity || identity.includes("/") || identity.includes("?") || identity.includes("#")) {
    throw new Error("La identidad del evento no es apta para navegación territorial.");
  }
  return `${context.eventDetailBaseHref}/${identity}`;
}
