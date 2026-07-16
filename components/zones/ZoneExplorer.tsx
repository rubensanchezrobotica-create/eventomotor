"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_ZONE_FILTERS,
  filterZoneEvents,
  nextZoneVisibleLimit,
  ZONE_PERIODS,
  type ZoneDisciplineGroupId,
  type ZoneFilters,
  type ZonePeriod,
  type ZonePreviewData,
} from "./zone-preview-model";
import ZoneEventCard from "./ZoneEventCard";
import styles from "./ZonePreview.module.css";

type ZoneExplorerProps = {
  data: ZonePreviewData;
  initialFilters: ZoneFilters;
  nowIso: string;
  pathname: string;
};

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 768px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function hasActiveFilters(filters: ZoneFilters) {
  return Boolean(
    filters.discipline
    || filters.group
    || filters.period !== "upcoming"
    || filters.province
    || filters.query,
  );
}

function scrollToEvents() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.requestAnimationFrame(() => {
    document.getElementById("eventos")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}

function resultTitle(period: ZonePeriod, zoneTitle: string) {
  if (period === "weekend") return `Este fin de semana en la zona ${zoneTitle.toLowerCase()}`;
  if (period === "next30") return `Eventos de los próximos 30 días en la zona ${zoneTitle.toLowerCase()}`;
  if (period === "month") return `Eventos de este mes en la zona ${zoneTitle.toLowerCase()}`;
  if (period === "all") return `Todos los eventos de la zona ${zoneTitle.toLowerCase()}`;
  return `Próximos eventos de motor en la zona ${zoneTitle.toLowerCase()}`;
}

export default function ZoneExplorer({
  data,
  initialFilters,
  nowIso,
  pathname,
}: ZoneExplorerProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const isMobile = useSyncExternalStore(subscribeMobile, isMobileViewport, () => false);
  const pageSize = isMobile ? 8 : 12;
  const effectiveVisibleLimit = isMobile && visibleLimit === 12 ? 8 : visibleLimit;
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const filteredEvents = useMemo(
    () => filterZoneEvents(data.events, filters, now),
    [data.events, filters, now],
  );
  const periodCounts = useMemo(() => Object.fromEntries(
    ZONE_PERIODS.map((period) => [
      period.id,
      filterZoneEvents(data.events, { ...filters, period: period.id }, now).length,
    ]),
  ) as Record<ZonePeriod, number>, [data.events, filters, now]);
  const filtersActive = hasActiveFilters(filters);
  const hasMoreEvents = effectiveVisibleLimit < filteredEvents.length;

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.province) params.set("provincia", filters.province);
    if (filters.discipline) params.set("disciplina", filters.discipline);
    if (filters.group) params.set("tipo", filters.group);
    if (filters.period !== "upcoming") params.set("periodo", filters.period);
    if (filters.query) params.set("q", filters.query);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [filters, pathname]);

  function updateFilter<Key extends keyof ZoneFilters>(key: Key, value: ZoneFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleLimit(12);
  }

  function selectProvince(province: string) {
    updateFilter("province", province);
    scrollToEvents();
  }

  function selectGroup(group: ZoneDisciplineGroupId) {
    setFilters((current) => ({
      ...current,
      discipline: "",
      group,
      query: "",
    }));
    setVisibleLimit(12);
    scrollToEvents();
  }

  function selectLocality(locality: string) {
    setFilters((current) => ({
      ...current,
      query: locality,
    }));
    setVisibleLimit(12);
    scrollToEvents();
  }

  return (
    <>
      <section aria-labelledby="zone-filter-title" className={styles.filterSection} id="filtros">
        <div className={`emc-container ${styles.filterShell}`}>
          <div className={styles.filterHeading}>
            <h2 id="zone-filter-title">Filtrar eventos</h2>
            <div className={styles.filterHeadingActions}>
              <p aria-live="polite">
                <strong>{filteredEvents.length}</strong>{" "}
                {filteredEvents.length === 1 ? "resultado" : "resultados"}
              </p>
              {filtersActive ? (
                <button
                  className={styles.clearButton}
                  onClick={() => {
                    setFilters(DEFAULT_ZONE_FILTERS);
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
                <option value="">Todas las provincias</option>
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

            <label className={filters.query ? styles.filterFieldActive : undefined}>
              <span>Título o localidad</span>
              <input
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="Ej. rally, Madrid, Jarama…"
                type="search"
                value={filters.query}
              />
            </label>
          </div>

          <div aria-label="Filtrar por periodo" className={styles.periodTabs}>
            {ZONE_PERIODS.map((period) => (
              <button
                aria-pressed={filters.period === period.id}
                className={filters.period === period.id ? styles.tabActive : ""}
                key={period.id}
                onClick={() => updateFilter("period", period.id)}
                type="button"
              >
                <span>{period.label}</span>
                <strong>{periodCounts[period.id]}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="zone-results-title" className={styles.resultsSection} id="eventos">
        <div className="emc-container">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Agenda territorial</span>
              <h2 id="zone-results-title">{resultTitle(filters.period, data.zone.title)}</h2>
            </div>
            <p>Ordenados por fecha</p>
          </div>

          {filteredEvents.length ? (
            <>
              <div className={styles.resultsGrid} data-limit={effectiveVisibleLimit}>
                {filteredEvents.map((event, index) => (
                  <div
                    className={styles.eventCardSlot}
                    hidden={index >= effectiveVisibleLimit}
                    key={event.slug || event.id}
                  >
                    <ZoneEventCard event={event} />
                  </div>
                ))}
              </div>
              {hasMoreEvents ? (
                <div className={styles.showMoreRow}>
                  <button
                    onClick={() => setVisibleLimit(nextZoneVisibleLimit(
                      effectiveVisibleLimit,
                      pageSize,
                      filteredEvents.length,
                    ))}
                    type="button"
                  >
                    Mostrar más eventos
                  </button>
                  <span>
                    Mostrando {Math.min(effectiveVisibleLimit, filteredEvents.length)} de{" "}
                    {filteredEvents.length}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.emptyState} role="status">
              <h3>No hay eventos que coincidan con estos filtros.</h3>
              <p>Prueba otro periodo, provincia, disciplina o término de búsqueda.</p>
              <button
                onClick={() => {
                  setFilters(DEFAULT_ZONE_FILTERS);
                  setVisibleLimit(12);
                }}
                type="button"
              >
                Mostrar próximos eventos
              </button>
            </div>
          )}
        </div>
      </section>

      {data.provinceOptions.length ? (
        <section aria-labelledby="province-title" className={styles.exploreSection}>
          <div className="emc-container">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>Territorio</span>
                <h2 id="province-title">Explora eventos por provincia</h2>
              </div>
            </div>
            <div className={styles.exploreGrid}>
              {data.provinceOptions.map((province) => (
                <button
                  aria-pressed={filters.province === province.key}
                  className={filters.province === province.key ? styles.exploreCardActive : ""}
                  key={province.key}
                  onClick={() => selectProvince(province.key)}
                  type="button"
                >
                  <strong>{province.label}</strong>
                  <span>{province.count} próximos eventos</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {data.localityOptions.length ? (
        <section aria-labelledby="locality-title" className={styles.exploreSection}>
          <div className="emc-container">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>Localidades</span>
                <h2 id="locality-title">Localidades con más actividad</h2>
              </div>
            </div>
            <div className={styles.localityChips}>
              {data.localityOptions.map((locality) => (
                <button
                  aria-pressed={filters.query === locality.label}
                  key={locality.key}
                  onClick={() => selectLocality(locality.label)}
                  type="button"
                >
                  <span>{locality.label}</span>
                  <strong>{locality.count}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {data.disciplineGroups.length ? (
        <section aria-labelledby="discipline-title" className={styles.exploreSection}>
          <div className="emc-container">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>Disciplinas</span>
                <h2 id="discipline-title">Explora eventos por tipo</h2>
              </div>
            </div>
            <div className={styles.disciplineGrid}>
              {data.disciplineGroups.map((group) => (
                <button
                  aria-pressed={filters.group === group.id}
                  className={filters.group === group.id ? styles.exploreCardActive : ""}
                  key={group.id}
                  onClick={() => selectGroup(group.id)}
                  type="button"
                >
                  <strong>{group.label}</strong>
                  <span>{group.count} próximos eventos</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
