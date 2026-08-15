"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import {
  buildPreviewSuggestions,
  type PreviewSuggestion,
  type PreviewSuggestionKind,
} from "@/components/preview/search-preview-model";
import { formatPreviewSelectedDate, type PreviewEvent } from "../redesign-v2-model";
import {
  CALENDAR_DISCIPLINES,
  CALENDAR_VEHICLES,
  countCalendarSecondaryFilters,
  formatCalendarDisciplineLabel,
  type CalendarUrlState,
} from "./calendar-page-model";
import styles from "./CalendarPageExperience.module.css";

const SUGGESTION_KIND_ORDER: PreviewSuggestionKind[] = ["ubicacion", "evento", "disciplina"];

const SUGGESTION_KIND_LABELS: Record<PreviewSuggestionKind, string> = {
  ubicacion: "Ubicación",
  evento: "Evento",
  disciplina: "Disciplina",
};

export type CalendarSearchValues = Pick<CalendarUrlState, "q" | "date" | "discipline" | "vehicle">;

type CalendarSearchExperienceProps = {
  events: readonly PreviewEvent[];
  onApply: (values: CalendarSearchValues) => void;
  onClearAll: () => void;
  onClearQuery: () => void;
  state: CalendarUrlState;
};

function suggestionDomId(suggestion: PreviewSuggestion) {
  return `calendar-v2-${suggestion.id.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function valuesFromState(state: CalendarUrlState): CalendarSearchValues {
  return {
    q: state.q,
    date: state.date,
    discipline: state.discipline,
    vehicle: state.vehicle,
  };
}

export default function CalendarSearchExperience({ events, onApply, onClearAll, onClearQuery, state }: CalendarSearchExperienceProps) {
  const [draft, setDraft] = useState<CalendarSearchValues>(() => valuesFromState(state));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestions = useMemo(
    () => buildPreviewSuggestions(events, draft.q).map((suggestion) => (
      suggestion.kind === "disciplina"
        ? { ...suggestion, label: formatCalendarDisciplineLabel(suggestion.label) }
        : suggestion
    )),
    [draft.q, events],
  );
  const showSuggestions = suggestionsOpen && suggestions.length > 0;
  const advancedFilterCount = countCalendarSecondaryFilters(draft);
  const selectedDateLabel = formatPreviewSelectedDate(draft.date);

  function updateDraft<K extends keyof CalendarSearchValues>(key: K, value: CalendarSearchValues[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function closeSuggestions() {
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function chooseSuggestion(suggestion: PreviewSuggestion) {
    const next = { ...draft, q: suggestion.label };
    setDraft(next);
    onApply(next);
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    closeSuggestions();
    onApply(draft);
    setAdvancedOpen(false);
  }

  function clearAll() {
    setDraft({ q: "", date: state.date, discipline: "", vehicle: "" });
    closeSuggestions();
    setAdvancedOpen(false);
    onClearAll();
  }

  return (
    <form className={styles.filterBar} onSubmit={submit}>
      <div className={styles.primaryFilterRow}>
        <div className={styles.queryFilter}>
          <label htmlFor="calendar-v2-query">¿Qué buscas?</label>
          <div className={styles.autocompleteControl}>
            <input
              aria-activedescendant={activeSuggestion >= 0 ? suggestionDomId(suggestions[activeSuggestion]) : undefined}
              aria-autocomplete="list"
              aria-controls="calendar-v2-suggestions"
              aria-expanded={showSuggestions}
              autoComplete="off"
              id="calendar-v2-query"
              name="q"
              onBlur={closeSuggestions}
              onChange={(event) => {
                const nextQuery = event.target.value;
                updateDraft("q", nextQuery);
                if (!nextQuery && state.q) onClearQuery();
                setSuggestionsOpen(Boolean(nextQuery));
                setActiveSuggestion(-1);
              }}
              onFocus={() => setSuggestionsOpen(true)}
              onKeyDown={handleQueryKeyDown}
              placeholder="Evento, ciudad o ubicación"
              role="combobox"
              type="search"
              value={draft.q}
            />
            {showSuggestions ? (
              <div className={styles.suggestions} id="calendar-v2-suggestions" role="listbox">
                {SUGGESTION_KIND_ORDER.map((kind) => {
                  const grouped = suggestions
                    .map((suggestion, index) => ({ suggestion, index }))
                    .filter(({ suggestion }) => suggestion.kind === kind);
                  if (!grouped.length) return null;
                  const groupLabelId = `calendar-v2-suggestions-${kind}`;
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
          aria-controls="calendar-v2-advanced-filters"
          aria-expanded={advancedOpen}
          className={styles.advancedFilterToggle}
          onClick={() => setAdvancedOpen((current) => !current)}
          type="button"
        >
          <span>Más filtros</span>
          <span>{advancedFilterCount ? `${advancedFilterCount} ${advancedFilterCount === 1 ? "activo" : "activos"}` : advancedOpen ? "−" : "+"}</span>
        </button>

        <button className={styles.primaryButton} type="submit">Buscar eventos <span aria-hidden="true">→</span></button>
      </div>

      <div className={styles.secondaryFilterFields} data-open={advancedOpen} id="calendar-v2-advanced-filters">
        <div className={styles.dateFilter}>
          <label htmlFor="calendar-v2-date">Fecha</label>
          <div className={styles.selectedDatePicker} data-selected={Boolean(selectedDateLabel)}>
            <time aria-hidden="true" dateTime={draft.date}>{selectedDateLabel}</time>
            <input
              aria-describedby="calendar-v2-date-hint"
              aria-label={selectedDateLabel ? `Cambiar fecha. Fecha seleccionada: ${selectedDateLabel}` : "Seleccionar fecha"}
              id="calendar-v2-date"
              name="date"
              onChange={(event) => updateDraft("date", event.target.value)}
              type="date"
              value={draft.date}
            />
          </div>
          <small className={styles.dateHint} id="calendar-v2-date-hint">Toca la fecha para cambiarla.</small>
        </div>

        <label>Disciplina<select name="discipline" onChange={(event) => updateDraft("discipline", event.target.value)} value={draft.discipline}><option value="">Todas</option>{CALENDAR_DISCIPLINES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Vehículo<select name="vehicle" onChange={(event) => updateDraft("vehicle", event.target.value)} value={draft.vehicle}><option value="">Todos</option>{CALENDAR_VEHICLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <button className={styles.secondaryButton} onClick={clearAll} type="button">Limpiar filtros</button>
      </div>
    </form>
  );
}
