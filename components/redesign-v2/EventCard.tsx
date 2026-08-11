import Image from "next/image";
import Link from "next/link";
import styles from "./RedesignV2.module.css";
import {
  isRemoteImage,
  previewEventDateLabel,
  previewEventHref,
  previewEventStatus,
  previewVehicleLabel,
  resolveRedesignEventImage,
  type PreviewEvent,
  type ResolvedEventImage,
} from "./redesign-v2-model";

type EventCardProps = {
  event: PreviewEvent;
  nowIso: string;
  featured?: boolean;
  featuredLabel?: string;
  resolvedImage?: ResolvedEventImage;
};

export default function EventCard({ event, nowIso, featured = false, featuredLabel, resolvedImage }: EventCardProps) {
  const image = resolvedImage ?? resolveRedesignEventImage(event);
  const date = previewEventDateLabel(event);
  const href = previewEventHref(event);

  return (
    <article className={featured ? `${styles.eventCard} ${styles.eventCardFeatured}` : styles.eventCard}>
      <Link className={styles.eventCardLink} href={href} aria-label={`Ver ${event.title}`}>
        {featured ? (
          <div className={styles.featuredChrome}>
            <span className={styles.featuredDesktopLabel}>{featuredLabel ?? "Evento destacado"}</span>
            <span className={styles.featuredMobileLabel}>Destacado esta semana</span>
            <span className={styles.featuredEditorialLabel}>Selección editorial</span>
          </div>
        ) : null}
        <div className={styles.eventImageLink}>
          {image.src ? (
            <Image
              alt={image.alt}
              className={styles.eventImage}
              height={800}
              sizes={featured ? "(max-width: 920px) 100vw, 38vw" : "(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 33vw"}
              src={image.src}
              unoptimized={isRemoteImage(image.src)}
              width={1200}
            />
          ) : (
            <span className={styles.neutralEventImage} aria-hidden="true">
              <strong>EventoMotor</strong>
              <small>Agenda nacional del motor</small>
            </span>
          )}
          <span className={styles.imageShade} />
          {image.label ? <span className={styles.imageLabel}>{image.label}</span> : null}
          {date ? (
            <span
              className={`${styles.dateBlock} ${
                date.kind === "range"
                  ? styles.dateBlockRange
                  : date.kind === "cross-month"
                    ? styles.dateBlockCrossMonth
                    : ""
              }`}
              aria-label={date.ariaLabel}
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
            </span>
          ) : null}
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
