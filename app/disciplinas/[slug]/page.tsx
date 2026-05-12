import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { formatRange, getDisciplineColor, statusOf } from "@/lib/date-utils";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";
import { normalizeDisciplineSlug, normalizeSeoText, SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

type DisciplinePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

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

function matchesDiscipline(event: EventItem, discipline: (typeof SEO_DISCIPLINES)[number]) {
  const eventDisciplineSlug = normalizeDisciplineSlug(event.discipline);
  const eventVehicleTypeSlug = normalizeDisciplineSlug(event.vehicleType || event.vehicle_type || "");

  if (eventDisciplineSlug === discipline.slug || normalizeSeoText(event.discipline) === normalizeSeoText(discipline.title)) {
    return true;
  }

  if (discipline.slug === "karting" && (eventDisciplineSlug === "karting" || eventVehicleTypeSlug === "karting")) {
    return true;
  }

  return matchesTerms(event, discipline.terms);
}

function EventCard({ event }: { event: EventItem }) {
  const color = getDisciplineColor(event.discipline);
  const label = dayLabel(event);

  return (
    <TrackLink
      className="emc-result-card emc-taxonomy-card"
      eventName="click_event_detail"
      eventParams={{
        event_slug: event.slug,
        event_title: event.title,
        discipline: event.discipline,
        zone: event.region || event.province,
        vehicle_type: event.vehicleType || event.vehicle_type || "otros",
      }}
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
    </TrackLink>
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
    .filter((event) => statusOf(event) !== "finalizado")
    .filter((event) => matchesDiscipline(event, discipline))
    .sort((a, b) => a.start.localeCompare(b.start));
  const relatedEvents = events.slice(0, 6);
  const otherDisciplines = SEO_DISCIPLINES.filter((item) => item.slug !== discipline.slug);
  const eventsTitle = `Eventos de ${discipline.title.toLowerCase()} próximos`;

  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />
      <main className="emc-contact-page emc-taxonomy-page">
        <section className="emc-taxonomy-hero">
          <div className="emc-container emc-taxonomy-hero-grid">
            <div>
              <div className="emc-event-breadcrumb">
                <Link href="/">Inicio</Link>
                <span>/</span>
                <Link href="/disciplinas">Disciplinas</Link>
                <span>/</span>
                <strong>{discipline.title}</strong>
              </div>
              <div className="emc-kicker">Disciplina</div>
              <h1>{discipline.h1}</h1>
              <p className="emc-taxonomy-lead">{discipline.description}</p>
              <div className="emc-contact-actions emc-taxonomy-actions">
                <Link className="emc-btn emc-btn-primary" href="/#calendario">
                  Ver calendario
                </Link>
                <Link className="emc-contact-secondary-link" href="/disciplinas">
                  Todas las disciplinas
                </Link>
              </div>
            </div>
            <aside className="emc-taxonomy-stats" aria-label="Resumen de disciplina">
              <div>
                <strong>{events.length}</strong>
                <span>eventos próximos</span>
              </div>
              <div>
                <strong>{discipline.title}</strong>
                <span>disciplina</span>
              </div>
            </aside>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-section-head emc-taxonomy-section-head">
              <div>
                <div className="emc-kicker">Eventos</div>
                <h2>{eventsTitle}</h2>
              </div>
              <p>
                <span className="emc-opportunity-count-badge">{events.length} próximos</span>
                Listado filtrado por disciplina con enlaces a fichas individuales, ubicación y fuente oficial cuando está disponible.
              </p>
            </div>
            <div className="emc-results-grid">
              {events.length ? (
                events.map((event) => <EventCard event={event} key={event.id} />)
              ) : (
                <div className="emc-panel emc-taxonomy-empty">
                  <h2>No hay eventos próximos de esta disciplina</h2>
                  <p>Vuelve al calendario general o revisa otras disciplinas.</p>
                  <Link className="emc-btn emc-btn-primary" href="/#calendario">
                    Ver calendario
                  </Link>
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
