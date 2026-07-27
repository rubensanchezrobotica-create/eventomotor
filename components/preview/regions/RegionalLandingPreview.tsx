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
  normalizeRegionalText,
  REGIONAL_DESKTOP_LIMIT,
  REGIONAL_MOBILE_LIMIT,
  type RegionalLandingModel,
  type RegionalLandingQuery,
} from "./regional-landing-model";
import styles from "./RegionalLandingPreview.module.css";

type RegionalLandingPreviewProps = {
  model: RegionalLandingModel;
  pathname: string;
  query: RegionalLandingQuery;
};

type QueryValues = {
  discipline?: string;
  province?: string;
  q?: string;
  show?: string;
  vehicle?: string;
  when?: RegionalLandingQuery["when"];
};

function queryHref(
  pathname: string,
  values: QueryValues,
  anchor = "eventos",
) {
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

function upcomingCountLabel(count: number) {
  return count === 1 ? "1 próximo evento" : `${count} próximos eventos`;
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

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: "discipline" | "province" | "vehicle";
  options: RegionalLandingModel["provinceCounts"];
  value: string;
}) {
  return (
    <label className={styles.finderField}>
      <span>{label}</span>
      <select defaultValue={value} name={name}>
        <option value="">Todas</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function FinderPeriodChips({
  model,
  pathname,
  query,
}: RegionalLandingPreviewProps) {
  const preserved = {
    discipline: query.discipline,
    province: query.province,
    q: query.query,
    vehicle: query.vehicle,
  };

  return (
    <nav aria-label="Periodo" className={styles.periodChips}>
      <Link
        aria-current={query.when === "upcoming" ? "page" : undefined}
        href={queryHref(pathname, { ...preserved, when: "upcoming" }, "encuentra-evento")}
      >
        Próximos <strong>{model.upcomingTotal}</strong>
      </Link>
      {model.weekendEvents.length > 0 ? (
        <Link
          aria-current={query.when === "weekend" ? "page" : undefined}
          href={queryHref(pathname, { ...preserved, when: "weekend" }, "encuentra-evento")}
        >
          Fin de semana <strong>{model.weekendEvents.length}</strong>
        </Link>
      ) : null}
      {model.nextThirtyDaysEvents.length > 0
      && model.nextThirtyDaysEvents.length !== model.upcomingTotal ? (
        <Link
          aria-current={query.when === "next30" ? "page" : undefined}
          href={queryHref(pathname, { ...preserved, when: "next30" }, "encuentra-evento")}
        >
          Próximos 30 días <strong>{model.nextThirtyDaysEvents.length}</strong>
        </Link>
        ) : null}
    </nav>
  );
}

function EventFinder({
  filteredTotal,
  model,
  pathname,
  query,
}: RegionalLandingPreviewProps & { filteredTotal: number }) {
  const isFull = model.finderMode === "full";
  const showSearch = isFull || model.upcomingTotal >= 6;
  const showProvince = model.provinceCounts.length > 1;
  const showDiscipline = model.disciplineCounts.length > 1;
  const showVehicle = model.vehicleCounts.length > 1;

  return (
    <section
      aria-labelledby="regional-finder-title"
      className={styles.finderSection}
      id="encuentra-evento"
    >
      <div className="emc-container">
        <form action={`${pathname}#eventos`} className={styles.finderPanel} method="get">
          <div className={styles.finderHeading}>
            <div>
              <span className={styles.eyebrow}>Agenda a tu medida</span>
              <h2 id="regional-finder-title">Encuentra un evento</h2>
            </div>
            <FinderPeriodChips model={model} pathname={pathname} query={query} />
          </div>

          <div className={styles.finderControls}>
            {showSearch ? (
              <label className={`${styles.finderField} ${styles.searchField}`}>
                <span>Buscar</span>
                <input
                  defaultValue={query.query}
                  name="q"
                  placeholder="Evento, circuito, ciudad…"
                  type="search"
                />
              </label>
            ) : null}
            {showProvince ? (
              <FilterSelect
                label="Provincia"
                name="province"
                options={model.provinceCounts}
                value={query.province}
              />
            ) : null}
            {!isFull && showDiscipline ? (
              <FilterSelect
                label="Disciplina"
                name="discipline"
                options={model.disciplineCounts}
                value={query.discipline}
              />
            ) : null}
            <input name="when" type="hidden" value={query.when} />
            <button className="emc-btn emc-btn-primary" type="submit">
              Ver {countLabel(filteredTotal)}
            </button>
          </div>

          {isFull && (showDiscipline || showVehicle) ? (
            <details className={styles.moreFilters}>
              <summary>Más filtros <span aria-hidden="true">+</span></summary>
              <div className={styles.moreFiltersGrid}>
                {showDiscipline ? (
                  <FilterSelect
                    label="Disciplina"
                    name="discipline"
                    options={model.disciplineCounts}
                    value={query.discipline}
                  />
                ) : null}
                {showVehicle ? (
                  <FilterSelect
                    label="Vehículo"
                    name="vehicle"
                    options={model.vehicleCounts}
                    value={query.vehicle}
                  />
                ) : null}
              </div>
            </details>
          ) : null}
        </form>
      </div>
    </section>
  );
}

export default function RegionalLandingPreview({
  model,
  pathname,
  query,
}: RegionalLandingPreviewProps) {
  const filteredEvents = filterRegionalLandingEvents(model, query);
  const visibleEvents = query.showAll
    ? filteredEvents
    : filteredEvents.slice(0, REGIONAL_DESKTOP_LIMIT);
  const venueHighlights = buildVenueHighlights(model.upcomingEvents);
  const hasRealExploreChoice = model.provinceCounts.length > 1
    || model.disciplineCounts.length > 1
    || venueHighlights.length > 1;
  const hasActiveFilters = Boolean(
    query.discipline
    || query.province
    || query.query
    || query.vehicle
    || query.when !== "upcoming",
  );
  const preservedFilters = {
    discipline: query.discipline,
    province: query.province,
    q: query.query,
    vehicle: query.vehicle,
    when: query.when,
  };

  return (
    <div className={`emc-page ${styles.page}`} data-region={model.config.id}>
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <section className={styles.hero}>
          <div className={`emc-container ${styles.heroInner}`}>
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
            {model.upcomingTotal > 0 ? (
              <strong className={styles.inventoryPill}>
                <span aria-hidden="true" />
                {upcomingCountLabel(model.upcomingTotal)}
              </strong>
            ) : null}
          </div>
        </section>

        {model.finderMode === "full" || model.finderMode === "compact" ? (
          <EventFinder
            filteredTotal={filteredEvents.length}
            model={model}
            pathname={pathname}
            query={query}
          />
        ) : null}

        <section className={styles.eventsSection} id="eventos">
          <div className="emc-container">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>Agenda regional</span>
                <h2>Próximos eventos en {model.config.name}</h2>
                {model.upcomingTotal > 0 ? (
                  <p>{countLabel(filteredEvents.length)} · Ordenados por fecha</p>
                ) : null}
              </div>
              {hasActiveFilters ? (
                <Link className={styles.clearLink} href={`${pathname}#eventos`}>
                  Quitar filtros
                </Link>
              ) : null}
            </div>

            {model.upcomingTotal > 0 ? (
              filteredEvents.length > 0 ? (
                <>
                  <div className={styles.eventGrid}>
                    {visibleEvents.map((event, index) => (
                      <RegionalEventCard
                        event={event}
                        hideOnMobileInitially={!query.showAll && index >= REGIONAL_MOBILE_LIMIT}
                        key={eventKey(event)}
                        source={`regional_preview_${model.config.id}`}
                      />
                    ))}
                  </div>
                  {!query.showAll && filteredEvents.length > REGIONAL_MOBILE_LIMIT ? (
                    <div className={styles.moreRow}>
                      <Link
                        className={`${styles.showAllButton} ${styles.showAllMobile} emc-btn emc-btn-dark`}
                        href={queryHref(pathname, { ...preservedFilters, show: "all" })}
                      >
                        Ver todos los {filteredEvents.length} eventos
                      </Link>
                      {filteredEvents.length > REGIONAL_DESKTOP_LIMIT ? (
                        <Link
                          className={`${styles.showAllButton} ${styles.showAllDesktop} emc-btn emc-btn-dark`}
                          href={queryHref(pathname, { ...preservedFilters, show: "all" })}
                        >
                          Ver todos los {filteredEvents.length} eventos
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.noResults}>
                  <strong>No hay eventos que coincidan con estos filtros.</strong>
                  <Link href={`${pathname}#eventos`}>Ver la agenda regional completa</Link>
                </div>
              )
            ) : (
              <div className={styles.emptyNote}>
                <div>
                  <strong>Aún no hay próximos eventos confirmados en {model.config.name}.</strong>
                  <p>Mientras se incorporan nuevas fechas, puedes consultar alternativas reales en la agenda nacional.</p>
                </div>
                <div className={styles.emptyActions}>
                  <Link href={PUBLIC_NAVIGATION.calendar}>Ver agenda nacional</Link>
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
                  <span className={styles.eyebrow}>Alternativas reales</span>
                  <h2>Planes próximos en España</h2>
                  <p>Selección nacional ordenada por fecha.</p>
                </div>
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
                  <span className={styles.eyebrow}>Exploración regional</span>
                  <h2>Explora eventos en {model.config.name}</h2>
                </div>
              </div>
              <div className={styles.exploreSurface}>
                {model.provinceCounts.length > 1 ? (
                  <div className={styles.exploreGroup}>
                    <h3>Por provincia</h3>
                    <div className={styles.exploreGrid}>
                      {model.provinceCounts.map((item) => (
                        <Link
                          href={queryHref(pathname, { province: item.key })}
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
                          href={queryHref(pathname, { discipline: item.key })}
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
          <div className={`emc-container ${styles.editorialCard}`}>
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
