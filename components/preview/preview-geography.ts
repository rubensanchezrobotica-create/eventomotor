import type { ConceptZone } from "@/components/public/concept/concept-model";

const COPY_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bA Coruna\b/giu, "A Coruña"],
  [/\bCastilla y Leon\b/giu, "Castilla y León"],
  [/\bPais Vasco\b/giu, "País Vasco"],
  [/\bEspana\b/giu, "España"],
  [/\bCataluna\b/giu, "Cataluña"],
  [/\bCatalunya\b/giu, "Cataluña"],
  [/\bAragon\b/giu, "Aragón"],
  [/\bAndalucia\b/giu, "Andalucía"],
  [/\bAlmeria\b/giu, "Almería"],
  [/\bCastellon\b/giu, "Castellón"],
  [/\bCaceres\b/giu, "Cáceres"],
  [/\bCordoba\b/giu, "Córdoba"],
  [/\bpublicacion\b/giu, "publicación"],
  [/\bpagina\b/giu, "página"],
  [/\bbrujula\b/giu, "brújula"],
];

const PROVINCE_ALIASES: Record<string, string> = {
  "la coruna": "a coruna",
  "illes balears": "baleares",
  "islas baleares": "baleares",
  guipuzcoa: "gipuzkoa",
  lerida: "lleida",
  orense: "ourense",
  vizcaya: "bizkaia",
};

const CANONICAL_PROVINCES: Record<string, string> = {
  "a coruna": "A Coruña",
  alava: "Álava",
  almeria: "Almería",
  avila: "Ávila",
  baleares: "Baleares",
  bizkaia: "Bizkaia",
  caceres: "Cáceres",
  cadiz: "Cádiz",
  castellon: "Castellón",
  cordoba: "Córdoba",
  gipuzkoa: "Gipuzkoa",
  jaen: "Jaén",
  leon: "León",
  lleida: "Lleida",
  malaga: "Málaga",
  ourense: "Ourense",
};

export function normalizePreviewGeographyKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function provinceKey(value: string) {
  const normalized = normalizePreviewGeographyKey(value);
  return PROVINCE_ALIASES[normalized] || normalized;
}

function canonicalProvince(value: string) {
  const key = provinceKey(value);
  return CANONICAL_PROVINCES[key] || value.trim().replace(/\s+/g, " ");
}

function belongsToStructuredZone(zone: ConceptZone, province: string, region: string) {
  const structuredLocation = [province, region].map(normalizePreviewGeographyKey);

  return zone.terms.some((term) => {
    const normalizedTerm = normalizePreviewGeographyKey(term);
    return structuredLocation.some((value) => value.includes(normalizedTerm));
  });
}

export function formatPreviewDisplayText(value: string) {
  return COPY_REPLACEMENTS.reduce(
    (formatted, [pattern, replacement]) => formatted.replace(pattern, replacement),
    value,
  );
}

export function formatPreviewZoneProvinces(zone: ConceptZone | undefined, fallback: string, limit = 3) {
  const source = zone
    ? zone.events
      .filter((event) => belongsToStructuredZone(zone, event.province, event.region))
      .map((event) => event.province)
    : fallback.split("/");
  const deduplicated = new Map<string, string>();

  for (const province of source) {
    const key = provinceKey(province);
    if (key && !deduplicated.has(key)) deduplicated.set(key, canonicalProvince(province));
  }

  const provinces = [...deduplicated.values()].sort((left, right) => left.localeCompare(right, "es"));
  const visible = provinces.slice(0, limit).join(" / ");

  return `${visible || formatPreviewDisplayText(fallback)}${provinces.length > limit ? "…" : ""}`;
}
