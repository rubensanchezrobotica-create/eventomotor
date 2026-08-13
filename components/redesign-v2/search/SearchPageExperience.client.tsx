"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  buildPreviewSuggestions,
  type PreviewSuggestion,
  type PreviewSuggestionKind,
} from "@/components/preview/search-preview-model";
import { trackEvent } from "@/lib/analytics";
import EventCard from "../EventCard";
import { formatPreviewSelectedDate, type PreviewEvent, type ResolvedEventImage } from "../redesign-v2-model";
import {
  buildSearchPageHref,
  buildSearchPageResults,
  EMPTY_SEARCH_PAGE_STATE,
  parseSearchPageState,
  resetSearchPage,
  SEARCH_DISCIPLINE_OPTIONS,
  SEARCH_VEHICLE_OPTIONS,
  type SearchPageState,
} from "./search-page-model";
import styles from "./SearchPageExperience.module.css";

type SearchPageExperienceProps = {
  events: PreviewEvent[];
  imageByEventId: Record<string, ResolvedEventImage>;
  initialState: SearchPageState;
  nowIso: string;
};

const SUGGESTION_KIND_ORDER: PreviewSuggestionKind[] = ["ubicacion", "evento", "disciplina"];
const SUGGESTION_KIND_LABELS: Record<PreviewSuggestionKind, string> = {
  ubicacion: "Ubicación",
  evento: "Evento",
  disciplina: "Disciplina",
};

