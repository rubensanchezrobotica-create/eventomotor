import Image from "next/image";
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
  normalizeRegionalText,
  regionalNextEventLongLabel,
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
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ""}#${anchor}`;
}

function eventKey(event: EventItem) {
  return event.slug || event.id;
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? "evento" : "eventos"}`;
}

function upcomingCountLabel(count: number) {
  return count === 1 ? "1 próximo evento" : `${count} próximos eventos`;
}

function orderedCountLabel(count: number) {
  return count === 1 ? "1 evento ordenado por fecha" : `${count} eventos ordenados por fecha`;
}

function buildVenueHighlights(events: EventItem[]) {
  const venues = new Map<string, { count: number; event: EventItem; label: string }>();

  for (const event of events) {
    const label = event.venue?.trim();
    const key = normalizeRegionalText(label);
    if (!label || !key || key === "por confirmar") continue;
    const current = venues.get(key);
    venues.set(key, {
      count: (current?.count || 0) + 1,
      event: current?.event || event,
      label: current?.label || label,
    });
  }

  return [...venues.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"))
    .slice(0, 4);
}

export default function RegionalLandingPreview({
  model,
  pathname,
  query,
}: RegionalLandingPreviewProps) {
  const filteredEvents = filterRegionalLandingEvents(model, query);
  const visibleEvents = filteredEvents.slice(0, query.show);
  const hasMore = filteredEvents.length > visibleEvents.length;
  const nextEvent = model.upcomingEvents[0];
  const firstWeekendKey = model.weekendEvents[0] ? eventKey(model.weekendEvents[0]) : "";
  const venueHighlights = buildVenueHighlights(model.upcomingEvents);
  const hasRealExploreChoice = model.provinceCounts.length > 1
    || model.disciplineCounts.length > 1
    || venueHighlights.length > 1;
  const hasFilterChoices = model.provinceCounts.length > 1 || model.disciplineCounts.length > 1;
  const activeView = query.weekendOnly
    ? "fin-de-semana"
    : query.thirtyDaysOnly
      ? "30-dias"
      : "";
  const activeLabel = query.weekendOnly
    ? "este fin de semana"
    : query.thirtyDaysOnly
      ? "los próximos 30 días"
      : query.province
        ? model.provinceCounts.find((item) => item.key === query.province)?.label
        : query.discipline
          ? model.disciplineCounts.find((item) => item.key === query.discipline)?.label
          : "";

  return (
    <div className={`emc-page ${styles.page}`} data-region={model.config.id}>
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <section className={`${styles.hero} ${nextEvent ? "" : styles.heroEmpty}`}>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.heroBackdrop}
            fill
            priority
            sizes="100vw"
            src={model.config.heroAsset}
          />
          <span className={styles.heroShade} aria-hidden="true" />
          <div className={`emc-container ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
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
                  <div className={styles.heroSignals}>
                    <strong className={styles.inventoryPill}>
                      <span aria-hidden="true" className={styles.liveDot} />
                      {upcomingCountLabel(model.upcomingTotal)}
                    </strong>
                    <span className={styles.coverage}>
                      <span aria-hidden="true">⌖</span>
                      {model.config.coverage}
                    </span>
                  </div>
                  <div className={styles.heroActions}>
                    <a className="emc-btn emc-btn-primary" href="#eventos">
                      Explorar próximos eventos
                    </a>
                    {model.weekendEvents.length ? (
                      <Link
                        className={styles.secondaryAction}
                        href={queryHref(pathname, { vista: "fin-de-semana" })}
                      >
                        Ver este fin de semana
                      </Link>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className={styles.coverage}>
                  <span aria-hidden="true">⌖</span>
                  {model.config.coverage}
                </p>
              )}
            </div>

            {nextEvent ? (
              <aside className={styles.heroEvent} aria-label="Próximo evento de la región">
                <span className={styles.heroEventLabel}>
                  <span aria-hidden="true">↗</span>
                  Próxima cita en {model.config.name}
                </span>
                <RegionalEventCard
                  event={nextEvent}
                  priority
                  source={`regional_preview_${model.config.id}_hero`}
                  variant="hero"
                />
              </aside>
            ) : null}
          </div>
        </section>

        {model.upcomingTotal && model.weekendEvents.length ? (
          <section className={styles.weekendStrip} aria-label="Resumen del fin de semana">
            <div className={`emc-container ${styles.weekendInner}`}>
              <div className={styles.weekendLead}>
                <span className={styles.weekendIcon} aria-hidden="true">◷</span>
                <p>
                  <span>Agenda inmediata</span>
                  <strong>{model.weekendEvents.length} {model.weekendEvents.length === 1 ? "plan" : "planes"} este fin de semana</strong>
                </p>
              </div>
              <div className={styles.weekendMiniEvents}>
                {model.weekendEvents.slice(0, 2).map((event) => (
                  <Link href={`/evento/${eventKey(event)}`} key={eventKey(event)}>
                    <strong>{event.title}</strong>
                    <span>{event.city}, {event.province}</span>
                  </Link>
                ))}
              </div>
              <Link
                className={styles.weekendAction}
                href={queryHref(pathname, { vista: "fin-de-semana" })}
              >
                Ver planes
              </Link>
            </div>
          </section>
        ) : model.upcomingTotal ? (
          <section className={`${styles.weekendStrip} ${styles.weekendStripQuiet}`} aria-label="Resumen del fin de semana">
            <div className={`emc-container ${styles.weekendQuietInner}`}>
              <span className={styles.weekendIcon} aria-hidden="true">◷</span>
              <p>
                <strong>Tu próxima cita en {model.config.name} es el {regionalNextEventLongLabel(nextEvent)}</strong>
                <span>Todavía no hay eventos publicados para este fin de semana.</span>
              </p>
            </div>
          </section>
        ) : null}

        {model.upcomingTotal ? (
          <section className={styles.filterRail} aria-label="Vistas rápidas de la agenda">
            <div className={`emc-container ${styles.filterInner}`}>
              <nav className={styles.periodChips} aria-label="Periodo">
                <Link
                  aria-current={!activeView ? "page" : undefined}
                  href={queryHref(pathname, {})}
                >
                  Próximos
                </Link>
                {model.weekendEvents.length ? (
                  <Link
                    aria-current={query.weekendOnly ? "page" : undefined}
                    href={queryHref(pathname, { vista: "fin-de-semana" })}
                  >
                    Este fin de semana
                  </Link>
                ) : null}
                {model.nextThirtyDaysEvents.length ? (
                  <Link
                    aria-current={query.thirtyDaysOnly ? "page" : undefined}
                    href={queryHref(pathname, { vista: "30-dias" })}
                  >
                    Próximos 30 días
                  </Link>
                ) : null}
              </nav>

              {hasFilterChoices ? (
                <details className={styles.filterDetails}>
                  <summary>Filtrar <span aria-hidden="true">⌄</span></summary>
                  <div className={styles.filterPopover}>
                    {model.provinceCounts.length > 1 ? (
                      <div>
                        <strong>Provincia</strong>
                        <div>
                          {model.provinceCounts.map((item) => (
                            <Link
                              href={queryHref(pathname, {
                                provincia: item.key,
                                vista: activeView,
                              })}
                              key={item.key}
                            >
                              {item.label} <span>{item.count}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {model.disciplineCounts.length > 1 ? (
                      <div>
                        <strong>Disciplina</strong>
                        <div>
                          {model.disciplineCounts.slice(0, 8).map((item) => (
                            <Link
                              href={queryHref(pathname, {
                                disciplina: item.key,
                                vista: activeView,
                              })}
                              key={item.key}
                            >
                              {item.label} <span>{item.count}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={styles.eventsSection} id="eventos">
          <div className="emc-container">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>Inventario regional</span>
                <h2>
                  {model.upcomingTotal
                    ? activeLabel
                      ? `Eventos en ${activeLabel}`
                      : `Próximos eventos en ${model.config.name}`
                    : `Próximas fechas en ${model.config.name}`}
                </h2>
              </div>
              {activeLabel ? (
                <Link className={styles.clearLink} href={`${pathname}#eventos`}>
                  Ver toda {model.config.name}
                </Link>
              ) : model.upcomingTotal ? (
                <p>{orderedCountLabel(filteredEvents.length)}</p>
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
                        vista: activeView,
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
                <div>
                  <span className={styles.eyebrow}>Agenda en actualización</span>
                  <h3>Todavía no hay nuevos eventos confirmados en {model.config.name}.</h3>
                  <p>
                    Mientras llegan nuevas fechas, puedes descubrir otros planes de motor o publicar una cita para revisión.
                  </p>
                  <div className={styles.emptyActions}>
                    <Link className="emc-btn emc-btn-primary" href={PUBLIC_NAVIGATION.calendar}>
                      Explorar calendario nacional
                    </Link>
                    <Link href={PUBLIC_NAVIGATION.publish}>Publicar un evento</Link>
                  </div>
                </div>
                <div className={styles.emptyTerritory} aria-hidden="true">
                  <span>{model.config.name}</span>
                  <small>Próximamente</small>
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
                  <span className={styles.eyebrow}>Ideas para seguir descubriendo</span>
                  <h2>Planes próximos en España</h2>
                </div>
                <p>Selección nacional separada del inventario de {model.config.name}.</p>
              </div>
              <div className={styles.eventGrid}>
                {model.fallbackNationalEvents.slice(0, 3).map((event) => (
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
                  <span className={styles.eyebrow}>Explora la región</span>
                  <h2>Explora eventos en {model.config.name}</h2>
                </div>
                <p>Accesos creados únicamente con inventario publicado.</p>
              </div>
              <div className={styles.exploreSurface}>
                {model.provinceCounts.length > 1 ? (
                  <div className={styles.exploreGroup}>
                    <h3>Por provincia</h3>
                    <div className={styles.exploreGrid}>
                      {model.provinceCounts.map((item) => (
                        <Link
                          href={queryHref(pathname, { provincia: item.key })}
                          key={item.key}
                        >
                          <strong>{item.label}</strong>
                          <span>{countLabel(item.count)} <i aria-hidden="true">→</i></span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
                {model.disciplineCounts.length > 1 ? (
                  <div className={styles.exploreGroup}>
                    <h3>Por disciplina</h3>
                    <div className={styles.exploreGrid}>
                      {model.disciplineCounts.slice(0, 8).map((item) => (
                        <Link
                          href={queryHref(pathname, { disciplina: item.key })}
                          key={item.key}
                        >
                          <strong>{item.label}</strong>
                          <span>{countLabel(item.count)} <i aria-hidden="true">→</i></span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
                {venueHighlights.length > 1 ? (
                  <div className={styles.exploreGroup}>
                    <h3>Recintos destacados</h3>
                    <div className={styles.venueGrid}>
                      {venueHighlights.map((venue) => (
                        <Link href={`/evento/${eventKey(venue.event)}`} key={venue.label}>
                          <span aria-hidden="true">⌖</span>
                          <strong>{venue.label}</strong>
                          <small>{countLabel(venue.count)}</small>
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
          <div className={`emc-container ${styles.editorialCard}`} data-region={model.config.name}>
            <article>
              <span className={styles.eyebrow}>Guía regional</span>
              <h2>Motor, territorio y próximos planes en {model.config.name}</h2>
              {model.config.seoParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
            <aside className={styles.faq} aria-label="Preguntas frecuentes">
              <span className={styles.faqLabel}>Preguntas frecuentes</span>
              {model.config.faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}<span aria-hidden="true">+</span></summary>
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
                  <span>
                    <small>Archivo regional</small>
                    Ver {model.pastEvents.length} eventos ya celebrados
                  </span>
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
              <h2>Haz visible tu próximo evento en {model.config.name}</h2>
              <p>Publica la fecha, ubicación y fuente oficial para que los aficionados puedan descubrirla.</p>
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
                <Link href={link.href} key={link.href}>{link.label}<span aria-hidden="true">↗</span></Link>
              ))}
              <Link href={model.config.publicPath}>Página pública actual<span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </section>
      </main>

      <ConceptFooter variant="compact" />
    </div>
  );
}
