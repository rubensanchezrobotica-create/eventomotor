"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_ZONE_FILTERS,
  featuredZoneProvinces,
  filterZoneEvents,
  hasAdvancedZoneFilters,
  hasSpecificZoneFilters,
  nextZoneVisibleLimit,
  visibleZoneLocalities,
  visibleZoneProvinces,
  ZONE_PERIODS,
  ZONE_PERIOD_TABS,
  zoneFamilySummary,
  zoneMobileResultTitle,
  zoneResultTitleParts,
  type ZoneDisciplineGroupId,
  type ZoneFilters,
  type ZonePeriod,
  type ZonePreviewData,
} from "./zone-preview-model";
import ZoneEventCard from "./ZoneEventCard";
import ZoneMobileSelector from "./ZoneMobileSelector";
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
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(
    () => hasAdvancedZoneFilters(initialFilters),
  );
  const [openExploreGroups, setOpenExploreGroups] = useState({
    families: false,
    localities: false,
    provinces: false,
  });
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
    ZONE_PERIODS.map((period) => [
      period.id,
      filterZoneEvents(data.events, { ...filters, period: period.id }, now).length,
    ]),
  ) as Record<ZonePeriod, number>, [data.events, filters, now]);
  const advancedFiltersActive = hasAdvancedZoneFilters(filters);
  const specificFiltersActive = hasSpecificZoneFilters(filters);
  const isWeekendActive = filters.period === "weekend";
  const resultTitle = zoneResultTitleParts(filters.period, data.zone.title);
  const mobileResultTitle = zoneMobileResultTitle(filters.period, data.zone.title);
  const hasMoreEvents = effectiveVisibleLimit < filteredEvents.length;
  const provinceCards = featuredZoneProvinces(data.provinceOptions);
  const visibleProvinceCount = visibleZoneProvinces(
    provinceCards,
    showAllProvinces,
    isMobile ? 6 : 8,
  ).length;
  const visibleLocalityCount = visibleZoneLocalities(
    data.localityOptions,
    showAllLocalities,
    isMobile ? 8 : 10,
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
        : { ...current, period: "weekend" }
    ));
    setVisibleLimit(12);
    scrollToEvents();
  }

  function clearFilters() {
    setFilters(DEFAULT_ZONE_FILTERS);
    setAdvancedFiltersOpen(false);
    setVisibleLimit(12);
  }

  function toggleExploreGroup(group: keyof typeof openExploreGroups) {
    setOpenExploreGroups((current) => ({ ...current, [group]: !current[group] }));
  }

  return (
    <>
      <section aria-labelledby="zone-filter-title" className={styles.filterSection} id="filtros">
        <div
          className={`emc-container ${styles.filterShell}`}
          data-advanced-open={advancedFiltersOpen}
        >
          <div className={styles.filterHeading}>
            <h2 id="zone-filter-title">
              <span className={styles.desktopOnly}>Filtrar eventos</span>
              <span className={styles.mobileOnly}>Encuentra un evento</span>
            </h2>
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

          <div className={`${styles.filterGrid} ${styles.desktopFilterGrid}`}>
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

          <div className={styles.mobileFilters}>
            <ZoneMobileSelector currentZone={data.zone.id} />

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

            <div aria-label="Periodos principales" className={styles.mobilePrimaryPeriods}>
              <button
                aria-pressed={filters.period === "upcoming"}
                className={filters.period === "upcoming" ? styles.tabActive : ""}
                onClick={() => updateFilter("period", "upcoming")}
                type="button"
              >
                <span>Próximos</span>
                <strong>{periodCounts.upcoming}</strong>
              </button>
              {periodCounts.weekend ? (
                <button
                  aria-label={`Este fin de semana, ${periodCounts.weekend} ${
                    periodCounts.weekend === 1 ? "evento" : "eventos"
                  }`}
                  aria-pressed={isWeekendActive}
                  className={isWeekendActive ? styles.tabActive : ""}
                  onClick={activateWeekend}
                  type="button"
                >
                  <span className={styles.weekendLabelFull}>Este fin de semana</span>
                  <span className={styles.weekendLabelCompact}>Fin de semana</span>
                  <span aria-hidden="true" className={styles.weekendPeriodSeparator}>·</span>
                  <strong>{periodCounts.weekend}</strong>
                </button>
              ) : null}
            </div>

            <div className={styles.mobileFilterActions}>
              <button className={styles.mobileResultsButton} onClick={scrollToEvents} type="button">
                Ver {filteredEvents.length} {filteredEvents.length === 1 ? "evento" : "eventos"}
              </button>
              <button
                aria-controls="zone-advanced-filters"
                aria-expanded={advancedFiltersOpen}
                className={styles.advancedFiltersToggle}
                onClick={() => setAdvancedFiltersOpen((current) => !current)}
                type="button"
              >
                <span aria-hidden="true" className={styles.advancedFiltersIcon}>
                  {advancedFiltersOpen ? "−" : "+"}
                </span>
                {advancedFiltersOpen
                  ? "Ocultar filtros"
                  : `Más filtros${advancedFiltersActive ? " · Activos" : ""}`}
              </button>
            </div>

            <div
              className={`${styles.mobileAdvancedFilters} ${
                advancedFiltersOpen ? styles.mobileAdvancedFiltersOpen : ""
              }`}
              id="zone-advanced-filters"
            >
              <div className={styles.mobileAdvancedFields}>
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
              <div aria-label="Periodos avanzados" className={styles.mobileAdvancedPeriods}>
                {ZONE_PERIOD_TABS.filter((period) => period.id !== "upcoming").map((period) => (
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
          </div>

          <div
            aria-label="Filtrar por periodo"
            className={`${styles.periodTabs} ${styles.desktopPeriodTabs}`}
          >
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
                onClick={clearFilters}
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
              <h2
                aria-label={`${resultTitle.lead} ${resultTitle.zone}`}
                id="zone-results-title"
                tabIndex={-1}
              >
                <span className={styles.desktopOnly} aria-hidden="true">
                  <span>{resultTitle.lead}</span>{" "}
                  <span className={styles.zoneTitleSuffix}>{resultTitle.zone}</span>
                </span>
                <span className={styles.mobileOnly} aria-hidden="true">{mobileResultTitle}</span>
              </h2>
              <p className={styles.resultsMeta}>
                <span className={styles.desktopOnly}>Ordenados por fecha</span>
                <span className={styles.mobileOnly}>
                  Ordenados por fecha
                </span>
              </p>
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
                onClick={clearFilters}
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
              <h2 aria-label={`Explora ${data.zone.title}`} id="zone-explore-title">
                <span className={styles.desktopOnly} aria-hidden="true">
                  Explora la zona {data.zone.title.toLowerCase()}
                </span>
                <span className={styles.mobileOnly} aria-hidden="true">
                  Explora {data.zone.title}
                </span>
              </h2>
              <p>Filtra la agenda por provincia, familia de eventos o localidad.</p>
            </div>

            {provinceCards.length ? (
              <div className={styles.exploreGroup}>
                <button
                  aria-controls="zone-provinces-panel"
                  aria-expanded={openExploreGroups.provinces}
                  className={styles.exploreAccordionToggle}
                  onClick={() => toggleExploreGroup("provinces")}
                  type="button"
                >
                  <span>
                    Provincias
                    {filters.province ? <small>Filtro activo</small> : null}
                  </span>
                  <span aria-hidden="true">{openExploreGroups.provinces ? "−" : "+"}</span>
                </button>
                <div
                  className={`${styles.exploreAccordionPanel} ${
                    openExploreGroups.provinces ? styles.exploreAccordionPanelOpen : ""
                  }`}
                  id="zone-provinces-panel"
                >
                  <h3>Provincias con más eventos</h3>
                  <div className={styles.exploreGrid} id="zone-provinces">
                    {provinceCards.map((province, index) => (
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
                  {provinceCards.length > (isMobile ? 6 : 8) ? (
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
              </div>
            ) : null}

            {data.disciplineGroups.length ? (
              <div className={styles.exploreGroup}>
                <button
                  aria-controls="zone-families-panel"
                  aria-expanded={openExploreGroups.families}
                  className={styles.exploreAccordionToggle}
                  onClick={() => toggleExploreGroup("families")}
                  type="button"
                >
                  <span>
                    Familias de eventos
                    {filters.group ? <small>Filtro activo</small> : null}
                  </span>
                  <span aria-hidden="true">{openExploreGroups.families ? "−" : "+"}</span>
                </button>
                <div
                  className={`${styles.exploreAccordionPanel} ${
                    openExploreGroups.families ? styles.exploreAccordionPanelOpen : ""
                  }`}
                  id="zone-families-panel"
                >
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
              </div>
            ) : null}

            {data.localityOptions.length ? (
              <div className={`${styles.exploreGroup} ${styles.localityGroup}`}>
                <button
                  aria-controls="zone-localities-panel"
                  aria-expanded={openExploreGroups.localities}
                  className={styles.exploreAccordionToggle}
                  onClick={() => toggleExploreGroup("localities")}
                  type="button"
                >
                  <span>
                    Localidades
                    {filters.query ? <small>Filtro activo</small> : null}
                  </span>
                  <span aria-hidden="true">{openExploreGroups.localities ? "−" : "+"}</span>
                </button>
                <div
                  className={`${styles.exploreAccordionPanel} ${
                    openExploreGroups.localities ? styles.exploreAccordionPanelOpen : ""
                  }`}
                  id="zone-localities-panel"
                >
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
                  {data.localityOptions.length > (isMobile ? 8 : 10) ? (
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
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
