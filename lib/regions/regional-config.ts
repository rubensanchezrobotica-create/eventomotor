import { getOpportunityPage } from "@/lib/opportunity-pages";
import {
  matchesSeoCommunity,
  SEO_COMMUNITIES,
  type SeoCommunityConfig,
} from "@/lib/seo-communities";
import { normalizeSeoText } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

export const REGIONAL_COMMUNITY_KEYS = {
  andalucia: "andalucia",
  aragon: "aragon",
  asturias: "asturias",
  baleares: "baleares",
  canarias: "canarias",
  cantabria: "cantabria",
  castillaLaMancha: "castillaLaMancha",
  castillaYLeon: "castillaYLeon",
  cataluna: "cataluna",
  comunidadValenciana: "comunidadValenciana",
  extremadura: "extremadura",
  galicia: "galicia",
  madrid: "madrid",
  murcia: "murcia",
  navarra: "navarra",
  paisVasco: "paisVasco",
} as const;

export type RegionalRegionId = keyof typeof REGIONAL_COMMUNITY_KEYS;
export type RegionalFinderMode = "full" | "compact" | "hidden" | "empty";

export type RegionalLandingConfig = {
  aliases: readonly string[];
  description: string;
  disciplines: readonly string[];
  eyebrow: string;
  emptyState: {
    description: string;
    eyebrow: string;
    title: string;
  };
  faqs: Array<{ answer: string; question: string }>;
  h1: string;
  id: RegionalRegionId;
  name: string;
  nameWithPreposition: string;
  provinces: readonly string[];
  publicMetadata: {
    canonical: string;
    description: string;
    title: string;
  };
  publicPath: string;
  relatedLinks: Array<{ href: string; label: string }>;
  seoParagraphs: string[];
  venueAliases: readonly string[];
};

type RegionalDefinition = {
  aliases: readonly string[];
  communityKey: keyof typeof SEO_COMMUNITIES;
  description: string;
  disciplines: readonly string[];
  emptyDescription?: string;
  guideParagraphs: readonly string[];
  name: string;
  nameWithPreposition: string;
  provinces: readonly string[];
  relatedLinks?: readonly { href: string; label: string }[];
};

const STANDARD_EMPTY_DESCRIPTION =
  "Ahora mismo no hay próximas fechas confirmadas. Actualizamos la agenda cuando organizadores, clubes y circuitos publican nuevos eventos.";

