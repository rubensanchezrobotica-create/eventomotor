import { slugify } from "@/lib/slug";
import type { EventItem } from "@/types/event";

export type EventListing = {
  kind: "discipline" | "region";
  slug: string;
  name: string;
  events: EventItem[];
};

export const DISCIPLINE_SLUGS: Record<string, string> = {
  motogp: "MotoGP",
  motocross: "Motocross",
  trial: "Trial",
  enduro: "Enduro",
  superbike: "Superbike",
  velocidad: "Velocidad",
  minivelocidad: "MiniVelocidad",
  mototurismo: "Mototurismo",
};

export const CANONICAL_DISCIPLINE_HREFS = [
  "/disciplinas/rallyes",
  "/disciplinas/circuito",
  "/disciplinas/concentraciones",
  "/disciplinas/offroad",
  "/disciplinas/clasicos",
  "/disciplinas/karting",
  "/disciplinas/rutas",
  "/disciplinas/ferias",
] as const;

export type CanonicalDisciplineHref = typeof CANONICAL_DISCIPLINE_HREFS[number];

type CanonicalDisciplineInput = {
  discipline: string | null | undefined;
  vehicleType?: string | null;
};

const DISCIPLINES_BY_HREF: Readonly<Record<CanonicalDisciplineHref, readonly string[]>> = {
  "/disciplinas/rallyes": [
    "Rally",
    "Rallysprint",
    "Rally Histórico",
    "Rally Tierra",
    "Rally TT",
    "Rally Raid",
    "Eco Rally",
    "Rallymix",
    "Rallycrono",
    "Rallycross",
    "Slalom",
    "Subida",
    "Montana",
    "Cronometrada",
    "Regularidad",
    "Tramo de Tierra",
    "Tramo Cronometrado de Subida",
  ],
  "/disciplinas/circuito": [
    "Circuito",
    "Tandas",
    "Trackday",
    "Velocidad",
    "MiniVelocidad",
    "Superbike",
    "MotoGP",
    "JuniorGP",
    "WorldSBK",
    "Pitbike",
    "Minimotard",
    "Supermotard",
    "Supermoto",
    "Drift",
    "Resistencia",
    "Resistencia Ciclomotores",
  ],
  "/disciplinas/concentraciones": [],
  "/disciplinas/offroad": [
    "Motocross",
    "Trial",
    "TrialGP",
    "Trial Clasicas",
    "Autocross",
    "Enduro",
    "Enduret",
    "Enduro Indoor",
    "Enduro Country",
    "Hard Enduro",
    "Enduro Clasicas",
    "Cross Country",
    "Supercross",
    "Resistencia Tierra",
    "Todo Terreno Clasico",
    "Todoterreno",
    "Off Road",
    "Offroad",
  ],
  "/disciplinas/clasicos": [],
  "/disciplinas/karting": ["Karting"],
  "/disciplinas/rutas": [],
  "/disciplinas/ferias": ["Ferias", "Feria"],
};

function normalizeTaxonomyValue(value: string | null | undefined) {
  return value
    ?.trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ") || "";
}

const CANONICAL_HREF_BY_DISCIPLINE = new Map(
  Object.entries(DISCIPLINES_BY_HREF).flatMap(([href, disciplines]) => (
    disciplines.map((discipline) => [
      normalizeTaxonomyValue(discipline),
      href as CanonicalDisciplineHref,
    ] as const)
  )),
);

const MOTORCYCLE_VEHICLE_TYPES = new Set(["moto", "motos"]);
const CLASSIC_CAR_VEHICLE_TYPES = new Set(["coche", "coches", "mixto"]);
const MOTORCYCLE_CONCENTRATION_DISCIPLINES = new Set([
  "concentracion",
  "concentraciones",
  "motoalmuerzo",
  "custom",
]);
const MOTORCYCLE_ROUTE_DISCIPLINES = new Set(["rutas", "ruta motera", "mototurismo"]);
const CLASSIC_CAR_DISCIPLINES = new Set(["clasicos", "regularidad clasicos"]);

