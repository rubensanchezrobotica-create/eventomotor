"use client";

import { useEffect, useMemo, useRef, type FormEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import EventCard from "../EventCard";
import { paginateVisibleEvents } from "../listing/paginate-visible-events";
import type { PreviewEvent, ResolvedEventImage } from "../redesign-v2-model";
import {
  addCalendarDays,
  buildCalendarDayCounts,
  buildCalendarMonthCells,
  calendarDayAriaLabel,
  calendarEventsForSelectedDate,
  CALENDAR_DISCIPLINES,
  CALENDAR_PAGE_SIZE,
  CALENDAR_VEHICLES,
  formatCalendarDayHeading,
  formatCalendarMonth,
  parseCalendarUrlState,
  serializeCalendarUrlState,
  shiftCalendarMonth,
  type CalendarUrlState,
} from "./calendar-page-model";
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

export default function CalendarPageExperience({ events, imageByEventId, initialState, nowIso, today }: CalendarPageExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dayButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingFocusDate = useRef<string | null>(null);
  const state = useMemo(
    () => searchParams.toString() ? parseCalendarUrlState(searchParams, today) : initialState,
    [initialState, searchParams, today],
  );

  useEffect(() => {
    if (!pendingFocusDate.current) return;
    const date = pendingFocusDate.current;
    pendingFocusDate.current = null;
    window.requestAnimationFrame(() => dayButtonRefs.current[date]?.focus());
  }, [state.date]);

  const monthCells = useMemo(() => buildCalendarMonthCells(state.date), [state.date]);
  const dayCounts = useMemo(() => buildCalendarDayCounts(events, state.date, state), [events, state]);
  const selectedEvents = useMemo(() => calendarEventsForSelectedDate(events, state), [events, state]);
  const pagination = useMemo(() => paginateVisibleEvents({ events: selectedEvents, imageByEventId, page: state.page, pageSize: CALENDAR_PAGE_SIZE }), [selectedEvents, imageByEventId, state.page]);
  const normalizedState = useMemo(
    () => pagination.page === state.page ? state : { ...state, page: pagination.page },
    [pagination.page, state],
  );
  const hasFilters = Boolean(state.place || state.discipline || state.vehicle);

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

  function selectDate(date: string) {
    const count = dayCounts[date] ?? 0;
    navigate({ ...state, date, page: 1 });
    trackEvent("open_calendar_day", { date, events_count: count, page_path: currentPagePath() });
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
      dayButtonRefs.current[nextDate]?.focus();
      return;
    }
    pendingFocusDate.current = nextDate;
    navigate({ ...state, date: nextDate, page: 1 });
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      ...state,
      place: String(form.get("place") ?? "").trim(),
      discipline: String(form.get("discipline") ?? ""),
      vehicle: String(form.get("vehicle") ?? ""),
      page: 1,
    };
    navigate(next);
    if (next.discipline !== state.discipline) trackEvent("filter_discipline", { discipline: next.discipline || "all", page_path: currentPagePath() });
    if (next.vehicle !== state.vehicle) trackEvent("filter_vehicle_type", { vehicle_type: next.vehicle || "all", page_path: currentPagePath() });
  }

  function clearFilters() {
    navigate({ ...state, place: "", discipline: "", vehicle: "", page: 1 });
  }

  return (
    <section className={styles.calendarSection} aria-label="Calendario y agenda del día">
      <div className={styles.calendarSurface}>
        <div className={styles.toolbar}>
          <button aria-label="Mes anterior" className={styles.monthButton} onClick={() => navigate({ ...state, date: shiftCalendarMonth(state.date, -1), page: 1 })} type="button">‹</button>
          <h2 className={styles.monthTitle}>{formatCalendarMonth(state.date)}</h2>
          <div className={styles.toolbarActions}>
            <button aria-label="Mes siguiente" className={styles.monthButton} onClick={() => navigate({ ...state, date: shiftCalendarMonth(state.date, 1), page: 1 })} type="button">›</button>
            <button className={styles.todayButton} onClick={() => navigate({ ...state, date: today, page: 1 })} type="button">Hoy</button>
          </div>
        </div>

        <div aria-hidden="true" className={styles.weekdays}>
          {weekDays.map((day) => <span key={day.full}><span className={styles.fullWeekday}>{day.short}</span><span className={styles.compactWeekday}>{day.compact}</span></span>)}
        </div>
        <div aria-label={`Calendario de ${formatCalendarMonth(state.date)}`} className={styles.monthGrid} role="grid">
          {monthCells.map((cell, index) => cell ? (
            <div className={styles.dayCell} key={cell.date} role="gridcell">
              <button
                aria-label={calendarDayAriaLabel(cell.date, dayCounts[cell.date] ?? 0)}
                aria-pressed={state.date === cell.date}
                className={styles.dayButton}
                data-selected={state.date === cell.date}
                data-today={today === cell.date}
                onClick={() => selectDate(cell.date)}
                onKeyDown={(event) => handleDayKeyDown(event, cell.date)}
                ref={(element) => { dayButtonRefs.current[cell.date] = element; }}
                tabIndex={state.date === cell.date ? 0 : -1}
                type="button"
              >
                <span className={styles.dayNumber}>{cell.day}</span>
                {(dayCounts[cell.date] ?? 0) > 0 ? <><span className={styles.eventCount}>{dayCounts[cell.date]} {(dayCounts[cell.date] ?? 0) === 1 ? "evento" : "eventos"}</span><span aria-hidden="true" className={styles.eventDot} /></> : null}
              </button>
            </div>
          ) : <div aria-hidden="true" className={styles.emptyCell} key={`empty-${index}`} />)}
        </div>

        <form className={styles.filters} key={`${state.place}|${state.discipline}|${state.vehicle}`} onSubmit={applyFilters}>
          <label>Lugar<input autoComplete="address-level2" defaultValue={state.place} name="place" placeholder="Provincia, ciudad o localidad" /></label>
          <label>Disciplina<select defaultValue={state.discipline} name="discipline"><option value="">Todas</option>{CALENDAR_DISCIPLINES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Vehículo<select defaultValue={state.vehicle} name="vehicle"><option value="">Todos</option>{CALENDAR_VEHICLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className={styles.filterActions}><button className={styles.primaryButton} type="submit">Aplicar filtros</button>{hasFilters ? <button className={styles.secondaryButton} onClick={clearFilters} type="button">Limpiar</button> : null}</div>
        </form>
      </div>

      <div className={styles.resultsSection}>
        <div className={styles.resultsHeader}>
          <div><span className={styles.kicker}>Agenda del día</span><h2>{formatCalendarDayHeading(state.date)}</h2></div>
          <p>{selectedEvents.length} {selectedEvents.length === 1 ? "evento" : "eventos"} para esta fecha</p>
        </div>
        {pagination.visible.length ? (
          <div className={styles.eventGrid}>{pagination.visible.map((event, index) => <EventCard event={event} key={event.id} nowIso={nowIso} resolvedImage={pagination.visibleImages[index]} />)}</div>
        ) : (
          <div className={styles.emptyState}><h3>No hay eventos para este día</h3><p>Prueba otra fecha o ajusta los filtros.</p>{hasFilters ? <button className={styles.secondaryButton} onClick={clearFilters} type="button">Limpiar filtros</button> : null}</div>
        )}
        {pagination.pageCount > 1 ? <nav aria-label="Paginación de eventos" className={styles.pagination}>{Array.from({ length: pagination.pageCount }, (_, index) => index + 1).map((page) => <a aria-current={page === pagination.page ? "page" : undefined} href={`?${serializeCalendarUrlState({ ...normalizedState, page })}`} key={page} onClick={(event) => { event.preventDefault(); navigate({ ...normalizedState, page }); }}>{page}</a>)}</nav> : null}
        <p aria-live="polite" className={styles.visuallyHidden}>{selectedEvents.length} {selectedEvents.length === 1 ? "evento" : "eventos"} para el {formatCalendarDayHeading(state.date).toLocaleLowerCase("es-ES")}</p>
      </div>
    </section>
  );
}
