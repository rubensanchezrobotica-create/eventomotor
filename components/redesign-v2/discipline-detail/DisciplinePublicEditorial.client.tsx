"use client";

import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import { currentPagePath, eventAnalyticsParams, trackEvent } from "@/lib/analytics";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import type { DisciplinePreviewData } from "@/components/disciplines/discipline-preview-model";
import styles from "./DisciplineDetailPage.module.css";

function introParagraphs(intro: string) {
  const sentences = intro.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()) || [intro];
  const midpoint = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, midpoint).join(" "), sentences.slice(midpoint).join(" ")].filter(Boolean);
}

function eventDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function DisciplinePublicEditorial({ data }: { data: DisciplinePreviewData }) {
  const paragraphs = introParagraphs(data.discipline.intro);
  const disciplineName = data.discipline.title.toLocaleLowerCase("es");
  const analyticsSource = "discipline_public";

  return (
    <div className={styles.publicEditorial}>
      <section className={styles.organizerCard}>
        <div>
          <span className={styles.kicker}>Para organizadores</span>
          <h2>{data.editorial.ctaTitle}</h2>
          <p>{data.editorial.ctaText}</p>
        </div>
        <TrackLink
          className={styles.organizerLink}
          eventName="click_publish_event"
          eventParams={{ source: `${analyticsSource}_${data.discipline.slug}` }}
          href="/publicar-evento"
        >
          Publicar un evento
        </TrackLink>
      </section>

      <section aria-labelledby="discipline-public-guide" className={styles.editorialCard}>
        <span className={styles.kicker}>Guía de la disciplina</span>
        <h2 id="discipline-public-guide">Sobre los {disciplineName} en España</h2>
        <p>{paragraphs[0]}</p>
        <details className={styles.editorialDisclosure}>
          <summary>Leer más sobre esta disciplina</summary>
          <div className={styles.editorialDisclosureBody}>
            {paragraphs.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <nav aria-label="Enlaces de la disciplina" className={styles.editorialLinks}>
              <Link href={PUBLIC_NAVIGATION.calendar}>Calendario completo</Link>
              <Link href="/eventos-motor-este-fin-de-semana">Eventos este fin de semana</Link>
              <Link href="/zonas">Explorar por zonas</Link>
              <Link href="/publicar-evento">Publicar evento</Link>
            </nav>
            <div aria-label="Preguntas frecuentes" className={styles.publicFaq}>
              <h3>Preguntas frecuentes</h3>
              <details>
                <summary>¿Qué eventos aparecen en esta disciplina?</summary>
                <p>
                  Se muestran eventos visibles cuya disciplina o tipo de vehículo estructurado
                  permite una clasificación inequívoca.
                </p>
              </details>
              <details>
                <summary>¿Cómo encuentro un evento próximo?</summary>
                <p>
                  Utiliza provincia y periodo para acotar la agenda; en Más filtros puedes elegir
                  modalidad, vehículo o buscar por título y localidad.
                </p>
              </details>
              <details>
                <summary>¿Debo confirmar la información antes de asistir?</summary>
                <p>
                  Sí. Consulta siempre la ficha y la fuente oficial porque horarios, ubicación,
                  inscripciones o programa pueden cambiar.
                </p>
              </details>
            </div>
          </div>
        </details>
      </section>

      {data.pastEvents.length ? (
        <section className={styles.historySection}>
          <details
            onToggle={(event) => {
              if (event.currentTarget.open) {
                trackEvent("open_discipline_history", {
                  discipline: data.discipline.title,
                  page_path: currentPagePath(),
                });
              }
            }}
          >
            <summary>
              <span>
                <strong>Eventos anteriores de {data.discipline.title}</strong>
                <small>{data.pastEvents.length} eventos históricos</small>
              </span>
              <span aria-hidden="true">+</span>
            </summary>
            <div className={styles.historyList}>
              {data.pastEvents.map((event) => (
                <TrackLink
                  eventName="click_event_detail"
                  eventParams={{
                    ...eventAnalyticsParams(event),
                    source: `${analyticsSource}_history`,
                  }}
                  href={`/evento/${event.slug || event.id}`}
                  key={event.slug || event.id}
                >
                  <span>
                    <strong>{event.title}</strong>
                    <small>{[event.city, event.province].filter(Boolean).join(", ") || event.venue}</small>
                  </span>
                  <span className={styles.historyDate}>
                    {eventDate(event.start)}
                    {event.end && event.end !== event.start ? ` – ${eventDate(event.end)}` : ""}
                  </span>
                  <span aria-hidden="true">→</span>
                </TrackLink>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      <section aria-labelledby="other-disciplines-title" className={styles.otherDisciplines}>
        <span className={styles.kicker}>Sigue explorando</span>
        <h2 id="other-disciplines-title">Explora otras disciplinas</h2>
        <div className={styles.otherDisciplineGrid}>
          {data.otherDisciplines.map((discipline) => (
            <TrackLink
              eventName="change_discipline"
              eventParams={{
                from_discipline: data.discipline.slug,
                source: `${analyticsSource}_other`,
                to_discipline: discipline.slug,
              }}
              href={`/disciplinas/${discipline.slug}`}
              key={discipline.slug}
            >
              <strong>{discipline.title}</strong>
              <span>
                {discipline.count} {discipline.count === 1 ? "próximo evento" : "próximos eventos"}
              </span>
              <span aria-hidden="true">→</span>
            </TrackLink>
          ))}
        </div>
      </section>
    </div>
  );
}
