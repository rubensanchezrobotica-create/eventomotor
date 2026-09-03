import {
  classifyEventDisciplinePage,
  isDisciplineSlug,
  type DisciplineSlug,
} from "@/components/disciplines/discipline-preview-model";
import {
  buildDisciplinesPageModel,
  isUpcomingDisciplineEvent,
} from "@/components/redesign-v2/disciplines/disciplines-model";
import {
  resolveV2EventImageCandidates,
  stableV2EventKey,
  stableV2Hash,
} from "@/components/redesign-v2/discipline-fallback-resolver";
import { paginateVisibleEvents } from "@/components/redesign-v2/listing/paginate-visible-events";
import {
  projectPreviewEvent,
  resolveRedesignEventImages,
  type PreviewEvent,
  type ResolvedEventImage,
} from "@/components/redesign-v2/redesign-v2-model";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

export const DISCIPLINE_DETAIL_PAGE_SIZE = 12;
export const DISCIPLINE_DETAIL_QUERY_MAX_LENGTH = 120;
export const DISCIPLINE_SEARCH_MIN_CHARS = 2;
export const DISCIPLINE_SEARCH_MAX_SUGGESTIONS = 6;
const DISCIPLINE_SEARCH_MAX_EVENT_SUGGESTIONS = 4;
const DISCIPLINE_SEARCH_MAX_LOCATION_SUGGESTIONS = 2;

export type DisciplineHeroVisual = {
  src: string;
};

export const DISCIPLINE_HERO_VISUALS: Partial<Record<DisciplineSlug, DisciplineHeroVisual>> = {
  rallyes: {
    src: "/images/redesign-v2/disciplines/hero-rallyes.png",
  },
  circuito: {
    src: "/images/redesign-v2/disciplines/hero-circuito.png",
  },
  concentraciones: {
    src: "/images/redesign-v2/disciplines/hero-concentraciones.png",
  },
  offroad: {
    src: "/images/redesign-v2/disciplines/hero-offroad.png",
  },
};

export type DisciplineDetailPageItem = {
  event: PreviewEvent;
  image: ResolvedEventImage;
};

export type DisciplineSearchSuggestionSource = {
  slug: string;
  title: string;
  city?: string;
  province?: string;
  venue?: string;
};

export type DisciplineSearchSuggestion = {
  href: string;
  id: string;
  kind: "event" | "location";
  label: string;
  meta?: string;
};

export type DisciplineDetailPageModel = {
  definition: (typeof SEO_DISCIPLINES)[number];
  filteredCount: number;
  items: DisciplineDetailPageItem[];
  page: number;
  pageCount: number;
  query: string;
  siteUpcomingCount: number;
  suggestionIndex: DisciplineSearchSuggestionSource[];
  today: string;
  totalUpcomingCount: number;
};

function eventIdentity(event: EventItem) {
  return String(event.slug || event.id).trim();
}

function deduplicateVisibleEvents(events: readonly EventItem[]) {
  const unique = new Map<string, EventItem>();

  for (const event of events) {
    if (event.visible === false) continue;
    const identity = eventIdentity(event);
    if (!identity || unique.has(identity)) continue;
    unique.set(identity, event);
  }

  return [...unique.values()];
}

function chronologicalEventOrder(left: EventItem, right: EventItem) {
  return left.start.localeCompare(right.start)
    || String(left.end || left.start).localeCompare(String(right.end || right.start))
    || left.title.localeCompare(right.title, "es")
    || eventIdentity(left).localeCompare(eventIdentity(right));
}

export function resolveDisciplineDetailDefinition(slug: string) {
  if (!isDisciplineSlug(slug)) return null;
  return SEO_DISCIPLINES.find((discipline) => discipline.slug === slug) ?? null;
}

export function resolveDisciplineHeroVisual(slug: DisciplineSlug) {
  return DISCIPLINE_HERO_VISUALS[slug] ?? null;
}

export function parseDisciplineDetailPage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d+$/.test(candidate)) return 1;
  const page = Number(candidate);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function parseDisciplineDetailQuery(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return String(candidate ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, DISCIPLINE_DETAIL_QUERY_MAX_LENGTH);
}

