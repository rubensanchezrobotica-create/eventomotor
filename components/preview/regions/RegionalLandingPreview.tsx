import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import type { EventItem } from "@/types/event";
import RegionalEventCard from "./RegionalEventCard";
import {
  filterRegionalLandingEvents,
  nextRegionalShowLimit,
  regionalNextEventLabel,
  type RegionalLandingModel,
  type RegionalLandingQuery,
} from "./regional-landing-model";
import styles from "./RegionalLandingPreview.module.css";

type RegionalLandingPreviewProps = {
  model: RegionalLandingModel;
  pathname: string;
  query: RegionalLandingQuery;
};

function queryHref(
  pathname: string,
  values: Record<string, string | number | boolean | undefined>,
  anchor = "eventos",
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "" || value === false) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}#${anchor}`;
}

function eventKey(event: EventItem) {
  return event.slug || event.id;
}

export default function RegionalLandingPreview({
  model,
  pathname,
  query,
}: RegionalLandingPreviewProps) {
  const filteredEvents = filterRegionalLandingEvents(model, query);
  const visibleEvents = filteredEvents.slice(0, query.show);
  const hasMore = filteredEvents.length > visibleEvents.length;
  const firstWeekendKey = model.weekendEvents[0] ? eventKey(model.weekendEvents[0]) : "";
  const hasRealExploreChoice = model.provinceCounts.length > 1 || model.disciplineCounts.length > 1;
  const activeLabel = query.weekendOnly
    ? "este fin de semana"
    : query.province
      ? model.provinceCounts.find((item) => item.key === query.province)?.label
      : query.discipline
        ? model.disciplineCounts.find((item) => item.key === query.discipline)?.label
        : "";

  return (
    <div className={`emc-page ${styles.page}`}>
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <section className={styles.hero}>
          <div className="emc-container">
            <nav aria-label="Migas de pan" className={styles.breadcrumb}>
              <ol>
                <li><Link href="/">Inicio</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/zonas">Regiones</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{model.config.name}</li>
              </ol>
            </nav>
            <span className={styles.eyebrow}>{model.config.eyebrow}</span>
            <h1>{model.config.h1}</h1>
            <p className={styles.heroDescription}>{model.config.description}</p>
            {model.upcomingTotal ? (
              <>
                <p className={styles.heroCount}>
                  <strong>{model.upcomingTotal} próximos eventos</strong>
                  {model.provinceCounts.length ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <strong>{model.provinceCounts.length} {model.provinceCounts.length === 1 ? "provincia" : "provincias"}</strong>
                    </>
                  ) : null}
                </p>
                <a className="emc-btn emc-btn-primary" href="#eventos">
                  Ver próximos eventos
                </a>
              </>
            ) : null}
          </div>
        </section>

        {model.upcomingTotal && model.weekendEvents.length ? (
          <section className={styles.weekendStrip} aria-label="Resumen del fin de semana">
            <div className={`emc-container ${styles.weekendInner}`}>
              <p><strong>{model.weekendEvents.length} {model.weekendEvents.length === 1 ? "plan" : "planes"} este fin de semana</strong></p>
              <Link href={queryHref(pathname, { vista: "fin-de-semana" })}>Verlos</Link>
            </div>
          </section>
        ) : model.upcomingTotal ? (
          <section className={styles.weekendStrip} aria-label="Resumen del fin de semana">
            <div className={`emc-container ${styles.weekendInner}`}>
              <p>
                <strong>Sin citas este fin de semana</strong>
                <span aria-hidden="true">·</span>
                <span>Próximo evento: {regionalNextEventLabel(model.upcomingEvents[0])}</span>
              </p>
            </div>
          </section>
        ) : null}

        <section className={styles.eventsSection} id="eventos">
          <div className="emc-container">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>Inventario regional</span>
                <h2>
                  {activeLabel
                    ? `Eventos en ${activeLabel}`
                    : `Próximos eventos en ${model.config.name}`}
                </h2>
              </div>
              {activeLabel ? (
                <Link className={styles.clearLink} href={`${pathname}#eventos`}>
                  Ver toda {model.config.name}
                </Link>
              ) : null}
            </div>

            {model.upcomingTotal ? (
              <>
                <div className={styles.eventGrid}>
                  {visibleEvents.map((event, index) => (
                    <RegionalEventCard
                      anchorId={eventKey(event) === firstWeekendKey ? "fin-de-semana-regional" : undefined}
                      event={event}
                      hideOnMobileInitially={query.show === 8 && index >= 6}
                      key={eventKey(event)}
                      source={`regional_preview_${model.config.id}`}
                    />
                  ))}
                </div>
                {hasMore ? (
                  <div className={styles.moreRow}>
                    <Link
                      className="emc-btn emc-btn-dark"
                      href={queryHref(pathname, {
                        disciplina: query.discipline,
                        mostrar: nextRegionalShowLimit(query.show, filteredEvents.length),
                        provincia: query.province,
                        vista: query.weekendOnly ? "fin-de-semana" : "",
                      })}
                    >
                      Ver más eventos
                    </Link>
                    <span>Mostrando hasta {Math.min(query.show, filteredEvents.length)} de {filteredEvents.length}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.eyebrow}>Agenda en actualización</span>
                <h2>Aún no tenemos próximas fechas publicadas en {model.config.name}.</h2>
                <p>
                  Puedes explorar el calendario nacional o enviar una cita para que el equipo la revise.
                </p>
                <div className={styles.emptyActions}>
                  <Link className="emc-btn emc-btn-primary" href={PUBLIC_NAVIGATION.calendar}>
                    Explorar calendario nacional
                  </Link>
                  <Link href={PUBLIC_NAVIGATION.publish}>Publicar un evento</Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {!model.upcomingTotal && model.fallbackNationalEvents.length ? (
          <section className={styles.nationalSection}>
            <div className="emc-container">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.eyebrow}>Alternativas</span>
                  <h2>Próximos eventos en España</h2>
                </div>
                <p>No forman parte del total regional.</p>
              </div>
              <div className={styles.eventGrid}>
                {model.fallbackNationalEvents.map((event) => (
                  <RegionalEventCard
                    event={event}
                    key={eventKey(event)}
                    source="regional_preview_national_fallback"
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {model.upcomingTotal && hasRealExploreChoice ? (
          <section className={styles.exploreSection}>
            <div className="emc-container">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.eyebrow}>Explorar la agenda</span>
                  <h2>Encuentra tu próximo plan</h2>
                </div>
                <p>Solo aparecen accesos con próximos eventos publicados.</p>
              </div>
              <div className={styles.exploreColumns}>
                {model.provinceCounts.length > 1 ? (
                  <div>
                    <h3>Por provincia</h3>
                    <div className={styles.exploreGrid}>
                      {model.provinceCounts.map((item) => (
                        <Link
                          href={queryHref(pathname, { provincia: item.key })}
                          key={item.key}
                        >
                          <strong>{item.label}</strong>
                          <span>{item.count} {item.count === 1 ? "evento" : "eventos"}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
                {model.disciplineCounts.length > 1 ? (
                  <div>
                    <h3>Por disciplina</h3>
                    <div className={styles.exploreGrid}>
                      {model.disciplineCounts.slice(0, 8).map((item) => (
                        <Link
                          href={queryHref(pathname, { disciplina: item.key })}
                          key={item.key}
                        >
                          <strong>{item.label}</strong>
                          <span>{item.count} {item.count === 1 ? "evento" : "eventos"}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className={styles.editorialSection}>
          <div className={`emc-container ${styles.editorialCard}`}>
            <article>
              <span className={styles.eyebrow}>Guía regional</span>
              <h2>Sobre los eventos de motor en {model.config.name}</h2>
              {model.config.seoParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
            <aside className={styles.faq} aria-label="Preguntas frecuentes">
              {model.config.faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </aside>
          </div>
        </section>

        {model.pastEvents.length ? (
          <section className={styles.historySection}>
            <div className="emc-container">
              <details className={styles.historyDetails}>
                <summary>
                  <span>Ver {model.pastEvents.length} eventos ya celebrados</span>
                  <span aria-hidden="true">+</span>
                </summary>
                <div className={styles.historyList}>
                  {model.pastEvents.slice(0, 12).map((event) => (
                    <Link href={`/evento/${event.slug || event.id}`} key={eventKey(event)}>
                      <strong>{event.title}</strong>
                      <span>{event.start} · {event.city}, {event.province}</span>
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          </section>
        ) : null}

        <section className={styles.organizerSection}>
          <div className={`emc-container ${styles.organizerCard}`}>
            <div>
              <span className={styles.eyebrow}>Para organizadores</span>
              <h2>¿Organizas un evento en {model.config.name}?</h2>
              <p>Añádelo gratis para que los aficionados lo encuentren en la agenda.</p>
            </div>
            <TrackLink
              className="emc-btn emc-btn-primary"
              eventName="click_publish_event"
              eventParams={{ source: `regional_preview_${model.config.id}_organizer` }}
              href={PUBLIC_NAVIGATION.publish}
            >
              Publicar un evento
            </TrackLink>
          </div>
        </section>

        <section className={styles.linksSection}>
          <div className="emc-container">
            <span className={styles.eyebrow}>Sigue explorando</span>
            <div className={styles.relatedLinks}>
              {model.config.relatedLinks.map((link) => (
                <Link href={link.href} key={link.href}>{link.label}</Link>
              ))}
              <Link href={model.config.publicPath}>Página pública actual</Link>
            </div>
          </div>
        </section>
      </main>

      <ConceptFooter variant="compact" />
    </div>
  );
}
