"use client";

import TrackLink from "@/components/analytics/TrackLink";
import { eventAnalyticsParams } from "@/lib/analytics";
import type { SavedEvent } from "@/lib/saved-events";
import type { EventItem } from "@/types/event";
import {
  normalizeZoneDiscipline,
  normalizeZoneProvince,
  zoneEventDateLabel,
  zoneEventStatusLabel,
  zoneVehicleLabel,
} from "./zone-preview-model";
import ZoneSaveButton from "./ZoneSaveButton";
import styles from "./ZonePreview.module.css";

type ZoneEventCardProps = {
  event: EventItem;
  saveSource?: string;
  showMultiDayMeta?: boolean;
  showStatus?: boolean;
  source?: string;
};

export default function ZoneEventCard({
  event,
  saveSource,
  showMultiDayMeta = true,
  showStatus = true,
  source = "zone_preview_results",
}: ZoneEventCardProps) {
  const slug = event.slug || event.id;
  const date = zoneEventDateLabel(event);
  const status = zoneEventStatusLabel(event);
  const vehicle = zoneVehicleLabel(event);
  const province = normalizeZoneProvince(event.province);
  const discipline = normalizeZoneDiscipline(event.discipline);
  const location = [event.city, province].filter(Boolean).join(", ");
  const isMultiDay = (event.end || event.start) > event.start;
  const savedEvent: SavedEvent = {
    slug,
    title: event.title,
    start: event.start,
    end: event.end || event.start,
    city: event.city,
    province,
    venue: event.venue,
    discipline,
    category: (event as EventItem & { category?: string }).category,
    vehicle_type: event.vehicleType || event.vehicle_type,
    source_url: event.officialUrl || event.sourceUrl,
    ticket_url: event.registrationUrl || event.ticketUrl,
  };

  return (
    <article className={`${styles.eventCard} ${event.featured ? styles.eventCardFeatured : ""}`}>
      <TrackLink
        aria-label={`Ver ${event.title}`}
        className={styles.eventCardLink}
        eventName="click_event_detail"
        eventParams={{
          ...eventAnalyticsParams(event),
          source,
        }}
        href={`/evento/${slug}`}
      >
        <span className={styles.srOnly}>Abrir ficha de {event.title}</span>
      </TrackLink>

      <div
        aria-hidden="true"
        className={`${styles.dateBlock} ${
          date.kind === "range"
            ? styles.dateBlockRange
            : date.kind === "cross-month"
              ? styles.dateBlockCrossMonth
              : ""
        }`}
      >
        {date.kind === "cross-month" ? (
          <>
            <span className={styles.dateLine}>
              <strong>{date.startDay}</strong>
              <span>{date.startMonth}</span>
            </span>
            <span className={styles.dateLine}>
              <strong>{date.endDay}</strong>
              <span>{date.endMonth}</span>
            </span>
          </>
        ) : (
          <>
            <strong>{date.day}</strong>
            <span>{date.month}</span>
          </>
        )}
      </div>

      <div className={styles.eventCopy}>
        <div className={styles.cardEyebrows}>
          {event.featured ? <span className={styles.featuredChip}>Destacado</span> : null}
          {showStatus && status ? <span>{status}</span> : null}
        </div>
        <h3>{event.title}</h3>
        <p className={styles.location}>{location || event.venue}</p>
        <div className={styles.eventMeta}>
          <span>{discipline}</span>
          {vehicle ? <span>{vehicle}</span> : null}
          {showMultiDayMeta && isMultiDay ? (
            <span className={styles.multiDayMeta}>Varios días</span>
          ) : null}
        </div>
      </div>

      <ZoneSaveButton event={savedEvent} source={saveSource} />
    </article>
  );
}
