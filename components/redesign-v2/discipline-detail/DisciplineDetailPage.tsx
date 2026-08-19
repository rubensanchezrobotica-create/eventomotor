import Image from "next/image";
import Link from "next/link";
import CompactAgendaSignup from "@/components/redesign-v2/newsletter/CompactAgendaSignup.client";
import {
  DISCIPLINE_DETAIL_PAGE_SIZE,
  disciplineDetailPageHref,
  disciplineDetailPaginationItems,
  type DisciplineDetailPageItem,
  type DisciplineDetailPageModel,
} from "./discipline-detail-model";
import DisciplineSearchAssist from "./DisciplineSearchAssist.client";
import {
  isRemoteImage,
  previewEventDateLabel,
  previewEventStatus,
  previewVehicleLabel,
} from "@/components/redesign-v2/redesign-v2-model";
import cardStyles from "@/components/redesign-v2/RedesignV2.module.css";
import styles from "./DisciplineDetailPage.module.css";

type DisciplineDetailPageProps = {
  model: DisciplineDetailPageModel;
  nowIso: string;
};

function DisciplineEventCard({ item, nowIso }: { item: DisciplineDetailPageItem; nowIso: string }) {
  const { event, image } = item;
  const date = previewEventDateLabel(event);
  const href = `/preview/redesign-v2/evento/${event.slug || event.id}`;

  return (
    <article className={cardStyles.eventCard}>
      <Link aria-label={`Ver ${event.title}`} className={cardStyles.eventCardLink} href={href}>
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
      </Link>
    </article>
  );
}

function Pagination({ model }: { model: DisciplineDetailPageModel }) {
  const items = disciplineDetailPaginationItems(model.page, model.pageCount);
  if (!items.length) return null;

  return (
    <nav aria-label="Paginación de eventos de la disciplina" className={styles.pagination}>
      {model.page > 1 ? (
        <Link href={disciplineDetailPageHref(model.definition.slug, model.page - 1, model.query)}>Anterior</Link>
      ) : null}
      <span className={styles.pageNumbers}>
        {items.map((item, index) => item === "ellipsis" ? (
          <span aria-hidden="true" className={styles.ellipsis} key={`ellipsis-${index}`}>…</span>
        ) : (
          <Link
            aria-current={item === model.page ? "page" : undefined}
            href={disciplineDetailPageHref(model.definition.slug, item, model.query)}
            key={item}
          >
            {item}
          </Link>
        ))}
      </span>
      {model.page < model.pageCount ? (
        <Link href={disciplineDetailPageHref(model.definition.slug, model.page + 1, model.query)}>Siguiente</Link>
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

export default function DisciplineDetailPage({ model, nowIso }: DisciplineDetailPageProps) {
  const range = visibleRange(model);

  return (
    <section className={styles.page} data-a6-discipline-detail>
      <div className={styles.shell}>
        <header className={styles.resultsHeader}>
          <div>
            <span className={styles.kicker}>Próximos eventos</span>
            <h2 id="discipline-detail-results">
              Próximos eventos de {model.definition.title}
            </h2>
            <p aria-live="polite">{resultsSummary(model, range)}</p>
          </div>
        </header>

        <DisciplineSearchAssist
          action={disciplineDetailPageHref(model.definition.slug, 1)}
          disciplineSlug={model.definition.slug}
          initialQuery={model.query}
          key={model.query}
          source={model.suggestionIndex}
        />

        {model.items.length ? (
          <div aria-labelledby="discipline-detail-results" className={styles.eventGrid}>
            {model.items.map((item) => (
              <DisciplineEventCard item={item} key={item.event.id} nowIso={nowIso} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState} role="status">
            {model.query ? (
              <>
                <h3>No hemos encontrado próximos eventos para “{model.query}”.</h3>
                <p>Prueba con otro evento, localidad o provincia.</p>
                <div>
                  <Link href={disciplineDetailPageHref(model.definition.slug, 1)}>Limpiar búsqueda</Link>
                  <Link href="/preview/redesign-v2/calendario">Ver calendario completo</Link>
                </div>
              </>
            ) : (
              <>
                <h3>No hay próximos eventos publicados en esta disciplina.</h3>
                <p>Consulta el calendario completo o vuelve a explorar las disciplinas disponibles.</p>
                <div>
                  <Link href="/preview/redesign-v2/calendario">Abrir calendario</Link>
                  <Link href="/preview/redesign-v2/disciplinas">Volver a Disciplinas</Link>
                </div>
              </>
            )}
          </div>
        )}

        <Pagination model={model} />

        {model.items.length ? (
          <Link className={styles.calendarLink} href="/preview/redesign-v2/calendario">
            Ver calendario completo <span aria-hidden="true">→</span>
          </Link>
        ) : null}

        <CompactAgendaSignup
          description="Una selección de próximos eventos para vivir el motor."
          eyebrow="LA AGENDA MOTOR"
          title="TU AGENDA DE MOTOR, CADA SEMANA"
        />
      </div>
    </section>
  );
}
