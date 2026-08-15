import type { PreviewEvent } from "../redesign-v2-model";

export const CALENDAR_PAGE_SIZE = 12;
export const CALENDAR_LIST_PAGE_SIZE = 20;
export const CALENDAR_ROUTE = "/preview/redesign-v2/calendario";

export const CALENDAR_DISCIPLINES = [
  { value: "rallyes", label: "Rallyes", terms: ["rally", "rallye", "rallysprint", "subida", "montana"] },
  { value: "circuito", label: "Circuito", terms: ["circuito", "trackday", "tandas", "velocidad", "motogp", "superbike"] },
  { value: "concentraciones", label: "Concentraciones", terms: ["concentracion", "motoalmuerzo", "bikers", "motero"] },
  { value: "offroad", label: "Offroad", terms: ["offroad", "motocross", "supercross", "enduro", "trial", "cross country", "raid"] },
  { value: "clasicos", label: "Clásicos", terms: ["clasico", "clasica", "historico", "retro"] },
  { value: "karting", label: "Karting", terms: ["kart", "karting"] },
  { value: "rutas", label: "Rutas", terms: ["ruta", "mototurismo", "touring", "road trip"] },
  { value: "ferias", label: "Ferias", terms: ["feria", "salon", "expo", "exposicion", "motor show"] },
] as const;

export const CALENDAR_VEHICLES = [
  { value: "moto", label: "Moto" },
  { value: "coche", label: "Coche" },
  { value: "mixto", label: "Mixto" },
  { value: "otros", label: "Otros" },
] as const;

export type CalendarView = "month" | "week" | "list";

export type CalendarUrlState = {
  date: string;
  q: string;
  discipline: string;
  vehicle: string;
  page: number;
  view: CalendarView;
};

export type CalendarQueryRecord = Record<string, string | string[] | undefined>;
export type CalendarMonthCell = { date: string; day: number };

