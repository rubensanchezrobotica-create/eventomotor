"use client";

import Link from "next/link";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import { useEffect, useState } from "react";
import { downloadIcsFile } from "@/lib/calendar-export";
import { currentPagePath, eventAnalyticsParams, trackEvent } from "@/lib/analytics";
import { getSavedEvents, removeSavedEvent, type SavedEvent } from "@/lib/saved-events";

export function formatSavedDate(event: SavedEvent) {
  const formatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const start = formatter.format(new Date(`${event.start}T12:00:00`));
  if (!event.end || event.end === event.start) return start;
  return `${start} - ${formatter.format(new Date(`${event.end}T12:00:00`))}`;
}

export function hasValidCalendarDate(event: SavedEvent) {
  return Boolean(event.start && !Number.isNaN(new Date(`${event.start}T12:00:00`).getTime()));
}

export function savedEventsCountLabel(count: number) {
  return count === 1 ? "1 evento guardado" : `${count} eventos guardados`;
}

type SavedEventsViewProps = {
  events: SavedEvent[];
  onAddToCalendar: (event: SavedEvent) => void;
  onExportAll: () => void;
  onRemove: (slug: string) => void;
};

export function SavedEventsView({
  events,
  onAddToCalendar,
  onExportAll,
  onRemove,
}: SavedEventsViewProps) {
  const countLabel = savedEventsCountLabel(events.length);

  return (
    <div className="emc-my-events-content">
      <section className="emc-my-events-toolbar" aria-labelledby="saved-events-summary">
        <div>
          <strong aria-hidden="true">{events.length}</strong>
          <div>
            <span>Tu agenda</span>
            <h2 id="saved-events-summary">{countLabel}</h2>
          </div>
        </div>
        <div className="emc-my-events-toolbar-actions">
          {events.length ? (
            <button className="emc-btn emc-btn-dark emc-my-events-export" onClick={onExportAll} type="button">
              Exportar todos
            </button>
          ) : null}
          <Link className="emc-btn emc-btn-primary" href={PUBLIC_NAVIGATION.calendar}>
            Explorar calendario
          </Link>
        </div>
      </section>

      {events.length ? (
        <section className="emc-my-events-list" aria-label="Eventos guardados">
          <div className="emc-my-events-grid">
            {events.map((event) => (
              <article className="emc-my-event-card" key={event.slug}>
                <time className="emc-result-date" dateTime={event.start}>
                  {new Date(`${event.start}T12:00:00`).getDate()}
                  <small>
                    {new Intl.DateTimeFormat("es-ES", { month: "short" }).format(
                      new Date(`${event.start}T12:00:00`),
                    )}
                  </small>
                </time>
                <div className="emc-my-event-main">
                  <div className="emc-result-meta">
                    <span className="emc-badge">{event.discipline}</span>
                    {event.vehicle_type ? <span className="emc-badge">{event.vehicle_type}</span> : null}
                  </div>
                  <h3>{event.title}</h3>
                  <div className="emc-my-event-details">
                    <p className="emc-my-event-location">{event.city}, {event.province}</p>
                    <p>{formatSavedDate(event)}</p>
                  </div>
                </div>
                <div className="emc-my-event-actions">
                  <Link
                    className="emc-card-action"
                    href={`/evento/${event.slug}`}
                    onClick={() => trackEvent("click_event_detail", {
                      ...eventAnalyticsParams(event),
                      discipline: event.discipline,
                      zone: event.province,
                      vehicle_type: event.vehicle_type || "otros",
                      page_path: currentPagePath(),
                      source: "my_events",
                    })}
                  >
                    Ver evento
                  </Link>
                  {hasValidCalendarDate(event) ? (
                    <button
                      className="emc-card-action emc-card-action-dark emc-calendar-card-action"
                      onClick={() => onAddToCalendar(event)}
                      type="button"
                    >
                      Añadir al calendario
                    </button>
                  ) : null}
                  <button
                    aria-label={`Quitar ${event.title} de Mis eventos`}
                    className="emc-link-button emc-my-event-remove"
                    onClick={() => onRemove(event.slug)}
                    type="button"
                  >
                    Quitar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="emc-panel emc-my-events-empty" aria-labelledby="saved-events-empty-title" aria-live="polite">
          <div className="emc-my-events-empty-icon" aria-hidden="true">+</div>
          <div>
            <div className="emc-kicker">Empieza tu agenda</div>
            <h2 id="saved-events-empty-title">Aún no has guardado ningún evento</h2>
            <p>Guarda los eventos que te interesen para tenerlos aquí y añadirlos a tu calendario cuando quieras.</p>
          </div>
          <Link className="emc-btn emc-btn-primary" href={PUBLIC_NAVIGATION.calendar}>
            Explorar eventos
          </Link>
        </section>
      )}
    </div>
  );
}

export default function MyEventsClient() {
  const [events, setEvents] = useState<SavedEvent[]>([]);

  useEffect(() => {
    const savedEventsTimer = window.setTimeout(() => setEvents(getSavedEvents()), 0);
    trackEvent("open_my_events", { page_path: currentPagePath() });
    return () => window.clearTimeout(savedEventsTimer);
  }, []);

  function remove(slug: string) {
    const removedEvent = events.find((event) => event.slug === slug);
    const next = removeSavedEvent(slug);
    setEvents(next);
    trackEvent("remove_saved_event", {
      ...(removedEvent ? eventAnalyticsParams(removedEvent) : { event_slug: slug }),
      page_path: currentPagePath(),
      source: "my_events",
    });
  }

  function addToCalendar(event: SavedEvent) {
    downloadIcsFile(`${event.slug}.ics`, [event]);
    trackEvent("add_to_calendar", {
      ...eventAnalyticsParams(event),
      page_path: currentPagePath(),
      source: "my_events",
    });
  }

  function exportAll() {
    downloadIcsFile("eventomotor-mis-eventos.ics", events);
    trackEvent("add_to_calendar", {
      events_count: events.length,
      page_path: currentPagePath(),
      source: "my_events_export_all",
    });
  }

  return (
    <SavedEventsView
      events={events}
      onAddToCalendar={addToCalendar}
      onExportAll={exportAll}
      onRemove={remove}
    />
  );
}
