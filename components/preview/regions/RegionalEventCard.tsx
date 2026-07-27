import TrackLink from "@/components/analytics/TrackLink";
import { eventAnalyticsParams } from "@/lib/analytics";
import type { SavedEvent } from "@/lib/saved-events";
import type { EventItem } from "@/types/event";
import {
  regionalEventBadges,
  regionalEventDateAriaLabel,
  regionalEventDateLabel,
} from "./regional-landing-model";
import RegionalSaveButton from "./RegionalSaveButton";
import styles from "./RegionalLandingPreview.module.css";

type RegionalEventCardProps = {
  anchorId?: string;
  event: EventItem;
  hideOnMobileInitially?: boolean;
  source: string;
};

export default function RegionalEventCard({
  anchorId,
  event,
  hideOnMobileInitially = false,
  source,
}: RegionalEventCardProps) {
  const date = regionalEventDateLabel(event);
  const badges = regionalEventBadges(event);
  const slug = event.slug || event.id;
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

      <time
        aria-label={regionalEventDateAriaLabel(event)}
        className={`${styles.dateBlock} ${date.splitRange ? styles.dateBlockSplit : ""}`}
        dateTime={event.start}
      >
        {date.lines.map((line) => (
          <span className={styles.dateLine} key={`${line.day}-${line.month}`}>
            <strong>{line.day}</strong>
            <span>{line.month}</span>
          </span>
        ))}
      </time>

      <div className={styles.cardBody}>
        <div className={styles.badges}>
          {badges.status ? <span className={styles.statusBadge}>{badges.status}</span> : null}
          {badges.informational
            .slice(0, badges.status ? 1 : 2)
            .map((badge) => <span key={badge}>{badge}</span>)}
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
