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
  galicia: {
    landingSlug: "eventos-motor-galicia",
    name: "Galicia",
    regionAliases: ["galicia"],
    provinces: ["a coruna", "la coruna", "lugo", "ourense", "orense", "pontevedra"],
    cityAliases: ["a coruna", "la coruna", "lugo", "ourense", "orense", "pontevedra", "vigo", "bueu", "ribadeo", "trabada", "as pontes"],
    venueAliases: [],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Galicia, A Coruna, Lugo, Ourense y Pontevedra.",
    },
  },
  aragon: {
    landingSlug: "eventos-motor-aragon",
    name: "Aragon",
    regionAliases: ["aragon"],
    provinces: ["zaragoza", "huesca", "teruel"],
    cityAliases: ["zaragoza", "huesca", "teruel", "alcaniz", "zuera", "ainsa", "calanda", "ayerbe", "anzanigo"],
    venueAliases: ["motorland", "motorland aragon", "circuito de motorland"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Karting", href: "/disciplinas/karting" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Aragon, Zaragoza, Huesca, Teruel y MotorLand.",
    },
  },
  castillaLaMancha: {
    landingSlug: "eventos-motor-castilla-la-mancha",
    name: "Castilla-La Mancha",
    regionAliases: ["castilla-la mancha", "castilla la mancha"],
    provinces: ["albacete", "ciudad real", "cuenca", "guadalajara", "toledo"],
    cityAliases: ["albacete", "ciudad real", "cuenca", "guadalajara", "toledo", "talavera de la reina", "poblete", "guadalmez", "corral de calatrava"],
    venueAliases: ["circuito de albacete"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Castilla-La Mancha, Albacete, Toledo, Ciudad Real, Cuenca y Guadalajara.",
    },
  },
  canarias: {
    landingSlug: "eventos-motor-canarias",
    name: "Canarias",
    regionAliases: ["canarias", "islas canarias"],
    provinces: ["las palmas", "santa cruz de tenerife"],
    cityAliases: ["las palmas", "las palmas de gran canaria", "santa cruz de tenerife", "tenerife", "gran canaria", "arona", "arafo", "arrecife", "lanzarote"],
    venueAliases: [],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Clasicos", href: "/disciplinas/clasicos" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Canarias, Las Palmas y Santa Cruz de Tenerife.",
    },
  },
  murcia: {
    landingSlug: "eventos-motor-murcia",
    name: "Region de Murcia",
    regionAliases: ["region de murcia", "murcia"],
    provinces: ["murcia"],
    cityAliases: ["murcia", "cartagena", "lorca", "torre pacheco", "alhama de murcia", "san javier", "fortuna"],
    venueAliases: ["circuito de cartagena"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
    ],
    copy: {
      shortDescription: "Eventos de motor en la Region de Murcia, Murcia, Cartagena y alrededores.",
    },
  },
  castillaYLeon: {
    landingSlug: "eventos-motor-castilla-y-leon",
    name: "Castilla y Leon",
    regionAliases: ["castilla y leon"],
    provinces: ["avila", "burgos", "leon", "palencia", "salamanca", "segovia", "soria", "valladolid", "zamora"],
    cityAliases: ["avila", "burgos", "leon", "palencia", "salamanca", "segovia", "soria", "valladolid", "zamora", "guardo", "vinuesa", "pobladura de las regueras", "miranda de ebro"],
    venueAliases: ["circuito de kotarr"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Castilla y Leon, Leon, Valladolid, Burgos, Salamanca, Zamora, Avila, Segovia, Palencia y Soria.",
    },
  },
  asturias: {
    landingSlug: "eventos-motor-asturias",
    name: "Asturias",
    regionAliases: ["asturias", "principado de asturias"],
    provinces: ["asturias"],
    cityAliases: ["gijon", "oviedo", "luarca", "langreo", "cangas", "cangas del narcea", "ribadesella", "pravia", "castropol", "navia"],
    venueAliases: ["los dolmenes"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Asturias, Oviedo, Gijon, Luarca, Langreo y otros municipios asturianos.",
    },
  },
  cantabria: {
    landingSlug: "eventos-motor-cantabria",
    name: "Cantabria",
    regionAliases: ["cantabria"],
    provinces: ["cantabria"],
    cityAliases: ["santander", "torrelavega", "comillas", "heras", "potes", "saron", "santa maria de cayon", "cayon"],
    venueAliases: ["pena cabarga", "peña cabarga", "cabarga"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Clasicos", href: "/disciplinas/clasicos" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Cantabria, Santander, Torrelavega, Comillas y zonas cercanas.",
    },
  },
  navarra: {
    landingSlug: "eventos-motor-navarra",
    name: "Navarra",
    regionAliases: ["navarra", "comunidad foral de navarra"],
    provinces: ["navarra"],
    cityAliases: ["pamplona", "iruna", "iruña", "tudela", "los arcos", "corella", "ultzama", "tafalla", "estella"],
    venueAliases: ["circuito de navarra", "navarra circuit"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Navarra, Pamplona, Los Arcos, Corella y Circuito de Navarra.",
    },
  },
  extremadura: {
    landingSlug: "eventos-motor-extremadura",
    name: "Extremadura",
    regionAliases: ["extremadura"],
    provinces: ["badajoz", "caceres", "cáceres"],
    cityAliases: ["badajoz", "caceres", "cáceres", "merida", "mérida", "plasencia", "almendralejo", "olivenza", "jaraiz de la vera", "aceuchal"],
    venueAliases: [],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Karting", href: "/disciplinas/karting" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Extremadura, Badajoz, Caceres, Merida, Plasencia y otros municipios.",
    },
  },
  baleares: {
    landingSlug: "eventos-motor-baleares",
    name: "Baleares",
    regionAliases: ["baleares", "illes balears", "islas baleares"],
    provinces: ["baleares", "illes balears"],
    cityAliases: ["palma", "calvia", "calvià", "inca", "felanitx", "llucmajor", "sineu", "eivissa", "ibiza", "menorca", "mallorca", "magaluf", "can picafort"],
    venueAliases: ["puig major", "sa cala", "sant salvador"],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Karting", href: "/disciplinas/karting" },
    ],
    copy: {
      shortDescription: "Eventos de motor en Baleares, Mallorca, Palma, Ibiza, Menorca y otras zonas de las islas.",
    },
  },
  paisVasco: {
    landingSlug: "eventos-motor-pais-vasco",
    name: "País Vasco",
    regionAliases: ["pais vasco", "país vasco", "euskadi"],
    provinces: ["alava", "álava", "araba", "bizkaia", "vizcaya", "gipuzkoa", "guipuzcoa", "guipúzcoa"],
    cityAliases: ["bilbao", "vitoria", "vitoria-gasteiz", "donostia", "san sebastian", "durango", "abadiño", "abadino", "eskoriatza", "irun"],
    venueAliases: [],
    relatedPages: [
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Clasicos", href: "/disciplinas/clasicos" },
    ],
    copy: {
      shortDescription: "Eventos de motor en País Vasco, Bizkaia, Gipuzkoa, Alava, Bilbao, Vitoria-Gasteiz y Donostia.",
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

function structuredFieldValues(value?: string | null) {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue || normalizedValue === "por confirmar") return [];

  return [
    normalizedValue,
    ...normalizedValue
      .split(/[;,/|]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  ];
}

function matchesStructuredField(value: string | undefined, aliases: readonly string[]) {
  const values = structuredFieldValues(value);

  if (!values.length) return false;

  return aliases.some((alias) => {
    const normalizedAlias = normalizeValue(alias);
    return Boolean(normalizedAlias && values.includes(normalizedAlias));
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

export function getSeoCommunityForEvent(event: EventItem): SeoCommunityConfig | undefined {
  return Object.values(SEO_COMMUNITIES).find((community) => matchesSeoCommunity(event, community));
}
