"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import { paginateVisibleEvents } from "../listing/paginate-visible-events";
import type { PreviewEvent, ResolvedEventImage } from "../redesign-v2-model";
import CalendarEventRow from "./CalendarEventRow";
import CalendarSearchExperience, { type CalendarSearchValues } from "./CalendarSearchExperience.client";
import {
  addCalendarDays,
  buildCalendarDayCounts,
  buildCalendarMonthCells,
  buildCalendarMonthSummary,
  calendarDayAriaLabel,
  calendarEventsForMonth,
  calendarEventsForSelectedDate,
  calendarEventsForWeek,
  calendarWeekDates,
  CALENDAR_LIST_PAGE_SIZE,
  CALENDAR_PAGE_SIZE,
  formatCalendarCount,
  formatCalendarDayHeading,
  formatCalendarMonth,
  formatCalendarMonthCompact,
  formatCalendarWeekCompact,
  isCalendarDateKey,
  parseCalendarUrlState,
  serializeCalendarUrlState,
  shiftCalendarMonth,
  type CalendarUrlState,
  type CalendarView,
} from "./calendar-page-model";
import { diversifyCalendarVisibleImages } from "./calendar-visible-images";
import styles from "./CalendarPageExperience.module.css";

type CalendarPageExperienceProps = {
  events: PreviewEvent[];
  imageByEventId: Record<string, ResolvedEventImage>;
  initialState: CalendarUrlState;
  nowIso: string;
  today: string;
};

const weekDays = [
  { short: "LUN", compact: "L", full: "Lunes" },
  { short: "MAR", compact: "M", full: "Martes" },
  { short: "MIÉ", compact: "X", full: "Miércoles" },
  { short: "JUE", compact: "J", full: "Jueves" },
  { short: "VIE", compact: "V", full: "Viernes" },
  { short: "SÁB", compact: "S", full: "Sábado" },
  { short: "DOM", compact: "D", full: "Domingo" },
] as const;

const selectedDayFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
const compactDateFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" });

