import type { PreviewEvent } from "../redesign-v2-model";
import {
  addCalendarDays,
  isCalendarDateKey,
  madridCalendarDateKey,
} from "../calendar/calendar-page-model";

export const WEEKEND_ROUTE = "/preview/redesign-v2/eventos-motor-este-fin-de-semana";
export const WEEKEND_PAGE_SIZE = 12;

export const WEEKEND_DISCIPLINES = [
  { value: "rallyes", label: "Rallyes", terms: ["rally", "rallye", "rallysprint", "subida", "montana"] },
  { value: "circuito", label: "Circuito", terms: ["circuito", "trackday", "tandas", "velocidad", "motogp", "superbike"] },
  { value: "concentraciones", label: "Concentraciones", terms: ["concentracion", "motoalmuerzo", "bikers", "motero"] },
  { value: "offroad", label: "Offroad", terms: ["offroad", "motocross", "supercross", "enduro", "trial", "cross country", "raid"] },
  { value: "clasicos", label: "Clásicos", terms: ["clasico", "clasica", "historico", "retro"] },
  { value: "karting", label: "Karting", terms: ["kart", "karting"] },
  { value: "rutas", label: "Rutas", terms: ["ruta", "mototurismo", "touring", "road trip"] },
  { value: "ferias", label: "Ferias", terms: ["feria", "salon", "expo", "exposicion", "motor show"] },
] as const;

export const WEEKEND_VEHICLES = [
  { value: "moto", label: "Moto" },
  { value: "coche", label: "Coche" },
  { value: "mixto", label: "Mixto" },
  { value: "otros", label: "Otros" },
] as const;

export type WeekendDay = "all" | "fri" | "sat" | "sun";

export type WeekendRange = {
  today: string;
  start: string;
  end: string;
  friday: string;
  saturday: string;
  sunday: string;
};

export type WeekendUrlState = {
  q: string;
  discipline: string;
  vehicle: string;
  day: WeekendDay;
  page: number;
};

export type WeekendQueryRecord = Record<string, string | string[] | undefined>;

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  timeZone: "Europe/Madrid",
});

const longDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
});

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readQuery(query: WeekendQueryRecord | URLSearchParams, name: string): string {
  return query instanceof URLSearchParams
    ? query.get(name) ?? ""
    : firstQueryValue(query[name]);
}

function normalizeAllowedValue(value: string, allowed: readonly string[]): string {
  const normalized = normalizeWeekendText(value);
  return allowed.includes(normalized) ? normalized : "";
}

function eventRange(event: PreviewEvent): { start: string; end: string } | null {
  if (!isCalendarDateKey(event.start)) return null;
  const end = isCalendarDateKey(event.end) && event.end >= event.start
    ? event.end
    : event.start;
  return { start: event.start, end };
}

function eventSearchText(event: PreviewEvent): string {
  return normalizeWeekendText([
    event.title,
    event.championship,
    event.discipline,
    event.venue,
    event.city,
    event.province,
    event.region,
    event.tags.join(" "),
    event.vehicleType,
  ].join(" "));
}

function matchesDiscipline(event: PreviewEvent, discipline: string): boolean {
  if (!discipline) return true;
  const definition = WEEKEND_DISCIPLINES.find((item) => item.value === discipline);
  if (!definition) return false;
  const text = normalizeWeekendText([
    event.title,
    event.championship,
    event.discipline,
    event.tags.join(" "),
    event.vehicleType,
  ].join(" "));
  return definition.terms.some((term) => text.includes(normalizeWeekendText(term)));
}

function normalizedVehicle(event: PreviewEvent): string {
  const vehicle = normalizeWeekendText(event.vehicleType);
  return ["moto", "coche", "mixto"].includes(vehicle) ? vehicle : "otros";
}

export function normalizeWeekendText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim();
}

export function calculateWeekendRange(now: string | Date = new Date()): WeekendRange {
  const today = madridCalendarDateKey(now);
  const weekday = dateFromKey(today).getUTCDay();
  const fridayOffset = weekday === 0
    ? -2
    : weekday === 6
      ? -1
      : weekday <= 4
        ? 5 - weekday
        : 0;
  const friday = addCalendarDays(today, fridayOffset);
  const saturday = addCalendarDays(friday, 1);
  const sunday = addCalendarDays(friday, 2);

  return { today, start: friday, end: sunday, friday, saturday, sunday };
}

export function eventIntersectsWeekend(event: PreviewEvent, range: WeekendRange): boolean {
  const dates = eventRange(event);
  return Boolean(dates && dates.start <= range.end && dates.end >= range.start);
}

export function eventMatchesWeekendDay(event: PreviewEvent, day: WeekendDay, range: WeekendRange): boolean {
  if (day === "all") return eventIntersectsWeekend(event, range);
  const target = day === "fri" ? range.friday : day === "sat" ? range.saturday : range.sunday;
  const dates = eventRange(event);
  return Boolean(dates && dates.start <= target && dates.end >= target);
}

