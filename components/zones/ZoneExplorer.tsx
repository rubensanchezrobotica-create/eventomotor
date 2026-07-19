"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  createWeekendZoneFilters,
  DEFAULT_ZONE_FILTERS,
  filterZoneEvents,
  hasSpecificZoneFilters,
  nextZoneVisibleLimit,
  visibleZoneLocalities,
  visibleZoneProvinces,
  ZONE_PERIOD_TABS,
  zoneFamilySummary,
  zoneResultTitleParts,
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

function scrollToEvents() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.requestAnimationFrame(() => {
    document.getElementById("zone-results-title")?.focus({ preventScroll: true });
    document.getElementById("eventos")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}

export default function ZoneExplorer({
  data,
  initialFilters,
  nowIso,
  pathname,
}: ZoneExplorerProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [showAllLocalities, setShowAllLocalities] = useState(false);
  const [showAllProvinces, setShowAllProvinces] = useState(false);
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
    ZONE_PERIOD_TABS.map((period) => [
      period.id,
      filterZoneEvents(data.events, { ...filters, period: period.id }, now).length,
    ]),
  ) as Record<ZonePeriod, number>, [data.events, filters, now]);
  const specificFiltersActive = hasSpecificZoneFilters(filters);
  const isWeekendActive = filters.period === "weekend";
  const resultTitle = zoneResultTitleParts(filters.period, data.zone.title);
  const hasMoreEvents = effectiveVisibleLimit < filteredEvents.length;
  const visibleProvinceCount = visibleZoneProvinces(
    data.provinceOptions,
    showAllProvinces,
  ).length;
  const visibleLocalityCount = visibleZoneLocalities(
    data.localityOptions,
    showAllLocalities,
  ).length;

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

  function activateWeekend() {
    setFilters((current) => (
      current.period === "weekend"
        ? { ...current, period: "upcoming" }
        : { ...current, period: createWeekendZoneFilters().period }
    ));
    setVisibleLimit(12);
    scrollToEvents();
  }

  return (
    <>
      <section aria-labelledby="zone-filter-title" className={styles.filterSection} id="filtros">
        <div className={`emc-container ${styles.filterShell}`}>
          <div className={styles.filterHeading}>
            <h2 id="zone-filter-title">Filtrar eventos</h2>
          </div>

          {data.weekendEvents.length ? (
            <button
              aria-label={isWeekendActive
                ? "Volver a próximos eventos"
                : `Ver ${data.weekendEvents.length} eventos de este fin de semana`}
              aria-pressed={isWeekendActive}
              className={`${styles.weekendStrip} ${isWeekendActive ? styles.weekendStripActive : ""}`}
              onClick={activateWeekend}
              type="button"
            >
              <span className={styles.weekendStripCopy}>
                <strong>
                  {data.weekendEvents.length}{" "}
                  {data.weekendEvents.length === 1 ? "evento" : "eventos"} este fin de semana
                </strong>
                <span>Viernes, sábado y domingo más próximos.</span>
              </span>
              <span className={styles.weekendStripAction}>
                {isWeekendActive ? "Volver a próximos" : "Ver eventos"}
                <span aria-hidden="true">→</span>
              </span>
            </button>
          ) : null}

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
            {ZONE_PERIOD_TABS.map((period) => (
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

          {specificFiltersActive ? (
            <div aria-live="polite" className={styles.filterSummary}>
              <span>
                <strong>{filteredEvents.length}</strong>{" "}
                {filteredEvents.length === 1 ? "resultado" : "resultados"}
              </span>
              <span aria-hidden="true">·</span>
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
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="zone-results-title" className={styles.resultsSection} id="eventos">
        <div className="emc-container">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Agenda territorial</span>
              <h2 id="zone-results-title" tabIndex={-1}>
                <span>{resultTitle.lead}</span>{" "}
                <span className={styles.zoneTitleSuffix}>{resultTitle.zone}</span>
              </h2>
              <p className={styles.resultsMeta}>Ordenados por fecha</p>
            </div>
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

      {data.provinceOptions.length || data.disciplineGroups.length || data.localityOptions.length ? (
        <section aria-labelledby="zone-explore-title" className={styles.exploreSection}>
          <div className="emc-container">
            <div className={styles.exploreHeading}>
              <span className={styles.eyebrow}>Descubre la zona</span>
              <h2 id="zone-explore-title">
                Explora la zona {data.zone.title.toLowerCase()}
              </h2>
              <p>Filtra la agenda por provincia, familia de eventos o localidad.</p>
            </div>

            {data.provinceOptions.length ? (
              <div className={styles.exploreGroup}>
                <h3>Provincias con más eventos</h3>
                <div className={styles.exploreGrid} id="zone-provinces">
                  {data.provinceOptions.map((province, index) => (
                    <button
                      aria-pressed={filters.province === province.key}
                      className={filters.province === province.key ? styles.exploreCardActive : ""}
                      hidden={index >= visibleProvinceCount}
                      key={province.key}
                      onClick={() => selectProvince(province.key)}
                      type="button"
                    >
                      <strong>{province.label}</strong>
                      <span className={styles.exploreCardMeta}>
                        <span>{province.count} próximos eventos</span>
                        <span aria-hidden="true">→</span>
                      </span>
                    </button>
                  ))}
                </div>
                {data.provinceOptions.length > 8 ? (
                  <button
                    aria-controls="zone-provinces"
                    aria-expanded={showAllProvinces}
                    className={styles.expandButton}
                    onClick={() => setShowAllProvinces((current) => !current)}
                    type="button"
                  >
                    {showAllProvinces ? "Ocultar provincias" : "Ver todas las provincias"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {data.disciplineGroups.length ? (
              <div className={styles.exploreGroup}>
                <h3>Familias de eventos</h3>
                <p className={styles.exploreDescription}>
                  {zoneFamilySummary(data.stats.disciplines, data.disciplineGroups.length)}
                </p>
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
                      <span className={styles.exploreCardMeta}>
                        <span>{group.count} próximos eventos</span>
                        <span aria-hidden="true">→</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {data.localityOptions.length ? (
              <div className={`${styles.exploreGroup} ${styles.localityGroup}`}>
                <h3>Localidades con más actividad</h3>
                <div className={styles.localityChips} id="zone-localities">
                  {data.localityOptions.map((locality, index) => (
                    <button
                      aria-pressed={filters.query === locality.label}
                      hidden={index >= visibleLocalityCount}
                      key={locality.key}
                      onClick={() => selectLocality(locality.label)}
                      type="button"
                    >
                      <span>{locality.label}</span>
                      <strong>{locality.count}</strong>
                    </button>
                  ))}
                </div>
                {data.localityOptions.length > 10 ? (
                  <button
                    aria-controls="zone-localities"
                    aria-expanded={showAllLocalities}
                    className={styles.expandButton}
                    onClick={() => setShowAllLocalities((current) => !current)}
                    type="button"
                  >
                    {showAllLocalities ? "Ocultar localidades" : "Mostrar todas las localidades"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
