"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import type { PreviewEvent, ResolvedEventImage } from "../redesign-v2-model";
import WeekendEventCard from "./WeekendEventCard";
import WeekendSearchExperience, { type WeekendSearchValues } from "./WeekendSearchExperience.client";
import {
  buildWeekendDayCounts,
  buildWeekendResults,
  formatWeekendDayDate,
  formatWeekendRangeLabel,
  paginateWeekendEvents,
  parseWeekendUrlState,
  serializeWeekendUrlState,
  WEEKEND_PAGE_SIZE,
  WEEKEND_ROUTE,
  weekendTodayDay,
  type WeekendDay,
  type WeekendRange,
  type WeekendUrlState,
} from "./weekend-page-model";
import { diversifyWeekendVisibleImages } from "./weekend-visible-images";
import styles from "./WeekendPageExperience.module.css";

type WeekendPageExperienceProps = {
  events: PreviewEvent[];
  imageByEventId: Record<string, ResolvedEventImage>;
  initialState: WeekendUrlState;
  nowIso: string;
  range: WeekendRange;
};

const dayOptions: ReadonlyArray<{ day: WeekendDay; label: string }> = [
  { day: "all", label: "Todos" },
  { day: "fri", label: "Viernes" },
  { day: "sat", label: "Sábado" },
  { day: "sun", label: "Domingo" },
];

function dayDate(day: WeekendDay, range: WeekendRange) {
  if (day === "fri") return range.friday;
  if (day === "sat") return range.saturday;
  if (day === "sun") return range.sunday;
  return null;
}

