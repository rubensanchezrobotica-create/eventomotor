import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import PublicListingFinder from "@/components/public/listing/PublicListingFinder";
import RegionalEventCard from "@/components/regions/RegionalEventCard";
import RegionalTrackedDetails from "@/components/regions/RegionalTrackedDetails";
import MotorcycleConcentrationsAnalytics from "@/components/concentrations/MotorcycleConcentrationsAnalytics";
import {
  filterMotorcycleConcentrations,
  MOTORCYCLE_DESKTOP_LIMIT,
  MOTORCYCLE_MOBILE_LIMIT,
  motorcycleTemporalStatus,
  type MotorcycleConcentrationsModel,
  type MotorcycleLandingQuery,
} from "@/lib/concentrations/motorcycle-concentrations-model";
import type { OpportunityPage } from "@/lib/opportunity-pages";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import type { EventItem } from "@/types/event";
import styles from "@/components/regions/RegionalLanding.module.css";

type MotorcycleConcentrationsLandingProps = {
  model: MotorcycleConcentrationsModel;
  page: OpportunityPage;
  pathname: string;
  query: MotorcycleLandingQuery;
};

type QueryValues = {
  archive?: string;
  month?: string;
  province?: string;
  q?: string;
  show?: string;
  when?: MotorcycleLandingQuery["when"];
};

function queryHref(pathname: string, values: QueryValues, anchor = "eventos") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (!value || (key === "when" && value === "upcoming")) continue;
    params.set(key, value);
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

function activePeriodLabel(
  model: MotorcycleConcentrationsModel,
  query: MotorcycleLandingQuery,
) {
  if (query.when === "weekend") return "Fin de semana";
  if (query.when === "next30") return "Próximos 30 días";
  if (query.month) return model.monthCounts.find((item) => item.month === query.month)?.label;
  return undefined;
}