export function parseWeekendUrlState(query: WeekendQueryRecord | URLSearchParams): WeekendUrlState {
  const requestedDay = normalizeWeekendText(readQuery(query, "day"));
  const rawPage = Number.parseInt(readQuery(query, "page"), 10);
  return {
    q: readQuery(query, "q").trim().slice(0, 80),
    discipline: normalizeAllowedValue(
      readQuery(query, "discipline"),
      WEEKEND_DISCIPLINES.map((item) => item.value),
    ),
    vehicle: normalizeAllowedValue(
      readQuery(query, "vehicle"),
      WEEKEND_VEHICLES.map((item) => item.value),
    ),
    day: (["fri", "sat", "sun"] as const).includes(requestedDay as "fri" | "sat" | "sun")
      ? requestedDay as WeekendDay
      : "all",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function serializeWeekendUrlState(state: WeekendUrlState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.discipline) params.set("discipline", state.discipline);
  if (state.vehicle) params.set("vehicle", state.vehicle);
  if (state.day !== "all") params.set("day", state.day);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function countWeekendSecondaryFilters(state: Pick<WeekendUrlState, "discipline" | "vehicle">): number {
  return [state.discipline, state.vehicle].filter(Boolean).length;
}

export function filterWeekendEvents(
  events: readonly PreviewEvent[],
  state: Pick<WeekendUrlState, "q" | "discipline" | "vehicle">,
): PreviewEvent[] {
  const query = normalizeWeekendText(state.q);
  return [...events]
    .filter((event) => {
      if (query && !eventSearchText(event).includes(query)) return false;
      if (!matchesDiscipline(event, state.discipline)) return false;
      if (state.vehicle && normalizedVehicle(event) !== state.vehicle) return false;
      return true;
    })
    .sort((left, right) => (
      left.start.localeCompare(right.start)
      || left.title.localeCompare(right.title, "es")
      || left.id.localeCompare(right.id)
    ));
}

export function buildWeekendDayCounts(
  events: readonly PreviewEvent[],
  state: Pick<WeekendUrlState, "q" | "discipline" | "vehicle">,
  range: WeekendRange,
): Record<WeekendDay, number> {
  const filtered = filterWeekendEvents(events, state);
  return {
    all: filtered.length,
    fri: filtered.filter((event) => eventMatchesWeekendDay(event, "fri", range)).length,
    sat: filtered.filter((event) => eventMatchesWeekendDay(event, "sat", range)).length,
    sun: filtered.filter((event) => eventMatchesWeekendDay(event, "sun", range)).length,
  };
}

export function buildWeekendResults(
  events: readonly PreviewEvent[],
  state: WeekendUrlState,
  range: WeekendRange,
): PreviewEvent[] {
  return filterWeekendEvents(events, state)
    .filter((event) => eventMatchesWeekendDay(event, state.day, range));
}

export function paginateWeekendEvents<T>(events: readonly T[], page: number, pageSize = WEEKEND_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(events.length / safePageSize));
  const normalizedPage = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (normalizedPage - 1) * safePageSize;
  return {
    page: normalizedPage,
    pageCount,
    total: events.length,
    visible: events.slice(start, start + safePageSize),
  };
}

export function formatWeekendRangeLabel(range: WeekendRange): string {
  const start = dateFromKey(range.start);
  const end = dateFromKey(range.end);
  const startMonth = monthFormatter.format(start).replace(".", "").toLocaleUpperCase("es-ES");
  const endMonth = monthFormatter.format(end).replace(".", "").toLocaleUpperCase("es-ES");
  const sameMonth = range.start.slice(0, 7) === range.end.slice(0, 7);
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  if (sameMonth) return `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth} ${end.getUTCFullYear()}`;
  if (sameYear) return `${start.getUTCDate()} ${startMonth}–${end.getUTCDate()} ${endMonth} ${end.getUTCFullYear()}`;
  return `${start.getUTCDate()} ${startMonth} ${start.getUTCFullYear()}–${end.getUTCDate()} ${endMonth} ${end.getUTCFullYear()}`;
}

export function formatWeekendDayDate(value: string): string {
  return longDateFormatter.format(dateFromKey(value));
}

export function formatWeekendEventDate(event: PreviewEvent): string {
  const dates = eventRange(event);
  if (!dates) return "Fecha por confirmar";
  if (dates.start === dates.end) return longDateFormatter.format(dateFromKey(dates.start));
  return `${longDateFormatter.format(dateFromKey(dates.start))} — ${longDateFormatter.format(dateFromKey(dates.end))}`;
}

const DISCIPLINE_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  clasico: "Clásico",
  clasicos: "Clásicos",
  clasica: "Clásica",
  clasicas: "Clásicas",
  competicion: "Competición",
  concentracion: "Concentración",
  concentraciones: "Concentraciones",
  exhibicion: "Exhibición",
  historico: "Histórico",
  montana: "Montaña",
};

export function formatWeekendDisciplineLabel(value: string | null | undefined): string {
  const label = String(value ?? "").trim();
  if (!label) return "Motor";
  return DISCIPLINE_DISPLAY_LABELS[normalizeWeekendText(label)] ?? label;
}

export function weekendTodayDay(range: WeekendRange): WeekendDay | null {
  if (range.today === range.friday) return "fri";
  if (range.today === range.saturday) return "sat";
  if (range.today === range.sunday) return "sun";
  return null;
}
