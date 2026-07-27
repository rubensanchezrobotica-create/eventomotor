import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import type { EventItem } from "@/types/event";
import RegionalEventCard from "./RegionalEventCard";
import RegionalFilterDisclosure from "./RegionalFilterDisclosure";
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

function EventFinder({
  filteredTotal,
  model,
  pathname,
  query,
}: RegionalLandingPreviewProps & { filteredTotal: number }) {
  const isFull = model.finderMode === "full";
  const showSearch = isFull;
  const showProvince = model.provinceCounts.length > 1;
  const showDiscipline = model.disciplineCounts.length > 1;
  const showVehicle = model.vehicleCounts.length > 1;
  const showNextThirtyDays = model.nextThirtyDaysEvents.length > 0
    && model.nextThirtyDaysEvents.length !== model.upcomingTotal;
  const activePeriodLabel = query.when === "weekend"
    ? "Fin de semana"
    : query.when === "next30"
      ? "Próximos 30 días"
      : undefined;

  return (
    <div id="encuentra-evento">
      <RegionalFilterDisclosure
        activePeriodLabel={activePeriodLabel}
        totalLabel={`${countLabel(filteredTotal)} ${filteredTotal === 1 ? "ordenado" : "ordenados"} por fecha`}
      >
        <form
          action={`${pathname}#eventos`}
          aria-label="Filtrar eventos"
          className={styles.finderPanel}
          method="get"
        >
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
            <label className={styles.finderField}>
              <span>Cuándo</span>
              <select defaultValue={query.when} name="when">
                <option value="upcoming">Próximos</option>
                {model.weekendEvents.length > 0 ? (
                  <option value="weekend">Fin de semana</option>
                ) : null}
                {showNextThirtyDays ? (
                  <option value="next30">Próximos 30 días</option>
                ) : null}
              </select>
            </label>
            <button className="emc-btn emc-btn-primary" type="submit">
              Aplicar filtros
            </button>
          </div>

          <div className={styles.filterFooter}>
            {(isFull && (showDiscipline || showVehicle)) || (!isFull && showVehicle) ? (
              <details className={styles.moreFilters}>
                <summary>Más filtros <span aria-hidden="true">+</span></summary>
                <div className={styles.moreFiltersGrid}>
                  {isFull && showDiscipline ? (
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
            ) : <span />}
            <Link className={styles.resetFilters} href={`${pathname}#eventos`}>
              Restablecer
            </Link>
          </div>
        </form>
      </RegionalFilterDisclosure>
    </div>
  );
}

function RegionalEmptyState({
  model,
}: Pick<RegionalLandingPreviewProps, "model">) {
  return (
    <section className={styles.emptyStateSection} id="eventos">
      <div className="emc-container">
        <div className={styles.emptyStateContent}>
          <span className={styles.eyebrow}>Agenda en actualización</span>
          <h2>Agenda de {model.config.name} en actualización</h2>
          <p>
            Ahora mismo no hay próximas fechas confirmadas. Actualizamos la agenda cuando organizadores, clubes y circuitos publican nuevos eventos.
          </p>
          <div className={styles.emptyStateActions}>
            <Link className={styles.emptyPrimaryLink} href={PUBLIC_NAVIGATION.publish}>
              Publicar un evento en {model.config.name}
            </Link>
            <Link className={styles.emptySecondaryLink} href={PUBLIC_NAVIGATION.calendar}>
              Ver calendario nacional
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function RegionalHistory({
  model,
}: Pick<RegionalLandingPreviewProps, "model">) {
  if (!model.pastEvents.length) return null;

  return (
    <section className={styles.historySection}>
      <div className="emc-container">
        <details className={styles.historyDetails}>
          <summary>
            <span>
              <small>Archivo regional</small>
              Ver {model.pastEvents.length} {model.pastEvents.length === 1 ? "evento celebrado" : "eventos celebrados"} en {model.config.name}
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
    <div
      className={`emc-page ${styles.page}`}
      data-inventory={model.finderMode}
      data-region={model.config.id}
    >
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <section className={styles.hero}>
          <div className={`emc-container ${styles.heroInner}`}>
            <nav aria-label="Migas de pan" className={styles.breadcrumb}>
              <ol>
                <li><Link href="/">Inicio</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/zonas">Zonas</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{model.config.name}</li>
              </ol>
            </nav>
            <span className={styles.eyebrow}>{model.config.eyebrow}</span>
            <h1>{model.config.h1}</h1>
            <p className={styles.heroDescription}>{model.config.description}</p>
          </div>
        </section>

        {model.upcomingTotal === 0 ? <RegionalEmptyState model={model} /> : null}

        {model.upcomingTotal > 0 ? (
          <section
            className={`${styles.eventsSection} ${model.upcomingTotal <= 2 ? styles.sparseEventsSection : ""}`}
            id="eventos"
          >
            <div className={`emc-container ${
              model.upcomingTotal === 1
                ? styles.singleEventContainer
                : model.upcomingTotal === 2
                  ? styles.twoEventContainer
                  : ""
            }`}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>
                    {model.upcomingTotal === 1
                      ? `Próximo evento en ${model.config.name}`
                      : `Próximos eventos en ${model.config.name}`}
                  </h2>
                  {model.finderMode === "hidden" && model.upcomingTotal > 1 ? (
                    <p>{countLabel(filteredEvents.length)} ordenados por fecha</p>
                  ) : null}
                </div>
                {hasActiveFilters ? (
                  <Link className={styles.clearLink} href={`${pathname}#eventos`}>
                    Quitar filtros
                  </Link>
                ) : null}
              </div>
              {model.finderMode === "full" || model.finderMode === "compact" ? (
                <EventFinder
                  filteredTotal={filteredEvents.length}
                  model={model}
                  pathname={pathname}
                  query={query}
                />
              ) : null}
              {filteredEvents.length > 0 ? (
                <>
                  <div className={`${styles.eventGrid} ${model.upcomingTotal === 1 ? styles.singleEventGrid : ""}`}>
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
              )}
            </div>
          </section>
        ) : null}

        {model.upcomingTotal === 0 ? <RegionalHistory model={model} /> : null}

        <section className={styles.editorialSection}>
          <div className={`emc-container ${styles.editorialCard}`}>
            <article>
              <span className={styles.eyebrow}>Guía regional</span>
              <h2>Guía de motor en {model.config.name}</h2>
              <p className={styles.guideIntroduction}>
                Provincias, disciplinas, circuitos y recursos para descubrir la agenda de motor de la región.
              </p>
              <div className={styles.guideGroups}>
                {model.provinceCounts.length > 0 ? (
                  <details className={styles.guideGroup}>
                    <summary>Provincias<span aria-hidden="true">+</span></summary>
                    <div className={styles.guideLinkList}>
                      {model.provinceCounts.map((item) => (
                        <Link href={queryHref(pathname, { province: item.key })} key={item.key}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : null}
                {model.disciplineCounts.length > 0 ? (
                  <details className={styles.guideGroup}>
                    <summary>Disciplinas<span aria-hidden="true">+</span></summary>
                    <div className={styles.guideLinkList}>
                      {model.disciplineCounts.slice(0, 8).map((item) => (
                        <Link href={queryHref(pathname, { discipline: item.key })} key={item.key}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : null}
                {venueHighlights.length > 0 ? (
                  <details className={styles.guideGroup}>
                    <summary>Recintos<span aria-hidden="true">+</span></summary>
                    <div className={styles.guideLinkList}>
                      {venueHighlights.map((venue) => (
                        <Link href={`/evento/${eventKey(venue.event)}`} key={venue.label}>
                          {venue.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
              <nav aria-label={`Recursos de ${model.config.name}`} className={styles.guideResources}>
                {model.config.relatedLinks.map((link) => (
                  <Link href={link.href} key={link.href}>{link.label}</Link>
                ))}
                <Link href={model.config.publicPath}>Página pública actual</Link>
              </nav>
              <details className={styles.seoDetails}>
                <summary>Información sobre la agenda regional<span aria-hidden="true">+</span></summary>
                <div>
                  {model.config.seoParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </details>
            </article>
            <aside className={styles.faq} aria-label="Preguntas frecuentes">
              <h3 className={styles.faqLabel}>Preguntas frecuentes</h3>
              {model.config.faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}<span aria-hidden="true">+</span></summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </aside>
          </div>
        </section>

        {model.upcomingTotal > 0 ? <RegionalHistory model={model} /> : null}

        {model.upcomingTotal > 0 ? (
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
        ) : null}

      </main>

      <ConceptFooter variant="compact" />
    </div>
  );
}
