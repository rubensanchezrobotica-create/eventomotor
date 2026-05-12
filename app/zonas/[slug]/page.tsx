import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref, unique } from "@/components/public/concept/concept-model";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getRegionSlug } from "@/lib/event-listing-slugs";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";
import { normalizeSeoText, SEO_DISCIPLINES, SEO_ZONES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

type ZonePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SEO_ZONES.map((zone) => ({ slug: zone.slug }));
}

function findZone(slug: string) {
  return SEO_ZONES.find((zone) => zone.slug === slug);
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
          <span className="emc-badge">{event.city}</span>
        </div>
        <h3>{event.title}</h3>
        <p>{formatRange(event)} / {event.city}, {event.province}</p>
        <span className="emc-card-action">Ver evento</span>
      </div>
    </TrackLink>
  );
}

export async function generateMetadata({ params }: ZonePageProps): Promise<Metadata> {
  const { slug } = await params;
  const zone = findZone(slug);

  if (!zone) return {};

  return {
    title: zone.metaTitle,
    description: zone.metaDescription,
    alternates: {
      canonical: `${SITE_URL}/zonas/${zone.slug}`,
    },
    openGraph: {
      title: zone.metaTitle,
      description: zone.metaDescription,
      url: `${SITE_URL}/zonas/${zone.slug}`,
      siteName: "EventoMotor",
      type: "website",
    },
  };
}

export default async function ZonePage({ params }: ZonePageProps) {
  const { slug } = await params;
  const zone = findZone(slug);

  if (!zone) notFound();

  const events = (await getVisibleEvents())
    .filter((event) => matchesTerms(event, zone.terms))
    .sort((a, b) => a.start.localeCompare(b.start));
  const provinces = unique(events.map((event) => event.province)).slice(0, 9);
  const cities = unique(events.map((event) => event.city)).slice(0, 9);

  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />
      <main className="emc-contact-page">
        <section className="emc-contact-hero emc-seo-hero">
          <div className="emc-container">
            <div className="emc-kicker">Zona</div>
            <h1>{zone.h1}</h1>
            <p className="emc-contact-lead">{zone.intro}</p>
            <div className="emc-contact-actions">
              <Link className="emc-btn emc-btn-primary" href="/#calendario">
                Ver calendario
              </Link>
              <Link className="emc-contact-secondary-link" href="/zonas">
                Todas las zonas
              </Link>
            </div>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Eventos</div>
                <h2>{events.length ? `${events.length} eventos en la zona` : "Eventos de la zona"}</h2>
              </div>
              <p>Eventos filtrados por territorio, con enlaces a fichas individuales, fecha, disciplina y ubicación.</p>
            </div>
            <div className="emc-results-grid">
              {events.length ? (
                events.map((event) => <EventCard event={event} key={event.id} />)
              ) : (
                <div className="emc-panel emc-publish-criteria">
                  <h2>Sin eventos visibles ahora mismo</h2>
                  <p>Vuelve al calendario principal para explorar eventos de otras zonas o disciplinas.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {provinces.length || cities.length ? (
          <section className="emc-section emc-internal-links-section">
            <div className="emc-container">
              <div className="emc-section-head">
                <div>
                  <div className="emc-kicker">Territorio</div>
                  <h2>Provincias y ciudades con eventos</h2>
                </div>
              </div>
              <div className="emc-internal-links">
                {provinces.map((province) => (
                  <Link className="emc-internal-link-card" href={`/eventos-moto/${getRegionSlug(province)}`} key={province}>
                    <span>Provincia</span>
                    <strong>{province}</strong>
                  </Link>
                ))}
                {cities.slice(0, Math.max(0, 9 - provinces.length)).map((city) => (
                  <Link className="emc-internal-link-card" href="/#calendario" key={city}>
                    <span>Ciudad</span>
                    <strong>{city}</strong>
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
                <div className="emc-kicker">Disciplinas</div>
                <h2>Explora eventos por tipo</h2>
              </div>
            </div>
            <div className="emc-internal-links">
              {SEO_DISCIPLINES.slice(0, 6).map((item) => (
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