function dateFromKey(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

function formatSelectedDay(date: string) {
  const parts = selectedDayFormatter.formatToParts(dateFromKey(date));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = read("weekday");
  return { weekday: weekday.charAt(0).toLocaleUpperCase("es-ES") + weekday.slice(1), day: read("day"), month: read("month") };
}

export default function CalendarPageExperience({ events, imageByEventId, initialState, nowIso, today }: CalendarPageExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dayButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingFocusDate = useRef<string | null>(null);
  const pendingAgendaScroll = useRef(false);
  const pendingPaginationScroll = useRef(false);
  const agendaRef = useRef<HTMLElement | null>(null);
  const state = useMemo(() => searchParams.toString() ? parseCalendarUrlState(searchParams, today) : initialState, [initialState, searchParams, today]);

  const monthCells = useMemo(() => buildCalendarMonthCells(state.date), [state.date]);
  const dayCounts = useMemo(() => buildCalendarDayCounts(events, state.date, state), [events, state]);
  const selectedEvents = useMemo(() => calendarEventsForSelectedDate(events, state), [events, state]);
  const monthEvents = useMemo(() => calendarEventsForMonth(events, state), [events, state]);
  const weekGroups = useMemo(() => calendarEventsForWeek(events, state), [events, state]);
  const weekDates = useMemo(() => calendarWeekDates(state.date), [state.date]);
  const selectedWeekEvents = useMemo(() => weekGroups[state.date] ?? [], [state.date, weekGroups]);
  const selectedWeekImages = useMemo(
    () => diversifyCalendarVisibleImages(selectedWeekEvents, selectedWeekEvents.map((event) => imageByEventId[event.id])),
    [imageByEventId, selectedWeekEvents],
  );
  const monthSummary = useMemo(() => buildCalendarMonthSummary(events, state), [events, state]);
  const selectedDay = useMemo(() => formatSelectedDay(state.date), [state.date]);
  const hasFilters = Boolean(state.q || state.discipline || state.vehicle);

  const paginatedEvents = state.view === "list" ? monthEvents : selectedEvents;
  const pageSize = state.view === "list" ? CALENDAR_LIST_PAGE_SIZE : CALENDAR_PAGE_SIZE;
  const pagination = useMemo(
    () => paginateVisibleEvents({ events: paginatedEvents, imageByEventId, page: state.view === "week" ? 1 : state.page, pageSize }),
    [imageByEventId, pageSize, paginatedEvents, state.page, state.view],
  );
  const visibleImages = useMemo(() => diversifyCalendarVisibleImages(pagination.visible, pagination.visibleImages), [pagination.visible, pagination.visibleImages]);
  const normalizedState = useMemo(
    () => pagination.page === state.page || state.view === "week" ? { ...state, page: state.view === "week" ? 1 : state.page } : { ...state, page: pagination.page },
    [pagination.page, state],
  );

  useEffect(() => {
    if (!pendingFocusDate.current) return;
    const date = pendingFocusDate.current;
    pendingFocusDate.current = null;
    window.requestAnimationFrame(() => dayButtonRefs.current[date]?.focus({ preventScroll: true }));
  }, [state.date]);

  useEffect(() => {
    if (!pendingAgendaScroll.current) return;
    pendingAgendaScroll.current = false;
    scrollToAgenda();
  }, [state.date]);

  useEffect(() => {
    if (!pendingPaginationScroll.current) return;
    pendingPaginationScroll.current = false;
    scrollToAgenda();
  }, [state.page]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const canonicalQuery = serializeCalendarUrlState(normalizedState);
    if (currentQuery === canonicalQuery) return;
    router.replace(`${pathname}?${canonicalQuery}`, { scroll: false });
  }, [normalizedState, pathname, router, searchParams]);

  function navigate(next: CalendarUrlState, replace = false) {
    const url = `${pathname}?${serializeCalendarUrlState(next)}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }

  function scrollToAgenda() {
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      agendaRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  }

  function selectDate(date: string, shouldScrollToAgenda = true) {
    if (shouldScrollToAgenda && date === state.date) scrollToAgenda();
    else if (shouldScrollToAgenda) pendingAgendaScroll.current = true;
    navigate({ ...state, date, page: 1 });
    trackEvent("open_calendar_day", { date, events_count: dayCounts[date] ?? 0, page_path: currentPagePath() });
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDate(date);
      return;
    }
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const nextDate = addCalendarDays(date, offsets[event.key]);
    if (nextDate.slice(0, 7) === date.slice(0, 7)) {
      dayButtonRefs.current[nextDate]?.focus({ preventScroll: true });
      return;
    }
    pendingFocusDate.current = nextDate;
    navigate({ ...state, date: nextDate, page: 1 });
  }

  function applySearch(values: CalendarSearchValues) {
    const next = {
      ...state,
      q: values.q.trim().slice(0, 80),
      date: isCalendarDateKey(values.date) ? values.date : state.date,
      discipline: values.discipline,
      vehicle: values.vehicle,
      page: 1,
    };
    navigate(next);
    if (next.discipline !== state.discipline) trackEvent("filter_discipline", { discipline: next.discipline || "all", page_path: currentPagePath() });
    if (next.vehicle !== state.vehicle) trackEvent("filter_vehicle_type", { vehicle_type: next.vehicle || "all", page_path: currentPagePath() });
  }

  function clearFilters() {
    navigate({ ...state, q: "", discipline: "", vehicle: "", page: 1 });
  }

  function clearQuery() {
    if (!state.q) return;
    navigate({ ...state, q: "", page: 1 });
  }

  function changeView(view: CalendarView) {
    navigate({ ...state, view, page: 1 });
  }

  function shiftVisiblePeriod(delta: number) {
    const date = state.view === "week" ? addCalendarDays(state.date, delta * 7) : shiftCalendarMonth(state.date, delta);
    navigate({ ...state, date, page: 1 });
  }

  function changePage(page: number) {
    if (page === pagination.page) {
      scrollToAgenda();
      return;
    }
    pendingPaginationScroll.current = true;
    navigate({ ...normalizedState, page });
  }

  function renderRows(rowEvents: readonly PreviewEvent[], rowImages: readonly ResolvedEventImage[]) {
    return <div className={styles.eventRows}>{rowEvents.map((event, index) => <CalendarEventRow event={event} image={rowImages[index]} key={event.id} nowIso={nowIso} />)}</div>;
  }

  const nextMonthDate = shiftCalendarMonth(state.date, 1);
  const nextMonthCells = buildCalendarMonthCells(nextMonthDate);
  const nextMonthCounts = buildCalendarDayCounts(events, nextMonthDate, state);

  return (
    <section className={styles.calendarSection} aria-label="Calendario y agenda de eventos">
      <CalendarSearchExperience events={events} key={`${state.q}|${state.date}|${state.discipline}|${state.vehicle}`} onApply={applySearch} onClearAll={clearFilters} onClearQuery={clearQuery} state={state} />

      <div className={styles.calendarSurface}>
        <div className={styles.toolbar}>
          <div className={styles.monthNavigation}>
            <button aria-label={state.view === "week" ? "Semana anterior" : "Mes anterior"} className={styles.monthButton} onClick={() => shiftVisiblePeriod(-1)} type="button">‹</button>
            <h2 aria-label={state.view === "week" ? `${compactDateFormatter.format(dateFromKey(weekDates[0]))} — ${compactDateFormatter.format(dateFromKey(weekDates[6]))}` : undefined} className={styles.monthTitle}>
              {state.view === "week" ? <><span className={styles.weekTitleFull}>{compactDateFormatter.format(dateFromKey(weekDates[0]))} — {compactDateFormatter.format(dateFromKey(weekDates[6]))}</span><span className={styles.weekTitleCompact}>{formatCalendarWeekCompact(weekDates[0], weekDates[6])}</span></> : formatCalendarMonthCompact(state.date)}
            </h2>
            <button aria-label={state.view === "week" ? "Semana siguiente" : "Mes siguiente"} className={styles.monthButton} onClick={() => shiftVisiblePeriod(1)} type="button">›</button>
          </div>
          <div aria-label="Vista del calendario" className={styles.viewSwitch}>
            {(["month", "week", "list"] as const).map((view) => <button aria-pressed={state.view === view} key={view} onClick={() => changeView(view)} type="button">{{ month: "Mes", week: "Semana", list: "Lista" }[view]}</button>)}
          </div>
          <button className={styles.todayButton} onClick={() => selectDate(today)} type="button">Hoy</button>
        </div>

        {state.view === "month" ? (
          <div className={styles.monthLayout}>
            <div className={styles.monthPanel}>
              <div aria-hidden="true" className={styles.weekdays}>{weekDays.map((day) => <span key={day.full}><span className={styles.fullWeekday}>{day.short}</span><span className={styles.compactWeekday}>{day.compact}</span></span>)}</div>
              <div aria-label={`Calendario de ${formatCalendarMonth(state.date)}`} className={styles.monthGrid} role="grid">
                {monthCells.map((cell, index) => cell ? (
                  <div className={styles.dayCell} key={cell.date} role="gridcell">
                    <button aria-label={calendarDayAriaLabel(cell.date, dayCounts[cell.date] ?? 0)} aria-pressed={state.date === cell.date} className={styles.dayButton} data-selected={state.date === cell.date} data-today={today === cell.date} onClick={() => selectDate(cell.date)} onKeyDown={(event) => handleDayKeyDown(event, cell.date)} ref={(element) => { dayButtonRefs.current[cell.date] = element; }} tabIndex={state.date === cell.date ? 0 : -1} type="button">
                      <span className={styles.dayNumber}>{cell.day}</span>
                      {(dayCounts[cell.date] ?? 0) > 0 ? <><span className={styles.eventCount}>{formatCalendarCount(dayCounts[cell.date], "evento", "eventos")}</span><span aria-hidden="true" className={styles.eventDot} /></> : null}
                    </button>
                  </div>
                ) : <div aria-hidden="true" className={styles.emptyCell} key={`empty-${index}`} />)}
              </div>
            </div>

            <aside className={styles.calendarSidebar} aria-label="Contexto del calendario">
              <section className={styles.selectedDayPanel}>
                <span>Día seleccionado</span><p>{selectedDay.weekday},</p><strong>{selectedDay.day}</strong><p>de {selectedDay.month}</p>
                <small>{formatCalendarCount(selectedEvents.length, "evento", "eventos")} para esta fecha</small>
              </section>
              <section className={styles.monthSummary}>
                <span>Resumen del mes</span>
                <dl><div><dt>{monthSummary.events === 1 ? "Evento" : "Eventos"}</dt><dd>{monthSummary.events}</dd></div><div><dt>{monthSummary.activeDays === 1 ? "Día" : "Días"}</dt><dd>{monthSummary.activeDays}</dd></div><div><dt>{monthSummary.provinces === 1 ? "Provincia" : "Provincias"}</dt><dd>{monthSummary.provinces}</dd></div></dl>
              </section>
              <section className={styles.nextMonth}>
                <button onClick={() => navigate({ ...state, date: nextMonthDate, page: 1 })} type="button">Ver {formatCalendarMonth(nextMonthDate).toLocaleLowerCase("es-ES")} <span aria-hidden="true">→</span></button>
                <div aria-hidden="true" className={styles.miniCalendar}>{nextMonthCells.map((cell, index) => <span data-has-events={cell ? (nextMonthCounts[cell.date] ?? 0) > 0 : false} key={cell?.date ?? `mini-${index}`}>{cell?.day ?? ""}</span>)}</div>
              </section>
            </aside>
          </div>
        ) : null}

        {state.view === "week" ? (
          <div className={styles.weekView}>
            <div className={styles.weekStrip}>{weekDates.map((date) => <button aria-pressed={state.date === date} data-today={today === date} key={date} onClick={() => selectDate(date, false)} type="button"><span>{compactDateFormatter.format(dateFromKey(date)).split(" ")[0]}</span><strong>{Number(date.slice(-2))}</strong><small>{formatCalendarCount(weekGroups[date].length, "evento", "eventos")}</small></button>)}</div>
            <div className={styles.weekAgenda} ref={(element) => { agendaRef.current = element; }}>
              <div className={styles.weekAgendaHeader}>
                <h3>{formatCalendarDayHeading(state.date)}</h3>
                <p>{formatCalendarCount(selectedWeekEvents.length, "evento", "eventos")}</p>
              </div>
              {selectedWeekEvents.length
                ? renderRows(selectedWeekEvents, selectedWeekImages)
                : <div className={styles.emptyState}><h3>No hay eventos para este día</h3><p>Selecciona otro día o ajusta los filtros.</p></div>}
            </div>
          </div>
        ) : null}

        {state.view === "list" ? <div className={styles.listIntro}><span>Vista cronológica</span><h3>{formatCalendarCount(monthSummary.events, "evento único", "eventos únicos")} en {formatCalendarMonth(state.date).toLocaleLowerCase("es-ES")}</h3><p>Los eventos de varios días aparecen una sola vez.</p></div> : null}
      </div>

      {state.view !== "week" ? (
        <section className={styles.resultsSection} ref={(element) => { agendaRef.current = element; }}>
          <div className={styles.resultsHeader}><div><span className={styles.kicker}>{state.view === "list" ? "Agenda del mes" : "Agenda del día"}</span><h2>{state.view === "list" ? formatCalendarMonth(state.date) : formatCalendarDayHeading(state.date)}</h2></div><p>{formatCalendarCount(paginatedEvents.length, "evento", "eventos")}</p></div>
          {pagination.visible.length ? renderRows(pagination.visible, visibleImages) : <div className={styles.emptyState}><h3>No hay eventos en esta selección</h3><p>Prueba otra fecha o ajusta los filtros.</p>{hasFilters ? <button className={styles.secondaryButton} onClick={clearFilters} type="button">Limpiar filtros</button> : null}</div>}
          {pagination.pageCount > 1 ? <nav aria-label="Paginación de eventos" className={styles.pagination}>{Array.from({ length: pagination.pageCount }, (_, index) => index + 1).map((page) => <a aria-current={page === pagination.page ? "page" : undefined} href={`?${serializeCalendarUrlState({ ...normalizedState, page })}`} key={page} onClick={(event) => { event.preventDefault(); changePage(page); }}>{page}</a>)}</nav> : null}
        </section>
      ) : null}
      <p aria-live="polite" className={styles.visuallyHidden}>{formatCalendarCount(state.view === "list" ? monthEvents.length : selectedEvents.length, "evento", "eventos")} en la vista actual</p>
    </section>
  );
}
