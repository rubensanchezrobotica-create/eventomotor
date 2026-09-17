import Image from "next/image";
import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import {
  DEFAULT_DISCIPLINE_FILTERS,
  disciplineResultMeta,
  disciplineResultTitle,
  type DisciplineFilters,
  type DisciplinePreviewData,
} from "@/components/disciplines/discipline-preview-model";
import CompactAgendaSignup from "@/components/redesign-v2/newsletter/CompactAgendaSignup.client";
import { eventAnalyticsParams } from "@/lib/analytics";
import {
  DISCIPLINE_DETAIL_PAGE_SIZE,
  disciplineDetailPageHref,
  disciplineDetailPaginationItems,
  publicDisciplineDetailHref,
  type DisciplineDetailPageItem,
  type DisciplineDetailPageModel,
} from "./discipline-detail-model";
import DisciplineSearchAssist from "./DisciplineSearchAssist.client";
import DisciplinePublicEditorial from "./DisciplinePublicEditorial.client";
import DisciplinePublicFilters from "./DisciplinePublicFilters.client";
import {
  isRemoteImage,
  previewEventDateLabel,
  previewEventSavedSnapshot,
  previewEventStatus,
  previewVehicleLabel,
} from "@/components/redesign-v2/redesign-v2-model";
import cardStyles from "@/components/redesign-v2/RedesignV2.module.css";
import styles from "./DisciplineDetailPage.module.css";

type DisciplineDetailPageProps = {
  model: DisciplineDetailPageModel;
  nowIso: string;
} & ({ routeContext: "preview" } | {
  publicData: DisciplinePreviewData;
  publicFilters: DisciplineFilters;
  routeContext: "public";
});

function DisciplineEventCard({ item, nowIso, routeContext }: {
  item: DisciplineDetailPageItem;
  nowIso: string;
  routeContext: "preview" | "public";
}) {
  const { event, image } = item;
  const date = previewEventDateLabel(event);
  const href = routeContext === "public"
    ? `/evento/${event.slug || event.id}`
    : `/preview/redesign-v2/evento/${event.slug || event.id}`;
  const savedEvent = previewEventSavedSnapshot(event);

  return (
    <article className={cardStyles.eventCard}>
      {routeContext === "public" ? (
        <TrackLink
          aria-label={`Ver ${event.title}`}
          className={cardStyles.eventCardHitArea}
          eventName="click_event_detail"
          eventParams={{
            ...eventAnalyticsParams(item.original ?? event),
            source: "discipline_public_results",
          }}
          href={href}
        >
          <span className={styles.srOnly}>Abrir ficha de {event.title}</span>
        </TrackLink>
      ) : (
        <Link aria-label={`Ver ${event.title}`} className={cardStyles.eventCardHitArea} href={href} />
      )}
      <div className={cardStyles.eventCardLink}>
        <div className={cardStyles.eventImageLink}>
          {image.src ? (
            <Image
              alt={image.alt}
              className={cardStyles.eventImage}
              height={800}
              sizes="(max-width: 680px) 100vw, (max-width: 1020px) 50vw, 33vw"
              src={image.src}
              unoptimized={isRemoteImage(image.src)}
              width={1200}
            />
          ) : (
            <span aria-hidden="true" className={cardStyles.neutralEventImage}>
              <strong>EventoMotor</strong>
              <small>Agenda nacional del motor</small>
            </span>
          )}
          <span className={cardStyles.imageShade} />
          {image.label ? <span className={cardStyles.imageLabel}>{image.label}</span> : null}
          {date ? (
            <span
              aria-label={date.ariaLabel}
              className={`${cardStyles.dateBlock} ${
                date.kind === "range"
                  ? cardStyles.dateBlockRange
                  : date.kind === "cross-month"
                    ? cardStyles.dateBlockCrossMonth
                    : ""
              }`}
            >
              {date.kind === "cross-month" ? (
                <>
                  <span className={cardStyles.dateLine}>
                    <strong>{date.startDay}</strong>
                    <span>{date.startMonth}</span>
                  </span>
                  <span className={cardStyles.dateLine}>
                    <strong>{date.endDay}</strong>
                    <span>{date.endMonth}</span>
                  </span>
                </>
              ) : (
                <>
                  <strong>{date.day}</strong>
                  <span>{date.month}</span>
                </>
              )}
            </span>
          ) : null}
          <div className={cardStyles.eventSaveAction}>
            <EventRetentionActions
              compactIcons
              directChildren
              event={savedEvent}
              saveOnly
              source="redesign_v2_discipline_detail"
            />
          </div>
        </div>
        <div className={cardStyles.eventCardBody}>
          <div className={cardStyles.eventMetaLine}>
            <span aria-hidden="true" className={cardStyles.statusDot} />
            <span>{previewEventStatus(event, nowIso)}</span>
            <span aria-hidden="true">·</span>
            <span>{previewVehicleLabel(event)}</span>
          </div>
          <h3>{event.title}</h3>
          <p>{[event.city, event.province].filter(Boolean).join(", ") || event.venue}</p>
          <span className={cardStyles.cardAction}>
            Ver evento <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </article>
  );
}

