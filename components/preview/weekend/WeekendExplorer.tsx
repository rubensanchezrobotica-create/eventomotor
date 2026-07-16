"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { WeekendPreviewData, WeekendFilters, WeekendDayFilter, WeekendFamilyId } from "./weekend-preview-model";
import {
  DEFAULT_WEEKEND_FILTERS,
  filterWeekendEvents,
  getWeekendDayCounts,
  nextWeekendVisibleLimit,
} from "./weekend-preview-model";
import WeekendEventCard from "./WeekendEventCard";
import styles from "./WeekendPreview.module.css";

type WeekendExplorerProps = {
  data: WeekendPreviewData;
  initialFilters: WeekendFilters;
  pathname: string;
};

const DAY_TABS: Array<{ id: WeekendDayFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "viernes", label: "Viernes" },
  { id: "sabado", label: "Sábado" },
  { id: "domingo", label: "Domingo" },
  { id: "varios", label: "Varios días" },
];

const FAMILY_LABELS: Record<WeekendFamilyId, string> = {
  concentraciones: "Concentraciones",
  rallyes: "Rallyes",
  circuito: "Circuito y tandas",
  otros: "Ferias y clásicos",
};

function hasActiveFilters(filters: WeekendFilters) {
  return Boolean(
    filters.day !== "todos"
    || filters.discipline
    || filters.family
    || filters.province
    || filters.query,
  );
}

