"use client";

import { useEffect, useMemo, useState } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import {
  DEFAULT_DISCIPLINE_FILTERS,
  DISCIPLINE_PERIODS,
  disciplineFiltersToSearchParams,
  disciplineResultMeta,
  disciplineResultTitle,
  featuredDisciplineProvinces,
  filterDisciplineEvents,
  hasAdvancedDisciplineFilters,
  hasSpecificDisciplineFilters,
  nextDisciplineVisibleLimit,
  type DisciplineFilters,
  type DisciplinePeriod,
  type DisciplinePreviewData,
} from "./discipline-preview-model";
import DisciplineEventCard from "./DisciplineEventCard";
import DisciplineMobileSelector from "./DisciplineMobileSelector";
import zoneStyles from "@/components/zones/ZonePreview.module.css";
import styles from "./DisciplinePreview.module.css";

type DisciplineExplorerProps = {
  analyticsSource: "discipline_preview" | "discipline_public";
  data: DisciplinePreviewData;
  disciplineBasePath: "/preview/disciplinas" | "/disciplinas";
  initialFilters: DisciplineFilters;
  nowIso: string;
  pathname: string;
};

type ExploreGroup = "modalities" | "provinces" | "localities";

function scrollToResults() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.requestAnimationFrame(() => {
    document.getElementById("discipline-results-title")?.focus({ preventScroll: true });
    document.getElementById("eventos")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}

export default function DisciplineExplorer({
  analyticsSource,
  data,
  disciplineBasePath,
  initialFilters,
  nowIso,
  pathname,
}: DisciplineExplorerProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(
    () => hasAdvancedDisciplineFilters(initialFilters),
  );
  const [openGroups, setOpenGroups] = useState<Record<ExploreGroup, boolean>>({
    localities: false,
    modalities: false,
    provinces: false,
  });
  const [showAllLocalities, setShowAllLocalities] = useState(false);
  const [showAllProvinces, setShowAllProvinces] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [isMobile, setIsMobile] = useState(false);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const pageSize = isMobile ? 8 : 12;
  const effectiveVisibleLimit = isMobile && visibleLimit === 12 ? 8 : visibleLimit;
  const filteredEvents = useMemo(
    () => filterDisciplineEvents(data.events, filters, now),
    [data.events, filters, now],
  );
  const periodCounts = useMemo(() => Object.fromEntries(
    DISCIPLINE_PERIODS.map((period) => [
      period.id,
      filterDisciplineEvents(data.events, { ...filters, period: period.id }, now).length,
    ]),
  ) as Record<DisciplinePeriod, number>, [data.events, filters, now]);
  const provinceCards = featuredDisciplineProvinces(data.provinceOptions);
  const provinceLimit = showAllProvinces ? provinceCards.length : isMobile ? 6 : 8;
  const localityLimit = showAllLocalities ? data.localityOptions.length : isMobile ? 8 : 10;
  const desktopResultTitle = disciplineResultTitle(
    filters.period,
    data.discipline.title,
    false,
    data.discipline.slug,
  );
  const mobileResultTitle = disciplineResultTitle(
    filters.period,
    data.discipline.title,
    true,
    data.discipline.slug,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const query = disciplineFiltersToSearchParams(filters).toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [filters, pathname]);

  function updateFilter<Key extends keyof DisciplineFilters>(
    key: Key,
    value: DisciplineFilters[Key],
    analyticsName?: string,
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleLimit(12);
    if (analyticsName) {
      trackEvent(analyticsName, {
        discipline: data.discipline.slug,
        filter_name: key,
        filter_value: value,
        page_path: currentPagePath(),
        source: analyticsSource,
      });
    }
  }

  function applyAndScroll<Key extends keyof DisciplineFilters>(
    key: Key,
    value: DisciplineFilters[Key],
    analyticsName: string,
  ) {
    updateFilter(key, value, analyticsName);
    scrollToResults();
  }

  function clearFilters() {
    setFilters(DEFAULT_DISCIPLINE_FILTERS);
    setAdvancedFiltersOpen(false);
    setVisibleLimit(12);
  }

  function toggleGroup(group: ExploreGroup) {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
    trackEvent("toggle_discipline_exploration", {
      discipline: data.discipline.slug,
      group,
      page_path: currentPagePath(),
      will_open: !openGroups[group],
    });
  }

  return (
    <>
      <section aria-labelledby="discipline-filter-title" className={zoneStyles.filterSection} id="filtros">
        <div className={`emc-container ${zoneStyles.filterShell}`}>
          <div className={zoneStyles.filterHeading}>
            <h2 id="discipline-filter-title">
              <span className={zoneStyles.desktopOnly}>Filtrar eventos</span>
              <span className={zoneStyles.mobileOnly}>Encuentra un evento</span>
            </h2>
          </div>

          <div className={`${zoneStyles.filterGrid} ${zoneStyles.desktopFilterGrid} ${styles.desktopFilterGrid}`}>
            <label className={filters.province ? zoneStyles.filterFieldActive : undefined}>
              <span>Provincia</span>
              <select
                onChange={(event) => updateFilter("province", event.target.value, "select_discipline_province")}
                value={filters.province}
              >
                <option value="">Todas las provincias</option>
                {provinceCards.map((option) => (
                  <option key={option.key} value={option.key}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
            <label className={filters.modality ? zoneStyles.filterFieldActive : undefined}>
              <span>Modalidad</span>
              <select
                onChange={(event) => updateFilter("modality", event.target.value, "select_discipline_modality")}
                value={filters.modality}
              >
                <option value="">Todas las modalidades</option>
                {data.modalities.map((option) => (
                  <option key={option.id} value={option.id}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
            <label className={filters.vehicle ? zoneStyles.filterFieldActive : undefined}>
              <span>Vehículo</span>
              <select onChange={(event) => updateFilter("vehicle", event.target.value)} value={filters.vehicle}>
                <option value="">Todos los vehículos</option>
                {data.vehicleOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
            <label className={filters.query ? zoneStyles.filterFieldActive : undefined}>
              <span>Título o localidad</span>
              <input
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="Ej. Jarama, Madrid…"
                type="search"
                value={filters.query}
              />
            </label>
          </div>

          <div className={zoneStyles.mobileFilters}>
            <DisciplineMobileSelector
              analyticsSource={`${analyticsSource}_filter`}
              basePath={disciplineBasePath}
              currentDiscipline={data.discipline.slug}
            />
            <label className={filters.province ? zoneStyles.filterFieldActive : undefined}>
              <span>Provincia</span>
              <select
                onChange={(event) => updateFilter("province", event.target.value, "select_discipline_province")}
                value={filters.province}
              >
                <option value="">Todas las provincias</option>
                {provinceCards.map((option) => (
                  <option key={option.key} value={option.key}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>

            <div aria-label="Periodos principales" className={zoneStyles.mobilePrimaryPeriods}>
              <button
                aria-pressed={filters.period === "upcoming"}
                className={filters.period === "upcoming" ? zoneStyles.tabActive : ""}
                onClick={() => updateFilter("period", "upcoming", "select_discipline_period")}
                type="button"
              >
                <span>Próximos</span><strong>{periodCounts.upcoming}</strong>
              </button>
              <button
                aria-label={`Este fin de semana, ${periodCounts.weekend} ${periodCounts.weekend === 1 ? "evento" : "eventos"}`}
                aria-pressed={filters.period === "weekend"}
                className={filters.period === "weekend" ? zoneStyles.tabActive : ""}
                onClick={() => updateFilter("period", "weekend", "select_discipline_period")}
                type="button"
              >
                <span className={zoneStyles.weekendLabelFull}>Este fin de semana</span>
                <span className={zoneStyles.weekendLabelCompact}>Fin de semana</span>
                <strong>{periodCounts.weekend}</strong>
              </button>
            </div>

            <div className={zoneStyles.mobileFilterActions}>
              <button
                className={zoneStyles.mobileResultsButton}
                onClick={() => {
                  trackEvent("view_discipline_results", {
                    discipline: data.discipline.slug,
                    page_path: currentPagePath(),
                    result_count: filteredEvents.length,
                  });
                  scrollToResults();
                }}
                type="button"
              >
                Ver {filteredEvents.length} {filteredEvents.length === 1 ? "evento" : "eventos"}
              </button>
              <button
                aria-controls="discipline-advanced-filters"
                aria-expanded={advancedFiltersOpen}
                className={zoneStyles.advancedFiltersToggle}
                onClick={() => {
                  setAdvancedFiltersOpen((current) => !current);
                  trackEvent("toggle_discipline_filters", {
                    discipline: data.discipline.slug,
                    page_path: currentPagePath(),
                    will_open: !advancedFiltersOpen,
                  });
                }}
                type="button"
              >
                <span aria-hidden="true" className={zoneStyles.advancedFiltersIcon}>
                  {advancedFiltersOpen ? "−" : "+"}
                </span>
                {advancedFiltersOpen ? "Ocultar filtros" : "Más filtros"}
              </button>
            </div>

            <div
              className={`${zoneStyles.mobileAdvancedFilters} ${
                advancedFiltersOpen ? zoneStyles.mobileAdvancedFiltersOpen : ""
              }`}
              id="discipline-advanced-filters"
            >
              <div className={zoneStyles.mobileAdvancedFields}>
                <label className={filters.modality ? zoneStyles.filterFieldActive : undefined}>
                  <span>Modalidad</span>
                  <select onChange={(event) => updateFilter("modality", event.target.value)} value={filters.modality}>
                    <option value="">Todas las modalidades</option>
                    {data.modalities.map((option) => (
                      <option key={option.id} value={option.id}>{option.label} ({option.count})</option>
                    ))}
                  </select>
                </label>
                <label className={filters.vehicle ? zoneStyles.filterFieldActive : undefined}>
                  <span>Vehículo</span>
                  <select onChange={(event) => updateFilter("vehicle", event.target.value)} value={filters.vehicle}>
                    <option value="">Todos los vehículos</option>
                    {data.vehicleOptions.map((option) => (
                      <option key={option.key} value={option.key}>{option.label} ({option.count})</option>
                    ))}
                  </select>
                </label>
                <label className={filters.query ? zoneStyles.filterFieldActive : undefined}>
                  <span>Título o localidad</span>
                  <input
                    onChange={(event) => updateFilter("query", event.target.value)}
                    placeholder="Ej. Jarama, Madrid…"
                    type="search"
                    value={filters.query}
                  />
                </label>
              </div>
              <div aria-label="Periodos avanzados" className={zoneStyles.mobileAdvancedPeriods}>
                {DISCIPLINE_PERIODS.filter(({ id }) => ["next30", "month", "all"].includes(id)).map((period) => (
                  <button
                    aria-pressed={filters.period === period.id}
                    className={filters.period === period.id ? zoneStyles.tabActive : ""}
                    key={period.id}
                    onClick={() => updateFilter("period", period.id, "select_discipline_period")}
                    type="button"
                  >
                    <span>{period.label}</span><strong>{periodCounts[period.id]}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div aria-label="Filtrar por periodo" className={`${zoneStyles.periodTabs} ${zoneStyles.desktopPeriodTabs}`}>
            {DISCIPLINE_PERIODS.map((period) => (
              <button
                aria-pressed={filters.period === period.id}
                className={filters.period === period.id ? zoneStyles.tabActive : ""}
                key={period.id}
                onClick={() => updateFilter("period", period.id, "select_discipline_period")}
                type="button"
              >
                <span>{period.label}</span><strong>{periodCounts[period.id]}</strong>
              </button>
            ))}
          </div>

          {hasSpecificDisciplineFilters(filters) ? (
            <div aria-live="polite" className={zoneStyles.filterSummary}>
              <span><strong>{filteredEvents.length}</strong> {filteredEvents.length === 1 ? "resultado" : "resultados"}</span>
              <span aria-hidden="true">·</span>
              <button className={zoneStyles.clearButton} onClick={clearFilters} type="button">Limpiar filtros</button>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="discipline-results-title" className={zoneStyles.resultsSection} id="eventos">
        <div className="emc-container">
          <div className={zoneStyles.sectionHeading}>
            <div>
              <span className={zoneStyles.eyebrow}>Agenda por disciplina</span>
              <h2
                aria-label={desktopResultTitle}
                id="discipline-results-title"
                tabIndex={-1}
              >
                <span aria-hidden="true" className={zoneStyles.desktopOnly}>{desktopResultTitle}</span>
                <span aria-hidden="true" className={zoneStyles.mobileOnly}>{mobileResultTitle}</span>
              </h2>
              <p className={zoneStyles.resultsMeta}>{disciplineResultMeta(filteredEvents.length)}</p>
            </div>
          </div>
          {filteredEvents.length ? (
            <>
              <div className={zoneStyles.resultsGrid} data-limit={effectiveVisibleLimit}>
                {filteredEvents.map((event, index) => (
                  <div className={zoneStyles.eventCardSlot} hidden={index >= effectiveVisibleLimit} key={event.slug || event.id}>
                    <DisciplineEventCard event={event} source={`${analyticsSource}_results`} />
                  </div>
                ))}
              </div>
              {effectiveVisibleLimit < filteredEvents.length ? (
                <div className={zoneStyles.showMoreRow}>
                  <button
                    onClick={() => {
                      const next = nextDisciplineVisibleLimit(effectiveVisibleLimit, pageSize, filteredEvents.length);
                      setVisibleLimit(next);
                      trackEvent("show_more_discipline_events", {
                        discipline: data.discipline.slug,
                        page_path: currentPagePath(),
                        visible_count: next,
                      });
                    }}
                    type="button"
                  >
                    Mostrar más eventos
                  </button>
                  <span>Mostrando {effectiveVisibleLimit} de {filteredEvents.length}</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className={zoneStyles.emptyState} role="status">
              <h3>No hay eventos que coincidan con estos filtros.</h3>
              <p>Prueba otro periodo, provincia, modalidad o término de búsqueda.</p>
              <button onClick={clearFilters} type="button">Mostrar próximos eventos</button>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="discipline-explore-title" className={zoneStyles.exploreSection}>
        <div className="emc-container">
          <div className={zoneStyles.exploreHeading}>
            <span className={zoneStyles.eyebrow}>Descubre la disciplina</span>
            <h2 id="discipline-explore-title">Explora {data.discipline.title}</h2>
            <p>Filtra por modalidad, provincia o localidad.</p>
          </div>

          <div className={zoneStyles.exploreGroup}>
            <button
              aria-controls="discipline-modalities-panel"
              aria-expanded={openGroups.modalities}
              className={zoneStyles.exploreAccordionToggle}
              onClick={() => toggleGroup("modalities")}
              type="button"
            >
              <span>Modalidades{filters.modality ? <small>Filtro activo</small> : null}</span>
              <span aria-hidden="true">{openGroups.modalities ? "−" : "+"}</span>
            </button>
            <div className={`${zoneStyles.exploreAccordionPanel} ${openGroups.modalities ? zoneStyles.exploreAccordionPanelOpen : ""}`} id="discipline-modalities-panel">
              <h3>Modalidades con próximos eventos</h3>
              <div className={`${zoneStyles.disciplineGrid} ${styles.modalityGrid}`}>
                {data.modalities.map((modality) => (
                  <button
                    aria-pressed={filters.modality === modality.id}
                    className={filters.modality === modality.id ? zoneStyles.exploreCardActive : ""}
                    key={modality.id}
                    onClick={() => applyAndScroll("modality", modality.id, "select_discipline_modality")}
                    type="button"
                  >
                    <strong>{modality.label}</strong>
                    <span className={zoneStyles.exploreCardMeta}><span>{modality.count} próximos eventos</span><span aria-hidden="true">→</span></span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={zoneStyles.exploreGroup}>
            <button
              aria-controls="discipline-provinces-panel"
              aria-expanded={openGroups.provinces}
              className={zoneStyles.exploreAccordionToggle}
              onClick={() => toggleGroup("provinces")}
              type="button"
            >
              <span>Provincias{filters.province ? <small>Filtro activo</small> : null}</span>
              <span aria-hidden="true">{openGroups.provinces ? "−" : "+"}</span>
            </button>
            <div className={`${zoneStyles.exploreAccordionPanel} ${openGroups.provinces ? zoneStyles.exploreAccordionPanelOpen : ""}`} id="discipline-provinces-panel">
              <h3>Provincias con más próximos eventos</h3>
              <div className={zoneStyles.exploreGrid} id="discipline-provinces">
                {provinceCards.map((province, index) => (
                  <button
                    aria-pressed={filters.province === province.key}
                    className={filters.province === province.key ? zoneStyles.exploreCardActive : ""}
                    hidden={index >= provinceLimit}
                    key={province.key}
                    onClick={() => applyAndScroll("province", province.key, "select_discipline_province")}
                    type="button"
                  >
                    <strong>{province.label}</strong>
                    <span className={zoneStyles.exploreCardMeta}><span>{province.count} próximos eventos</span><span aria-hidden="true">→</span></span>
                  </button>
                ))}
              </div>
              {provinceCards.length > (isMobile ? 6 : 8) ? (
                <button
                  aria-controls="discipline-provinces"
                  aria-expanded={showAllProvinces}
                  className={zoneStyles.expandButton}
                  onClick={() => setShowAllProvinces((current) => !current)}
                  type="button"
                >
                  {showAllProvinces ? "Ocultar provincias" : "Ver todas las provincias"}
                </button>
              ) : null}
            </div>
          </div>

          {data.localityOptions.length ? (
            <div className={`${zoneStyles.exploreGroup} ${zoneStyles.localityGroup}`}>
              <button
                aria-controls="discipline-localities-panel"
                aria-expanded={openGroups.localities}
                className={zoneStyles.exploreAccordionToggle}
                onClick={() => toggleGroup("localities")}
                type="button"
              >
                <span>Localidades{filters.locality ? <small>Filtro activo</small> : null}</span>
                <span aria-hidden="true">{openGroups.localities ? "−" : "+"}</span>
              </button>
              <div className={`${zoneStyles.exploreAccordionPanel} ${openGroups.localities ? zoneStyles.exploreAccordionPanelOpen : ""}`} id="discipline-localities-panel">
                <h3>Localidades con más actividad</h3>
                <div className={zoneStyles.localityChips} id="discipline-localities">
                  {data.localityOptions.map((locality, index) => (
                    <button
                      aria-pressed={filters.locality === locality.key}
                      hidden={index >= localityLimit}
                      key={locality.key}
                      onClick={() => applyAndScroll("locality", locality.key, "select_discipline_locality")}
                      type="button"
                    >
                      <span>{locality.label}</span><strong>{locality.count}</strong>
                    </button>
                  ))}
                </div>
                {data.localityOptions.length > (isMobile ? 8 : 10) ? (
                  <button
                    aria-controls="discipline-localities"
                    aria-expanded={showAllLocalities}
                    className={zoneStyles.expandButton}
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
    </>
  );
}
