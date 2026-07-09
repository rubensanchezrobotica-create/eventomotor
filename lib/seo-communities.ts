import type { EventItem } from "@/types/event";
import { normalizeRegion } from "@/lib/normalize-region";
import { normalizeSeoText } from "@/lib/seo-taxonomy";

type RelatedPage = {
  label: string;
  href: string;
};

export type SeoCommunityConfig = {
  landingSlug: string;
  name: string;
  regionAliases: readonly string[];
  provinces: readonly string[];
  cityAliases: readonly string[];
  venueAliases: readonly string[];
  relatedPages: readonly RelatedPage[];
  copy?: {
    shortDescription: string;
  };
};

export const SEO_COMMUNITIES = {
  cataluna: {
    landingSlug: "eventos-motor-cataluna",
    name: "Cataluna",
    regionAliases: ["cataluna", "catalunya"],
    provinces: ["barcelona", "girona", "tarragona", "lleida", "lerida"],
    cityAliases: ["barcelona", "girona", "tarragona", "lleida", "lerida", "montmelo", "ribes de freser", "gironella", "orista"],
    venueAliases: ["circuit de barcelona-catalunya", "circuit de catalunya", "montmelo"],
    relatedPages: [
      { label: "Eventos de motor en Barcelona", href: "/eventos-motor-barcelona" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Cataluna, Barcelona, Girona, Tarragona y Lleida.",
    },
  },
  madrid: {
    landingSlug: "eventos-motor-madrid",
    name: "Madrid",
    regionAliases: ["madrid", "comunidad de madrid"],
    provinces: ["madrid"],
    cityAliases: ["madrid", "san sebastian de los reyes", "alcala de henares", "alcorcon", "leganes", "getafe", "arroyomolinos"],
    venueAliases: ["jarama", "circuito del jarama", "ifema"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Madrid, Jarama y Comunidad de Madrid.",
    },
  },
  andalucia: {
    landingSlug: "eventos-motor-andalucia",
    name: "Andalucia",
    regionAliases: ["andalucia"],
    provinces: ["sevilla", "malaga", "cadiz", "cordoba", "granada", "huelva", "jaen", "almeria"],
    cityAliases: ["sevilla", "malaga", "cadiz", "cordoba", "granada", "huelva", "jaen", "almeria", "jerez de la frontera", "osuna"],
    venueAliases: ["circuito de jerez", "angel nieto", "monteblanco"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Andalucia, Sevilla, Malaga, Cadiz, Granada, Cordoba, Jaen, Huelva y Almeria.",
    },
  },
  comunidadValenciana: {
    landingSlug: "eventos-motor-comunidad-valenciana",
    name: "Comunidad Valenciana",
    regionAliases: ["comunidad valenciana", "comunitat valenciana", "pais valenciano"],
    provinces: ["valencia", "alicante", "castellon"],
    cityAliases: ["valencia", "alicante", "castellon", "cheste", "alcoy", "alcoi"],
    venueAliases: ["ricardo tormo", "circuit ricardo tormo", "cheste"],
    relatedPages: [
      { label: "Eventos de motor en Valencia", href: "/eventos-motor-valencia" },
      { label: "Rallyes Valencia 2026", href: "/rallyes-valencia-2026" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Comunidad Valenciana, Valencia, Alicante y Castellon.",
    },
  },
} as const satisfies Record<string, SeoCommunityConfig>;

function normalizeValue(value?: string | null) {
  return normalizeSeoText(value || "").trim();
}

function hasUsableLocationValue(value?: string | null) {
  const normalizedValue = normalizeValue(value);
  return Boolean(normalizedValue && normalizedValue !== "por confirmar");
}

function matchesStructuredField(value: string | undefined, aliases: readonly string[]) {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue || normalizedValue === "por confirmar") return false;

  return aliases.some((alias) => {
    const normalizedAlias = normalizeValue(alias);
    return normalizedValue === normalizedAlias || normalizedValue.includes(normalizedAlias);
  });
}

function matchesRegionField(value: string | undefined, aliases: readonly string[]) {
  const normalizedValue = normalizeRegion(value);

  if (!normalizedValue) return false;

  return aliases.some((alias) => normalizeRegion(alias) === normalizedValue);
}

function fallbackSearchText(event: EventItem) {
  return normalizeSeoText(
    [
      event.title,
      event.championship,
      event.discipline,
      event.venue,
      event.city,
      event.province,
      event.region,
      ...(event.tags || []),
    ].join(" "),
  );
}

function matchesFallbackAliases(event: EventItem, community: SeoCommunityConfig) {
  const text = fallbackSearchText(event);
  const aliases = [
    community.name,
    ...community.regionAliases,
    ...community.provinces,
    ...community.cityAliases,
    ...community.venueAliases,
  ];

  return aliases.some((alias) => text.includes(normalizeValue(alias)));
}

export function matchesSeoCommunity(event: EventItem, community: SeoCommunityConfig) {
  const regionAliases = [community.name, ...community.regionAliases];
  const structuredMatch =
    matchesRegionField(event.region, regionAliases) ||
    matchesStructuredField(event.province, community.provinces) ||
    matchesStructuredField(event.city, community.cityAliases);

  // Priority is intentionally given to structured fields: region, province and city.
  // Text aliases are a temporary fallback while imported event locations are normalized.
  if (structuredMatch) return true;

  const hasStructuredLocation = [event.region, event.province, event.city].some(hasUsableLocationValue);
  return !hasStructuredLocation && matchesFallbackAliases(event, community);
}
