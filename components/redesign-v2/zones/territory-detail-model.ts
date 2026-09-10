import { classifyEventDisciplinePage } from "@/components/disciplines/discipline-preview-model";
import { paginateVisibleEvents } from "@/components/redesign-v2/listing/paginate-visible-events";
import {
  projectPreviewEvent,
  resolveRedesignEventImages,
  type PreviewEvent,
  type ResolvedEventImage,
} from "@/components/redesign-v2/redesign-v2-model";
import {
  isRegionalRegionId,
  REGIONAL_CONFIGS,
} from "@/lib/regions/regional-config";
import {
  getSpanishTerritoryBySlug,
  isSpanishTerritoryEvent,
  matchEventToSpanishTerritory,
  SPANISH_TERRITORIES,
  type SpanishTerritory,
} from "@/lib/regions/territory-contract";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";
import {
  buildTerritoryDirectoryModel,
  isUpcomingTerritoryEvent,
} from "./territory-directory-model";

export const TERRITORY_DETAIL_PAGE_SIZE = 12;
export const TERRITORY_DETAIL_QUERY_MAX_LENGTH = 120;

export type TerritoryDetailState = "EMPTY" | "MINIMAL" | "COMPACT" | "FULL";

export type TerritoryDetailFilterOption = Readonly<{
  count: number;
  key: string;
  label: string;
}>;

export type TerritoryDetailQuery = Readonly<{
  discipline: string;
  page: number;
  province: string;
  q: string;
}>;

export type TerritoryDetailPageItem = Readonly<{
  event: PreviewEvent;
  image: ResolvedEventImage;
}>;

export type TerritoryDetailPageModel = Readonly<{
  activeProvinceCount: number;
  description: string;
  disciplineOptions: readonly TerritoryDetailFilterOption[];
  faqs: readonly { answer: string; question: string }[];
  filteredCount: number;
  guideParagraphs: readonly string[];
  items: readonly TerritoryDetailPageItem[];
  page: number;
  pageCount: number;
  provinceOptions: readonly TerritoryDetailFilterOption[];
  query: TerritoryDetailQuery;
  relatedLinks: readonly { href: string; label: string }[];
  showDisciplineFilter: boolean;
  showProvinceFilter: boolean;
  showTextSearch: boolean;
  siteUpcomingCount: number;
  state: TerritoryDetailState;
  territory: SpanishTerritory;
  today: string;
  totalUpcomingCount: number;
}>;

const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "cancelado", "cancelada"]);
const UNKNOWN_FILTER_VALUES = new Set(["", "a-confirmar", "por-confirmar", "sin-determinar", "sin-provincia"]);
const EMPTY_IMAGE: ResolvedEventImage = { alt: "", kind: "neutral", src: null };

