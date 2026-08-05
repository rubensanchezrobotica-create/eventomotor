"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EventCard from "./EventCard";
import styles from "./RedesignV2.module.css";
import {
  excludePreviewEventById,
  filterPreviewEvents,
  type PreviewEvent,
  type SearchFilters,
} from "./redesign-v2-model";

const EMPTY_FILTERS: SearchFilters = { place: "", date: "", discipline: "", vehicle: "" };

type SearchExperienceProps = {
  events: PreviewEvent[];
  excludeEventId?: string | null;
  nowIso: string;
};

export default function SearchExperience({ events, excludeEventId, nowIso }: SearchExperienceProps) {
  const [draft, setDraft] = useState<SearchFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const gridEvents = useMemo(() => excludePreviewEventById(events, excludeEventId), [events, excludeEventId]);
  const filtered = useMemo(() => filterPreviewEvents(gridEvents, filters), [gridEvents, filters]);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const visible = filtered.slice(0, 9);

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <form
        className={styles.searchPanel}
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(draft);
        }}
      >
        <label>
          <span>Dónde</span>
          <input
            name="place"
            onChange={(event) => updateFilter("place", event.target.value)}
            placeholder="Ciudad o provincia"
            type="search"
            value={draft.place}
          />
        </label>
        <label>
          <span>Cuándo</span>
          <input name="date" onChange={(event) => updateFilter("date", event.target.value)} type="date" value={draft.date} />
        </label>
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
        <button type="submit">
          Buscar eventos <span aria-hidden="true">→</span>
        </button>
      </form>

      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>Agenda motor</span>
          <h2>Próximos eventos</h2>
        </div>
        <p aria-live="polite">
          {hasActiveFilters
            ? `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"} para tu búsqueda`
            : `${filtered.length} ${filtered.length === 1 ? "próximo evento" : "próximos eventos"} en toda España`}
        </p>
      </div>

      {visible.length ? (
        <div className={styles.eventGrid}>
          {visible.map((event) => <EventCard event={event} key={event.id} nowIso={nowIso} />)}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h3>No hay eventos que coincidan</h3>
          <p>Prueba otra combinación de fecha, zona o disciplina.</p>
          <button type="button" onClick={() => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); }}>
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
