"use client";

import { useEffect, useState } from "react";
import { downloadIcsFile } from "@/lib/calendar-export";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import { isEventSaved, removeSavedEvent, saveEvent, type SavedEvent } from "@/lib/saved-events";

type EventRetentionActionsProps = {
  event: SavedEvent;
  source?: string;
};

export default function EventRetentionActions({ event, source = "event_detail" }: EventRetentionActionsProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isEventSaved(event.slug));
  }, [event.slug]);

  function save() {
    saveEvent(event);
    setSaved(true);
    trackEvent("save_event", {
      event_slug: event.slug,
      event_title: event.title,
      discipline: event.discipline,
      page_path: currentPagePath(),
      source,
    });
  }

  function remove() {
    removeSavedEvent(event.slug);
    setSaved(false);
    trackEvent("remove_saved_event", {
      event_slug: event.slug,
      event_title: event.title,
      page_path: currentPagePath(),
      source,
    });
  }

  function addToCalendar() {
    downloadIcsFile(`${event.slug || "evento-eventomotor"}.ics`, [event]);
    trackEvent("add_to_calendar", {
      event_slug: event.slug,
      event_title: event.title,
      page_path: currentPagePath(),
      source,
    });
  }

  return (
    <div className="emc-retention-actions">
      {saved ? (
        <>
          <button className="emc-btn emc-btn-dark emc-saved-event-button" disabled type="button">
            Evento guardado
          </button>
          <button className="emc-link-button emc-unsave-link" onClick={remove} type="button">
            Quitar de mis eventos
          </button>
        </>
      ) : (
        <button className="emc-btn emc-btn-dark" onClick={save} type="button">
          Guardar evento
        </button>
      )}
      <button className="emc-btn emc-btn-dark" onClick={addToCalendar} type="button">
        Añadir al calendario
      </button>
    </div>
  );
}