function cleanText(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeTerritoryDetailText(value: string | null | undefined) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function territoryDetailFilterKey(value: string | null | undefined) {
  return normalizeTerritoryDetailText(value).replace(/\s+/g, "-");
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTerritoryDetailPage(value: string | string[] | undefined) {
  const candidate = firstParam(value);
  if (!candidate || !/^\d+$/.test(candidate)) return 1;
  const page = Number(candidate);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function parseTerritoryDetailQuery(
  searchParams: Record<string, string | string[] | undefined>,
): TerritoryDetailQuery {
  return {
    discipline: territoryDetailFilterKey(firstParam(searchParams.discipline)),
    page: parseTerritoryDetailPage(searchParams.page),
    province: territoryDetailFilterKey(firstParam(searchParams.province)),
    q: cleanText(firstParam(searchParams.q)).slice(0, TERRITORY_DETAIL_QUERY_MAX_LENGTH),
  };
}

export function resolvePreviewTerritory(slug: string) {
  const territory = getSpanishTerritoryBySlug(slug);
  if (
    !territory
    || territory.slug !== slug
    || territory.kind !== "AUTONOMOUS_COMMUNITY"
    || !territory.launchLandingEligible
  ) return null;
  return territory;
}

export function previewTerritories() {
  return SPANISH_TERRITORIES.filter((territory) => (
    territory.kind === "AUTONOMOUS_COMMUNITY" && territory.launchLandingEligible
  ));
}

export function territoryDetailState(total: number): TerritoryDetailState {
  if (total >= 10) return "FULL";
  if (total >= 3) return "COMPACT";
  if (total >= 1) return "MINIMAL";
  return "EMPTY";
}

function isCancelled(event: EventItem) {
  return CANCELLED_STATUSES.has(normalizeTerritoryDetailText(event.eventStatus))
    || event.dataQuality === "cancelled";
}

function eventIdentity(event: EventItem) {
  return cleanText(event.slug || event.id);
}

function deduplicateVisibleEvents(events: readonly EventItem[]) {
  const unique = new Map<string, EventItem>();

  for (const event of events) {
    if (event.visible === false || isCancelled(event)) continue;
    const identity = eventIdentity(event);
    if (!identity || unique.has(identity)) continue;
    unique.set(identity, event);
  }

  return [...unique.values()];
}

function chronologicalOrder(left: EventItem, right: EventItem) {
  return left.start.localeCompare(right.start)
    || String(left.end || left.start).localeCompare(String(right.end || right.start))
    || left.title.localeCompare(right.title, "es")
    || eventIdentity(left).localeCompare(eventIdentity(right));
}

function buildOptions(
  events: readonly EventItem[],
  readOption: (event: EventItem) => { key: string; label: string } | null,
) {
  const options = new Map<string, TerritoryDetailFilterOption>();

  for (const event of events) {
    const option = readOption(event);
    if (!option || UNKNOWN_FILTER_VALUES.has(option.key)) continue;
    const current = options.get(option.key);
    options.set(option.key, {
      count: (current?.count ?? 0) + 1,
      key: option.key,
      label: current?.label ?? option.label,
    });
  }

  return [...options.values()].sort((left, right) => (
    right.count - left.count || left.label.localeCompare(right.label, "es")
  ));
}

function provinceOption(event: EventItem) {
  const label = cleanText(event.province);
  const key = territoryDetailFilterKey(label);
  return key ? { key, label } : null;
}

function disciplineOption(event: EventItem) {
  const slug = classifyEventDisciplinePage(event);
  const discipline = slug
    ? SEO_DISCIPLINES.find((candidate) => candidate.slug === slug)
    : null;
  return discipline ? { key: discipline.slug, label: discipline.title } : null;
}

function eventMatchesSearch(event: EventItem, q: string) {
  if (!q) return true;
  const haystack = normalizeTerritoryDetailText([
    event.title,
    event.venue,
    event.city,
    event.province,
  ].filter(Boolean).join(" "));
  return haystack.includes(normalizeTerritoryDetailText(q));
}

function territoryContent(territory: SpanishTerritory) {
  if (isRegionalRegionId(territory.id)) {
    const config = REGIONAL_CONFIGS[territory.id];
    return {
      description: config.description,
      faqs: config.faqs,
      guideParagraphs: config.seoParagraphs,
      relatedLinks: config.relatedLinks,
    };
  }

  return {
    description: `Consulta los próximos eventos de motor en ${territory.displayName}.`,
    faqs: [],
    guideParagraphs: [],
    relatedLinks: [],
  };
}

function validFilterKey(
  requested: string,
  options: readonly TerritoryDetailFilterOption[],
) {
  return options.some(({ key }) => key === requested) ? requested : "";
}

export function territoryDetailPageHref(
  territorySlug: string,
  query: Partial<TerritoryDetailQuery> = {},
) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.province) params.set("province", query.province);
  if (query.discipline) params.set("discipline", query.discipline);
  if ((query.page ?? 1) > 1) params.set("page", String(query.page));
  const search = params.toString();
  const base = `/preview/redesign-v2/zonas/${territorySlug}`;
  return search ? `${base}?${search}` : base;
}

export function territoryDetailPaginationItems(page: number, pageCount: number) {
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

export function territoryDetailHeroSummary(model: TerritoryDetailPageModel) {
  const eventLabel = model.totalUpcomingCount === 1
    ? "1 evento próximo"
    : `${model.totalUpcomingCount} eventos próximos`;
  const provinceLabel = model.activeProvinceCount === 1
    ? "1 provincia con actividad"
    : `${model.activeProvinceCount} provincias con actividad`;
  return `${eventLabel} · ${provinceLabel}. Descubre los próximos eventos de motor en ${model.territory.displayName}.`;
}

export function territoryDetailResultsSummary(model: TerritoryDetailPageModel) {
  const hasFilters = Boolean(model.query.q || model.query.province || model.query.discipline);
  if (!model.filteredCount) {
    return hasFilters
      ? "No hay próximos eventos que coincidan con los filtros seleccionados."
      : "Sin próximos eventos publicados en este territorio.";
  }
  if (model.pageCount === 1) {
    const noun = model.filteredCount === 1 ? "evento próximo" : "eventos próximos";
    const order = model.filteredCount === 1 ? "ordenado" : "ordenados";
    return `${model.filteredCount} ${noun}, ${order} por fecha.`;
  }
  const first = (model.page - 1) * TERRITORY_DETAIL_PAGE_SIZE + 1;
  const last = first + model.items.length - 1;
  return `Mostrando ${first}–${last} de ${model.filteredCount} eventos próximos, ordenados por fecha.`;
}

export function buildTerritoryDetailPageModel(
  events: readonly EventItem[],
  territory: SpanishTerritory,
  options: { now: string | Date; query: TerritoryDetailQuery },
): TerritoryDetailPageModel {
  const directory = buildTerritoryDirectoryModel(events, options.now);
  const territorialEvents = deduplicateVisibleEvents(events)
    .filter((event) => isUpcomingTerritoryEvent(event, directory.today))
    .filter((event) => isSpanishTerritoryEvent(event))
    .filter((event) => matchEventToSpanishTerritory(event)?.id === territory.id)
    .sort(chronologicalOrder);
  const state = territoryDetailState(territorialEvents.length);
  const provinceOptions = buildOptions(territorialEvents, provinceOption);
  const disciplineOptions = buildOptions(territorialEvents, disciplineOption);
  const showTextSearch = state === "FULL";
  const showProvinceFilter = (state === "FULL" || state === "COMPACT") && provinceOptions.length >= 2;
  const showDisciplineFilter = (state === "FULL" || state === "COMPACT") && disciplineOptions.length >= 2;
  const query: TerritoryDetailQuery = {
    discipline: showDisciplineFilter
      ? validFilterKey(options.query.discipline, disciplineOptions)
      : "",
    page: options.query.page,
    province: showProvinceFilter
      ? validFilterKey(options.query.province, provinceOptions)
      : "",
    q: showTextSearch ? options.query.q : "",
  };
  const filteredEvents = territorialEvents.filter((event) => (
    (!query.province || provinceOption(event)?.key === query.province)
    && (!query.discipline || disciplineOption(event)?.key === query.discipline)
    && eventMatchesSearch(event, query.q)
  ));
  const projectedEvents = filteredEvents.map(projectPreviewEvent);
  const neutralImages = Object.fromEntries(
    projectedEvents.map((event) => [event.id, EMPTY_IMAGE]),
  );
  const pagination = paginateVisibleEvents({
    events: projectedEvents,
    imageByEventId: neutralImages,
    page: query.page,
    pageSize: TERRITORY_DETAIL_PAGE_SIZE,
  });
  const visibleEvents = pagination.visible;
  const visibleImages = resolveRedesignEventImages(visibleEvents);
  const content = territoryContent(territory);

  return {
    activeProvinceCount: provinceOptions.length,
    description: content.description,
    disciplineOptions,
    faqs: content.faqs,
    filteredCount: pagination.total,
    guideParagraphs: content.guideParagraphs,
    items: visibleEvents.map((event, index) => ({ event, image: visibleImages[index] })),
    page: pagination.page,
    pageCount: pagination.pageCount,
    provinceOptions,
    query: { ...query, page: pagination.page },
    relatedLinks: content.relatedLinks,
    showDisciplineFilter,
    showProvinceFilter,
    showTextSearch,
    siteUpcomingCount: directory.totalUpcomingEventCount,
    state,
    territory,
    today: directory.today,
    totalUpcomingCount: territorialEvents.length,
  };
}