const REGIONAL_DEFINITIONS: Record<RegionalRegionId, RegionalDefinition> = {
  andalucia: {
    aliases: ["Andalucía", "Andalucia"],
    communityKey: "andalucia",
    description: "Agenda de motor en Almería, Cádiz, Córdoba, Granada, Huelva, Jaén, Málaga y Sevilla.",
    disciplines: ["Rallyes y subidas", "Concentraciones", "Motocross y enduro", "Circuito"],
    guideParagraphs: [
      "Andalucía reparte su agenda entre ocho provincias, con rallyes, subidas, circuito, karting, motocross, enduro y concentraciones. Comprueba siempre municipio, horarios y fuente oficial antes de desplazarte.",
    ],
    name: "Andalucía",
    nameWithPreposition: "en Andalucía",
    provinces: ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla"],
  },
  aragon: {
    aliases: ["Aragón", "Aragon"],
    communityKey: "aragon",
    description: "Agenda de motor en Huesca, Teruel y Zaragoza, incluido el entorno de MotorLand.",
    disciplines: ["Circuito", "Karting", "Rallyes", "Motociclismo"],
    guideParagraphs: [
      "Aragón combina la actividad de MotorLand con rallyes, karting, pruebas de tierra, clásicas y citas moteras en Huesca, Teruel y Zaragoza. Revisa la ficha y la fuente oficial para confirmar cada horario.",
    ],
    name: "Aragón",
    nameWithPreposition: "en Aragón",
    provinces: ["Huesca", "Teruel", "Zaragoza"],
  },
  asturias: {
    aliases: ["Asturias", "Principado de Asturias"],
    communityKey: "asturias",
    description: "Agenda asturiana de rallyes, subidas, rutas, concentraciones y clásicos.",
    disciplines: ["Rallyes y subidas", "Rutas", "Concentraciones", "Clásicos"],
    guideParagraphs: [
      "Asturias concentra una agenda especialmente ligada a rallyes, rallysprint, subidas, rutas y clásicos. La localidad y la fuente de cada ficha ayudan a comprobar recorridos y cambios antes de salir.",
    ],
    name: "Asturias",
    nameWithPreposition: "en Asturias",
    provinces: ["Asturias"],
  },
  baleares: {
    aliases: ["Baleares", "Illes Balears", "Islas Baleares"],
    communityKey: "baleares",
    description: "Agenda de motor en Mallorca, Ibiza, Menorca y el resto de Illes Balears.",
    disciplines: ["Rallyes y subidas", "Karting", "Circuito", "Concentraciones"],
    guideParagraphs: [
      "Baleares reúne pruebas en Mallorca, Ibiza, Menorca y otras zonas de las islas. Comprueba la isla, el municipio y la fuente oficial antes de organizar el desplazamiento.",
    ],
    name: "Baleares",
    nameWithPreposition: "en Baleares",
    provinces: ["Baleares", "Illes Balears"],
  },
  canarias: {
    aliases: ["Canarias", "Islas Canarias"],
    communityKey: "canarias",
    description: "Agenda de motor en Las Palmas y Santa Cruz de Tenerife.",
    disciplines: ["Rallyes", "Montaña", "Clásicos", "Motociclismo"],
    guideParagraphs: [
      "Canarias distribuye su calendario entre las islas de Las Palmas y Santa Cruz de Tenerife, con rallyes, montaña, clásicos y motociclismo. Confirma isla, municipio y horarios en la fuente enlazada.",
    ],
    name: "Canarias",
    nameWithPreposition: "en Canarias",
    provinces: ["Las Palmas", "Santa Cruz de Tenerife"],
  },
  cantabria: {
    aliases: ["Cantabria"],
    communityKey: "cantabria",
    description: "Agenda cántabra de rallyes, subidas, rutas, concentraciones y clásicos.",
    disciplines: ["Rallyes y subidas", "Clásicos", "Rutas", "Concentraciones"],
    guideParagraphs: [
      "Cantabria mantiene una agenda vinculada a rallyes, subidas, regularidad, rutas y concentraciones. Consulta municipio, recorrido y fuente oficial antes de desplazarte.",
    ],
    name: "Cantabria",
    nameWithPreposition: "en Cantabria",
    provinces: ["Cantabria"],
  },
  castillaLaMancha: {
    aliases: ["Castilla-La Mancha", "Castilla La Mancha"],
    communityKey: "castillaLaMancha",
    description: "Agenda de motor en Albacete, Ciudad Real, Cuenca, Guadalajara y Toledo.",
    disciplines: ["Concentraciones", "Rallyes", "Clásicos", "Circuito"],
    guideParagraphs: [
      "Castilla-La Mancha reparte sus citas entre cinco provincias, con concentraciones, rallyes, clásicos, rutas y actividad de circuito. Revisa la localidad y la fuente oficial antes de planificar el viaje.",
    ],
    name: "Castilla-La Mancha",
    nameWithPreposition: "en Castilla-La Mancha",
    provinces: ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo"],
  },
  castillaYLeon: {
    aliases: ["Castilla y León", "Castilla y Leon"],
    communityKey: "castillaYLeon",
    description: "Agenda de motor en las nueve provincias de Castilla y León.",
    disciplines: ["Rallyes", "Concentraciones", "Rutas", "Clásicos"],
    guideParagraphs: [
      "Castilla y León extiende su agenda por Ávila, Burgos, León, Palencia, Salamanca, Segovia, Soria, Valladolid y Zamora. Comprueba distancias, horarios y fuente oficial en cada ficha.",
    ],
    name: "Castilla y León",
    nameWithPreposition: "en Castilla y León",
    provinces: ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"],
  },
  cataluna: {
    aliases: ["Cataluña", "Catalunya", "Cataluna"],
    communityKey: "cataluna",
    description: "Agenda de eventos en Barcelona, Girona, Lleida y Tarragona.",
    disciplines: ["Circuito", "Rallyes", "Karting", "Concentraciones"],
    guideParagraphs: [
      "Cataluña reúne una de las agendas de motor más variadas de España. Barcelona concentra grandes citas de circuito y encuentros vinculados al automóvil y la moto, mientras Girona, Lleida y Tarragona aportan rallyes, pruebas de montaña, karting, concentraciones, rutas, clásicos y actividades locales. Esta selección utiliza la ubicación estructurada de cada ficha para mostrar únicamente eventos relacionados con el territorio catalán y mantener separados los próximos eventos de los ya celebrados.",
      "Los resultados se ordenan por fecha, dando prioridad a los eventos que ya están en curso. Cada tarjeta resume cuándo se celebra la cita, su ciudad, provincia y disciplina, y enlaza con una ficha donde puede existir información adicional sobre el recinto, la organización, entradas, inscripción o fuente oficial. Antes de desplazarte conviene comprobar siempre los detalles publicados por el organizador, especialmente en competiciones, rutas o eventos sujetos a cambios de horario.",
      "Puedes explorar la agenda por provincia o por las disciplinas que realmente tienen inventario. El Circuit de Barcelona-Catalunya, los trazados de karting y las carreteras donde se celebran rallyes y pruebas de montaña forman parte del contexto habitual de la región, junto con concentraciones moteras, ferias y encuentros de vehículos clásicos.",
    ],
    name: "Cataluña",
    nameWithPreposition: "en Cataluña",
    provinces: ["Barcelona", "Girona", "Lleida", "Tarragona"],
    relatedLinks: [
      { href: "/disciplinas/circuito", label: "Circuito y tandas" },
    ],
  },
  comunidadValenciana: {
    aliases: ["Comunidad Valenciana", "Comunitat Valenciana", "País Valenciano"],
    communityKey: "comunidadValenciana",
    description: "Agenda de motor en Alicante, Castellón y Valencia.",
    disciplines: ["Rallyes", "Circuito", "Karting", "Concentraciones"],
    guideParagraphs: [
      "La Comunidad Valenciana combina el Circuit Ricardo Tormo con rallyes, karting, concentraciones, ferias y clásicos en Alicante, Castellón y Valencia. Confirma horarios y condiciones en la fuente oficial de cada ficha.",
    ],
    name: "Comunidad Valenciana",
    nameWithPreposition: "en la Comunidad Valenciana",
    provinces: ["Alicante", "Castellón", "Valencia"],
  },
  extremadura: {
    aliases: ["Extremadura"],
    communityKey: "extremadura",
    description: "Agenda de motor en Badajoz y Cáceres.",
    disciplines: ["Rallyes", "Slalom", "Karting", "Clásicos"],
    guideParagraphs: [
      "Extremadura reúne rallyes, rallysprint, slalom, karting, clásicos y pruebas de tierra entre Badajoz y Cáceres. Consulta el municipio y la fuente enlazada para confirmar recorridos y horarios.",
    ],
    name: "Extremadura",
    nameWithPreposition: "en Extremadura",
    provinces: ["Badajoz", "Cáceres"],
  },
  galicia: {
    aliases: ["Galicia"],
    communityKey: "galicia",
    description: "Agenda de motor en A Coruña, Lugo, Ourense y Pontevedra.",
    disciplines: ["Rallyes y subidas", "Concentraciones", "Clásicos", "Karting"],
    guideParagraphs: [
      "Galicia reparte una intensa agenda de rallyes, subidas, concentraciones, clásicos y karting entre A Coruña, Lugo, Ourense y Pontevedra. Revisa recorrido, horarios y fuente oficial antes de asistir.",
    ],
    name: "Galicia",
    nameWithPreposition: "en Galicia",
    provinces: ["A Coruña", "Lugo", "Ourense", "Pontevedra"],
  },
  madrid: {
    aliases: ["Madrid", "Comunidad de Madrid"],
    communityKey: "madrid",
    description: "Agenda de coches, motos y competición en la Comunidad de Madrid.",
    disciplines: ["Circuito", "Concentraciones", "Clásicos", "Ferias"],
    guideParagraphs: [
      "Madrid combina eventos de circuito, concentraciones moteras, karting, clásicos, ferias, rutas y encuentros de clubes repartidos entre la capital y los municipios de la comunidad. Esta agenda regional selecciona eventos mediante campos estructurados de región, provincia y ciudad, por lo que una referencia secundaria en el título no basta para incorporar una cita ubicada realmente en otro territorio. Los eventos futuros y en curso forman el total principal; los ya celebrados permanecen disponibles en un histórico independiente.",
      "El Circuito de Madrid Jarama es uno de los principales focos de actividad, junto con IFEMA, instalaciones de karting y municipios que acogen concentraciones, exposiciones o rutas. Las próximas citas se presentan por orden temporal y cada tarjeta enlaza con su ficha individual. Allí puedes revisar la información disponible sobre recinto, fuente oficial, entradas o inscripción antes de planificar la visita.",
      "Cuando no existe actividad publicada para el viernes, sábado o domingo más próximo, la landing no se presenta como vacía: señala la fecha del siguiente evento y muestra inmediatamente el resto del inventario futuro. Los accesos regionales aparecen solo cuando ofrecen una elección real y nunca se utilizan tarjetas deshabilitadas ni contadores con valor cero.",
    ],
    name: "Madrid",
    nameWithPreposition: "en Madrid",
    provinces: ["Madrid"],
    relatedLinks: [
      { href: "/disciplinas/circuito", label: "Circuito y tandas" },
      { href: "/disciplinas/clasicos", label: "Clásicos" },
    ],
  },
  murcia: {
    aliases: ["Región de Murcia", "Murcia"],
    communityKey: "murcia",
    description: "Agenda de motor en Murcia, Cartagena, Lorca y el resto de la región.",
    disciplines: ["Concentraciones", "Rutas", "Karting", "Circuito"],
    guideParagraphs: [
      "La Región de Murcia reúne concentraciones, rutas, karting, clásicos y actividad de circuito entre Murcia, Cartagena, Lorca y otros municipios. Confirma horarios e inscripciones en la fuente oficial.",
    ],
    name: "Murcia",
    nameWithPreposition: "en Murcia",
    provinces: ["Murcia"],
  },
  navarra: {
    aliases: ["Navarra", "Comunidad Foral de Navarra"],
    communityKey: "navarra",
    description: "Agenda de circuito, rallyes, karting, coches y motos en Navarra.",
    disciplines: ["Circuito", "Rallyes", "Karting", "Motociclismo"],
    guideParagraphs: [
      "Navarra combina la actividad del Circuito de Navarra con rallyes, karting y pruebas locales en Los Arcos, Pamplona, Tudela y otros municipios. Revisa sede y fuente oficial antes de asistir.",
    ],
    name: "Navarra",
    nameWithPreposition: "en Navarra",
    provinces: ["Navarra"],
  },
  paisVasco: {
    aliases: ["País Vasco", "Euskadi"],
    communityKey: "paisVasco",
    description: "Agenda de motor en Álava, Bizkaia y Gipuzkoa.",
    disciplines: ["Rallyes y rallysprint", "Rutas", "Concentraciones", "Clásicos"],
    guideParagraphs: [
      "El País Vasco distribuye rallysprint, subidas, rutas, concentraciones y clásicos entre Álava, Bizkaia y Gipuzkoa. Comprueba municipio, recorrido y fuente oficial en cada ficha.",
    ],
    name: "País Vasco",
    nameWithPreposition: "en el País Vasco",
    provinces: ["Álava", "Bizkaia", "Gipuzkoa"],
  },
};