const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
const dayHeadingFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" });
const shortMonthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" });
const weekMonthFormatter = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "Europe/Madrid" });

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function normalizeCalendarText(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function isCalendarDateKey(value: unknown): value is string {
  const candidate = String(value ?? "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

export function calendarDateParts(value: string) {
  if (!isCalendarDateKey(value)) throw new Error(`Invalid calendar date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function calendarDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateFromKey(value: string): Date {
  const { year, month, day } = calendarDateParts(value);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function madridCalendarDateKey(now: string | Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeAllowedValue(value: string, allowed: readonly string[]): string {
  const normalized = normalizeCalendarText(value);
  return allowed.includes(normalized) ? normalized : "";
}

export function parseCalendarUrlState(query: CalendarQueryRecord | URLSearchParams, today: string): CalendarUrlState {
  if (!isCalendarDateKey(today)) throw new Error("Calendar today must be a valid date key");
  const read = (name: string) => query instanceof URLSearchParams ? query.get(name) ?? "" : firstQueryValue(query[name]);
  const rawPage = Number.parseInt(read("page"), 10);
  const requestedDate = read("date");
  const requestedQuery = read("q") || read("place");
  return {
    date: isCalendarDateKey(requestedDate) ? requestedDate : today,
    q: requestedQuery.trim().slice(0, 80),
    discipline: normalizeAllowedValue(read("discipline"), CALENDAR_DISCIPLINES.map((item) => item.value)),
    vehicle: normalizeAllowedValue(read("vehicle"), CALENDAR_VEHICLES.map((item) => item.value)),
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    view: normalizeAllowedValue(read("view"), ["month", "week", "list"]) as CalendarView || "month",
  };
}

export function serializeCalendarUrlState(state: CalendarUrlState): string {
  const params = new URLSearchParams();
  params.set("date", state.date);
  if (state.q) params.set("q", state.q);
  if (state.discipline) params.set("discipline", state.discipline);
  if (state.vehicle) params.set("vehicle", state.vehicle);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.view !== "month") params.set("view", state.view);
  return params.toString();
}

export function shiftCalendarMonth(value: string, delta: number): string {
  const { year, month, day } = calendarDateParts(value);
  const targetStart = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  const targetYear = targetStart.getUTCFullYear();
  const targetMonth = targetStart.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0, 12)).getUTCDate();
  return calendarDateKey(targetYear, targetMonth, Math.min(day, lastDay));
}

export function addCalendarDays(value: string, amount: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return calendarDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function buildCalendarMonthCells(value: string): Array<CalendarMonthCell | null> {
  const { year, month } = calendarDateParts(value);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay();
  const leadingEmptyCells = (firstWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const cells: Array<CalendarMonthCell | null> = Array.from({ length: leadingEmptyCells }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ date: calendarDateKey(year, month, day), day });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function eventRange(event: PreviewEvent) {
  if (!isCalendarDateKey(event.start)) return null;
  const end = isCalendarDateKey(event.end) && event.end >= event.start ? event.end : event.start;
  return { start: event.start, end };
}

export function calendarMonthRange(value: string): { start: string; end: string } {
  const { year, month } = calendarDateParts(value);
  return {
    start: calendarDateKey(year, month, 1),
    end: calendarDateKey(year, month, new Date(Date.UTC(year, month, 0, 12)).getUTCDate()),
  };
}

export function calendarDateForMonth(monthValue: string, selectedDate: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthValue)) return selectedDate;
  const candidate = `${monthValue}-01`;
  if (!isCalendarDateKey(candidate)) return selectedDate;
  const { day } = calendarDateParts(selectedDate);
  const { year, month } = calendarDateParts(candidate);
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  return calendarDateKey(year, month, Math.min(day, lastDay));
}

export function calendarEventMatchesDate(event: PreviewEvent, date: string): boolean {
  if (!isCalendarDateKey(date)) return false;
  const range = eventRange(event);
  return Boolean(range && range.start <= date && range.end >= date);
}

function calendarEventText(event: PreviewEvent): string {
  return normalizeCalendarText([event.title, event.championship, event.discipline, event.venue, event.city, event.province, event.region, event.tags.join(" ")].join(" "));
}

function normalizedVehicle(event: PreviewEvent): string {
  const vehicle = normalizeCalendarText(event.vehicleType);
  return ["moto", "coche", "mixto"].includes(vehicle) ? vehicle : "otros";
}

function matchesDiscipline(event: PreviewEvent, discipline: string): boolean {
  if (!discipline) return true;
  const definition = CALENDAR_DISCIPLINES.find((item) => item.value === discipline);
  if (!definition) return false;
  const text = calendarEventText(event);
  return definition.terms.some((term) => text.includes(normalizeCalendarText(term)));
}

export function filterCalendarEvents(events: readonly PreviewEvent[], filters: Pick<CalendarUrlState, "q" | "discipline" | "vehicle">): PreviewEvent[] {
  const query = normalizeCalendarText(filters.q);
  return events.filter((event) => {
    if (query && !calendarEventText(event).includes(query)) return false;
    if (!matchesDiscipline(event, filters.discipline)) return false;
    if (filters.vehicle && normalizedVehicle(event) !== filters.vehicle) return false;
    return true;
  });
}

export function calendarEventsForSelectedDate(events: readonly PreviewEvent[], state: CalendarUrlState): PreviewEvent[] {
  return filterCalendarEvents(events, state).filter((event) => calendarEventMatchesDate(event, state.date)).sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title, "es"));
}

function stableCalendarSort(left: PreviewEvent, right: PreviewEvent): number {
  return left.start.localeCompare(right.start)
    || left.title.localeCompare(right.title, "es")
    || left.id.localeCompare(right.id);
}

export function calendarEventsForMonth(events: readonly PreviewEvent[], state: CalendarUrlState): PreviewEvent[] {
  const range = calendarMonthRange(state.date);
  return filterCalendarEvents(events, state)
    .filter((event) => {
      const eventDates = eventRange(event);
      return Boolean(eventDates && eventDates.start <= range.end && eventDates.end >= range.start);
    })
    .sort(stableCalendarSort);
}

export function calendarWeekDates(value: string): string[] {
  const date = dateFromKey(value);
  const mondayOffset = -((date.getUTCDay() + 6) % 7);
  const monday = addCalendarDays(value, mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index));
}

export function calendarEventsForWeek(events: readonly PreviewEvent[], state: CalendarUrlState): Record<string, PreviewEvent[]> {
  const filtered = filterCalendarEvents(events, state);
  return Object.fromEntries(calendarWeekDates(state.date).map((date) => [
    date,
    filtered.filter((event) => calendarEventMatchesDate(event, date)).sort(stableCalendarSort),
  ]));
}

export type CalendarMonthSummary = {
  events: number;
  activeDays: number;
  provinces: number;
};

export function buildCalendarMonthSummary(events: readonly PreviewEvent[], state: CalendarUrlState): CalendarMonthSummary {
  const monthEvents = calendarEventsForMonth(events, state);
  const range = calendarMonthRange(state.date);
  const activeDays = new Set<string>();
  const provinces = new Set<string>();

  for (const event of monthEvents) {
    const dates = eventRange(event);
    if (!dates) continue;
    const start = dates.start < range.start ? range.start : dates.start;
    const end = dates.end > range.end ? range.end : dates.end;
    for (let date = start; date <= end; date = addCalendarDays(date, 1)) activeDays.add(date);
    const province = normalizeCalendarText(event.province);
    if (province) provinces.add(province);
  }

  return { events: monthEvents.length, activeDays: activeDays.size, provinces: provinces.size };
}

export function buildCalendarMonthOptions(events: readonly PreviewEvent[], selectedDate: string): Array<{ value: string; label: string }> {
  const months = new Set<string>([selectedDate.slice(0, 7)]);
  for (const event of events) {
    if (isCalendarDateKey(event.start)) months.add(event.start.slice(0, 7));
    if (isCalendarDateKey(event.end)) months.add(event.end.slice(0, 7));
  }
  return [...months].sort().map((value) => ({ value, label: shortMonthFormatter.format(dateFromKey(`${value}-01`)) }));
}

export function buildCalendarDayCounts(events: readonly PreviewEvent[], monthDate: string, filters: Pick<CalendarUrlState, "q" | "discipline" | "vehicle">): Record<string, number> {
  const filtered = filterCalendarEvents(events, filters);
  return Object.fromEntries(buildCalendarMonthCells(monthDate).filter((cell): cell is CalendarMonthCell => Boolean(cell)).map((cell) => [cell.date, filtered.filter((event) => calendarEventMatchesDate(event, cell.date)).length]));
}

export function formatCalendarMonth(value: string): string {
  return monthFormatter.format(dateFromKey(value)).toLocaleUpperCase("es-ES");
}

export function formatCalendarMonthCompact(value: string): string {
  const { year, month } = calendarDateParts(value);
  const monthName = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "Europe/Madrid" })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return `${monthName} ${year}`.toLocaleUpperCase("es-ES");
}

export function formatCalendarWeekCompact(start: string, end: string): string {
  const startParts = calendarDateParts(start);
  const endParts = calendarDateParts(end);
  const startMonth = weekMonthFormatter.format(dateFromKey(start)).replace(".", "").toLocaleUpperCase("es-ES");
  const endMonth = weekMonthFormatter.format(dateFromKey(end)).replace(".", "").toLocaleUpperCase("es-ES");
  if (startParts.year === endParts.year && startParts.month === endParts.month) return `${startParts.day}–${endParts.day} ${endMonth} ${endParts.year}`;
  if (startParts.year === endParts.year) return `${startParts.day} ${startMonth}–${endParts.day} ${endMonth} ${endParts.year}`;
  return `${startParts.day} ${startMonth} ${startParts.year}–${endParts.day} ${endMonth} ${endParts.year}`;
}

export function formatCalendarCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const CALENDAR_DISCIPLINE_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  "clasico": "Clásico",
  "clasicos": "Clásicos",
  "clasica": "Clásica",
  "clasicas": "Clásicas",
  "cl?sicos": "Clásicos",
  "competicion": "Competición",
  "concentracion": "Concentración",
  "concentraciones": "Concentraciones",
  "concentraci?n": "Concentración",
  "enduro clasicas": "Enduro Clásicas",
  "exhibicion": "Exhibición",
  "montana": "Montaña",
  "motocross clasico": "Motocross Clásico",
  "rally historico": "Rally Histórico",
  "resistencia clasicas asfalto": "Resistencia Clásicas Asfalto",
  "todo terreno clasico": "Todo Terreno Clásico",
  "trial clasicas": "Trial Clásicas",
  "velocidad clasicas": "Velocidad Clásicas",
};

export function formatCalendarDisciplineLabel(value: string | null | undefined): string {
  const label = String(value ?? "").trim();
  if (!label) return "Motor";
  return CALENDAR_DISCIPLINE_DISPLAY_LABELS[normalizeCalendarText(label)] ?? label;
}

export function formatCalendarDayHeading(value: string): string {
  const text = dayHeadingFormatter.format(dateFromKey(value));
  return text.charAt(0).toLocaleUpperCase("es-ES") + text.slice(1);
}

export function calendarDayAriaLabel(value: string, count: number): string {
  const date = dateFormatter.format(dateFromKey(value));
  return count === 0 ? `${date}, sin eventos` : `${date}, ${count} ${count === 1 ? "evento" : "eventos"}`;
}
