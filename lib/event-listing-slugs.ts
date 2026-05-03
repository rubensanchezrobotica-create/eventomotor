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
