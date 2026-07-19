"use client";

import { useEffect, useState } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import type { EventItem } from "@/types/event";
import DisciplineEventCard from "./DisciplineEventCard";
import { nextDisciplineVisibleLimit } from "./discipline-preview-model";
import zoneStyles from "@/components/zones/ZonePreview.module.css";
import styles from "./DisciplinePreview.module.css";

type DisciplineHistoryProps = {
  events: EventItem[];
  title: string;
};

export default function DisciplineHistory({ events, title }: DisciplineHistoryProps) {
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [isMobile, setIsMobile] = useState(false);
  const pageSize = isMobile ? 6 : 12;
  const effectiveLimit = isMobile && visibleLimit === 12 ? 6 : visibleLimit;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  return (
    <details
      className={zoneStyles.pastDetails}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          trackEvent("open_discipline_history", {
            discipline: title,
            page_path: currentPagePath(),
          });
        }
      }}
    >
      <summary>
        <span>
          <strong>Eventos anteriores de {title}</strong>
          <small>{events.length} eventos históricos</small>
        </span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className={zoneStyles.pastGrid}>
        {events.map((event, index) => (
          <div className={styles.historySlot} hidden={index >= effectiveLimit} key={event.slug || event.id}>
            <DisciplineEventCard event={event} source="discipline_preview_history" />
          </div>
        ))}
      </div>
      {effectiveLimit < events.length ? (
        <div className={`${zoneStyles.showMoreRow} ${styles.historyMore}`}>
          <button
            onClick={() => {
              const next = nextDisciplineVisibleLimit(effectiveLimit, pageSize, events.length);
              setVisibleLimit(next);
              trackEvent("show_more_discipline_history", {
                discipline: title,
                page_path: currentPagePath(),
                visible_count: next,
              });
            }}
            type="button"
          >
            Mostrar más anteriores
          </button>
          <span>Mostrando {effectiveLimit} de {events.length}</span>
        </div>
      ) : null}
    </details>
  );
}