function buildRegionalConfig(
  id: RegionalRegionId,
  definition: RegionalDefinition,
): RegionalLandingConfig {
  const community = SEO_COMMUNITIES[definition.communityKey];
  const page = getOpportunityPage(community.landingSlug);

  if (!page) {
    throw new Error(`No existe la landing pública regional "${community.landingSlug}".`);
  }

  return {
    aliases: definition.aliases,
    description: definition.description,
    disciplines: definition.disciplines,
    eyebrow: "Agenda territorial",
    emptyState: {
      description: definition.emptyDescription || STANDARD_EMPTY_DESCRIPTION,
      eyebrow: "Agenda en actualización",
      title: `Agenda de ${definition.name} en actualización`,
    },
    faqs: page.faqs,
    h1: page.h1,
    id,
    name: definition.name,
    nameWithPreposition: definition.nameWithPreposition,
    provinces: definition.provinces,
    publicMetadata: {
      canonical: `/${page.slug}`,
      description: page.description,
      title: page.title,
    },
    publicPath: `/${page.slug}`,
    relatedLinks: [...page.relatedLinks, ...(definition.relatedLinks || [])],
    seoParagraphs: [
      page.intro,
      ...page.editorialBlocks.map((block) => `${block.title}. ${block.text}`),
      ...page.usageSteps.map((step) => `${step.title}. ${step.text}`),
      ...definition.guideParagraphs,
    ],
    venueAliases: community.venueAliases,
  };
}

