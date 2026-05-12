import type { CSSProperties } from "react";
import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import type { OpportunityPage as OpportunityPageConfig } from "@/lib/opportunity-pages";
import type { EventItem } from "@/types/event";

function EventCard({ event }: { event: EventItem }) {
  const color = getDisciplineColor(event.discipline);
  const label = dayLabel(event);

  return (
    <TrackLink
      className="emc-result-card"
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

function breadcrumbJsonLd(page: OpportunityPageConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.h1,
        item: `${SITE_URL}/${page.slug}`,
      },
    ],
  };
}

export default async function OpportunityPage({ page }: { page: OpportunityPageConfig }) {
  const now = new Date();
  const events = (await getVisibleEvents())
    .filter((event) => page.filter(event, now))
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="emc-page">
      <ConceptStyles />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(page)) }}
      />
      <ConceptStaticHeader />
      <main className="emc-contact-page">
        <section className="emc-contact-hero emc-seo-hero">
          <div className="emc-container">
            <div className="emc-event-breadcrumb">
              <Link href="/">Inicio</Link>
              <span>/</span>
              <strong>{page.h1}</strong>
            </div>
            <div className="emc-kicker">Búsqueda popular</div>
            <h1>{page.h1}</h1>
            <p className="emc-contact-lead">{page.intro}</p>
            <div className="emc-contact-actions">
              <Link className="emc-btn emc-btn-primary" href="/#calendario">
                Ver calendario completo
              </Link>
              <Link className="emc-contact-secondary-link" href="/publicar-evento">
                Publicar evento
              </Link>
            </div>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Eventos filtrados</div>
                <h2>{events.length ? `${events.length} eventos encontrados` : "Sin eventos destacados ahora mismo"}</h2>
              </div>
              <p>Resultados generados a partir del calendario público de EventoMotor y enlazados a fichas individuales.</p>
            </div>

            {events.length ? (
              <div className="emc-results-grid">
                {events.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </div>
            ) : (
              <div className="emc-panel emc-publish-criteria">
                <h2>No hay eventos destacados con estos filtros ahora mismo.</h2>
                <p>Puedes consultar el calendario completo para ver próximos eventos por fecha, zona y disciplina.</p>
                <div className="emc-contact-actions">
                  <Link className="emc-btn emc-btn-primary" href="/#calendario">
                    Consultar calendario completo
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="emc-section emc-internal-links-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Enlaces internos</div>
                <h2>Explora más en EventoMotor</h2>
              </div>
            </div>
            <div className="emc-internal-links">
              {page.relatedLinks.map((link) => (
                <Link className="emc-internal-link-card" href={link.href} key={link.href}>
                  <span>Relacionado</span>
                  <strong>{link.label}</strong>
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
