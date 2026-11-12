import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import MotorcycleConcentrationsAnalytics from "@/components/concentrations/MotorcycleConcentrationsAnalytics";
import EventCard from "@/components/redesign-v2/EventCard";
import { assignV2HomeEventImages } from "@/components/redesign-v2/discipline-fallback-resolver";
import { projectPreviewEvent } from "@/components/redesign-v2/redesign-v2-model";
import { getVehicleType } from "@/lib/event-classification";
import {
  filterMotorcycleConcentrations,
  type MotorcycleConcentrationsModel,
  type MotorcycleLandingQuery,
} from "@/lib/concentrations/motorcycle-concentrations-model";
import type { OpportunityPage } from "@/lib/opportunity-pages";
import type { EventItem } from "@/types/event";
import v2 from "@/components/redesign-v2/zones/TerritoryDetailPage.module.css";
import styles from "./MotorcycleConcentrationsLandingV2.module.css";

type Props = {
  model: MotorcycleConcentrationsModel;
  nowIso: string;
  page: OpportunityPage;
  pathname: string;
  query: MotorcycleLandingQuery;
};

function eventHref(event: EventItem) {
  return `/evento/${event.slug || event.id}`;
}

function queryHref(pathname: string, values: Record<string, string>, anchor = "eventos") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value && !(key === "when" && value === "upcoming")) params.set(key, value);
  }
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ""}#${anchor}`;
}

