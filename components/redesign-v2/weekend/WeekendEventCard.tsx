import Image from "next/image";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import TrackLink from "@/components/analytics/TrackLink";
import { eventAnalyticsParams } from "@/lib/analytics";
import {
  isRemoteImage,
  previewEventHref,
  previewEventStatus,
  type PreviewEvent,
  type ResolvedEventImage,
} from "../redesign-v2-model";
import type { WeekendRouteContext } from "./weekend-page-model";
import {
  formatWeekendDisciplineLabel,
  formatWeekendEventDate,
} from "./weekend-page-model";
import styles from "./WeekendPageExperience.module.css";

type WeekendEventCardProps = {
  event: PreviewEvent;
  image: ResolvedEventImage;
  nowIso: string;
  routeContext: WeekendRouteContext;
};

export default function WeekendEventCard({ event, image, nowIso, routeContext }: WeekendEventCardProps) {
  const href = routeContext === "public" ? `/evento/${event.slug || event.id}` : previewEventHref(event);
  const analyticsSource = routeContext === "public" ? "weekend_public_results" : "redesign_v2_weekend";
  const eventName = routeContext === "public" ? "click_event_detail" : "view_event";
  const location = [event.venue, event.city, event.province].filter(Boolean).join(" · ");
  const savedEvent = {
    slug: event.slug || event.id,
    title: event.title,
    start: event.start,
    end: event.end || event.start,
    city: event.city,
    province: event.province,
    venue: event.venue,
    discipline: event.discipline,
    vehicle_type: event.vehicleType,
  };

  return (
    <article className={styles.eventCard}>
      <TrackLink
        aria-label={`Ver ${event.title}`}
        className={styles.eventImageLink}
        eventName={eventName}
        eventParams={{ ...eventAnalyticsParams(event), source: analyticsSource }}
        href={href}
      >
        <span className={styles.imageSurface}>
          {image.src ? (
            <Image
              alt=""
              className={styles.eventImage}
              height={800}
              sizes="(max-width: 700px) calc(100vw - 36px), (max-width: 1024px) 45vw, 370px"
              src={image.src}
              unoptimized={isRemoteImage(image.src)}
              width={1200}
            />
          ) : <span aria-hidden="true" className={styles.imageFallback}>EM</span>}
          {image.label ? <span aria-hidden="true" className={styles.imageLabel}>{image.label}</span> : null}
        </span>
      </TrackLink>

      <div className={styles.eventCardBody}>
        <div className={styles.eventMetaRow}>
          <span>{formatWeekendDisciplineLabel(event.discipline)}</span>
          <span className={styles.eventStatus}>{previewEventStatus(event, nowIso)}</span>
        </div>
        <p className={styles.eventDate}>{formatWeekendEventDate(event)}</p>
        <h3><TrackLink eventName={eventName} eventParams={{ ...eventAnalyticsParams(event), source: analyticsSource }} href={href}>{event.title}</TrackLink></h3>
        {location ? <p className={styles.eventLocation}>{location}</p> : null}
        {event.vehicleType ? <p className={styles.vehicleLabel}>{event.vehicleType}</p> : null}
      </div>

      <div className={styles.eventCardActions}>
        <TrackLink className={styles.eventDetailLink} eventName={eventName} eventParams={{ ...eventAnalyticsParams(event), source: analyticsSource }} href={href}>
          Ver evento <span aria-hidden="true">→</span>
        </TrackLink>
        <div aria-label={`Acciones para ${event.title}`} className={styles.retentionActions}>
          <EventRetentionActions calendarLabel="Añadir al calendario" compactIcons directChildren event={savedEvent} source={analyticsSource} />
        </div>
      </div>
    </article>
  );
}
