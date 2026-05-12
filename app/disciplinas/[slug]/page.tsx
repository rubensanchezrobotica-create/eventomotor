import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";
import { normalizeSeoText, SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

type DisciplinePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SEO_DISCIPLINES.map((discipline) => ({ slug: discipline.slug }));
}

function findDiscipline(slug: string) {
  return SEO_DISCIPLINES.find((discipline) => discipline.slug === slug);
}

function eventSearchText(event: EventItem) {
  return normalizeSeoText(
    [
      event.title,
      event.championship,
      event.discipline,
      event.venue,
      event.city,
      event.province,
      event.region,
      ...(event.tags || []),
    ].join(" "),
  );
}

function matchesTerms(event: EventItem, terms: readonly string[]) {
  const text = eventSearchText(event);
  return terms.some((term) => text.includes(normalizeSeoText(term)));
}

function EventCard({ event }: { event: EventItem }) {
  const color = getDisciplineColor(event.discipline);
  const label = dayLabel(event);

  return (
    <Link
      className="emc-result-card"
      href={eventHref(event)}
      style={{ "--emc-card-accent": color.accent } as CSSProperties}
    >
      <div className="emc-result-date">
        {label.day}
        <small>{label.month}</small>
      </div>
      <div>
        <div className="emc-result-meta">
          <span className="emc-badge">{event.discipline}</span>
          <span className="emc-badge">{event.province}</span>
        </div>
        <h3>{event.title}</h3>
        <p>{formatRange(event)} / {event.city}, {event.province}</p>
        <span className="emc-card-action">Ver evento</span>
      </div>
    </Link>
  );
}

export async function generateMetadata({ params }: DisciplinePageProps): Promise<Metadata> {
  const { slug } = await params;
  const discipline = findDiscipline(slug);

  if (!discipline) return {};

  return {
    title: discipline.metaTitle,
    description: discipline.metaDescription,
    alternates: {
      canonical: `${SITE_URL}/disciplinas/${discipline.slug}`,
    },
    openGraph: {
      title: discipline.metaTitle,
      description: discipline.metaDescription,
      url: `${SITE_URL}/disciplinas/${discipline.slug}`,
      siteName: "EventoMotor",
      type: "website",
    },
  };
}

export default async function DisciplinePage({ params }: DisciplinePageProps) {
  const { slug } = await params;
  const discipline = findDiscipline(slug);

  if (!discipline) notFound();

  const events = (await getVisibleEvents())
    .filter((event) => matchesTerms(event, discipline.terms))
    .sort((a, b) => a.start.localeCompare(b.start));
  const relatedEvents = events.slice(0, 6);
  const otherDisciplines = SEO_DISCIPLINES.filter((item) => item.slug !== discipline.slug);

  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />
      <main className="emc-contact-page">
        <section className="emc-contact-hero emc-seo-hero">
          <div className="emc-container">
            <div className="emc-kicker">Disciplina</div>
            <h1>{discipline.h1}</h1>
            <p className="emc-contact-lead">{discipline.intro}</p>
            <div className="emc-contact-actions">
              <Link className="emc-btn emc-btn-primary" href="/#calendario">
                Ver calendario
              </Link>
              <Link className="emc-contact-secondary-link" href="/disciplinas">
                Todas las disciplinas
              </Link>
            </div>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Eventos</div>
                <h2>{events.length ? `${events.length} eventos encontrados` : "Eventos relacionados"}</h2>
              </div>
              <p>Listado filtrado por disciplina con enlaces a fichas individuales, ubicación y fuente oficial cuando está disponible.</p>
            </div>
            <div className="emc-results-grid">
              {events.length ? (
                events.map((event) => <EventCard event={event} key={event.id} />)
              ) : (
                <div className="emc-panel emc-publish-criteria">
                  <h2>Sin eventos visibles ahora mismo</h2>
                  <p>Vuelve al calendario principal para explorar eventos de otras disciplinas o zonas.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {relatedEvents.length ? (
          <section className="emc-section emc-internal-links-section">
            <div className="emc-container">
              <div className="emc-section-head">
                <div>
                  <div className="emc-kicker">Enlaces internos</div>
                  <h2>Eventos destacados de {discipline.title}</h2>
                </div>
              </div>
              <div className="emc-internal-links">
                {relatedEvents.map((event) => (
                  <Link className="emc-internal-link-card" href={eventHref(event)} key={event.id}>
                    <span>{event.province}</span>
                    <strong>{event.title}</strong>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="emc-section emc-internal-links-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Más disciplinas</div>
                <h2>Explora otras categorías</h2>
              </div>
            </div>
            <div className="emc-internal-links">
              {otherDisciplines.slice(0, 6).map((item) => (
                <Link className="emc-internal-link-card" href={`/disciplinas/${item.slug}`} key={item.slug}>
                  <span>Disciplina</span>
                  <strong>{item.title}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <ConceptFooter />
    </div>
  );
}
