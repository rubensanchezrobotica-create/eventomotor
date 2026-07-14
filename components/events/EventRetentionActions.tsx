"use client";

import { useEffect, useState } from "react";
import { downloadIcsFile } from "@/lib/calendar-export";
import { currentPagePath, eventAnalyticsParams, trackEvent } from "@/lib/analytics";
import { isEventSaved, removeSavedEvent, saveEvent, type SavedEvent } from "@/lib/saved-events";

type EventRetentionActionsProps = {
  calendarLabel?: string;
  event: SavedEvent;
  source?: string;
};

export default function EventRetentionActions({
  calendarLabel = "Calendario",
  event,
  source = "event_detail",
}: EventRetentionActionsProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isEventSaved(event.slug));
  }, [event.slug]);

  function save() {
    saveEvent(event);
    setSaved(true);
    trackEvent("save_event", {
      ...eventAnalyticsParams(event),
      discipline: event.discipline,
      page_path: currentPagePath(),
      source,
    });
  }

  function remove() {
    removeSavedEvent(event.slug);
    setSaved(false);
    trackEvent("remove_saved_event", {
      ...eventAnalyticsParams(event),
      page_path: currentPagePath(),
      source,
    });
  }

  function addToCalendar() {
    downloadIcsFile(`${event.slug || "evento-eventomotor"}.ics`, [event]);
    trackEvent("add_to_calendar", {
      ...eventAnalyticsParams(event),
      page_path: currentPagePath(),
      source,
    });
  }

  return (
    <div className="emc-retention-actions">
      {saved ? (
        <>
          <button className="emc-btn emc-btn-dark emc-saved-event-button" disabled type="button">
            Guardado
          </button>
          <button className="emc-link-button emc-unsave-link" onClick={remove} type="button">
            Quitar de mis eventos
          </button>
        </>
      ) : (
        <button className="emc-btn emc-btn-dark" onClick={save} type="button">
          Guardar
        </button>
      )}
      <button className="emc-btn emc-btn-dark" onClick={addToCalendar} type="button">
        {calendarLabel}
      </button>
    </div>
  );
}
