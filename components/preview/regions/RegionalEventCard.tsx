import TrackLink from "@/components/analytics/TrackLink";
import { eventAnalyticsParams } from "@/lib/analytics";
import type { EventItem } from "@/types/event";
import {
  regionalEventBadges,
  regionalEventDateLabel,
} from "./regional-landing-model";
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

  return (
    <article
      className={`${styles.eventCard} ${hideOnMobileInitially ? styles.mobileInitialHidden : ""}`}
      id={anchorId}
    >
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
        <span className={styles.dateBlock} aria-hidden="true">
          <strong>{date.day}</strong>
          <span>{date.month}</span>
        </span>
        <span className={styles.cardBody}>
          <span className={styles.badges}>
            {badges.status ? <span className={styles.statusBadge}>{badges.status}</span> : null}
            {badges.informational.map((badge) => <span key={badge}>{badge}</span>)}
          </span>
          <strong className={styles.cardTitle}>{event.title}</strong>
          <span className={styles.location}>{event.city}, {event.province}</span>
          <span className={styles.cardAction}>Ver detalles</span>
        </span>
      </TrackLink>
    </article>
  );
}