export const REGIONAL_CONFIGS = Object.fromEntries(
  Object.entries(REGIONAL_DEFINITIONS).map(([id, definition]) => [
    id,
    buildRegionalConfig(id as RegionalRegionId, definition),
  ]),
) as Record<RegionalRegionId, RegionalLandingConfig>;

export const REGIONAL_REGION_IDS = Object.keys(REGIONAL_CONFIGS) as RegionalRegionId[];

export function getRegionalCommunity(id: RegionalRegionId): SeoCommunityConfig {
  return SEO_COMMUNITIES[REGIONAL_COMMUNITY_KEYS[id]];
}

function structuredValues(value: string | null | undefined) {
  const normalized = normalizeSeoText(value || "").trim();
  if (!normalized || normalized === "por confirmar") return [];
  return [
    normalized,
    ...normalized
      .split(/[;,/|]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  ];
}

function ownersFor(
  value: string | null | undefined,
  aliases: (community: SeoCommunityConfig) => readonly string[],
) {
  const values = structuredValues(value);
  if (!values.length) return [];

  return REGIONAL_REGION_IDS.filter((id) => {
    const community = getRegionalCommunity(id);
    const normalizedAliases = aliases(community).map((alias) => normalizeSeoText(alias).trim());
    return normalizedAliases.some((alias) => values.includes(alias));
  });
}

export function matchesRegionalCommunity(
  event: EventItem,
  id: RegionalRegionId,
) {
  const regionOwners = ownersFor(
    event.region,
    (community) => [community.name, ...community.regionAliases],
  );
  if (regionOwners.length) return regionOwners.length === 1 && regionOwners[0] === id;

  const provinceOwners = ownersFor(event.province, (community) => community.provinces);
  if (provinceOwners.length) return provinceOwners.length === 1 && provinceOwners[0] === id;

  const cityOwners = ownersFor(event.city, (community) => community.cityAliases);
  if (cityOwners.length) return cityOwners.length === 1 && cityOwners[0] === id;

  return matchesSeoCommunity(event, getRegionalCommunity(id));
}

export function isRegionalRegionId(value: string): value is RegionalRegionId {
  return Object.prototype.hasOwnProperty.call(REGIONAL_CONFIGS, value);
}