export function normalizeDisciplineSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim()
    .replace(/\s+/g, " ");
}

export function eventMatchesDisciplineSearch(event: EventItem, query: string) {
  const normalizedQuery = normalizeDisciplineSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeDisciplineSearchText([
    event.title,
    event.city,
    event.province,
    event.venue,
  ].filter((value) => typeof value === "string" && value.trim()).join(" "));

  return haystack.includes(normalizedQuery);
}

function compactSearchText(value: unknown) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || undefined;
}

function locationLabel(city?: string, province?: string) {
  if (!city) return province;
  if (!province || normalizeDisciplineSearchText(city) === normalizeDisciplineSearchText(province)) {
    return city;
  }
  return `${city}, ${province}`;
}

function suggestionMatchRank(values: Array<string | undefined>, normalizedQuery: string) {
  const normalizedValues = values
    .map(normalizeDisciplineSearchText)
    .filter(Boolean);
  if (!normalizedValues.some((value) => value.includes(normalizedQuery))) return null;
  if (normalizedValues.some((value) => value.startsWith(normalizedQuery))) return 0;
  if (normalizedValues.some((value) => value.split(" ").some((word) => word.startsWith(normalizedQuery)))) return 1;
  return 2;
}

export function buildDisciplineSearchSuggestionIndex(
  events: readonly EventItem[],
): DisciplineSearchSuggestionSource[] {
  const unique = new Map<string, DisciplineSearchSuggestionSource>();

  for (const event of events) {
    const slug = compactSearchText(event.slug || event.id);
    const title = compactSearchText(event.title);
    if (!slug || !title || unique.has(slug)) continue;
    const city = compactSearchText(event.city);
    const province = compactSearchText(event.province);
    const venue = compactSearchText(event.venue);
    unique.set(slug, {
      slug,
      title,
      ...(city ? { city } : {}),
      ...(province ? { province } : {}),
      ...(venue ? { venue } : {}),
    });
  }

  return [...unique.values()];
}

export function buildDisciplineSearchSuggestions(
  source: readonly DisciplineSearchSuggestionSource[],
  query: string,
  disciplineSlug: DisciplineSlug,
): DisciplineSearchSuggestion[] {
  const normalizedQuery = normalizeDisciplineSearchText(query);
  if (normalizedQuery.length < DISCIPLINE_SEARCH_MIN_CHARS) return [];

  const uniqueSource = [...new Map(
    source.map((event) => [normalizeDisciplineSearchText(event.slug), event]),
  ).values()];

  const eventSuggestions = uniqueSource
    .map((event, index) => ({
      event,
      index,
      rank: suggestionMatchRank(
        [event.title, event.city, event.province, event.venue],
        normalizedQuery,
      ),
    }))
    .filter((candidate): candidate is typeof candidate & { rank: number } => candidate.rank !== null)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, DISCIPLINE_SEARCH_MAX_EVENT_SUGGESTIONS)
    .map(({ event }) => ({
      href: `/preview/redesign-v2/evento/${event.slug}`,
      id: `event:${event.slug}`,
      kind: "event" as const,
      label: event.title,
      meta: locationLabel(event.city, event.province) || event.venue,
    }));

  const locations = new Map<string, {
    firstIndex: number;
    label: string;
    queryValue: string;
    rank: number;
  }>();

  function addLocation(label: string | undefined, queryValue: string | undefined, index: number) {
    if (!label || !queryValue) return;
    const normalizedLabel = normalizeDisciplineSearchText(label);
    const rank = suggestionMatchRank([label], normalizedQuery);
    if (!normalizedLabel || rank === null || locations.has(normalizedLabel)) return;
    locations.set(normalizedLabel, { firstIndex: index, label, queryValue, rank });
  }

  uniqueSource.forEach((event, index) => {
    addLocation(locationLabel(event.city, event.province), event.city || event.province, index);
    if (event.province && normalizeDisciplineSearchText(event.province) !== normalizeDisciplineSearchText(event.city)) {
      addLocation(event.province, event.province, index);
    }
  });

  const locationSuggestions = [...locations.values()]
    .sort((left, right) => left.rank - right.rank
      || left.firstIndex - right.firstIndex
      || left.label.localeCompare(right.label, "es"))
    .slice(0, DISCIPLINE_SEARCH_MAX_LOCATION_SUGGESTIONS)
    .map((location) => ({
      href: disciplineDetailPageHref(disciplineSlug, 1, location.queryValue),
      id: `location:${normalizeDisciplineSearchText(location.label)}`,
      kind: "location" as const,
      label: location.label,
    }));

  return [...eventSuggestions, ...locationSuggestions]
    .slice(0, DISCIPLINE_SEARCH_MAX_SUGGESTIONS);
}