export default function MotorcycleConcentrationsLanding({
  model,
  page,
  pathname,
  query,
}: MotorcycleConcentrationsLandingProps) {
  const filteredEvents = filterMotorcycleConcentrations(model, query);
  const visibleEvents = query.showAll
    ? filteredEvents
    : filteredEvents.slice(0, MOTORCYCLE_DESKTOP_LIMIT);
  const hasActiveFilters = Boolean(
    query.month || query.province || query.query || query.when !== "upcoming",
  );
  const preservedFilters = {
    month: query.month,
    province: query.province,
    q: query.query,
    when: query.when,
  };
  const archiveEvents = query.archiveAll ? model.pastEvents : model.pastEvents.slice(0, 12);

  return (
    <div className={`emc-page ${styles.page}`} data-listing="concentraciones-moteras-2026">
      <ConceptStyles />
      <MotorcycleConcentrationsAnalytics />
      <ConceptStaticHeader />

      <main>
        <section className={styles.hero}>
          <div className={`emc-container ${styles.heroInner} ${styles.motorcycleHeroInner}`}>
            <nav aria-label="Migas de pan" className={styles.breadcrumb}>
              <ol>
                <li><Link href="/">Inicio</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{page.h1}</li>
              </ol>
            </nav>
            <span className={styles.eyebrow}>{page.eyebrow}</span>
            <h1>{page.h1}</h1>
            <p className={styles.heroDescription}>{page.lead}</p>
            <dl aria-label="Resumen del calendario" className={styles.heroMetrics}>
              <div>
                <dt>Próximas</dt>
                <dd>{model.upcomingTotal}</dd>
              </div>
              <div>
                <dt>Provincias</dt>
                <dd>{model.provinceCounts.length}</dd>
              </div>
              <div>
                <dt>Este fin de semana</dt>
                <dd>{model.weekendEvents.length}</dd>
              </div>
            </dl>
          </div>
        </section>

        {model.upcomingTotal > 0 ? (
          <section aria-labelledby="accesos-rapidos" className={styles.quickSection}>
            <div className="emc-container">
              <div className={styles.quickHeading}>
                <div>
                  <span className={styles.eyebrow}>Acceso rápido</span>
                  <h2 id="accesos-rapidos">Elige cuándo salir</h2>
                </div>
                <Link href="/concentraciones-moteras-este-fin-de-semana">
                  Este fin de semana · {model.weekendEvents.length}
                </Link>
              </div>
              {model.monthCounts.length > 0 ? (
                <nav aria-label="Concentraciones por mes" className={styles.quickLinks}>
                  {model.monthCounts.map((month) => (
                    <Link href={queryHref(pathname, { month: month.month })} key={month.month}>
                      {month.label} <span>{month.count}</span>
                    </Link>
                  ))}
                </nav>
              ) : null}
            </div>
          </section>
        ) : null}

        {model.upcomingTotal > 0 ? (
          <section className={styles.eventsSection} id="eventos">
            <div className="emc-container">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.eyebrow}>Calendario 2026</span>
                  <h2>Próximas concentraciones moteras 2026</h2>
                  <p>{countLabel(filteredEvents.length)} ordenados por fecha</p>
                </div>
                {hasActiveFilters ? (
                  <TrackLink
                    className={styles.clearLink}
                    eventName="filter_motorcycle_concentrations"
                    eventParams={{ action: "reset", source: "concentraciones_moteras_heading" }}
                    href={`${pathname}#eventos`}
                  >
                    Quitar filtros
                  </TrackLink>
                ) : null}
              </div>

              <PublicListingFinder
                activePeriodLabel={activePeriodLabel(model, query)}
                analyticsEventName="filter_motorcycle_concentrations"
                analyticsSource="concentraciones_moteras_2026"
                nextThirtyDaysAvailable={model.nextThirtyDaysEvents.length > 0
                  && model.nextThirtyDaysEvents.length !== model.upcomingTotal}
                pathname={pathname}
                provinceCounts={model.provinceCounts}
                query={query}
                region="concentraciones-moteras-2026"
                searchPlaceholder="Evento, ciudad o provincia…"
                showSearch
                toggleEventName="toggle_motorcycle_concentrations_filters"
                totalLabel={countLabel(filteredEvents.length)}
                weekendAvailable={model.weekendEvents.length > 0}
              />

              {filteredEvents.length > 0 ? (
                <>
                  <div className={styles.eventGrid}>
                    {visibleEvents.map((event, index) => (
                      <RegionalEventCard
                        event={event}
                        hideOnMobileInitially={!query.showAll && index >= MOTORCYCLE_MOBILE_LIMIT}
                        key={eventKey(event)}
                        source="concentraciones_moteras_2026"
                        status={motorcycleTemporalStatus(event, model.today) === "ongoing" ? "ongoing" : undefined}
                      />
                    ))}
                  </div>
                  {!query.showAll && filteredEvents.length > MOTORCYCLE_MOBILE_LIMIT ? (
                    <div className={`${styles.moreRow} ${
                      filteredEvents.length <= MOTORCYCLE_DESKTOP_LIMIT
                        ? styles.moreRowDesktopComplete
                        : ""
                    }`}>
                      <Link
                        className={`${styles.showAllButton} emc-btn emc-btn-dark`}
                        href={queryHref(pathname, { ...preservedFilters, show: "all" })}
                      >
                        Ver los {filteredEvents.length} eventos
                      </Link>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.noResults}>
                  <strong>No hay concentraciones que coincidan con estos filtros.</strong>
                  <Link href={`${pathname}#eventos`}>Restablecer filtros</Link>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className={styles.emptyStateSection} id="eventos">
            <div className="emc-container">
              <div className={styles.emptyStateContent}>
                <span className={styles.eyebrow}>Agenda en actualización</span>
                <h2>Estamos actualizando las próximas concentraciones moteras</h2>
                <p>Consulta el calendario nacional o publica una cita con fecha, ubicación y fuente oficial.</p>
                <div className={styles.emptyStateActions}>
                  <Link className={styles.emptyPrimaryLink} href={PUBLIC_NAVIGATION.publish}>Publicar evento</Link>
                  <Link className={styles.emptySecondaryLink} href={PUBLIC_NAVIGATION.calendar}>Ver calendario nacional</Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {model.pastEvents.length > 0 ? (
          <section className={styles.historySection} id="archivo">
            <div className="emc-container">
              <RegionalTrackedDetails
                className={styles.historyDetails}
                eventName="open_motorcycle_concentrations_archive"
                open={query.archiveAll || undefined}
                region="concentraciones-moteras-2026"
              >
                <summary>
                  <span>
                    <small>Archivo 2026</small>
                    Ver {model.pastEvents.length} {model.pastEvents.length === 1 ? "evento celebrado" : "eventos celebrados"}
                  </span>
                  <span aria-hidden="true">+</span>
                </summary>
                <div className={styles.historyList}>
                  {archiveEvents.map((event) => (
                    <Link href={`/evento/${eventKey(event)}`} key={eventKey(event)}>
                      <strong>{event.title}</strong>
                      <span>{event.start} · {event.city}, {event.province}</span>
                    </Link>
                  ))}
                  {!query.archiveAll && model.pastEvents.length > archiveEvents.length ? (
                    <Link href={queryHref(pathname, { archive: "all" }, "archivo")}>
                      <strong>Ver archivo completo</strong>
                      <span>{model.pastEvents.length - archiveEvents.length} eventos más</span>
                    </Link>
                  ) : null}
                </div>
              </RegionalTrackedDetails>
            </div>
          </section>
        ) : null}

        <section className={styles.editorialSection}>
          <div className={`emc-container ${styles.editorialCard}`}>
            <article>
              <span className={styles.eyebrow}>Guía motera 2026</span>
              <h2>Cómo encontrar una concentración motera</h2>
              <p className={styles.guideIntroduction}>{page.intro}</p>
              <div className={styles.guideGroups}>
                {model.territories.length > 0 ? (
                  <details className={styles.guideGroup}>
                    <summary>Zonas con eventos<span aria-hidden="true">+</span></summary>
                    <div className={styles.guideLinkList}>
                      {model.territories.map((territory) => (
                        <Link href={territory.href} key={territory.id}>
                          {territory.label} ({territory.count})
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : null}
                {model.provinceCounts.length > 0 ? (
                  <details className={styles.guideGroup}>
                    <summary>Provincias<span aria-hidden="true">+</span></summary>
                    <div className={styles.guideLinkList}>
                      {model.provinceCounts.map((province) => (
                        <Link href={queryHref(pathname, { province: province.key })} key={province.key}>
                          {province.label} ({province.count})
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : null}
                <details className={styles.guideGroup}>
                  <summary>Cómo usar el calendario<span aria-hidden="true">+</span></summary>
                  <div className={styles.guideTextList}>
                    {page.usageSteps.map((step) => (
                      <p key={step.title}><strong>{step.title}.</strong> {step.text}</p>
                    ))}
                  </div>
                </details>
              </div>
              <nav aria-label="Recursos moteros" className={styles.guideResources}>
                {page.relatedLinks.map((link) => (
                  <Link href={link.href} key={link.href}>{link.label}</Link>
                ))}
              </nav>
              <details className={styles.seoDetails}>
                <summary>Información sobre el calendario motero<span aria-hidden="true">+</span></summary>
                <div>
                  {page.editorialBlocks.map((block) => (
                    <p key={block.title}><strong>{block.title}.</strong> {block.text}</p>
                  ))}
                </div>
              </details>
            </article>
            <aside aria-label="Preguntas frecuentes" className={styles.faq}>
              <h3 className={styles.faqLabel}>Preguntas frecuentes</h3>
              {page.faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}<span aria-hidden="true">+</span></summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </aside>
          </div>
        </section>

        <section className={styles.organizerSection}>
          <div className={`emc-container ${styles.organizerCard}`}>
            <div>
              <span className={styles.eyebrow}>Para organizadores</span>
              <h2>¿Organizas una concentración motera? Publica tu evento en EventoMotor.</h2>
              <p>Añade fecha, ubicación y fuente oficial para que otros motoristas puedan encontrarla.</p>
            </div>
            <TrackLink
              className="emc-btn emc-btn-primary"
              eventName="click_publish_event"
              eventParams={{ source: "concentraciones_moteras_2026_organizer" }}
              href={PUBLIC_NAVIGATION.publish}
            >
              Publicar evento
            </TrackLink>
          </div>
        </section>
      </main>

      <ConceptFooter variant="compact" />
    </div>
  );
}
