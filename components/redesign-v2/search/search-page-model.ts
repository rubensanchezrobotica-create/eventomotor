import { normalizePreviewText } from "@/components/preview/search-preview-model";
import { getVehicleType } from "@/lib/event-classification";
import { rebalanceVisibleV2EventImages } from "../discipline-fallback-resolver";
import {
  filterPreviewEvents,
  type PreviewEvent,
  type ResolvedEventImage,
} from "../redesign-v2-model";

export const SEARCH_PAGE_SIZE = 12;

export const SEARCH_DISCIPLINE_OPTIONS = [
  { value: "rally", label: "Rallyes" },
  { value: "circuito", label: "Circuito" },
  { value: "concentracion", label: "Concentraciones" },
  { value: "offroad", label: "Offroad" },
  { value: "clasico", label: "Clásicos" },
  { value: "kart", label: "Karting" },
  { value: "ruta", label: "Rutas" },
  { value: "feria", label: "Ferias" },
] as const;

export const SEARCH_VEHICLE_OPTIONS = [
  { value: "moto", label: "Moto" },
  { value: "coche", label: "Coche" },
  { value: "mixto", label: "Mixto" },
  { value: "otros", label: "Otros" },
] as const;

export type SearchDiscipline = "" | (typeof SEARCH_DISCIPLINE_OPTIONS)[number]["value"];
export type SearchVehicle = "" | (typeof SEARCH_VEHICLE_OPTIONS)[number]["value"];

export type SearchPageState = {
  q: string;
  place: string;
  date: string;
  discipline: SearchDiscipline;
  vehicle: SearchVehicle;
  page: number;
};

export const EMPTY_SEARCH_PAGE_STATE: SearchPageState = {
  q: "",
  place: "",
  date: "",
  discipline: "",
  vehicle: "",
  page: 1,
};

type SearchParamRecord = Record<string, string | string[] | undefined>;
type SearchParamReader = { get(name: string): string | null };

const disciplineValues = new Set<string>(SEARCH_DISCIPLINE_OPTIONS.map(({ value }) => value));
const vehicleValues = new Set<string>(SEARCH_VEHICLE_OPTIONS.map(({ value }) => value));

function readSearchParam(params: SearchParamRecord | SearchParamReader, name: string): string {
  if ("get" in params && typeof params.get === "function") return params.get(name) ?? "";
  const value = (params as SearchParamRecord)[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeText(value: string): string {
  return value.trim().slice(0, 160);
}

function safeIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
    ? value
    : "";
}

function safePage(value: string): number {
  if (!/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

export function parseSearchPageState(params: SearchParamRecord | SearchParamReader): SearchPageState {
  const discipline = readSearchParam(params, "discipline");
  const vehicle = readSearchParam(params, "vehicle");

  return {
    q: safeText(readSearchParam(params, "q")),
    place: safeText(readSearchParam(params, "place")),
    date: safeIsoDate(readSearchParam(params, "date")),
    discipline: disciplineValues.has(discipline) ? discipline as SearchDiscipline : "",
    vehicle: vehicleValues.has(vehicle) ? vehicle as SearchVehicle : "",
    page: safePage(readSearchParam(params, "page")),
  };
}

export function serializeSearchPageState(state: SearchPageState): URLSearchParams {
  const params = new URLSearchParams();
  const q = safeText(state.q);
  const place = safeText(state.place);
  const date = safeIsoDate(state.date);

  if (q) params.set("q", q);
  if (place) params.set("place", place);
  if (date) params.set("date", date);
  if (disciplineValues.has(state.discipline)) params.set("discipline", state.discipline);
  if (vehicleValues.has(state.vehicle)) params.set("vehicle", state.vehicle);
  if (state.page > 1) params.set("page", String(safePage(String(state.page))));
  return params;
}

export function buildSearchPageHref(state: SearchPageState): string {
  const query = serializeSearchPageState(state).toString();
  return query ? `/preview/redesign-v2/buscar?${query}` : "/preview/redesign-v2/buscar";
}

export function resetSearchPage(state: SearchPageState, changes: Partial<SearchPageState>): SearchPageState {
  return { ...state, ...changes, page: 1 };
}

function matchesLocation(event: PreviewEvent, place: string): boolean {
  const location = normalizePreviewText([
    event.venue,
    event.city,
    event.province,
    event.region,
  ].filter(Boolean).join(" "));
  return location.includes(normalizePreviewText(place));
}

export function filterSearchPageEvents(
  events: readonly PreviewEvent[],
  state: SearchPageState,
): PreviewEvent[] {
  const filteredBySharedEngine = filterPreviewEvents(events, {
    place: state.q,
    date: state.date,
    discipline: state.discipline,
    vehicle: "",
  });

  return filteredBySharedEngine.filter((event) => {
    if (state.place && !matchesLocation(event, state.place)) return false;
    if (state.vehicle && getVehicleType(event) !== state.vehicle) return false;
    return true;
  });
}

export function buildSearchPageResults(
  events: readonly PreviewEvent[],
  state: SearchPageState,
  imageByEventId: Readonly<Record<string, ResolvedEventImage>>,
) {
  const filtered = filterSearchPageEvents(events, state);
  const pageCount = Math.max(1, Math.ceil(filtered.length / SEARCH_PAGE_SIZE));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * SEARCH_PAGE_SIZE;
  const visible = filtered.slice(start, start + SEARCH_PAGE_SIZE);
  const visibleImages = rebalanceVisibleV2EventImages(
    visible,
    visible.map((event) => imageByEventId[event.id]),
  );

  return {
    filtered,
    page,
    pageCount,
    total: filtered.length,
    visible,
    visibleImages,
  };
}
