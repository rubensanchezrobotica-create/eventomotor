import Image from "next/image";
import Link from "next/link";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import {
  isRemoteImage,
  previewEventHref,
  previewEventStatus,
  type PreviewEvent,
  type ResolvedEventImage,
} from "../redesign-v2-model";
import styles from "./CalendarEventRow.module.css";

type CalendarEventRowProps = {
  event: PreviewEvent;
  image: ResolvedEventImage;
  nowIso: string;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

function formatEventDate(event: PreviewEvent): string {
  const start = dateFormatter.format(new Date(`${event.start}T12:00:00Z`));
  if (!event.end || event.end === event.start) return start;
  return `${start} — ${dateFormatter.format(new Date(`${event.end}T12:00:00Z`))}`;
}

export default function CalendarEventRow({ event, image, nowIso }: CalendarEventRowProps) {
  const href = previewEventHref(event);
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
    <article className={styles.row}>
      <Link aria-label={`Ver ${event.title}`} className={styles.imageLink} href={href}>
        {image.src ? (
          <Image
            alt={image.alt}
            className={styles.image}
            height={800}
            sizes="(max-width: 360px) 112px, (max-width: 720px) 128px, 176px"
            src={image.src}
            unoptimized={isRemoteImage(image.src)}
            width={1200}
          />
        ) : <span aria-hidden="true" className={styles.imageFallback}>EM</span>}
        {image.label ? <span className={styles.imageLabel}>{image.label}</span> : null}
      </Link>

      <div className={styles.content}>
        <div className={styles.badges}>
          <span>{event.discipline || "Motor"}</span>
          <span className={styles.status}>{previewEventStatus(event, nowIso)}</span>
          {event.vehicleType ? <span>{event.vehicleType}</span> : null}
        </div>
        <h3><Link href={href}>{event.title}</Link></h3>
        <p className={styles.date}>{formatEventDate(event)}</p>
        {location ? <p className={styles.location}>{location}</p> : null}
      </div>

      <div aria-label={`Acciones para ${event.title}`} className={styles.actions}>
        <EventRetentionActions calendarLabel="Añadir al calendario" compactIcons directChildren event={savedEvent} source="redesign_v2_calendar" />
      </div>
    </article>
  );
}
