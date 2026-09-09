import {
  getRegionalCommunity,
  REGIONAL_CONFIGS,
  type RegionalRegionId,
} from "@/lib/regions/regional-config";
import { normalizeSeoText, SEO_ZONES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

export const SPANISH_COUNTRY_CODE = "ES" as const;

export const SPANISH_COUNTRY_ALIASES = ["ES", "España", "Spain"] as const;

export const EXISTING_PROVINCE_PUBLIC_HREFS = [
  "/eventos-motor-barcelona",
  "/eventos-motor-valencia",
] as const;

export const LEGACY_MACRO_ZONE_HREFS = SEO_ZONES.map(
  (zone) => `/zonas/${zone.slug}` as const,
);

export type SpanishTerritoryKind = "AUTONOMOUS_COMMUNITY" | "AUTONOMOUS_CITY";
export type TerritoryIndexabilityIntent =
  | "PRESERVE_EXISTING"
  | "ELIGIBLE_FUTURE"
  | "DEFERRED_LOW_INVENTORY"
  | "DEFERRED_ZERO_INVENTORY";

export type SpanishTerritoryId =
  | RegionalRegionId
  | "laRioja"
  | "ceuta"
  | "melilla";

export type SpanishTerritory = Readonly<{
  aliases: readonly string[];
  countryCode: typeof SPANISH_COUNTRY_CODE;
  currentPublicCanonicalHref: string | null;
  displayName: string;
  futurePublicCanonicalHref: string | null;
  id: SpanishTerritoryId;
  indexabilityIntent: TerritoryIndexabilityIntent;
  kind: SpanishTerritoryKind;
  launchLandingEligible: boolean;
  legacyRouteReferences: readonly string[];
  provinceAliases: readonly string[];
  slug: string;
}>;

type ExistingTerritoryDefinition = Readonly<{
  id: RegionalRegionId;
  legacyMacroZoneSlug: (typeof SEO_ZONES)[number]["slug"];
  slug: string;
}>;

const EXISTING_TERRITORY_DEFINITIONS = [
  { id: "andalucia", slug: "andalucia", legacyMacroZoneSlug: "sur" },
  { id: "aragon", slug: "aragon", legacyMacroZoneSlug: "cataluna-aragon" },
  { id: "asturias", slug: "asturias", legacyMacroZoneSlug: "norte" },
  { id: "cantabria", slug: "cantabria", legacyMacroZoneSlug: "norte" },
  { id: "castillaLaMancha", slug: "castilla-la-mancha", legacyMacroZoneSlug: "centro" },
  { id: "castillaYLeon", slug: "castilla-y-leon", legacyMacroZoneSlug: "centro" },
  { id: "cataluna", slug: "cataluna", legacyMacroZoneSlug: "cataluna-aragon" },
  { id: "comunidadValenciana", slug: "comunidad-valenciana", legacyMacroZoneSlug: "levante" },
  { id: "extremadura", slug: "extremadura", legacyMacroZoneSlug: "sur" },
  { id: "galicia", slug: "galicia", legacyMacroZoneSlug: "norte" },
  { id: "baleares", slug: "baleares", legacyMacroZoneSlug: "levante" },
  { id: "canarias", slug: "canarias", legacyMacroZoneSlug: "canarias" },
  { id: "madrid", slug: "madrid", legacyMacroZoneSlug: "centro" },
  { id: "murcia", slug: "murcia", legacyMacroZoneSlug: "levante" },
  { id: "navarra", slug: "navarra", legacyMacroZoneSlug: "norte" },
  { id: "paisVasco", slug: "pais-vasco", legacyMacroZoneSlug: "norte" },
] as const satisfies readonly ExistingTerritoryDefinition[];

const ADDITIONAL_PROVINCE_ALIASES: Partial<Record<RegionalRegionId, readonly string[]>> = {
  cataluna: ["Gerona", "Lérida"],
  comunidadValenciana: ["Alacant", "Castelló", "Castello", "València"],
};

function existingTerritory(
  definition: ExistingTerritoryDefinition,
): SpanishTerritory {
  const config = REGIONAL_CONFIGS[definition.id];
  const community = getRegionalCommunity(definition.id);

  return {
    aliases: [config.name, ...config.aliases, ...community.regionAliases],
    countryCode: SPANISH_COUNTRY_CODE,
    currentPublicCanonicalHref: config.publicPath,
    displayName: config.name,
    futurePublicCanonicalHref: config.publicPath,
    id: definition.id,
    indexabilityIntent: "PRESERVE_EXISTING",
    kind: "AUTONOMOUS_COMMUNITY",
    launchLandingEligible: true,
    legacyRouteReferences: [`/zonas/${definition.legacyMacroZoneSlug}`],
    provinceAliases: [
      ...config.provinces,
      ...community.provinces,
      ...(ADDITIONAL_PROVINCE_ALIASES[definition.id] ?? []),
    ],
    slug: definition.slug,
  };
}

const NEW_TERRITORIES = [
  {
    aliases: ["La Rioja"],
    countryCode: SPANISH_COUNTRY_CODE,
    currentPublicCanonicalHref: null,
    displayName: "La Rioja",
    futurePublicCanonicalHref: "/eventos-motor-la-rioja",
    id: "laRioja",
    indexabilityIntent: "ELIGIBLE_FUTURE",
    kind: "AUTONOMOUS_COMMUNITY",
    launchLandingEligible: true,
    legacyRouteReferences: ["/zonas/norte"],
    provinceAliases: ["La Rioja"],
    slug: "la-rioja",
  },
  {
    aliases: ["Ceuta"],
    countryCode: SPANISH_COUNTRY_CODE,
    currentPublicCanonicalHref: null,
    displayName: "Ceuta",
    futurePublicCanonicalHref: null,
    id: "ceuta",
    indexabilityIntent: "DEFERRED_LOW_INVENTORY",
    kind: "AUTONOMOUS_CITY",
    launchLandingEligible: false,
    legacyRouteReferences: ["/zonas/sur"],
    provinceAliases: ["Ceuta"],
    slug: "ceuta",
  },
  {
    aliases: ["Melilla"],
    countryCode: SPANISH_COUNTRY_CODE,
    currentPublicCanonicalHref: null,
    displayName: "Melilla",
    futurePublicCanonicalHref: null,
    id: "melilla",
    indexabilityIntent: "DEFERRED_ZERO_INVENTORY",
    kind: "AUTONOMOUS_CITY",
    launchLandingEligible: false,
    legacyRouteReferences: ["/zonas/sur"],
    provinceAliases: ["Melilla"],
    slug: "melilla",
  },
] as const satisfies readonly SpanishTerritory[];

export const SPANISH_TERRITORIES: readonly SpanishTerritory[] = [
  ...EXISTING_TERRITORY_DEFINITIONS.map(existingTerritory),
  ...NEW_TERRITORIES,
];

const UNKNOWN_TERRITORY_VALUES = new Set([
  "",
  "a confirmar",
  "por confirmar",
  "sin determinar",
  "sin provincia",
  "sin region",
]);

export function normalizeTerritoryValue(value: string | null | undefined) {
  return normalizeSeoText(String(value ?? ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTerritoryCountry(value: string | null | undefined) {
  const normalized = normalizeTerritoryValue(value);
  const aliases = SPANISH_COUNTRY_ALIASES.map(normalizeTerritoryValue);

  return aliases.includes(normalized) ? SPANISH_COUNTRY_CODE : null;
}

export function isSpanishTerritoryEvent(event: Pick<EventItem, "country">) {
  return normalizeTerritoryCountry(event.country) === SPANISH_COUNTRY_CODE;
}

function structuredValues(value: string | null | undefined) {
  const raw = String(value ?? "");
  const values = [raw, ...raw.split(/[;,/|]+/)]
    .map(normalizeTerritoryValue)
    .filter((item) => !UNKNOWN_TERRITORY_VALUES.has(item));

  return [...new Set(values)];
}

function matchesAliases(
  value: string | null | undefined,
  aliases: readonly string[],
) {
  const values = structuredValues(value);
  if (!values.length) return false;

  const normalizedAliases = aliases.map(normalizeTerritoryValue);
  return normalizedAliases.some((alias) => values.includes(alias));
}

function uniqueMatch(
  value: string | null | undefined,
  aliases: (territory: SpanishTerritory) => readonly string[],
) {
  const matches = SPANISH_TERRITORIES.filter((territory) => (
    matchesAliases(value, aliases(territory))
  ));

  return matches.length === 1 ? matches[0] : null;
}

export function getSpanishTerritoryById(id: string) {
  return SPANISH_TERRITORIES.find((territory) => territory.id === id) ?? null;
}

export function getSpanishTerritoryBySlug(slug: string) {
  const normalizedSlug = normalizeTerritoryValue(slug).replace(/ /g, "-");
  return SPANISH_TERRITORIES.find((territory) => territory.slug === normalizedSlug) ?? null;
}

export function getSpanishTerritoryByAlias(alias: string) {
  const normalizedAlias = normalizeTerritoryValue(alias);
  const matches = SPANISH_TERRITORIES.filter((territory) => (
    [territory.displayName, territory.slug, ...territory.aliases]
      .map(normalizeTerritoryValue)
      .includes(normalizedAlias)
  ));

  return matches.length === 1 ? matches[0] : null;
}

export function matchEventToSpanishTerritory(
  event: Pick<EventItem, "country" | "province" | "region">,
) {
  if (!isSpanishTerritoryEvent(event)) return null;

  const regionMatch = uniqueMatch(event.region, (territory) => territory.aliases);
  const provinceMatch = uniqueMatch(
    event.province,
    (territory) => territory.provinceAliases,
  );

  if (regionMatch && provinceMatch && regionMatch.id !== provinceMatch.id) return null;
  return regionMatch ?? provinceMatch;
}

export function listSpanishTerritoryEventCounts(
  events: readonly Pick<EventItem, "country" | "province" | "region">[],
) {
  const counts = new Map<SpanishTerritoryId, number>(
    SPANISH_TERRITORIES.map((territory) => [territory.id, 0]),
  );

  for (const event of events) {
    const territory = matchEventToSpanishTerritory(event);
    if (territory) counts.set(territory.id, (counts.get(territory.id) ?? 0) + 1);
  }

  return SPANISH_TERRITORIES.map((territory) => ({
    count: counts.get(territory.id) ?? 0,
    territory,
  }));
}

export function listSpanishTerritoryProvinces(id: string) {
  return getSpanishTerritoryById(id)?.provinceAliases ?? [];
}

export function buildSpanishTerritoryPublicHref(id: string) {
  const territory = getSpanishTerritoryById(id);
  if (!territory?.launchLandingEligible) return null;

  return territory.currentPublicCanonicalHref ?? territory.futurePublicCanonicalHref;
}

export function isSpanishTerritoryLaunchLandingEligible(id: string) {
  return getSpanishTerritoryById(id)?.launchLandingEligible ?? false;
}