function suggestionDomId(suggestion: PreviewSuggestion) {
  return `redesign-v2-search-${suggestion.id.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

export default function SearchPageExperience({
  events,
  imageByEventId,
  nowIso,
}: SearchPageExperienceProps) {
  const searchParams = useSearchParams();
  const urlState = parseSearchPageState(searchParams);

  return (
    <StatefulSearchPageExperience
      events={events}
      imageByEventId={imageByEventId}
      initialState={urlState}
      key={searchParams.toString()}
      nowIso={nowIso}
    />
  );
}

function StatefulSearchPageExperience({
  events,
  imageByEventId,
  initialState,
  nowIso,
}: SearchPageExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(initialState);
  const [applied, setApplied] = useState(initialState);
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(initialState.date || initialState.discipline || initialState.vehicle),
  );
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const suggestions = useMemo(() => buildPreviewSuggestions(events, draft.q), [events, draft.q]);
  const results = useMemo(
    () => buildSearchPageResults(events, applied, imageByEventId),
    [applied, events, imageByEventId],
  );
  const hasActiveFilters = Boolean(
    applied.q || applied.place || applied.date || applied.discipline || applied.vehicle,
  );
  const advancedFilterCount = [draft.date, draft.discipline, draft.vehicle].filter(Boolean).length;
  const selectedDateLabel = formatPreviewSelectedDate(draft.date);
  const showSuggestions = suggestionsOpen && suggestions.length > 0;

  function closeSuggestions() {
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function announceResults() {
    window.requestAnimationFrame(() => {
      const heading = resultsHeadingRef.current;
      if (!heading) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      heading.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      heading.focus({ preventScroll: true });
    });
  }

  function navigate(next: SearchPageState, mode: "push" | "replace", focusResults = false) {
    const href = buildSearchPageHref(next);
    setDraft(next);
    setApplied(next);
    closeSuggestions();
    startTransition(() => {
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
    if (focusResults) announceResults();
  }

  function updateDraft<K extends keyof SearchPageState>(key: K, value: SearchPageState[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function clearAppliedField(key: "q" | "place" | "date" | "discipline" | "vehicle") {
    if (!applied[key]) return;
    navigate(resetSearchPage(applied, { [key]: "" }), "replace");
  }

  function applyDraftSearch() {
    const next = { ...draft, page: 1 };
    const nextResults = buildSearchPageResults(events, next, imageByEventId);
    trackEvent("search_events", {
      page_path: pathname,
      results_count: nextResults.total,
      has_query: Boolean(next.q),
      has_place: Boolean(next.place),
      has_date: Boolean(next.date),
    });
    if (next.discipline) {
      trackEvent("filter_discipline", { discipline: next.discipline, page_path: pathname });
    }
    if (next.vehicle) {
      trackEvent("filter_vehicle_type", { vehicle_type: next.vehicle, page_path: pathname });
    }
    navigate(next, "push", true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyDraftSearch();
  }

  function chooseSuggestion(suggestion: PreviewSuggestion) {
    const next = resetSearchPage(draft, { q: suggestion.label });
    navigate(next, "push", true);
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
    } else if (event.key === "Enter") {
      event.preventDefault();
      applyDraftSearch();
    }
  }

  function goToPage(page: number) {
    navigate({ ...applied, page }, "push", true);
  }

  return (
    <section className={styles.listingSection} aria-labelledby="search-results-title">
      <div className={styles.shell}>
        <form className={styles.searchPanel} onSubmit={submit}>
          <div className={styles.primaryRow}>
            <div className={`${styles.field} ${styles.queryField}`}>
              <label htmlFor="redesign-v2-search-query">¿Qué buscas?</label>
              <div className={styles.autocompleteControl}>
                <input
                  aria-activedescendant={activeSuggestion >= 0 ? suggestionDomId(suggestions[activeSuggestion]) : undefined}
                  aria-autocomplete="list"
                  aria-controls="redesign-v2-search-suggestions"
                  aria-expanded={showSuggestions}
                  autoComplete="off"
                  id="redesign-v2-search-query"
                  name="q"
                  onBlur={closeSuggestions}
                  onChange={(event) => {
                    const q = event.target.value;
                    updateDraft("q", q);
                    setSuggestionsOpen(Boolean(q));
                    setActiveSuggestion(-1);
                    if (!q) clearAppliedField("q");
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onKeyDown={handleQueryKeyDown}
                  placeholder="Evento, circuito o disciplina"
                  role="combobox"
                  type="search"
                  value={draft.q}
                />
                {showSuggestions ? (
                  <div className={styles.suggestions} id="redesign-v2-search-suggestions" role="listbox">
                    {SUGGESTION_KIND_ORDER.map((kind) => {
                      const grouped = suggestions
                        .map((suggestion, index) => ({ suggestion, index }))
                        .filter(({ suggestion }) => suggestion.kind === kind);
                      if (!grouped.length) return null;
                      const labelId = `redesign-v2-search-suggestions-${kind}`;
                      return (
                        <div aria-labelledby={labelId} className={styles.suggestionGroup} key={kind} role="group">
                          <span className={styles.suggestionGroupLabel} id={labelId}>{SUGGESTION_KIND_LABELS[kind]}</span>
                          {grouped.map(({ suggestion, index }) => (
                            <button
                              aria-selected={activeSuggestion === index}
                              className={activeSuggestion === index ? styles.suggestionActive : undefined}
                              id={suggestionDomId(suggestion)}
                              key={suggestion.id}
                              onClick={() => chooseSuggestion(suggestion)}
                              onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
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

            <div className={`${styles.field} ${styles.placeField}`}>
              <label htmlFor="redesign-v2-search-place">Ubicación</label>
              <input
                id="redesign-v2-search-place"
                name="place"
                onChange={(event) => {
                  const place = event.target.value;
                  updateDraft("place", place);
                  if (!place) clearAppliedField("place");
                }}
                placeholder="Ciudad, provincia o circuito"
                type="search"
                value={draft.place}
              />
            </div>

            <button
              aria-controls="redesign-v2-search-advanced"
              aria-expanded={advancedOpen}
              className={styles.advancedToggle}
              onClick={() => setAdvancedOpen((current) => !current)}
              type="button"
            >
              <span>Más filtros</span>
              <span>{advancedFilterCount ? `${advancedFilterCount} ${advancedFilterCount === 1 ? "activo" : "activos"}` : advancedOpen ? "−" : "+"}</span>
            </button>

            <button className={styles.submitButton} disabled={isPending} type="submit">
              {isPending ? "Actualizando…" : "Buscar eventos"} <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className={styles.advancedFilters} data-open={advancedOpen} id="redesign-v2-search-advanced">
            <div className={styles.field}>
              <label htmlFor="redesign-v2-search-date">Fecha</label>
              <div className={styles.dateRow}>
                <div className={styles.datePicker} data-selected={Boolean(draft.date && selectedDateLabel)}>
                  <time aria-hidden="true" dateTime={draft.date || undefined}>{selectedDateLabel ?? ""}</time>
                  <input
                    aria-describedby="redesign-v2-search-date-hint"
                    aria-label={selectedDateLabel ? `Cambiar fecha. Fecha seleccionada: ${selectedDateLabel}` : undefined}
                    id="redesign-v2-search-date"
                    name="date"
                    onChange={(event) => updateDraft("date", event.target.value)}
                    type="date"
                    value={draft.date}
                  />
                </div>
                {draft.date ? (
                  <button
                    aria-label={`Quitar fecha ${selectedDateLabel ?? draft.date}`}
                    className={styles.clearField}
                    onClick={() => {
                      updateDraft("date", "");
                      clearAppliedField("date");
                    }}
                    type="button"
                  >×</button>
                ) : null}
              </div>
              <small id="redesign-v2-search-date-hint">
                {draft.date ? "Toca la fecha para cambiarla." : "Ver eventos activos ese día."}
              </small>
            </div>

            <div className={styles.field}>
              <label htmlFor="redesign-v2-search-discipline">Disciplina</label>
              <select
                id="redesign-v2-search-discipline"
                name="discipline"
                onChange={(event) => {
                  const discipline = event.target.value as SearchPageState["discipline"];
                  updateDraft("discipline", discipline);
                  if (!discipline) clearAppliedField("discipline");
                }}
                value={draft.discipline}
              >
                <option value="">Todas</option>
                {SEARCH_DISCIPLINE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="redesign-v2-search-vehicle">Vehículo</label>
              <select
                id="redesign-v2-search-vehicle"
                name="vehicle"
                onChange={(event) => {
                  const vehicle = event.target.value as SearchPageState["vehicle"];
                  updateDraft("vehicle", vehicle);
                  if (!vehicle) clearAppliedField("vehicle");
                }}
                value={draft.vehicle}
              >
                <option value="">Todos</option>
                {SEARCH_VEHICLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </form>

        <div className={styles.resultsToolbar}>
          <div>
            <span className={styles.kicker}>Agenda motor</span>
            <h2 id="search-results-title" ref={resultsHeadingRef} tabIndex={-1}>Resultados</h2>
          </div>
          <p aria-live="polite" aria-atomic="true">
            {results.total} {results.total === 1 ? "resultado" : "resultados"}{hasActiveFilters ? " para tu búsqueda" : " próximos en toda España"}
          </p>
        </div>

        {results.visible.length ? (
          <div className={styles.eventGrid} data-visible-results={results.visible.length}>
            {results.visible.map((event, index) => (
              <EventCard event={event} key={event.id} nowIso={nowIso} resolvedImage={results.visibleImages[index]} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState} role="status">
            <span aria-hidden="true">0</span>
            <h3>No hemos encontrado eventos con esos filtros.</h3>
            <p>Prueba otra combinación o vuelve a la agenda completa.</p>
            <div>
              <button onClick={() => navigate(EMPTY_SEARCH_PAGE_STATE, "replace")} type="button">Limpiar filtros</button>
              <Link data-preview-fallback="production" href="/calendario">Ver calendario</Link>
            </div>
          </div>
        )}

        {results.visible.length ? (
          <nav aria-label="Paginación de resultados" className={styles.pagination}>
            <button disabled={results.page <= 1 || isPending} onClick={() => goToPage(results.page - 1)} type="button">
              <span aria-hidden="true">←</span> Anterior
            </button>
            <span>Página {results.page} de {results.pageCount}</span>
            <button disabled={results.page >= results.pageCount || isPending} onClick={() => goToPage(results.page + 1)} type="button">
              Siguiente <span aria-hidden="true">→</span>
            </button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