function Pagination({ model, publicFilters, routeContext }: {
  model: DisciplineDetailPageModel;
  publicFilters?: DisciplineFilters;
  routeContext: "preview" | "public";
}) {
  const items = disciplineDetailPaginationItems(model.page, model.pageCount);
  if (!items.length) return null;
  const href = (page: number) => routeContext === "public" && publicFilters
    ? publicDisciplineDetailHref(model.definition.slug, page, publicFilters)
    : disciplineDetailPageHref(model.definition.slug, page, model.query);

  return (
    <nav aria-label="Paginación de eventos de la disciplina" className={styles.pagination}>
      {model.page > 1 ? (
        <Link href={href(model.page - 1)}>Anterior</Link>
      ) : null}
      <span className={styles.pageNumbers}>
        {items.map((item, index) => item === "ellipsis" ? (
          <span aria-hidden="true" className={styles.ellipsis} key={`ellipsis-${index}`}>…</span>
        ) : (
          <Link
            aria-current={item === model.page ? "page" : undefined}
            href={href(item)}
            key={item}
          >
            {item}
          </Link>
        ))}
      </span>
      {model.page < model.pageCount ? (
        <Link href={href(model.page + 1)}>Siguiente</Link>
      ) : null}
    </nav>
  );
}

function visibleRange(model: DisciplineDetailPageModel) {
  if (!model.filteredCount) return null;
  const first = (model.page - 1) * DISCIPLINE_DETAIL_PAGE_SIZE + 1;
  const last = first + model.items.length - 1;
  return `${first}–${last}`;
}

function resultsSummary(model: DisciplineDetailPageModel, range: string | null) {
  if (model.query) {
    if (model.filteredCount === 1) {
      return `1 resultado para “${model.query}” en ${model.definition.title}.`;
    }
    if (range) {
      return `Mostrando ${range} de ${model.filteredCount} resultados para “${model.query}” en ${model.definition.title}.`;
    }
    return `0 resultados para “${model.query}” en ${model.definition.title}.`;
  }

  return range
    ? `Mostrando ${range} de ${model.totalUpcomingCount} eventos próximos, ordenados por fecha.`
    : "No hay próximos eventos publicados en esta disciplina.";
}

export default function DisciplineDetailPage(props: DisciplineDetailPageProps) {
  const { model, nowIso, routeContext } = props;
  const publicData = props.routeContext === "public" ? props.publicData : undefined;
  const publicFilters = props.routeContext === "public" ? props.publicFilters : undefined;
  const range = visibleRange(model);
  const resultTitle = publicFilters
    ? disciplineResultTitle(publicFilters.period, model.definition.title, false, model.definition.slug)
    : `Próximos eventos de ${model.definition.title}`;
  const calendarHref = routeContext === "public" ? "/calendario" : "/preview/redesign-v2/calendario";
  const disciplinesHref = routeContext === "public" ? "/disciplinas" : "/preview/redesign-v2/disciplinas";
  const clearHref = disciplineDetailPageHref(model.definition.slug, 1);

  return (
    <section className={styles.page} data-a6-discipline-detail>
      <div className={styles.shell}>
        <header className={styles.resultsHeader}>
          <div>
            <span className={styles.kicker}>{publicFilters ? "Agenda por disciplina" : "Próximos eventos"}</span>
            <h2 id="discipline-detail-results">
              {resultTitle}
            </h2>
            <p aria-live="polite">{publicFilters
              ? disciplineResultMeta(model.filteredCount)
              : resultsSummary(model, range)}</p>
          </div>
        </header>

        {publicData && publicFilters ? (
          <DisciplinePublicFilters
            data={publicData}
            initialFilters={publicFilters}
            key={JSON.stringify(publicFilters)}
            slug={model.definition.slug}
          />
        ) : (
          <DisciplineSearchAssist
            action={disciplineDetailPageHref(model.definition.slug, 1)}
            disciplineSlug={model.definition.slug}
            initialQuery={model.query}
            key={model.query}
            source={model.suggestionIndex}
          />
        )}

        {model.items.length ? (
          <div aria-labelledby="discipline-detail-results" className={styles.eventGrid}>
            {model.items.map((item) => (
              <DisciplineEventCard item={item} key={item.event.id} nowIso={nowIso} routeContext={routeContext} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState} role="status">
            {publicFilters ? (
              <>
                <h3>No hay eventos que coincidan con estos filtros.</h3>
                <p>Prueba otro periodo, provincia, modalidad o término de búsqueda.</p>
                <div>
                  <Link href={publicDisciplineDetailHref(model.definition.slug, 1, DEFAULT_DISCIPLINE_FILTERS)}>Mostrar próximos eventos</Link>
                  <Link href={calendarHref}>Ver calendario completo</Link>
                </div>
              </>
            ) : model.query ? (
              <>
                <h3>No hemos encontrado próximos eventos para “{model.query}”.</h3>
                <p>Prueba con otro evento, localidad o provincia.</p>
                <div>
                  <Link href={clearHref}>Limpiar búsqueda</Link>
                  <Link href={calendarHref}>Ver calendario completo</Link>
                </div>
              </>
            ) : (
              <>
                <h3>No hay próximos eventos publicados en esta disciplina.</h3>
                <p>Consulta el calendario completo o vuelve a explorar las disciplinas disponibles.</p>
                <div>
                  <Link href={calendarHref}>Abrir calendario</Link>
                  <Link href={disciplinesHref}>Volver a Disciplinas</Link>
                </div>
              </>
            )}
          </div>
        )}

        <Pagination model={model} publicFilters={publicFilters} routeContext={routeContext} />

        {model.items.length ? (
          <Link className={styles.calendarLink} href={calendarHref}>
            Ver calendario completo <span aria-hidden="true">→</span>
          </Link>
        ) : null}

        {publicData ? <DisciplinePublicEditorial data={publicData} /> : null}

        <CompactAgendaSignup
          description="Una selección de próximos eventos para vivir el motor."
          eyebrow="LA AGENDA MOTOR"
          title="TU AGENDA DE MOTOR, CADA SEMANA"
        />
      </div>
    </section>
  );
}
