import Image from "next/image";
import Link from "next/link";
import styles from "./RedesignV2.module.css";
import {
  isRemoteImage,
  previewEventHref,
  previewEventStatus,
  previewVehicleLabel,
  resolveRedesignEventImage,
  type PreviewEvent,
} from "./redesign-v2-model";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});

type EventCardProps = {
  event: PreviewEvent;
  nowIso: string;
  featured?: boolean;
};

export default function EventCard({ event, nowIso, featured = false }: EventCardProps) {
  const image = resolveRedesignEventImage(event);
  const date = dateFormatter.format(new Date(event.start));
  const [day, month] = date.replace(".", "").split(" ");

  return (
    <article className={featured ? `${styles.eventCard} ${styles.eventCardFeatured}` : styles.eventCard}>
      <Link className={styles.eventImageLink} href={previewEventHref(event)} aria-label={`Ver ${event.title}`}>
        <Image
          alt={image.alt}
          className={styles.eventImage}
          fill
          sizes={featured ? "(max-width: 920px) 100vw, 38vw" : "(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 33vw"}
          src={image.src}
          unoptimized={isRemoteImage(image.src)}
        />
        <span className={styles.imageShade} />
        {image.label ? <span className={styles.imageLabel}>{image.label}</span> : null}
        <span className={styles.dateBlock} aria-label={`Fecha: ${date}`}>
          <strong>{day}</strong>
          <span>{month}</span>
        </span>
      </Link>
      <div className={styles.eventCardBody}>
        <div className={styles.eventMetaLine}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>{previewEventStatus(event, nowIso)}</span>
          <span aria-hidden="true">·</span>
          <span>{previewVehicleLabel(event)}</span>
        </div>
        <h3>
          <Link href={previewEventHref(event)}>{event.title}</Link>
        </h3>
        <p>{[event.city, event.province].filter(Boolean).join(", ") || event.venue}</p>
        <Link className={styles.cardAction} href={previewEventHref(event)}>
          Ver evento <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
