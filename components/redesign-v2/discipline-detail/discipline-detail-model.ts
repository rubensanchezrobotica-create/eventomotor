import {
  classifyEventDisciplinePage,
  isDisciplineSlug,
  type DisciplineSlug,
} from "@/components/disciplines/discipline-preview-model";
import {
  buildDisciplinesPageModel,
  isUpcomingDisciplineEvent,
} from "@/components/redesign-v2/disciplines/disciplines-model";
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

export type DisciplineHeroVisual = {
  src: string;
};

export const DISCIPLINE_HERO_VISUALS: Partial<Record<DisciplineSlug, DisciplineHeroVisual>> = {
  rallyes: {
    src: "/images/redesign-v2/disciplines/hero-rallyes.png",
  },
};

export type DisciplineDetailPageItem = {
  event: PreviewEvent;
  image: ResolvedEventImage;
};

export type DisciplineDetailPageModel = {
  definition: (typeof SEO_DISCIPLINES)[number];
  filteredCount: number;
  items: DisciplineDetailPageItem[];
  page: number;
  pageCount: number;
  query: string;
  siteUpcomingCount: number;
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
  const resolvedImages = resolveRedesignEventImages(projectedDisciplineEvents);
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
    today: siteModel.today,
    totalUpcomingCount: disciplineEvents.length,
  };
}
