"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import type {
  ConceptHomeSearchPanelProps,
  DateQuickFilter,
} from "@/components/public/concept/ConceptHomePage";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import {
  buildCompactFilterSummary,
  buildPreviewSuggestions,
  getActiveAdvancedFilterCount,
  PREVIEW_DATE_OPTIONS,
  PREVIEW_VEHICLE_FILTERS,
  previewResultLabel,
  previewSearchButtonLabel,
} from "./search-preview-model";
import styles from "./SearchPreview.module.css";

const QUICK_DATES = PREVIEW_DATE_OPTIONS.filter((option) => option.id !== "todos");
const ADVANCED_FILTERS_PANEL_ID = "preview-home-advanced-filters";

const SUGGESTION_KIND_LABELS = {
  evento: "Evento",
  ubicacion: "Ubicación",
  disciplina: "Disciplina",
} as const;

export default function SearchPreview({
  events,
  zones,
  disciplines,
  query,
  discipline,
  zone,
  vehicleFilter,
  dateFilter,
  filteredCount,
  locationLabel,
  locationMessage,
  userLocationActive,
  onSearch,
  onQuery,
  onDiscipline,
  onZone,
  onVehicle,
  onDateFilter,
  onUseLocation,
  onClearLocation,
  onClearFilters,
}: ConceptHomeSearchPanelProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const suggestions = useMemo(() => buildPreviewSuggestions(events, query), [events, query]);
  const compactSearchState = {
    zone,
    dateFilter,
    vehicleFilter,
    discipline,
    userLocationActive,
  };
  const activeAdvancedFilterCount = getActiveAdvancedFilterCount(compactSearchState);
  const compactFilterSummary = buildCompactFilterSummary(compactSearchState);
  const filtersToggleLabel = activeAdvancedFilterCount === 0
    ? "Más filtros"
    : `Más filtros · ${activeAdvancedFilterCount} ${activeAdvancedFilterCount === 1 ? "activo" : "activos"}`;
  const hasActiveFilters =
    query.trim() !== "" ||
    discipline !== "Todas" ||
    zone !== "Toda España" ||
    vehicleFilter !== "todos" ||
    dateFilter !== "todos";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuggestionsOpen(false);
    trackEvent("search_events", {
      search_term: query.trim(),
      page_path: currentPagePath(),
    });
    onSearch();
  }

  function chooseSuggestion(label: string) {
    onQuery(label);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function handleQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen || !suggestions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion].label);
    } else if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  }

  return (
    <form className={`emc-hero-search ${styles.searchPanel}`} data-preview-search="true" onSubmit={submit}>
      <div className={styles.primaryRow}>
        <div className={`${styles.field} ${styles.queryField}`}>
          <label htmlFor="preview-home-query">¿Qué buscas?</label>
          <input
            aria-activedescendant={activeSuggestion >= 0 ? suggestions[activeSuggestion]?.id : undefined}
            aria-autocomplete="list"
            aria-controls="preview-home-suggestions"
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            autoComplete="off"
            id="preview-home-query"
            onBlur={() => setSuggestionsOpen(false)}
            onChange={(event) => {
              onQuery(event.target.value);
              setSuggestionsOpen(true);
              setActiveSuggestion(-1);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={handleQueryKeyDown}
            placeholder="Evento, circuito, ciudad…"
            role="combobox"
            value={query}
          />
          {suggestionsOpen && suggestions.length ? (
            <div className={styles.suggestions} id="preview-home-suggestions" role="listbox">
              {suggestions.map((suggestion, index) => (
                <button
                  aria-selected={activeSuggestion === index}
                  className={activeSuggestion === index ? styles.suggestionActive : undefined}
                  id={suggestion.id}
                  key={suggestion.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion.label)}
                  role="option"
                  type="button"
                >
                  <span>{SUGGESTION_KIND_LABELS[suggestion.kind]}</span>
                  <strong>{suggestion.label}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          className={`emc-btn emc-btn-primary ${styles.submitButton}`}
          disabled={filteredCount === 0}
          type="submit"
        >
          {filteredCount === 0 ? "Sin eventos" : previewSearchButtonLabel(filteredCount)}
        </button>
      </div>

      <div className={styles.compactMetaRow}>
        <button
          aria-controls={ADVANCED_FILTERS_PANEL_ID}
          aria-expanded={isFiltersOpen}
          className={styles.filtersToggle}
          onClick={() => setIsFiltersOpen((current) => !current)}
          type="button"
        >
          <span>{filtersToggleLabel}</span>
          <span aria-hidden="true" className={styles.toggleIcon}>⌄</span>
        </button>

        {compactFilterSummary ? (
          <p className={styles.filterSummary} title={compactFilterSummary}>{compactFilterSummary}</p>
        ) : null}

        {hasActiveFilters ? (
          <button className={styles.clearButton} onClick={onClearFilters} type="button">
            Limpiar
          </button>
        ) : null}
      </div>

      <div
        className={styles.advancedPanel}
        hidden={!isFiltersOpen}
        id={ADVANCED_FILTERS_PANEL_ID}
      >
        <div className={`${styles.field} ${styles.locationField}`}>
          <label htmlFor="preview-home-zone">¿Dónde?</label>
          <div className={styles.locationControl}>
            <select
              aria-describedby={locationMessage ? "preview-location-message" : undefined}
              id="preview-home-zone"
              onChange={(event) => onZone(event.target.value)}
              value={zone}
            >
              <option value="Toda España">{userLocationActive ? locationLabel : "Toda España"}</option>
              {zones.map((item) => <option key={item.name}>{item.name}</option>)}
            </select>
            <button
              aria-label={userLocationActive ? "Dejar de usar mi ubicación" : "Usar mi ubicación"}
              aria-pressed={userLocationActive}
              className={`${styles.locationAction} ${userLocationActive ? styles.locationActive : ""}`}
              onClick={userLocationActive ? onClearLocation : onUseLocation}
              title={userLocationActive ? "Dejar de usar mi ubicación" : "Usar mi ubicación"}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
                <circle cx="12" cy="9" r="2.4" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`${styles.field} ${styles.dateField}`}>
          <label htmlFor="preview-home-date">¿Cuándo?</label>
          <select
            id="preview-home-date"
            onChange={(event) => onDateFilter(event.target.value as DateQuickFilter)}
            value={dateFilter}
          >
            {PREVIEW_DATE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>

        <div aria-label="Tipo de vehículo" className={styles.vehicleTabs} role="group">
          {PREVIEW_VEHICLE_FILTERS.map((item) => (
            <button
              aria-pressed={vehicleFilter === item.id}
              className={vehicleFilter === item.id ? styles.active : undefined}
              key={item.id}
              onClick={() => onVehicle(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={`${styles.field} ${styles.disciplineField}`}>
          <label htmlFor="preview-home-discipline">Disciplina</label>
          <select
            id="preview-home-discipline"
            onChange={(event) => onDiscipline(event.target.value)}
            value={discipline}
          >
            <option value="Todas">Todas las disciplinas</option>
            {disciplines.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div aria-label="Accesos rápidos de fecha" className={styles.quickDates}>
          {QUICK_DATES.map((option) => (
            <button
              aria-pressed={dateFilter === option.id}
              className={dateFilter === option.id ? styles.active : undefined}
              key={option.id}
              onClick={() => onDateFilter(dateFilter === option.id ? "todos" : option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {locationMessage ? <p className={styles.locationMessage} id="preview-location-message" role="status">{locationMessage}</p> : null}
      <p aria-live="polite" className={styles.srOnly}>{previewResultLabel(filteredCount)}</p>
    </form>
  );
}