export default function MotorcycleConcentrationsLandingV2({
  model,
  nowIso,
  page,
  pathname,
  query,
}: Props) {
  const filteredEvents = filterMotorcycleConcentrations(model, query);
  const previewEvents = model.allEvents.map((event) => projectPreviewEvent({
    ...event,
    vehicleType: getVehicleType(event),
  }));
  const assignedImages = assignV2HomeEventImages(previewEvents);
  const imageById = new Map(previewEvents.map((event, index) => [event.id, assignedImages[index]]));
  const analyticsSource = `concentraciones_moteras_${model.year}`;
  const hasFilters = Boolean(query.month || query.province || query.query || query.when !== "upcoming");
  const archiveEvents = query.archiveAll ? model.pastEvents : model.pastEvents.slice(0, 12);
  const leadingMonth = model.monthCounts[0];

  return (
    <div className={`${v2.page} ${styles.page}`} data-listing={`concentraciones-moteras-${model.year}`} data-motorcycle-concentrations data-v2-motorcycle-concentrations>
      <MotorcycleConcentrationsAnalytics year={model.year} />

      <section aria-label="Resumen y meses del calendario" className={styles.overview}>
        <div className={v2.shell}>
          <dl aria-label="Resumen del calendario" className={styles.metrics}>
            <div><dt>Próximas</dt><dd>{model.upcomingTotal}</dd></div>
            <div><dt>Provincias</dt><dd>{model.provinceCounts.length}</dd></div>
            <div><dt>{leadingMonth?.label ?? "Meses"}</dt><dd>{leadingMonth?.count ?? 0}</dd></div>
          </dl>
          <div className={styles.monthRow}>
            <div>
              <span className={v2.kicker}>Explora por fecha</span>
              <h2>Encuentra tu próxima cita</h2>
            </div>
          </div>
          {model.monthCounts.length ? (
            <nav aria-label="Concentraciones por mes" className={styles.monthLinks}>
              {model.monthCounts.map((month) => (
                <Link
                  aria-current={query.month === month.month ? "page" : undefined}
                  href={queryHref(pathname, { month: month.month })}
                  key={month.month}
                >
                  {month.label} <span>{month.count}</span>
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="motorcycle-v2-results" className={v2.results} id="eventos">
        <div className={v2.shell}>
          <header className={v2.resultsHeader}>
            <span className={v2.kicker}>Calendario {model.year}</span>
            <h2 id="motorcycle-v2-results">Próximas citas</h2>
            <p aria-live="polite">{filteredEvents.length} {filteredEvents.length === 1 ? "evento ordenado" : "eventos ordenados"} por fecha</p>
          </header>

          <div aria-label="Filtrar concentraciones moteras" className={`${v2.filters} ${styles.filters}`}>
            <form action={`${pathname}#eventos`} className={styles.filterForm} method="get">
              <label className={`${v2.filterField} ${styles.searchField}`} htmlFor="motorcycle-v2-search">
                <span>Buscar</span>
                <input defaultValue={query.query} id="motorcycle-v2-search" name="q" placeholder="Evento, ciudad o provincia" type="search" />
              </label>
              <label className={v2.filterField} htmlFor="motorcycle-v2-month">
                <span>Mes</span>
                <select defaultValue={query.month} id="motorcycle-v2-month" name="month">
                  <option value="">Todos</option>
                  {model.monthCounts.map((month) => <option key={month.month} value={month.month}>{month.label} · {month.count}</option>)}
                </select>
              </label>
              <label className={v2.filterField} htmlFor="motorcycle-v2-province">
                <span>Provincia</span>
                <select defaultValue={query.province} id="motorcycle-v2-province" name="province">
                  <option value="">Todas</option>
                  {model.provinceCounts.map((province) => <option key={province.key} value={province.key}>{province.label} · {province.count}</option>)}
                </select>
              </label>
              <label className={v2.filterField} htmlFor="motorcycle-v2-when">
                <span>Cuándo</span>
                <select defaultValue={query.when} id="motorcycle-v2-when" name="when">
                  <option value="upcoming">Próximos</option>
                  <option value="weekend">Este fin de semana</option>
                  <option value="next30">Próximos 30 días</option>
                </select>
              </label>
              <div className={styles.filterActions}>
                {hasFilters ? (
                  <TrackLink
                    className={v2.clearFilters}
                    eventName="filter_motorcycle_concentrations"
                    eventParams={{ action: "reset", source: "concentraciones_moteras_heading" }}
                    href={`${pathname}#eventos`}
                  >Limpiar</TrackLink>
                ) : null}
                <button className={v2.applyFilters} type="submit">Aplicar filtros</button>
              </div>
            </form>
          </div>

          <div className={v2.resultsLanding}>
            {filteredEvents.length ? (
              <div aria-label={`Concentraciones moteras ${model.year}`} className={v2.eventGrid}>
                {filteredEvents.map((event) => (
                  <EventCard
                    event={projectPreviewEvent({ ...event, vehicleType: getVehicleType(event) })}
                    key={event.id}
                    nowIso={nowIso}
                    resolvedImage={imageById.get(event.id)}
                  />
                ))}
              </div>
            ) : (
              <div className={v2.emptyState} role="status">
                <h3>No hay coincidencias</h3>
                <p>Prueba otro mes o provincia, o consulta todas las concentraciones publicadas.</p>
                <div><Link href={`${pathname}#eventos`}>Limpiar filtros</Link></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {model.pastEvents.length ? (
        <section aria-label={`Archivo de concentraciones ${model.year}`} className={styles.archive} id="archivo">
          <div className={v2.shell}>
            <details className={v2.guideDisclosure} open={query.archiveAll || undefined}>
              <summary>Archivo {model.year}: {model.pastEvents.length} {model.pastEvents.length === 1 ? "evento celebrado" : "eventos celebrados"}</summary>
              <div className={styles.archiveList}>
                {archiveEvents.map((event) => <Link href={eventHref(event)} key={event.id}>{event.title} · {event.start}</Link>)}
                {!query.archiveAll && model.pastEvents.length > archiveEvents.length ? (
                  <Link href={queryHref(pathname, { archive: "all" }, "archivo")}>Ver archivo completo</Link>
                ) : null}
              </div>
            </details>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="motorcycle-v2-guide" className={`${v2.guide} ${styles.guide}`}>
        <header>
          <span className={v2.kicker}>Guía motera {model.year}</span>
          <h2 id="motorcycle-v2-guide">Cómo encontrar una concentración motera</h2>
          <p>{page.intro}</p>
        </header>
        <div className={styles.guideGrid}>
          <div>
            <details className={v2.guideDisclosure}>
              <summary>Cómo usar el calendario</summary>
              <div className={v2.guideCopy}>
                {page.usageSteps.map((step) => <p key={step.title}><strong>{step.title}.</strong> {step.text}</p>)}
              </div>
            </details>
            <details className={v2.guideDisclosure}>
              <summary>Fechas y fuentes</summary>
              <div className={v2.guideCopy}>
                {page.editorialBlocks.map((block) => <p key={block.title}><strong>{block.title}.</strong> {block.text}</p>)}
              </div>
            </details>
            {model.territories.length ? (
              <nav aria-label="Zonas con concentraciones" className={v2.relatedLinks}>
                <strong>Zonas con eventos</strong>
                <div>{model.territories.map((territory) => <Link href={territory.href} key={territory.id}>{territory.label} · {territory.count}</Link>)}</div>
              </nav>
            ) : null}
            <nav aria-label="Recursos moteros" className={v2.relatedLinks}>
              <strong>Seguir explorando</strong>
              <div>{page.relatedLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</div>
            </nav>
          </div>
          <div className={`${v2.faqs} ${styles.faqs}`}>
            <h3>Preguntas frecuentes</h3>
            {page.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className={styles.organizer}>
        <div className={v2.shell}>
          <div>
            <span className={v2.kicker}>Para organizadores</span>
            <h2>¿Organizas una concentración motera?</h2>
            <p>Añade fecha, ubicación y fuente oficial para que otros motoristas puedan encontrarla.</p>
          </div>
          <TrackLink
            className={v2.applyFilters}
            eventName="click_publish_event"
            eventParams={{ source: `${analyticsSource}_organizer` }}
            href="/publicar-evento"
          >Publicar evento</TrackLink>
        </div>
      </section>
    </div>
  );
}