export default function WeekendPageExperience({ events, imageByEventId, initialState, nowIso, range }: WeekendPageExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resultsRef = useRef<HTMLElement | null>(null);
  const pendingPaginationScroll = useRef(false);
  const state = useMemo(
    () => searchParams.toString() ? parseWeekendUrlState(searchParams) : initialState,
    [initialState, searchParams],
  );
  const dayCounts = useMemo(() => buildWeekendDayCounts(events, state, range), [events, range, state]);
  const filteredEvents = useMemo(() => buildWeekendResults(events, state, range), [events, range, state]);
  const pagination = useMemo(
    () => paginateWeekendEvents(filteredEvents, state.page, WEEKEND_PAGE_SIZE),
    [filteredEvents, state.page],
  );
  const visibleImages = useMemo(
    () => diversifyWeekendVisibleImages(
      pagination.visible,
      pagination.visible.map((event) => imageByEventId[event.id]),
    ),
    [imageByEventId, pagination.visible],
  );
  const normalizedState = useMemo(
    () => pagination.page === state.page ? state : { ...state, page: pagination.page },
    [pagination.page, state],
  );
  const todayDay = weekendTodayDay(range);
  const hasSearchFilters = Boolean(state.q || state.discipline || state.vehicle);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const canonicalQuery = serializeWeekendUrlState(normalizedState);
    if (currentQuery === canonicalQuery) return;
    router.replace(canonicalQuery ? `${pathname}?${canonicalQuery}` : pathname, { scroll: false });
  }, [normalizedState, pathname, router, searchParams]);

  useEffect(() => {
    if (!pendingPaginationScroll.current) return;
    pendingPaginationScroll.current = false;
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultsRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  }, [state.page]);

  function navigate(next: WeekendUrlState) {
    const query = serializeWeekendUrlState(next);
    router.push(query ? `${WEEKEND_ROUTE}?${query}` : WEEKEND_ROUTE, { scroll: false });
  }

  function applySearch(values: WeekendSearchValues) {
    const next = {
      ...state,
      q: values.q.trim().slice(0, 80),
      discipline: values.discipline,
      vehicle: values.vehicle,
      page: 1,
    };
    navigate(next);
    trackEvent("search_events", { page_path: currentPagePath(), source: "redesign_v2_weekend" });
    if (next.discipline !== state.discipline) trackEvent("filter_discipline", { discipline: next.discipline || "all", page_path: currentPagePath() });
    if (next.vehicle !== state.vehicle) trackEvent("filter_vehicle_type", { vehicle_type: next.vehicle || "all", page_path: currentPagePath() });
  }

  function clearFilters() {
    navigate({ q: "", discipline: "", vehicle: "", day: "all", page: 1 });
  }

  function clearEmptySearchFilters() {
    navigate({ ...state, q: "", discipline: "", vehicle: "", page: 1 });
  }

  function clearQuery() {
    if (!state.q) return;
    navigate({ ...state, q: "", page: 1 });
  }

  function selectDay(day: WeekendDay) {
    navigate({ ...state, day, page: 1 });
    trackEvent("filter_weekend_day", { day, page_path: currentPagePath() });
  }

  function changePage(page: number) {
    if (page === pagination.page) {
      resultsRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }
    pendingPaginationScroll.current = true;
    navigate({ ...normalizedState, page });
  }

  return (
    <section aria-label="Eventos de motor del fin de semana" className={styles.weekendSection}>
      <WeekendSearchExperience
        events={events}
        key={`${state.q}|${state.discipline}|${state.vehicle}`}
        onApply={applySearch}
        onClearAll={clearFilters}
        onClearQuery={clearQuery}
        state={state}
      />

      <section aria-labelledby="weekend-v2-days-title" className={styles.daySelector}>
        <div className={styles.daySelectorIntro}>
          <span>Tu agenda de motor</span>
          <h2 id="weekend-v2-days-title">{formatWeekendRangeLabel(range)}</h2>
          <p>Elige un día o explora el fin de semana completo.</p>
        </div>
        <div aria-label="Filtrar por día" className={styles.dayButtons}>
          {dayOptions.map(({ day, label }) => {
            const date = dayDate(day, range);
            return (
              <button aria-pressed={state.day === day} key={day} onClick={() => selectDay(day)} type="button">
                <span>{label}{todayDay === day ? <em>Hoy</em> : null}</span>
                <strong>{date ? formatWeekendDayDate(date) : "Fin de semana"}</strong>
                <small>{dayCounts[day]} {dayCounts[day] === 1 ? "evento" : "eventos"}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.resultsSection} ref={(element) => { resultsRef.current = element; }}>
        <div className={styles.resultsHeader}>
          <div><span>Agenda seleccionada</span><h2>Eventos para vivir el motor</h2></div>
          <p>{pagination.total} {pagination.total === 1 ? "evento" : "eventos"}</p>
        </div>

        {pagination.visible.length ? (
          <div className={styles.eventGrid}>
            {pagination.visible.map((event, index) => <WeekendEventCard event={event} image={visibleImages[index]} key={event.id} nowIso={nowIso} />)}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>No hay eventos en esta selección</h3>
            <p>{hasSearchFilters ? "Prueba con otro día o elimina los filtros para ampliar la agenda." : "Prueba con otro día para ampliar la agenda."}</p>
            {hasSearchFilters ? <button className={styles.secondaryButton} onClick={clearEmptySearchFilters} type="button">Limpiar filtros</button> : null}
          </div>
        )}

        {pagination.pageCount > 1 ? (
          <nav aria-label="Paginación de eventos del fin de semana" className={styles.pagination}>
            {Array.from({ length: pagination.pageCount }, (_, index) => index + 1).map((page) => {
              const query = serializeWeekendUrlState({ ...normalizedState, page });
              return <a aria-current={page === pagination.page ? "page" : undefined} href={query ? `${pathname}?${query}` : pathname} key={page} onClick={(event) => { event.preventDefault(); changePage(page); }}>{page}</a>;
            })}
          </nav>
        ) : null}
      </section>

      <aside className={styles.calendarCta}>
        <div><span>Más allá del domingo</span><h2>Planifica todo el mes</h2><p>Consulta la agenda completa por fecha, disciplina y vehículo.</p></div>
        <Link href="/preview/redesign-v2/calendario">Abrir calendario <span aria-hidden="true">→</span></Link>
      </aside>
      <p aria-live="polite" className={styles.visuallyHidden}>{pagination.total} {pagination.total === 1 ? "evento" : "eventos"} en la selección actual</p>
    </section>
  );
}