export function disciplineDetailPageHref(slug: DisciplineSlug, page: number, query = "") {
  const base = `/preview/redesign-v2/disciplinas/${slug}`;
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

export function disciplineDetailPaginationItems(page: number, pageCount: number) {
  if (pageCount <= 1) return [] as Array<number | "ellipsis">;
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((candidate) => candidate >= 1 && candidate <= pageCount)
    .sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];

  pages.forEach((candidate, index) => {
    if (index > 0 && candidate - pages[index - 1] > 1) items.push("ellipsis");
    items.push(candidate);
  });

  return items;
}

export function resolveDisciplineDetailEventImage(event: PreviewEvent): ResolvedEventImage {
  const [baseImage] = resolveRedesignEventImages([event]);
  if (baseImage.kind !== "representative") return baseImage;

  const compatibleCandidates = resolveV2EventImageCandidates(event)
    .filter(({ tier }) => tier <= 2)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (!compatibleCandidates.length) return baseImage;

  const stableHash = stableV2Hash(stableV2EventKey(event));
  const selectedIndex = Math.floor(
    (stableHash / 2 ** 32) * compatibleCandidates.length,
  );
  const selected = compatibleCandidates[selectedIndex];

  return { ...baseImage, src: selected.src };
}

export function buildDisciplineDetailPageModel(
  events: readonly EventItem[],
  slug: DisciplineSlug,
  options: { now: string | Date; page: number; query?: string },
): DisciplineDetailPageModel {
  const definition = SEO_DISCIPLINES.find((discipline) => discipline.slug === slug);
  if (!definition) throw new Error(`Disciplina desconocida: ${slug}`);

  const siteModel = buildDisciplinesPageModel(events, options.now);
  const query = parseDisciplineDetailQuery(options.query);
  const disciplineEvents = deduplicateVisibleEvents(events)
    .filter((event) => isUpcomingDisciplineEvent(event, siteModel.today))
    .filter((event) => classifyEventDisciplinePage(event) === slug)
    .sort(chronologicalEventOrder);
  const projectedDisciplineEvents = disciplineEvents.map(projectPreviewEvent);
  const suggestionIndex = buildDisciplineSearchSuggestionIndex(disciplineEvents);
  const resolvedImages = projectedDisciplineEvents.map(resolveDisciplineDetailEventImage);
  const imageByEventId = Object.fromEntries(
    projectedDisciplineEvents.map((event, index) => [event.id, resolvedImages[index]]),
  );
  const filteredEvents = disciplineEvents
    .filter((event) => eventMatchesDisciplineSearch(event, query))
    .map(projectPreviewEvent);
  const pagination = paginateVisibleEvents({
    events: filteredEvents,
    imageByEventId,
    page: options.page,
    pageSize: DISCIPLINE_DETAIL_PAGE_SIZE,
  });

  return {
    definition,
    filteredCount: pagination.total,
    items: pagination.visible.map((event, index) => ({
      event,
      image: pagination.visibleImages[index],
    })),
    page: pagination.page,
    pageCount: pagination.pageCount,
    query,
    siteUpcomingCount: siteModel.totalUpcomingEventCount,
    suggestionIndex,
    today: siteModel.today,
    totalUpcomingCount: disciplineEvents.length,
  };
}
