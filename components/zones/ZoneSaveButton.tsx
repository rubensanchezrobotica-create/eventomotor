"use client";

import { useEffect, useState } from "react";
import { currentPagePath, eventAnalyticsParams, trackEvent } from "@/lib/analytics";
import {
  isEventSaved,
  removeSavedEvent,
  saveEvent,
  type SavedEvent,
} from "@/lib/saved-events";
import styles from "./ZonePreview.module.css";

type ZoneSaveButtonProps = {
  event: SavedEvent;
};

export default function ZoneSaveButton({ event }: ZoneSaveButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sincroniza el estado persistido en localStorage.
    setSaved(isEventSaved(event.slug));
  }, [event.slug]);

  function toggleSaved() {
    if (saved) {
      removeSavedEvent(event.slug);
      setSaved(false);
      trackEvent("remove_saved_event", {
        ...eventAnalyticsParams(event),
        page_path: currentPagePath(),
        source: "zone_preview_card",
      });
      return;
    }

    saveEvent(event);
    setSaved(true);
    trackEvent("save_event", {
      ...eventAnalyticsParams(event),
      page_path: currentPagePath(),
      source: "zone_preview_card",
    });
  }

  return (
    <button
      aria-label={saved ? `Quitar ${event.title} de Mis eventos` : `Guardar evento ${event.title}`}
      aria-pressed={saved}
      className={styles.saveButton}
      onClick={toggleSaved}
      title={saved ? "Quitar de Mis eventos" : "Guardar en Mis eventos"}
      type="button"
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
    </button>
  );
}
