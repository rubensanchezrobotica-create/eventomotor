import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import ShareEventButton from "@/components/ShareEventButton";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel } from "@/components/public/concept/concept-model";
import { eventAnalyticsParams, urlDomain } from "@/lib/analytics";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getEventImage, getEventImageAlt } from "@/lib/event-images";
import { getDisciplineSlug } from "@/lib/event-listing-slugs";
import { classifyEventMacroZone, type MacroZoneId } from "@/lib/event-macro-zone";
import type { EventItem } from "@/types/event";
import {
  buildRelatedEventDetails,
  classifyEventTitleLength,
  eventLocationLabel,
  eventStatusLabel,
  formatEventDate,
  formatVerifiedAt,
  getAboutText,
  getEventPrimaryAction,
  getHeroSummary,
  getPracticalGridVariant,
  getPracticalItems,
  getSummaryItems,
  getUsefulTags,
  isFallbackEventImage,
  parseStructuredDescription,
  vehicleLabel,
  vehicleTypeOf,
} from "./event-detail-model";
import styles from "./EventDetailView.module.css";

export type EventDetailViewProps = {
  analyticsSource: string;
  event: EventItem;
  events: EventItem[];
  footerContactTrackingLocation: string;
  retentionSource: string;
  siteUrl: string;
};

const ZONE_LABELS: Record<MacroZoneId, string> = {
  norte: "Norte",
  centro: "Centro",
  "cataluna-aragon": "Cataluña / Aragón",
  levante: "Levante",
  sur: "Sur",
  canarias: "Canarias",
};

const TITLE_CLASS_NAMES = {
  short: styles.titleShort,
  medium: styles.titleMedium,
  long: styles.titleLong,
  extraLong: styles.titleExtraLong,
};

