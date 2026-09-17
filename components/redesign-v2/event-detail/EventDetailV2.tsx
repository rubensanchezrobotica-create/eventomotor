import Image from "next/image";
import Link from "next/link";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import ShareEventButton from "@/components/ShareEventButton";
import CompactAgendaSignup from "@/components/redesign-v2/newsletter/CompactAgendaSignup.client";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import { isRemoteImage } from "@/components/redesign-v2/redesign-v2-model";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { eventAnalyticsParams, urlDomain } from "@/lib/analytics";
import type { EventFaqItem } from "@/lib/event-seo-overrides";
import type { EventItem } from "@/types/event";
import type { EventDetailV2Model } from "./event-detail-model";
import styles from "./EventDetailV2.module.css";

type EventDetailV2Props = {
  model: EventDetailV2Model;
} & (
  | { routeContext: "preview" }
  | {
    routeContext: "public";
    publicContext: {
      event: EventItem;
      faqItems?: readonly EventFaqItem[];
      newsletterPublicLaunchEnabled: boolean;
    };
  }
);

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.externalLinkIcon}
      fill="none"
      focusable="false"
      height="15"
      viewBox="0 0 16 16"
      width="15"
    >
      <path d="M6 4h6v6M12 4 4 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

export default function EventDetailV2(props: EventDetailV2Props) {
  const { model, routeContext } = props;
  const publicContext = props.routeContext === "public" ? props.publicContext : null;
  const trackingParams = publicContext ? {
    ...eventAnalyticsParams(publicContext.event, { event_slug: model.slug }),
    source: publicContext.event.source,
  } : {};
  const imageAlt = model.image.kind === "event"
    ? model.image.alt
    : model.image.kind === "representative"
      ? `Imagen representativa de ${model.discipline}`
      : "";
  const heroDescription = model.venue ? (
    <>
      <span>{model.heroDescription}</span>
      <br />
      <small className={styles.heroVenue}>{model.venue}</small>
    </>
  ) : model.heroDescription;
  const hasContext = Boolean(
    model.distinctChampionship
    || model.countryContext
    || model.organizerContext,
  );
  const contentGridClassName = [
    styles.contentGrid,
    !model.practicalItems.length ? styles.contentGridEditorialOnly : "",
    !model.description && !model.programSection ? styles.contentGridPracticalOnly : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={`${styles.shellScope} ${routeContext === "public" ? redesignV2DisplayPilot.variable : ""}`}
      data-v2-event-context={routeContext}
    >
      <V2InteriorShell
        breadcrumbs={[
          { label: "Inicio", navigationId: "home" },
          { label: "Calendario", navigationId: "calendar" },
          { label: model.title },
        ]}
        description={heroDescription as unknown as string}
        eyebrow={model.discipline}
        heroTitleFontClassName={routeContext === "public" ? redesignV2DisplayPilot.variable : undefined}
        navigationMode={routeContext}
        title={model.title}
        trackPublicEventDetailNavigation={routeContext === "public"}
        upcomingCount={model.upcomingCount}
      >
        <article className={styles.article}>
          <div className={styles.container}>
            <section aria-label="Resumen del evento" className={styles.topGrid}>
              <figure className={`${styles.media} ${model.image.kind === "event" ? styles.mediaReal : styles.mediaFallback}`}>
                {model.image.src ? (
                  <Image
                    alt={imageAlt}
                    className={styles.image}
                    height={800}
                    priority
                    sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1100px) calc(100vw - 48px), 720px"
                    src={model.image.src}
                    unoptimized={isRemoteImage(model.image.src)}
                    width={1200}
                  />
                ) : (
                  <span aria-hidden="true" className={styles.neutralImage}>
                    <strong>EventoMotor</strong>
                    <small>Agenda nacional del motor</small>
                  </span>
                )}
                {model.image.label ? <figcaption>{model.image.label}</figcaption> : null}
              </figure>

              <aside className={styles.summary} aria-label={`Acciones y contexto de ${model.title}`}>
                {model.exceptionalStatus ? (
                  <div className={styles.statusAlert} data-status={model.exceptionalStatus.kind}>
                    <span>Estado del evento</span>
                    <strong>{model.exceptionalStatus.label}</strong>
                  </div>
                ) : null}

                {routeContext === "public" ? (
                  <span className={styles.temporalStatus}>{model.temporalStatus}</span>
                ) : null}

                {model.vehicle ? (
                  <div className={styles.chips}>
                    <span>{model.vehicle}</span>
                  </div>
                ) : null}

                {model.intro ? <p className={styles.intro}>{model.intro}</p> : null}

                {hasContext ? (
                  <dl className={styles.contextList}>
                    {model.distinctChampionship ? (
                      <div>
                        <dt>Campeonato</dt>
                        <dd>{model.distinctChampionship}</dd>
                      </div>
                    ) : null}
                    {model.countryContext ? (
                      <div>
                        <dt>País</dt>
                        <dd>{model.countryContext}</dd>
                      </div>
                    ) : null}
                    {model.organizerContext ? (
                      <div>
                        <dt>Organizador</dt>
                        <dd>
                          {model.organizerContext.href ? (
                            routeContext === "public" ? (
                              <TrackAnchor
                                eventName="click_event_organizer"
                                eventParams={trackingParams}
                                href={model.organizerContext.href}
                                rel="noopener noreferrer"
                                target="_blank"
                              >{model.organizerContext.label} <ExternalLinkIcon /></TrackAnchor>
                            ) : (
                              <a href={model.organizerContext.href} rel="noopener noreferrer" target="_blank">
                                {model.organizerContext.label} <ExternalLinkIcon />
                              </a>
                            )
                          ) : model.organizerContext.label}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                <div aria-label="Acciones del evento" className={styles.actions}>
                  <EventRetentionActions
                    calendarLabel="Añadir al calendario"
                    compactIcons
                    directChildren
                    event={model.savedEvent}
                    source={routeContext === "public" ? "event_detail" : "redesign_v2_event_detail"}
                  />
                  <ShareEventButton directChildren title={model.title} url={model.publicUrl} />
                </div>

                {model.primaryAction ? (
                  routeContext === "public" ? (
                    <TrackAnchor
                      className={styles.primaryAction}
                      eventName={model.primaryAction.type === "official" ? "click_official_source" : "click_tickets"}
                      eventParams={{
                        ...trackingParams,
                        ...(model.primaryAction.type === "official" ? {} : { ticket_url_domain: urlDomain(model.primaryAction.href) }),
                      }}
                      href={model.primaryAction.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >{model.primaryAction.label} <ExternalLinkIcon /></TrackAnchor>
                  ) : (
                    <a className={styles.primaryAction} href={model.primaryAction.href} rel="noopener noreferrer" target="_blank">
                      {model.primaryAction.label} <ExternalLinkIcon />
                    </a>
                  )
                ) : null}

                {model.source ? (
                  <a className={styles.sourceLink} href={model.source.href} rel="noopener noreferrer" target="_blank">
                    Fuente: {model.source.label} <ExternalLinkIcon />
                  </a>
                ) : null}

                {routeContext === "public" && model.mapHref ? (
                  <TrackAnchor
                    className={styles.mapAction}
                    eventName="click_event_maps"
                    eventParams={trackingParams}
                    href={model.mapHref}
                    rel="noopener noreferrer"
                    target="_blank"
                  >Cómo llegar <ExternalLinkIcon /></TrackAnchor>
                ) : null}
              </aside>
            </section>

            {model.description || model.programSection || model.practicalItems.length ? (
              <div className={contentGridClassName}>
                {model.description ? (
                  <section className={styles.description}>
                    <span className={styles.eyebrow}>Sobre el evento</span>
                    <h2>Lo esencial antes de asistir</h2>
                    <div className={styles.prose}>
                      {model.description.split(/\n\s*\n/).filter(Boolean).map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                ) : null}

                {model.programSection ? (
                  <section className={styles.program}>
                    <span className={styles.eyebrow}>Programa</span>
                    <h2>Horarios y programa</h2>
                    <p>{model.programSection}</p>
                  </section>
                ) : null}

                {model.practicalItems.length ? (
                  <section className={styles.practical}>
                    <span className={styles.eyebrow}>Información práctica</span>
                    <h2>Información útil</h2>
                    <dl>
                      {model.practicalItems.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null}
              </div>
            ) : null}

            {publicContext?.faqItems?.length ? (
              <section aria-labelledby="event-faq-title" className={styles.faq}>
                <div className={styles.sectionHeading}>
                  <span className={styles.eyebrow}>Preguntas frecuentes</span>
                  <h2 id="event-faq-title">Preguntas frecuentes sobre {model.title}</h2>
                </div>
                <div className={styles.faqGrid}>
                  {publicContext.faqItems.map((item) => (
                    <article className={styles.faqItem} key={item.question}>
                      <h3>{item.question}</h3>
                      <p>{item.answer}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {routeContext === "preview" || publicContext?.newsletterPublicLaunchEnabled ? (
              <CompactAgendaSignup
                description="Una selección de próximos eventos para vivir el motor."
                eyebrow="LA AGENDA MOTOR"
                title="TU AGENDA DE MOTOR, CADA SEMANA"
              />
            ) : null}

            {model.related.length ? (
              <section className={`${styles.related} ${model.compactRelatedFlow ? styles.relatedCompact : ""}`}>
                <div className={styles.sectionHeading}>
                  <span className={styles.eyebrow}>Sigue explorando</span>
                  <h2>También te puede interesar</h2>
                </div>
                <div className={styles.relatedGrid}>
                  {model.related.map((related) => {
                    const content = (
                      <>
                        <div className={styles.relatedMedia}>
                          {related.image.src ? (
                            <Image
                              alt=""
                              className={styles.relatedImage}
                              height={800}
                              sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1100px) 50vw, 33vw"
                              src={related.image.src}
                              unoptimized={isRemoteImage(related.image.src)}
                              width={1200}
                            />
                          ) : <span aria-hidden="true" className={styles.relatedNeutral}>EM</span>}
                          {related.image.label ? <span className={styles.relatedLabel}>Representativa</span> : null}
                        </div>
                        <div className={styles.relatedCopy}>
                          <span>{related.label}</span>
                          <h3>{related.title}</h3>
                          <p>{related.date.label}{related.location ? ` · ${related.location}` : ""}</p>
                          <strong>Ver evento <span aria-hidden="true">→</span></strong>
                        </div>
                      </>
                    );
                    return (
                      <article className={styles.relatedCard} key={related.slug}>
                        {routeContext === "public" ? (
                          <TrackLink
                            aria-label={`Ver ${related.title}`}
                            eventName="click_related_event"
                            eventParams={{
                              ...eventAnalyticsParams(related.trackingEvent),
                              related_event_slug: related.slug,
                              source_event_slug: model.slug,
                              source: related.context,
                            }}
                            href={related.href}
                          >{content}</TrackLink>
                        ) : (
                          <Link aria-label={`Ver ${related.title}`} href={related.href}>{content}</Link>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </article>
      </V2InteriorShell>
    </div>
  );
}
