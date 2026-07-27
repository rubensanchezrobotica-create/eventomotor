import Image from "next/image";
import TrackLink from "@/components/analytics/TrackLink";
import { eventAnalyticsParams } from "@/lib/analytics";
import { getEventImage, getEventImageAlt } from "@/lib/event-images";
import type { SavedEvent } from "@/lib/saved-events";
import type { EventItem } from "@/types/event";
import {
  regionalEventBadges,
  regionalEventDateLabel,
} from "./regional-landing-model";
import RegionalSaveButton from "./RegionalSaveButton";
import styles from "./RegionalLandingPreview.module.css";

type RegionalEventCardProps = {
  anchorId?: string;
  event: EventItem;
  hideOnMobileInitially?: boolean;
  priority?: boolean;
  source: string;
  variant?: "grid" | "hero";
};

function isRemoteImage(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

export default function RegionalEventCard({
  anchorId,
  event,
  hideOnMobileInitially = false,
  priority = false,
  source,
  variant = "grid",
}: RegionalEventCardProps) {
  const date = regionalEventDateLabel(event);
  const badges = regionalEventBadges(event);
  const slug = event.slug || event.id;
  const image = getEventImage(event);
  const hasOriginalImage = Boolean(event.image_url || event.imageUrl);
  const province = event.province?.trim();
  const location = [event.city?.trim(), province].filter(Boolean).join(", ");
  const savedEvent: SavedEvent = {
    slug,
    title: event.title,
    start: event.start,
    end: event.end || event.start,
    city: event.city,
    province,
    venue: event.venue,
    discipline: event.discipline,
    category: (event as EventItem & { category?: string }).category,
    vehicle_type: event.vehicleType || event.vehicle_type,
    source_url: event.officialUrl || event.sourceUrl,
    ticket_url: event.registrationUrl || event.ticketUrl,
  };
  const classNames = [
    styles.eventCard,
    variant === "hero" ? styles.heroEventCard : "",
    hasOriginalImage ? styles.eventCardWithOriginalImage : styles.eventCardWithFallback,
    event.featured ? styles.eventCardFeatured : "",
    badges.status ? styles.eventCardWithStatus : "",
    hideOnMobileInitially ? styles.mobileInitialHidden : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={classNames} id={anchorId}>
      <TrackLink
        aria-label={`Ver detalles de ${event.title}`}
        className={styles.cardLink}
        eventName="click_event_detail"
        eventParams={{
          ...eventAnalyticsParams(event),
          source,
        }}
        href={`/evento/${slug}`}
      >
        <span className={styles.srOnly}>Ver detalles de {event.title}</span>
      </TrackLink>

      <div className={styles.cardMedia}>
        <Image
          alt={hasOriginalImage ? `Imagen de ${event.title}` : getEventImageAlt(event)}
          className={styles.cardImage}
          fill
          priority={priority}
          sizes={variant === "hero"
            ? "(max-width: 760px) 92vw, 480px"
            : "(max-width: 760px) 34vw, (max-width: 1100px) 28vw, 220px"}
          src={image}
          unoptimized={isRemoteImage(image)}
        />
        <span className={styles.cardMediaShade} aria-hidden="true" />
        <time className={styles.dateBlock} dateTime={event.start}>
          <strong>{date.day}</strong>
          <span>{date.month}</span>
        </time>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.badges}>
          {badges.status ? <span className={styles.statusBadge}>{badges.status}</span> : null}
          {badges.informational.map((badge) => <span key={badge}>{badge}</span>)}
        </div>
        <h3 className={styles.cardTitle}>{event.title}</h3>
        <p className={styles.location}>{location || event.venue}</p>
        <span className={styles.cardAction}>Ver detalles <span aria-hidden="true">→</span></span>
      </div>

      <RegionalSaveButton
        event={savedEvent}
        source={`${source}_favorite`}
      />
    </article>
  );
}