function scrollToResults() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.requestAnimationFrame(() => {
    document.getElementById("eventos")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 768px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

export default function WeekendExplorer({ data, initialFilters, pathname }: WeekendExplorerProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const isMobile = useSyncExternalStore(subscribeMobile, isMobileViewport, () => false);
  const pageSize = isMobile ? 8 : 12;
  const effectiveVisibleLimit = isMobile && visibleLimit === 12 ? 8 : visibleLimit;
  const filtersActive = hasActiveFilters(filters);
  const eventsWithoutDayFilter = useMemo(() => filterWeekendEvents(
    data.events,
    { ...filters, day: "todos" },
    data.range,
  ), [data.events, data.range, filters]);
  const dayCounts = useMemo(
    () => getWeekendDayCounts(eventsWithoutDayFilter, data.range),
    [data.range, eventsWithoutDayFilter],
  );
  const filteredEvents = useMemo(
    () => filterWeekendEvents(data.events, filters, data.range),
    [data.events, data.range, filters],
  );
  const hasMoreEvents = effectiveVisibleLimit < filteredEvents.length;
  const analyticsSource = pathname.startsWith("/preview/")
    ? "weekend_preview_results"
    : "weekend_public_results";

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.province) params.set("provincia", filters.province);
    if (filters.discipline) params.set("disciplina", filters.discipline);
    if (filters.day !== "todos") params.set("dia", filters.day);
    if (filters.family) params.set("tipo", filters.family);
    if (filters.query) params.set("q", filters.query);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [filters, pathname]);

  function updateFilter<Key extends keyof WeekendFilters>(key: Key, value: WeekendFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleLimit(12);
  }

  function selectProvince(province: string) {
    setFilters((current) => ({ ...current, province }));
    setVisibleLimit(12);
    scrollToResults();
  }

  function selectFamily(family: WeekendFamilyId) {
    setFilters((current) => ({
      ...current,
      day: "todos",
      discipline: "",
      family,
      query: "",
    }));
    setVisibleLimit(12);
    scrollToResults();
  }

  return (
    <>
      <section className={styles.filterSection} id="filtros" aria-labelledby="filter-title">
        <div className={`emc-container ${styles.filterShell}`}>
          <div className={styles.filterHeading}>
            <h2 id="filter-title">Filtrar eventos</h2>
            <div className={styles.filterHeadingActions}>
              <p aria-live="polite">
                <strong>{filteredEvents.length}</strong> {filteredEvents.length === 1 ? "resultado" : "resultados"}
              </p>
              {filtersActive ? (
                <button
                  className={styles.clearButton}
                  onClick={() => {
                    setFilters(DEFAULT_WEEKEND_FILTERS);
                    setVisibleLimit(12);
                  }}
                  type="button"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.filterGrid}>
            <label className={filters.province ? styles.filterFieldActive : undefined}>
              <span>Provincia</span>
              <select
                onChange={(event) => updateFilter("province", event.target.value)}
                value={filters.province}
              >
                <option value="">Toda España</option>
                {data.provinceOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className={filters.discipline ? styles.filterFieldActive : undefined}>
              <span>Disciplina</span>
              <select
                onChange={(event) => updateFilter("discipline", event.target.value)}
                value={filters.discipline}
              >
                <option value="">Todas las disciplinas</option>
                {data.disciplineOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label
              className={`${styles.searchField} ${filters.query ? styles.filterFieldActive : ""}`}
            >
              <span>Título o localidad</span>
              <input
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="Ej. rally, Cheste, clásicos…"
                type="search"
                value={filters.query}
              />
            </label>

          </div>

          <div className={styles.dayTabs} aria-label="Filtrar por día" role="tablist">
            {DAY_TABS.map((tab) => (
              <button
                aria-controls="eventos"
                aria-selected={filters.day === tab.id}
                className={filters.day === tab.id ? styles.dayTabActive : ""}
                key={tab.id}
                onClick={() => updateFilter("day", tab.id)}
                role="tab"
                type="button"
              >
                <span>{tab.label}</span>
                <strong>{dayCounts[tab.id]}</strong>
              </button>
            ))}
          </div>

          <div className={styles.compactFilterRow}>
            <span>Tipos:</span>
            <div className={styles.familyChips}>
              {data.families.map((family) => (
                <button
                  aria-pressed={filters.family === family.id}
                  className={filters.family === family.id ? styles.familyChipActive : ""}
                  key={family.id}
                  onClick={() => selectFamily(family.id)}
                  type="button"
                >
                  <span>{FAMILY_LABELS[family.id]}</span>
                  <strong>{family.count}</strong>
                </button>
              ))}
            </div>
          </div>

          {data.topProvinces.length ? (
            <div className={styles.compactFilterRow}>
              <span>Provincias destacadas:</span>
              <div className={styles.provinceChips}>
                {data.topProvinces.map((province) => (
                  <button
                    aria-pressed={filters.province === province.key}
                    className={filters.province === province.key ? styles.provinceChipActive : ""}
                    key={province.key}
                    onClick={() => selectProvince(province.key)}
                    type="button"
                  >
                    <span>{province.label}</span>
                    <strong>{province.count}</strong>
                  </button>
                ))}
                {filters.province ? (
                  <button onClick={() => updateFilter("province", "")} type="button">
                    Ver todas
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.resultsSection} id="eventos" aria-labelledby="results-title">
        <div className="emc-container">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Agenda</span>
              <h2 id="results-title">Agenda del fin de semana</h2>
            </div>
            <p>
              Ordenados por fecha
            </p>
          </div>

          {filteredEvents.length ? (
            <>
              <div
                className={styles.resultsGrid}
                data-limit={effectiveVisibleLimit}
                role="tabpanel"
              >
                {filteredEvents.map((event, index) => (
                  <div
                    className={styles.eventCardSlot}
                    hidden={index >= effectiveVisibleLimit}
                    key={event.slug || event.id}
                  >
                    <WeekendEventCard
                      analyticsSource={analyticsSource}
                      event={event}
                    />
                  </div>
                ))}
              </div>
              {hasMoreEvents ? (
                <div className={styles.showMoreRow}>
                  <button
                    onClick={() => setVisibleLimit(nextWeekendVisibleLimit(
                      effectiveVisibleLimit,
                      pageSize,
                      filteredEvents.length,
                    ))}
                    type="button"
                  >
                    Mostrar más eventos
                  </button>
                  <span>
                    Mostrando {Math.min(effectiveVisibleLimit, filteredEvents.length)} de {filteredEvents.length}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.emptyState} role="status">
              <h3>No hay eventos que coincidan con estos filtros.</h3>
              <p>Prueba otra provincia, disciplina o día, o consulta el calendario completo.</p>
              <button
                onClick={() => {
                  setFilters(DEFAULT_WEEKEND_FILTERS);
                  setVisibleLimit(12);
                }}
                type="button"
              >
                Mostrar todos los eventos
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