export function getCanonicalDisciplineHref({
  discipline,
  vehicleType,
}: CanonicalDisciplineInput): CanonicalDisciplineHref | null {
  const normalizedDiscipline = normalizeTaxonomyValue(discipline);
  const normalizedVehicleType = normalizeTaxonomyValue(vehicleType);
  const mappedHref = CANONICAL_HREF_BY_DISCIPLINE.get(normalizedDiscipline);

  if (mappedHref) return mappedHref;

  if (
    MOTORCYCLE_CONCENTRATION_DISCIPLINES.has(normalizedDiscipline)
    && MOTORCYCLE_VEHICLE_TYPES.has(normalizedVehicleType)
  ) {
    return "/disciplinas/concentraciones";
  }

  if (
    MOTORCYCLE_ROUTE_DISCIPLINES.has(normalizedDiscipline)
    && MOTORCYCLE_VEHICLE_TYPES.has(normalizedVehicleType)
  ) {
    return "/disciplinas/rutas";
  }

  if (
    CLASSIC_CAR_DISCIPLINES.has(normalizedDiscipline)
    && CLASSIC_CAR_VEHICLE_TYPES.has(normalizedVehicleType)
  ) {
    return "/disciplinas/clasicos";
  }

  return null;
}

const REGION_ALIASES: Record<string, string[]> = {
  andalucia: ["andalucia", "andalusia"],
  catalunya: ["catalunya", "cataluna", "catalonia"],
  aragon: ["aragon"],
  navarra: ["navarra"],
  valencia: ["valencia", "comunitat-valenciana", "comunidad-valenciana"],
  murcia: ["murcia", "region-de-murcia"],
};

export function getDisciplineSlug(name: string) {
  return slugify(name);
}

export function getRegionSlug(name: string) {
  const slug = slugify(name);
  const alias = Object.entries(REGION_ALIASES).find(([, values]) => values.includes(slug));

  return alias?.[0] || slug;
}

function sameDiscipline(event: EventItem, name: string) {
  return slugify(event.discipline) === slugify(name);
}

function sameRegion(event: EventItem, slug: string) {
  const candidates = [event.region, event.province].map(getRegionSlug);
  const aliases = REGION_ALIASES[slug] || [slug];

  return candidates.some((candidate) => candidate === slug || aliases.includes(candidate));
}

export function resolveEventListing(slug: string, events: EventItem[]): EventListing | null {
  const normalizedSlug = slugify(slug);
  const disciplineName = DISCIPLINE_SLUGS[normalizedSlug];

  if (disciplineName) {
    const listingEvents = events.filter((event) => sameDiscipline(event, disciplineName));

    return listingEvents.length
      ? { kind: "discipline", slug: normalizedSlug, name: disciplineName, events: listingEvents }
      : null;
  }

  const regionEvents = events.filter((event) => sameRegion(event, normalizedSlug));

  if (!regionEvents.length) {
    return null;
  }

  return {
    kind: "region",
    slug: normalizedSlug,
    name: regionEvents[0].region,
    events: regionEvents,
  };
}

export function getListingLinks(events: EventItem[]) {
  const disciplineLinks = Object.entries(DISCIPLINE_SLUGS)
    .map(([slug, name]) => ({
      kind: "discipline" as const,
      slug,
      name,
      count: events.filter((event) => sameDiscipline(event, name)).length,
    }))
    .filter((link) => link.count > 0);

  const regionMap = new Map<string, { kind: "region"; slug: string; name: string; count: number }>();

  for (const event of events) {
    const slug = getRegionSlug(event.region);
    const current = regionMap.get(slug);

    if (current) {
      current.count += 1;
    } else {
      regionMap.set(slug, { kind: "region", slug, name: event.region, count: 1 });
    }
  }

  return {
    disciplines: disciplineLinks,
    regions: [...regionMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
