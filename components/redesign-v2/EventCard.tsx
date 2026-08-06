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
  type ResolvedEventImage,
} from "./redesign-v2-model";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});

type EventCardProps = {
  event: PreviewEvent;
  nowIso: string;
  featured?: boolean;
  featuredLabel?: string;
  resolvedImage?: ResolvedEventImage;
};

export default function EventCard({ event, nowIso, featured = false, featuredLabel, resolvedImage }: EventCardProps) {
  const image = resolvedImage ?? resolveRedesignEventImage(event);
  const date = dateFormatter.format(new Date(`${event.start.slice(0, 10)}T12:00:00`));
  const [day, month] = date.replace(".", "").split(" ");
  const href = previewEventHref(event);

  return (
    <article className={featured ? `${styles.eventCard} ${styles.eventCardFeatured}` : styles.eventCard}>
      <Link className={styles.eventCardLink} href={href} aria-label={`Ver ${event.title}`}>
        {featured ? (
          <div className={styles.featuredChrome}>
            <span>{featuredLabel ?? "Evento destacado"}</span>
            <span>Selección editorial</span>
          </div>
        ) : null}
        <div className={styles.eventImageLink}>
          {image.src ? (
            <Image
              alt={image.alt}
              className={styles.eventImage}
              fill
              sizes={featured ? "(max-width: 920px) 100vw, 38vw" : "(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 33vw"}
              src={image.src}
              unoptimized={isRemoteImage(image.src)}
            />
          ) : (
            <span className={styles.neutralEventImage} aria-hidden="true">
              <strong>EventoMotor</strong>
              <small>Agenda nacional del motor</small>
            </span>
          )}
          <span className={styles.imageShade} />
          {image.label ? <span className={styles.imageLabel}>{image.label}</span> : null}
          <span className={styles.dateBlock} aria-label={`Fecha: ${date}`}>
            <strong>{day}</strong>
            <span>{month}</span>
          </span>
        </div>
        <div className={styles.eventCardBody}>
          <div className={styles.eventMetaLine}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>{previewEventStatus(event, nowIso)}</span>
            <span aria-hidden="true">·</span>
            <span>{previewVehicleLabel(event)}</span>
          </div>
          <h3>{event.title}</h3>
          <p>{[event.city, event.province].filter(Boolean).join(", ") || event.venue}</p>
          <span className={styles.cardAction}>
            Ver evento <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
