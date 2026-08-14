"use client";

import { useEffect, useState } from "react";
import { downloadIcsFile } from "@/lib/calendar-export";
import { currentPagePath, eventAnalyticsParams, trackEvent } from "@/lib/analytics";
import { isEventSaved, removeSavedEvent, saveEvent, type SavedEvent } from "@/lib/saved-events";

type EventRetentionActionsProps = {
  calendarLabel?: string;
  compactIcons?: boolean;
  directChildren?: boolean;
  event: SavedEvent;
  source?: string;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} focusable="false" height="20" viewBox="0 0 24 24" width="20">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarPlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" height="20" viewBox="0 0 24 24" width="20">
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 14v5M9.5 16.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export default function EventRetentionActions({
  calendarLabel = "Calendario",
  compactIcons = false,
  directChildren = false,
  event,
  source = "event_detail",
}: EventRetentionActionsProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Re-sincroniza el evento cuando cambia el slug recibido.
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

  const compactActions = (
    <>
      <button
        aria-label={saved ? "Quitar de mis eventos" : "Guardar evento"}
        aria-pressed={saved}
        className={`emc-btn emc-btn-dark emc-icon-action${saved ? " emc-icon-action-saved" : ""}`}
        onClick={saved ? remove : save}
        title={saved ? "Quitar de mis eventos" : "Guardar"}
        type="button"
      >
        <HeartIcon filled={saved} />
      </button>
      <button
        aria-label="Añadir al calendario"
        className="emc-btn emc-btn-dark emc-icon-action"
        onClick={addToCalendar}
        title="Añadir al calendario"
        type="button"
      >
        <CalendarPlusIcon />
      </button>
    </>
  );

  if (compactIcons) {
    if (directChildren) return compactActions;
    return <div className="emc-retention-actions">{compactActions}</div>;
  }

  const actions = (
    <>
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
    </>
  );

  if (directChildren) return actions;

  return <div className="emc-retention-actions">{actions}</div>;
}
