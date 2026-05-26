"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { downloadIcsFile } from "@/lib/calendar-export";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import { getSavedEvents, removeSavedEvent, type SavedEvent } from "@/lib/saved-events";

function formatSavedDate(event: SavedEvent) {
  const formatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const start = formatter.format(new Date(`${event.start}T12:00:00`));
  if (!event.end || event.end === event.start) return start;
  return `${start} - ${formatter.format(new Date(`${event.end}T12:00:00`))}`;
}

function hasValidCalendarDate(event: SavedEvent) {
  return Boolean(event.start && !Number.isNaN(new Date(`${event.start}T12:00:00`).getTime()));
}

export default function MyEventsClient() {
  const [events, setEvents] = useState<SavedEvent[]>([]);
  const countLabel = events.length === 1 ? "1 evento guardado en este dispositivo." : `${events.length} eventos guardados en este dispositivo.`;

  useEffect(() => {
    setEvents(getSavedEvents());
    trackEvent("open_my_events", { page_path: currentPagePath() });
  }, []);

  function remove(slug: string) {
    const next = removeSavedEvent(slug);
    setEvents(next);
    trackEvent("remove_saved_event", { event_slug: slug, page_path: currentPagePath(), source: "my_events" });
  }

  function addToCalendar(event: SavedEvent) {
    downloadIcsFile(`${event.slug}.ics`, [event]);
    trackEvent("add_to_calendar", {
      event_slug: event.slug,
      event_title: event.title,
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

  if (!events.length) {
    return (
      <section className="emc-panel emc-my-events-empty">
        <div className="emc-kicker">Mis eventos</div>
        <h2>Aún no has guardado ningún evento.</h2>
        <p>Tus eventos se guardan solo en este dispositivo.</p>
        <div className="emc-contact-actions">
          <Link className="emc-btn emc-btn-primary" href="/eventos-motor-este-fin-de-semana">
            Ver eventos de este fin de semana
          </Link>
          <Link className="emc-btn emc-btn-dark" href="/calendario">
            Explorar calendario
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="emc-my-events-list">
      <div className="emc-my-events-toolbar">
        <div>
          <strong>{events.length}</strong>
          <p>{countLabel}</p>
        </div>
        <div className="emc-my-events-toolbar-actions">
          <button className="emc-btn emc-btn-dark emc-my-events-export" onClick={exportAll} type="button">
            Exportar todos
          </button>
          <Link className="emc-btn emc-btn-primary" href="/calendario">
            Explorar calendario
          </Link>
        </div>
      </div>

      <div className="emc-my-events-grid">
        {events.map((event) => (
          <article className="emc-my-event-card" key={event.slug}>
            <div className="emc-result-date">
              {new Date(`${event.start}T12:00:00`).getDate()}
              <small>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(`${event.start}T12:00:00`))}</small>
            </div>
            <div className="emc-my-event-main">
              <div className="emc-result-meta">
                <span className="emc-badge">{event.discipline}</span>
                {event.vehicle_type ? <span className="emc-badge">{event.vehicle_type}</span> : null}
              </div>
              <h3>{event.title}</h3>
              <p>{formatSavedDate(event)} / {event.city}, {event.province}</p>
            </div>
            <div className="emc-my-event-actions">
              <Link className="emc-card-action" href={`/evento/${event.slug}`}>
                Ver evento
              </Link>
              {hasValidCalendarDate(event) ? (
                <button className="emc-card-action emc-card-action-dark emc-calendar-card-action" onClick={() => addToCalendar(event)} type="button">
                  Añadir al calendario
                </button>
              ) : null}
              <button className="emc-link-button emc-my-event-remove" onClick={() => remove(event.slug)} type="button">
                Quitar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
