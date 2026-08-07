"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import {
  buildPreviewSuggestions,
  type PreviewSuggestion,
  type PreviewSuggestionKind,
} from "@/components/preview/search-preview-model";
import EventCard from "./EventCard";
import styles from "./RedesignV2.module.css";
import {
  excludePreviewEventById,
  filterPreviewEvents,
  reconcileAppliedTextFilter,
  resolveRedesignEventImages,
  type PreviewEvent,
  type SearchFilters,
} from "./redesign-v2-model";

const EMPTY_FILTERS: SearchFilters = { place: "", date: "", discipline: "", vehicle: "" };

const SUGGESTION_KIND_ORDER: PreviewSuggestionKind[] = ["ubicacion", "evento", "disciplina"];

const SUGGESTION_KIND_LABELS: Record<PreviewSuggestionKind, string> = {
  ubicacion: "Ubicación",
  evento: "Evento",
  disciplina: "Disciplina",
};

type SearchExperienceProps = {
  events: PreviewEvent[];
  excludeEventId?: string | null;
  nowIso: string;
};

function suggestionDomId(suggestion: PreviewSuggestion) {
  return `redesign-v2-${suggestion.id.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

export default function SearchExperience({ events, excludeEventId, nowIso }: SearchExperienceProps) {
  const [draft, setDraft] = useState<SearchFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const gridEvents = useMemo(() => excludePreviewEventById(events, excludeEventId), [events, excludeEventId]);
  const suggestions = useMemo(() => buildPreviewSuggestions(gridEvents, draft.place), [gridEvents, draft.place]);
  const filtered = useMemo(() => filterPreviewEvents(gridEvents, filters), [gridEvents, filters]);
  const imageByEventId = useMemo(() => {
    const resolved = resolveRedesignEventImages(events);
    return new Map(events.map((event, index) => [event.id, resolved[index]]));
  }, [events]);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const advancedFilterCount = [draft.date, draft.discipline, draft.vehicle].filter(Boolean).length;
  const visible = filtered.slice(0, 9);
  const showSuggestions = suggestionsOpen && suggestions.length > 0;

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function closeSuggestions() {
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function chooseSuggestion(suggestion: PreviewSuggestion) {
    const nextFilters = { ...draft, place: suggestion.label };
    setDraft(nextFilters);
    setFilters(nextFilters);
    closeSuggestions();
  }

  function handleQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }

    if (!showSuggestions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    }
  }

  return (
    <>
      <form
        className={styles.searchPanel}
        onSubmit={(event) => {
          event.preventDefault();
          closeSuggestions();
          setFilters(draft);
        }}
      >
        <div className={styles.searchPrimary}>
          <div className={styles.queryFilter}>
            <label htmlFor="redesign-v2-query">¿Qué buscas?</label>
            <div className={styles.autocompleteControl}>
              <input
                aria-activedescendant={activeSuggestion >= 0 ? suggestionDomId(suggestions[activeSuggestion]) : undefined}
                aria-autocomplete="list"
                aria-controls="redesign-v2-suggestions"
                aria-expanded={showSuggestions}
                autoComplete="off"
                id="redesign-v2-query"
                name="place"
                onBlur={closeSuggestions}
                onChange={(event) => {
                  const nextPlace = event.target.value;

                  updateFilter("place", nextPlace);
                  setFilters((current) => reconcileAppliedTextFilter(current, nextPlace));
                  setSuggestionsOpen(nextPlace !== "");
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={handleQueryKeyDown}
                placeholder="Evento, ciudad o ubicación"
                role="combobox"
                type="search"
                value={draft.place}
              />
              {showSuggestions ? (
                <div className={styles.suggestions} id="redesign-v2-suggestions" role="listbox">
                  {SUGGESTION_KIND_ORDER.map((kind) => {
                    const grouped = suggestions
                      .map((suggestion, index) => ({ suggestion, index }))
                      .filter(({ suggestion }) => suggestion.kind === kind);
                    if (!grouped.length) return null;
                    const groupLabelId = `redesign-v2-suggestions-${kind}`;
                    return (
                      <div aria-labelledby={groupLabelId} className={styles.suggestionGroup} key={kind} role="group">
                        <span className={styles.suggestionGroupLabel} id={groupLabelId}>{SUGGESTION_KIND_LABELS[kind]}</span>
                        {grouped.map(({ suggestion, index }) => (
                          <button
                            aria-selected={activeSuggestion === index}
                            className={activeSuggestion === index ? styles.suggestionActive : undefined}
                            id={suggestionDomId(suggestion)}
                            key={suggestion.id}
                            onClick={() => chooseSuggestion(suggestion)}
                            onMouseDown={(event) => event.preventDefault()}
                            role="option"
                            tabIndex={-1}
                            type="button"
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <button
            aria-controls="redesign-v2-advanced-filters"
            aria-expanded={advancedOpen}
            className={styles.advancedToggle}
            onClick={() => setAdvancedOpen((current) => !current)}
            type="button"
          >
            <span>Más filtros</span>
            <span>{advancedFilterCount ? `${advancedFilterCount} ${advancedFilterCount === 1 ? "activo" : "activos"}` : advancedOpen ? "−" : "+"}</span>
          </button>

          <button className={styles.searchSubmit} type="submit">
            Buscar eventos <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className={styles.advancedFilters} data-open={advancedOpen} id="redesign-v2-advanced-filters">
          <div className={styles.dateFilter}>
            <label htmlFor="redesign-v2-date"><span>Fecha</span></label>
            <div className={styles.dateControl}>
              <input
                aria-describedby="redesign-v2-date-hint"
                id="redesign-v2-date"
                name="date"
                onChange={(event) => updateFilter("date", event.target.value)}
                type="date"
                value={draft.date}
              />
              {draft.date ? (
                <button
                  className={styles.clearDate}
                  onClick={() => {
                    updateFilter("date", "");
                    setFilters((current) => ({ ...current, date: "" }));
                  }}
                  type="button"
                >
                  Limpiar fecha
                </button>
              ) : null}
            </div>
            <small id="redesign-v2-date-hint">Opcional. Puedes eliminarla en cualquier momento.</small>
          </div>

          <label>
            <span>Disciplina</span>
            <select name="discipline" onChange={(event) => updateFilter("discipline", event.target.value)} value={draft.discipline}>
              <option value="">Todas</option>
              <option value="rally">Rally</option>
              <option value="circuito">Circuito</option>
              <option value="kart">Karting</option>
              <option value="moto">Motos</option>
              <option value="clasico">Clásicos</option>
              <option value="concentracion">Concentraciones</option>
            </select>
          </label>
          <label>
            <span>Vehículo</span>
            <select name="vehicle" onChange={(event) => updateFilter("vehicle", event.target.value)} value={draft.vehicle}>
              <option value="">Todos</option>
              <option value="moto">Moto</option>
              <option value="coche">Coche</option>
              <option value="kart">Kart</option>
            </select>
          </label>
        </div>
      </form>

      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>Agenda motor</span>
          <h2>Próximos eventos</h2>
        </div>
        <p aria-live="polite">
          {hasActiveFilters
            ? `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"} para tu búsqueda`
            : `${events.length} ${events.length === 1 ? "próximo evento" : "próximos eventos"} en toda España`}
        </p>
      </div>

      {visible.length ? (
        <div className={styles.eventGrid}>
          {visible.map((event) => (
            <EventCard event={event} key={event.id} nowIso={nowIso} resolvedImage={imageByEventId.get(event.id)} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h3>No hay eventos que coincidan</h3>
          <p>Prueba otra combinación de fecha, zona o disciplina.</p>
          <button type="button" onClick={() => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); closeSuggestions(); }}>
            Limpiar filtros
          </button>
        </div>
      )}

      <div className={styles.centerAction}>
        <Link className={styles.outlineButton} href="/#calendario">Ver calendario completo</Link>
      </div>
    </>
  );
}
