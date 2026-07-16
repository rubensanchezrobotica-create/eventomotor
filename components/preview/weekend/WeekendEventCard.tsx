"use client";

import TrackLink from "@/components/analytics/TrackLink";
import { eventAnalyticsParams } from "@/lib/analytics";
import type { SavedEvent } from "@/lib/saved-events";
import type { EventItem } from "@/types/event";
import {
  isMultiDayWeekendEvent,
  weekendEventDateLabel,
  weekendEventStatusLabel,
  weekendVehicleLabel,
} from "./weekend-preview-model";
import WeekendSaveButton from "./WeekendSaveButton";
import styles from "./WeekendPreview.module.css";

type WeekendEventCardProps = {
  analyticsSource: string;
  event: EventItem;
};

export default function WeekendEventCard({
  analyticsSource,
  event,
}: WeekendEventCardProps) {
  const slug = event.slug || event.id;
  const date = weekendEventDateLabel(event);
  const status = weekendEventStatusLabel(event);
  const vehicle = weekendVehicleLabel(event);
  const location = [event.city, event.province].filter(Boolean).join(", ");
  const savedEvent: SavedEvent = {
    slug,
    title: event.title,
    start: event.start,
    end: event.end || event.start,
    city: event.city,
    province: event.province,
    venue: event.venue,
    discipline: event.discipline,
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
          source: analyticsSource,
        }}
        href={`/evento/${slug}`}
      >
        <span className={styles.srOnly}>Abrir ficha de {event.title}</span>
      </TrackLink>

      <div
        className={`${styles.dateBlock} ${
          date.kind === "range"
            ? styles.dateBlockRange
            : date.kind === "cross-month"
              ? styles.dateBlockCrossMonth
              : ""
        }`}
        aria-hidden="true"
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
          {status ? <span>{status}</span> : null}
        </div>
        <h3>{event.title}</h3>
        <p className={styles.location}>{location || event.venue}</p>
        <div className={styles.eventMeta}>
          <span>{event.discipline}</span>
          {vehicle ? <span>{vehicle}</span> : null}
          {isMultiDayWeekendEvent(event) ? <span>Varios días</span> : null}
        </div>
      </div>

      <WeekendSaveButton event={savedEvent} />
    </article>
  );
}
