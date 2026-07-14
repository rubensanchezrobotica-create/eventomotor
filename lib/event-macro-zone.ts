import type { EventItem } from "@/types/event";

export const MACRO_ZONE_IDS = [
  "norte",
  "centro",
  "cataluna-aragon",
  "levante",
  "sur",
  "canarias",
] as const;

export type MacroZoneId = (typeof MACRO_ZONE_IDS)[number];

const UNKNOWN_TERRITORIES = new Set(["", "a confirmar", "por confirmar", "sin determinar"]);

function normalizeTerritory(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const PROVINCE_ALIASES = {
  norte: [
    "A Coruña", "La Coruña", "Lugo", "Ourense", "Orense", "Pontevedra",
    "Asturias", "Cantabria", "Álava", "Alava", "Araba", "Bizkaia", "Vizcaya",
    "Gipuzkoa", "Guipúzcoa", "Guipuzcoa", "Navarra", "La Rioja",
  ],
  centro: [
    "Madrid", "Ávila", "Avila", "Burgos", "León", "Leon", "Palencia", "Salamanca",
    "Segovia", "Soria", "Valladolid", "Zamora", "Albacete", "Ciudad Real", "Cuenca",
    "Guadalajara", "Toledo",
  ],
  "cataluna-aragon": [
    "Barcelona", "Girona", "Gerona", "Lleida", "Lérida", "Lerida", "Tarragona",
    "Huesca", "Teruel", "Zaragoza",
  ],
  levante: [
    "Alicante", "Alacant", "Castellón", "Castellon", "Castelló", "Castello", "Valencia",
    "València", "Murcia", "Baleares", "Illes Balears", "Islas Baleares",
  ],
  sur: [
    "Almería", "Almeria", "Cádiz", "Cadiz", "Córdoba", "Cordoba", "Granada", "Huelva",
    "Jaén", "Jaen", "Málaga", "Malaga", "Sevilla", "Badajoz", "Cáceres", "Caceres",
    "Ceuta", "Melilla",
  ],
  canarias: ["Las Palmas", "Santa Cruz de Tenerife"],
} as const satisfies Record<MacroZoneId, readonly string[]>;

const REGION_ALIASES = {
  norte: [
    "Galicia", "Asturias", "Principado de Asturias", "Cantabria", "País Vasco", "Pais Vasco",
    "Euskadi", "Navarra", "Comunidad Foral de Navarra", "La Rioja",
  ],
  centro: [
    "Madrid", "Comunidad de Madrid", "Castilla y León", "Castilla y Leon",
    "Castilla-La Mancha", "Castilla La Mancha",
  ],
  "cataluna-aragon": ["Cataluña", "Cataluna", "Catalunya", "Aragón", "Aragon"],
  levante: [
    "Comunidad Valenciana", "Comunitat Valenciana", "País Valenciano", "Pais Valenciano",
    "Murcia", "Región de Murcia", "Region de Murcia", "Baleares", "Illes Balears",
    "Islas Baleares",
  ],
  sur: ["Andalucía", "Andalucia", "Extremadura", "Ceuta", "Melilla"],
  canarias: ["Canarias", "Islas Canarias"],
} as const satisfies Record<MacroZoneId, readonly string[]>;

function buildAliasMap(definitions: Record<MacroZoneId, readonly string[]>) {
  const aliases = new Map<string, MacroZoneId>();

  for (const zoneId of MACRO_ZONE_IDS) {
    for (const alias of definitions[zoneId]) {
      const key = normalizeTerritory(alias);
      const existingZone = aliases.get(key);

      if (existingZone && existingZone !== zoneId) {
        throw new Error(`El territorio "${alias}" está definido en más de una macrozona.`);
      }

      aliases.set(key, zoneId);
    }
  }

  return aliases;
}

const PROVINCE_TO_ZONE = buildAliasMap(PROVINCE_ALIASES);
const REGION_TO_ZONE = buildAliasMap(REGION_ALIASES);

function structuredValues(value: string | null | undefined) {
  const raw = String(value || "");
  const values = [raw, ...raw.split(/[;,/|]+/)];

  return Array.from(new Set(values.map(normalizeTerritory)))
    .filter((item) => !UNKNOWN_TERRITORIES.has(item));
}

function zoneFromStructuredField(
  value: string | null | undefined,
  aliases: ReadonlyMap<string, MacroZoneId>,
) {
  const matchedZones = new Set(
    structuredValues(value)
      .map((item) => aliases.get(item))
      .filter((zoneId): zoneId is MacroZoneId => Boolean(zoneId)),
  );

  return matchedZones.size === 1 ? [...matchedZones][0] : null;
}

export function classifyEventMacroZone(event: EventItem): MacroZoneId | null {
  const provinceZone = zoneFromStructuredField(event.province, PROVINCE_TO_ZONE);
  if (provinceZone) return provinceZone;

  const regionZone = zoneFromStructuredField(event.region, REGION_TO_ZONE);
  if (regionZone) return regionZone;

  return zoneFromStructuredField(event.city, PROVINCE_TO_ZONE)
    || zoneFromStructuredField(event.city, REGION_TO_ZONE);
}

export function isEventInMacroZone(event: EventItem, zoneId: MacroZoneId | string) {
  return classifyEventMacroZone(event) === zoneId;
}
