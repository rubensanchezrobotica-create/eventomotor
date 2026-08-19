"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DisciplineSlug } from "@/components/disciplines/discipline-preview-model";
import {
  DISCIPLINE_DETAIL_QUERY_MAX_LENGTH,
  DISCIPLINE_SEARCH_MIN_CHARS,
  buildDisciplineSearchSuggestions,
  normalizeDisciplineSearchText,
  type DisciplineSearchSuggestion,
  type DisciplineSearchSuggestionSource,
} from "./discipline-detail-model";
import styles from "./DisciplineDetailPage.module.css";

const SUGGESTION_KINDS: DisciplineSearchSuggestion["kind"][] = ["event", "location"];
const SUGGESTION_LABELS: Record<DisciplineSearchSuggestion["kind"], string> = {
  event: "Evento",
  location: "Ubicación",
};

type DisciplineSearchAssistProps = {
  action: string;
  initialQuery: string;
  source: DisciplineSearchSuggestionSource[];
  disciplineSlug: DisciplineSlug;
};

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export default function DisciplineSearchAssist({
  action,
  disciplineSlug,
  initialQuery,
  source,
}: DisciplineSearchAssistProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLFormElement>(null);
  const generatedId = useId().replace(/:/g, "");
  const inputId = `discipline-detail-search-${generatedId}`;
  const listboxId = `discipline-detail-suggestions-${generatedId}`;
  const [query, setQuery] = useState(initialQuery);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestions = useMemo(
    () => buildDisciplineSearchSuggestions(source, query, disciplineSlug),
    [disciplineSlug, query, source],
  );
  const resolvedActiveSuggestion = activeSuggestion < suggestions.length ? activeSuggestion : -1;
  const showSuggestions = suggestionsOpen && suggestions.length > 0;

  useEffect(() => {
    if (!suggestionsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
        setActiveSuggestion(-1);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [suggestionsOpen]);

  function closeSuggestions() {
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function chooseSuggestion(suggestion: DisciplineSearchSuggestion) {
    closeSuggestions();
    router.push(suggestion.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }

    if (event.key === "Tab") {
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
    } else if (event.key === "Enter" && resolvedActiveSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[resolvedActiveSuggestion]);
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget && rootRef.current?.contains(nextTarget)) return;
    closeSuggestions();
  }

  function preserveInputFocus(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  return (
    <form action={action} className={styles.searchForm} method="get" ref={rootRef} role="search">
      <label className={styles.srOnly} htmlFor={inputId}>
        Buscar eventos en esta disciplina
      </label>
      <div className={styles.searchAutocomplete}>
        <div className={styles.searchControl}>
          <SearchIcon />
          <input
            aria-activedescendant={showSuggestions && resolvedActiveSuggestion >= 0
              ? `${listboxId}-option-${resolvedActiveSuggestion}`
              : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showSuggestions}
            autoComplete="off"
            id={inputId}
            maxLength={DISCIPLINE_DETAIL_QUERY_MAX_LENGTH}
            name="q"
            onBlur={handleBlur}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setSuggestionsOpen(normalizeDisciplineSearchText(nextQuery).length >= DISCIPLINE_SEARCH_MIN_CHARS);
              setActiveSuggestion(-1);
            }}
            onFocus={() => {
              if (normalizeDisciplineSearchText(query).length >= DISCIPLINE_SEARCH_MIN_CHARS) {
                setSuggestionsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Busca por evento, localidad o provincia..."
            role="combobox"
            type="search"
            value={query}
          />
        </div>
        {showSuggestions ? (
          <div className={styles.suggestions} id={listboxId} role="listbox">
            {SUGGESTION_KINDS.map((kind) => {
              const grouped = suggestions
                .map((suggestion, index) => ({ suggestion, index }))
                .filter(({ suggestion }) => suggestion.kind === kind);
              if (!grouped.length) return null;
              const groupLabelId = `${listboxId}-${kind}`;
              return (
                <div aria-labelledby={groupLabelId} className={styles.suggestionGroup} key={kind} role="group">
                  <span className={styles.suggestionGroupLabel} id={groupLabelId}>
                    {SUGGESTION_LABELS[kind]}
                  </span>
                  {grouped.map(({ suggestion, index }) => (
                    <button
                      aria-label={suggestion.meta
                        ? `${SUGGESTION_LABELS[kind]}: ${suggestion.label}. ${suggestion.meta}`
                        : `${SUGGESTION_LABELS[kind]}: ${suggestion.label}`}
                      aria-selected={resolvedActiveSuggestion === index}
                      className={resolvedActiveSuggestion === index ? styles.suggestionActive : undefined}
                      id={`${listboxId}-option-${index}`}
                      key={suggestion.id}
                      onClick={() => chooseSuggestion(suggestion)}
                      onMouseDown={preserveInputFocus}
                      onMouseEnter={() => setActiveSuggestion(index)}
                      role="option"
                      tabIndex={-1}
                      type="button"
                    >
                      <strong>{suggestion.label}</strong>
                      {suggestion.meta ? <span>{suggestion.meta}</span> : null}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <button className={styles.searchSubmit} type="submit">Buscar</button>
      {initialQuery ? (
        <Link className={styles.clearSearch} href={action}>
          Limpiar búsqueda
        </Link>
      ) : null}
    </form>
  );
}
