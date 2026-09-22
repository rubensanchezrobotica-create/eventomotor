"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import {
  buildPreviewSuggestions,
  type PreviewSuggestion,
  type PreviewSuggestionKind,
} from "@/components/preview/search-preview-model";
import type { PreviewEvent } from "../redesign-v2-model";
import type { WeekendPreviewData } from "@/components/preview/weekend/weekend-preview-model";
import {
  countWeekendSecondaryFilters,
  formatWeekendDisciplineLabel,
  WEEKEND_DISCIPLINES,
  WEEKEND_VEHICLES,
  type WeekendUrlState,
  type WeekendRouteContext,
} from "./weekend-page-model";
import styles from "./WeekendPageExperience.module.css";

const SUGGESTION_KIND_ORDER: PreviewSuggestionKind[] = ["ubicacion", "evento", "disciplina"];

const SUGGESTION_KIND_LABELS: Record<PreviewSuggestionKind, string> = {
  ubicacion: "Ubicación",
  evento: "Evento",
  disciplina: "Disciplina",
};

export type WeekendSearchValues = Pick<WeekendUrlState, "q" | "discipline" | "vehicle" | "province" | "family">;

type WeekendSearchExperienceProps = {
  events: readonly PreviewEvent[];
  onApply: (values: WeekendSearchValues) => void;
  onClearAll: () => void;
  onClearQuery: () => void;
  publicOptions?: Pick<WeekendPreviewData, "disciplineOptions" | "families" | "provinceOptions">;
  routeContext: WeekendRouteContext;
  state: WeekendUrlState;
};

function suggestionDomId(suggestion: PreviewSuggestion) {
  return `weekend-v2-${suggestion.id.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function valuesFromState(state: WeekendUrlState): WeekendSearchValues {
  return { q: state.q, discipline: state.discipline, vehicle: state.vehicle, province: state.province ?? "", family: state.family ?? "" };
}

export default function WeekendSearchExperience({
  events,
  onApply,
  onClearAll,
  onClearQuery,
  publicOptions,
  routeContext,
  state,
}: WeekendSearchExperienceProps) {
  const [draft, setDraft] = useState<WeekendSearchValues>(() => valuesFromState(state));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestions = useMemo(
    () => buildPreviewSuggestions(events, draft.q).map((suggestion) => (
      suggestion.kind === "disciplina"
        ? { ...suggestion, label: formatWeekendDisciplineLabel(suggestion.label) }
        : suggestion
    )),
    [draft.q, events],
  );
  const showSuggestions = suggestionsOpen && suggestions.length > 0;
  const advancedFilterCount = routeContext === "public"
    ? [draft.province, draft.discipline, draft.family].filter(Boolean).length
    : countWeekendSecondaryFilters(draft);

  function updateDraft<Key extends keyof WeekendSearchValues>(
    key: Key,
    value: WeekendSearchValues[Key],
  ) {
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
    setDraft({ q: "", discipline: "", vehicle: "", province: "", family: "" });
    closeSuggestions();
    setAdvancedOpen(false);
    onClearAll();
  }

  return (
    <form className={styles.searchBar} data-route-context={routeContext} onSubmit={submit}>
      <div className={styles.searchPrimaryRow}>
        <div className={styles.queryFilter}>
          <label htmlFor="weekend-v2-query">¿Qué buscas?</label>
          <div className={styles.autocompleteControl}>
            <input
              aria-activedescendant={activeSuggestion >= 0 ? suggestionDomId(suggestions[activeSuggestion]) : undefined}
              aria-autocomplete="list"
              aria-controls="weekend-v2-suggestions"
              aria-expanded={showSuggestions}
              autoComplete="off"
              id="weekend-v2-query"
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
              <div className={styles.suggestions} id="weekend-v2-suggestions" role="listbox">
                {SUGGESTION_KIND_ORDER.map((kind) => {
                  const grouped = suggestions
                    .map((suggestion, index) => ({ suggestion, index }))
                    .filter(({ suggestion }) => suggestion.kind === kind);
                  if (!grouped.length) return null;
                  const groupLabelId = `weekend-v2-suggestions-${kind}`;
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
          aria-label={advancedFilterCount ? `Más filtros, ${advancedFilterCount} ${advancedFilterCount === 1 ? "filtro activo" : "filtros activos"}` : "Más filtros"}
          aria-controls="weekend-v2-advanced-filters"
          aria-expanded={advancedOpen}
          className={`${styles.advancedFilterToggle} max-[760px]:gap-1! max-[760px]:px-2!`}
          onClick={() => setAdvancedOpen((current) => !current)}
          type="button"
        >
          <span>Más filtros</span>
          <span aria-hidden="true">
            <span className="max-[760px]:hidden">
              {advancedFilterCount
                ? `${advancedFilterCount} ${advancedFilterCount === 1 ? "activo" : "activos"}`
                : advancedOpen ? "−" : "+"}
            </span>
            <span className={advancedFilterCount
              ? "hidden min-w-5 h-5 items-center justify-center rounded-full border border-[#ff7a27]/50 px-1 leading-none max-[760px]:inline-flex"
              : "hidden max-[760px]:inline"}
            >{advancedFilterCount || (advancedOpen ? "−" : "+")}</span>
          </span>
        </button>

        <button className={styles.primaryButton} type="submit">
          Buscar eventos <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className={styles.secondaryFilterFields} data-open={advancedOpen} id="weekend-v2-advanced-filters">
        {routeContext === "public" ? (
          <label>
            Provincia
            <select name="provincia" onChange={(event) => updateDraft("province", event.target.value)} value={draft.province}>
              <option value="">Toda España</option>
              {publicOptions?.provinceOptions.map((item) => <option key={item.key} value={item.key}>{item.label} ({item.count})</option>)}
            </select>
          </label>
        ) : null}
        <label>
          Disciplina
          <select
            name={routeContext === "public" ? "disciplina" : "discipline"}
            onChange={(event) => updateDraft("discipline", event.target.value)}
            value={draft.discipline}
          >
            <option value="">Todas</option>
            {routeContext === "public"
              ? publicOptions?.disciplineOptions.map((item) => <option key={item.key} value={item.key}>{item.label} ({item.count})</option>)
              : WEEKEND_DISCIPLINES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {routeContext === "public" ? (
          <label>
            Tipo
            <select name="tipo" onChange={(event) => updateDraft("family", event.target.value as WeekendSearchValues["family"])} value={draft.family}>
              <option value="">Todos</option>
              {publicOptions?.families.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.count})</option>)}
            </select>
          </label>
        ) : (
          <label>
            Vehículo
            <select name="vehicle" onChange={(event) => updateDraft("vehicle", event.target.value)} value={draft.vehicle}>
              <option value="">Todos</option>
              {WEEKEND_VEHICLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        )}
        <button className={styles.secondaryButton} onClick={clearAll} type="button">Limpiar filtros</button>
      </div>
    </form>
  );
}
