import Image from "next/image";
import Link from "next/link";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import ShareEventButton from "@/components/ShareEventButton";
import { isRemoteImage } from "@/components/redesign-v2/redesign-v2-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import type { EventDetailV2Model } from "./event-detail-model";
import styles from "./EventDetailV2.module.css";

type EventDetailV2Props = {
  model: EventDetailV2Model;
};

function ExternalArrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function EventDetailV2({ model }: EventDetailV2Props) {
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

  return (
    <div className={styles.shellScope}>
      <V2PreviewShell
        breadcrumbs={[
          { label: "Inicio", navigationId: "home" },
          { label: "Calendario", navigationId: "calendar" },
          { label: model.title },
        ]}
        description={heroDescription as unknown as string}
        eyebrow={model.discipline}
        title={model.title}
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
                {model.vehicle ? (
                  <div className={styles.chips}>
                    <span>{model.vehicle}</span>
                  </div>
                ) : null}

                {model.intro ? <p className={styles.intro}>{model.intro}</p> : null}

                <div aria-label="Acciones del evento" className={styles.actions}>
                  <EventRetentionActions
                    calendarLabel="Añadir al calendario"
                    directChildren
                    event={model.savedEvent}
                    source="redesign_v2_event_detail"
                  />
                  <ShareEventButton directChildren title={model.title} url={model.publicUrl} />
                </div>

                {model.primaryAction ? (
                  <a className={styles.primaryAction} href={model.primaryAction.href} rel="noopener noreferrer" target="_blank">
                    {model.primaryAction.label} <ExternalArrow />
                  </a>
                ) : null}

                {model.source ? (
                  <a className={styles.sourceLink} href={model.source.href} rel="noopener noreferrer" target="_blank">
                    Fuente: {model.source.label} <ExternalArrow />
                  </a>
                ) : null}
              </aside>
            </section>

            {model.description || model.practicalItems.length ? (
              <div className={styles.contentGrid}>
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

            {model.related.length ? (
              <section className={styles.related}>
                <div className={styles.sectionHeading}>
                  <span className={styles.eyebrow}>Sigue explorando</span>
                  <h2>También te puede interesar</h2>
                </div>
                <div className={styles.relatedGrid}>
                  {model.related.map((related) => (
                    <article className={styles.relatedCard} key={related.slug}>
                      <Link aria-label={`Ver ${related.title}`} href={related.href}>
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
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </article>
      </V2PreviewShell>
    </div>
  );
}