const PRACTICAL_GRID_CLASS_NAMES = {
  one: styles.practicalGridOne,
  two: styles.practicalGridTwo,
  three: styles.practicalGridThree,
  four: styles.practicalGridFour,
  five: styles.practicalGridFive,
  six: styles.practicalGridSix,
};

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function isRemoteImage(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function googleMapsUrl(event: EventItem) {
  const hasCoordinates = typeof event.latitude === "number"
    && typeof event.longitude === "number"
    && Number.isFinite(event.latitude)
    && Number.isFinite(event.longitude);

  return hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
    : "";
}

function AboutDescription({ text }: { text: string }) {
  const structuredDescription = parseStructuredDescription(text);

  if (!structuredDescription) return <p>{text}</p>;

  return (
    <div className={styles.structuredDescription}>
      {structuredDescription.blocks.map((block, index) => {
        const key = `${block.kind}-${block.label || "text"}-${index}`;

        if (block.kind === "field") {
          return (
            <dl className={styles.structuredField} key={key}>
              <div>
                <dt>{block.label}</dt>
                <dd>{block.value}</dd>
              </div>
            </dl>
          );
        }

        return (
          <p className={block.kind === "description" ? styles.structuredIntro : styles.structuredPlain} key={key}>
            {block.value}
          </p>
        );
      })}
    </div>
  );
}

export default function EventDetailView({
  analyticsSource,
  event,
  events,
  footerContactTrackingLocation,
  retentionSource,
  siteUrl,
}: EventDetailViewProps) {
  const slug = event.slug || event.id;
  const publicUrl = `${siteUrl}/evento/${slug}`;
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const fallbackImage = isFallbackEventImage(eventImage);
  const color = getDisciplineColor(event.discipline);
  const status = eventStatusLabel(event);
  const heroSummary = getHeroSummary(event);
  const aboutText = getAboutText(event);
  const primaryAction = getEventPrimaryAction(event);
  const summaryItems = getSummaryItems(event);
  const practicalItems = getPracticalItems(event);
  const practicalGridVariant = getPracticalGridVariant(practicalItems.length);
  const usefulTags = getUsefulTags(event);
  const titleLength = classifyEventTitleLength(event.title);
  const compactTags = usefulTags.length <= 2;
  const relatedEvents = buildRelatedEventDetails(event, events);
  const location = eventLocationLabel(event);
  const mapsUrl = googleMapsUrl(event);
  const zone = classifyEventMacroZone(event);
  const organizerName = cleanText(event.organizerName);
  const organizerUrl = cleanText(event.organizerUrl);
  const heroMeta = [event.championship, event.source]
    .filter((value, index, list) => cleanText(value) && list.findIndex((item) => cleanText(item) === cleanText(value)) === index)
    .join(" · ");
  const trackingParams = {
    ...eventAnalyticsParams(event, { event_slug: slug }),
    source: analyticsSource,
  };
  const savedEvent = {
    slug,
    title: event.title,
    start: event.start,
    end: event.end || event.start,
    city: event.city,
    province: event.province,
    venue: event.venue,
    discipline: event.discipline,
    category: (event as EventItem & { category?: string }).category,
    vehicle_type: vehicleTypeOf(event),
    source_url: cleanText(event.officialUrl) || cleanText(event.sourceUrl),
    ticket_url: cleanText(event.registrationUrl) || cleanText(event.ticketUrl),
  };

  return (
    <div className={`emc-page ${styles.previewPage}`}>
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <article>
          <section className={styles.heroSection}>
            <div className={`emc-container ${styles.heroGrid} ${summaryItems.length ? "" : styles.heroGridCompact}`}>
              <div className={styles.heroCopy}>
                <nav aria-label="Migas de pan" className={styles.breadcrumb}>
                  <ol>
                    <li><Link href="/">Inicio</Link></li>
                    <li aria-hidden="true">/</li>
                    <li><Link href="/calendario">Calendario</Link></li>
                    <li aria-hidden="true">/</li>
                    <li><Link href={`/disciplinas/${getDisciplineSlug(event.discipline)}`}>{event.discipline}</Link></li>
                  </ol>
                </nav>

                <div className={styles.chips}>
                  {event.featured ? <span className="emc-badge emc-featured-badge">Evento destacado</span> : null}
                  <span className="emc-badge">{vehicleLabel(event)}</span>
                  <span
                    className="emc-badge"
                    style={{ borderColor: `${color.accent}66`, backgroundColor: `${color.accent}18` }}
                  >
                    {event.discipline}
                  </span>
                  {status ? <span className={`${styles.statusChip} emc-badge`}>{status}</span> : null}
                </div>

                <time className={styles.date} dateTime={event.start}>{formatEventDate(event)}</time>
                <h1 className={TITLE_CLASS_NAMES[titleLength]}>{event.title}</h1>
                {location ? <p className={styles.location}>{location}</p> : null}
                {heroMeta ? <p className={styles.heroMeta}>{heroMeta}</p> : null}
                {heroSummary ? <p className={styles.heroSummary}>{heroSummary}</p> : null}
              </div>

              <figure className={styles.mediaCard}>
                <Image
                  alt={eventImageAlt}
                  className={`${styles.eventImage} ${fallbackImage ? styles.eventImageFallback : styles.eventImagePoster}`}
                  height={900}
                  priority
                  sizes="(max-width: 900px) 92vw, (max-width: 1180px) 42vw, 500px"
                  src={eventImage}
                  unoptimized={isRemoteImage(eventImage)}
                  width={1600}
                />
              </figure>

              <div className={styles.actionPanel}>
                {primaryAction ? (
                  <TrackAnchor
                    className={`emc-btn emc-btn-primary ${styles.primaryAction}`}
                    eventName={primaryAction.type === "official" ? "click_official_source" : "click_tickets"}
                    eventParams={{
                      ...trackingParams,
                      ...(primaryAction.type === "official" ? {} : { ticket_url_domain: urlDomain(primaryAction.href) }),
                    }}
                    href={primaryAction.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {primaryAction.label}
                  </TrackAnchor>
                ) : null}
                <div className={styles.utilityActions}>
                  <EventRetentionActions
                    calendarLabel="Añadir al calendario"
                    directChildren
                    event={savedEvent}
                    source={retentionSource}
                  />
                  <ShareEventButton directChildren title={event.title} url={publicUrl} />
                </div>
              </div>

              {summaryItems.length ? (
                <aside className={styles.summaryCard} aria-label="Resumen verificado del evento">
                  <div className={styles.summaryHead}>
                    <span>En breve</span>
                    {formatVerifiedAt(event.verifiedAt) ? <strong>Revisado</strong> : null}
                  </div>
                  <dl>
                    {summaryItems.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              ) : null}
            </div>
          </section>

          <section className={styles.contentSection}>
            <div className={`emc-container ${styles.contentFlow} ${event.scheduleText ? styles.contentFlowWithSchedule : styles.contentFlowWithoutSchedule} ${aboutText ? styles.contentFlowWithAbout : ""}`}>
              {aboutText ? (
                <section className={`${styles.editorialCard} ${styles.aboutCard}`}>
                  <span className={styles.eyebrow}>Sobre el evento</span>
                  <h2>Lo esencial antes de asistir</h2>
                  <AboutDescription text={aboutText} />
                </section>
              ) : null}

              {event.scheduleText ? (
                <section className={`${styles.editorialCard} ${styles.scheduleCard}`}>
                  <span className={styles.eyebrow}>Programa y horarios</span>
                  <h2>Horarios publicados</h2>
                  <p>{event.scheduleText}</p>
                </section>
              ) : null}

              <section className={styles.practicalBlock}>
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>Información práctica</span>
                    <h2>Datos para organizar tu visita</h2>
                  </div>
                  {mapsUrl ? (
                    <TrackAnchor
                      className="emc-btn emc-btn-dark"
                      eventName="click_event_maps"
                      eventParams={trackingParams}
                      href={mapsUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Cómo llegar
                    </TrackAnchor>
                  ) : null}
                </div>
                <dl className={`${styles.practicalGrid} ${PRACTICAL_GRID_CLASS_NAMES[practicalGridVariant]} ${event.scheduleText ? styles.practicalGridNarrow : ""}`}>
                  {practicalItems.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </section>

          {organizerName || usefulTags.length ? (
            <section className={styles.supportSection}>
              <div className={`emc-container ${styles.supportGrid} ${compactTags && !organizerName ? styles.supportGridCompactTags : ""}`}>
                {organizerName ? (
                  <section className={styles.supportCard}>
                    <span className={styles.eyebrow}>Organiza</span>
                    <h2>{organizerName}</h2>
                    {organizerUrl ? (
                      <TrackAnchor
                        className="emc-btn emc-btn-dark"
                        eventName="click_event_organizer"
                        eventParams={trackingParams}
                        href={organizerUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Web del organizador
                      </TrackAnchor>
                    ) : null}
                  </section>
                ) : null}
                {usefulTags.length ? (
                  <section className={`${styles.supportCard} ${compactTags ? styles.compactTagCard : ""}`}>
                    <span className={styles.eyebrow}>Etiquetas</span>
                    <h2>Temas relacionados</h2>
                    <div className={styles.tagList}>
                      {usefulTags.map((tag) => <span className="emc-badge" key={tag}>{tag}</span>)}
                    </div>
                  </section>
                ) : null}
              </div>
            </section>
          ) : null}

          {relatedEvents.length ? (
            <section className={styles.relatedSection}>
              <div className="emc-container">
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>Sigue explorando</span>
                    <h2>Otros eventos que pueden interesarte</h2>
                  </div>
                </div>
                <div className={styles.relatedGrid}>
                  {relatedEvents.map(({ context, event: related }) => {
                    const relatedColor = getDisciplineColor(related.discipline);
                    const label = dayLabel(related);
                    const relatedSlug = related.slug || related.id;

                    return (
                      <TrackLink
                        className={styles.relatedCard}
                        eventName="click_related_event"
                        eventParams={{
                          ...eventAnalyticsParams(related),
                          related_event_slug: relatedSlug,
                          source_event_slug: slug,
                          source: context,
                        }}
                        href={`/evento/${relatedSlug}`}
                        key={relatedSlug}
                        style={{ "--preview-accent": relatedColor.accent } as CSSProperties}
                      >
                        <div className={styles.relatedDate}>
                          <strong>{label.day}</strong>
                          <span>{label.month}</span>
                        </div>
                        <div className={styles.relatedCopy}>
                          <div className={styles.relatedMeta}>
                            <span>{context}</span>
                            {context !== related.discipline ? <span>{related.discipline}</span> : null}
                          </div>
                          <h3>{related.title}</h3>
                          <p>{formatRange(related)} · {related.city}, {related.province}</p>
                        </div>
                      </TrackLink>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          <section className={styles.finalSection}>
            <div className={`emc-container ${styles.finalCard}`}>
              <div>
                <span className={styles.eyebrow}>Más eventos</span>
                <h2>¿Buscas más planes de motor?</h2>
                <p>Continúa por el calendario, la disciplina o la zona de este evento.</p>
              </div>
              <div className={styles.finalActions}>
                <Link className="emc-btn emc-btn-primary" href="/calendario">Ver calendario</Link>
                <Link className="emc-btn emc-btn-dark" href={`/disciplinas/${getDisciplineSlug(event.discipline)}`}>
                  Ver más de {event.discipline}
                </Link>
                {zone ? <Link className="emc-btn emc-btn-dark" href={`/zonas/${zone}`}>Ver zona {ZONE_LABELS[zone]}</Link> : null}
              </div>
            </div>
          </section>
        </article>
      </main>

      <ConceptFooter contactTrackingLocation={footerContactTrackingLocation} variant="compact" />
    </div>
  );
}
