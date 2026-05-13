import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import ShareEventButton from "@/components/ShareEventButton";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getEventImage, getEventImageAlt } from "@/lib/event-images";
import { getDisciplineSlug, getRegionSlug } from "@/lib/event-listing-slugs";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import type { EventItem } from "@/types/event";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

type EventOfferData = EventItem & {
  price?: number | string | null;
  priceCurrency?: string | null;
  validFrom?: string | null;
  isFree?: boolean | null;
};

const VEHICLE_LABELS: Record<string, string> = {
  moto: "Moto",
  coche: "Coche",
  mixto: "Mixto",
  karting: "Karting",
  otros: "Otros",
};

async function getVisibleEvents(): Promise<EventItem[]> {
  const supabase = createSupabaseServerClient();

  if (!supabase) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("visible", true)
    .order("start_date", { ascending: true });

  if (error || !data) return [];

  return (data as EventRow[]).map(mapEventRowToEventItem);
}

async function getEventBySlug(slug: string): Promise<EventItem | null> {
  const events = await getVisibleEvents();
  return events.find((event) => event.slug === slug) || null;
}

function valueOrPending(value: string | null | undefined) {
  return value?.trim() || "Por confirmar";
}

function vehicleTypeOf(event: EventItem) {
  return event.vehicleType || event.vehicle_type || "otros";
}

function vehicleLabel(event: EventItem) {
  return VEHICLE_LABELS[vehicleTypeOf(event)] || "Otros";
}

function absoluteImageUrl(value: string, siteUrl: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${siteUrl}${value}`;
}

function isRemoteImage(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function formatDatePart(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateWithoutYear(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function formatEventDate(event: EventItem) {
  if (!event.start) return "Por confirmar";
  if (!event.end || event.end === event.start) return formatDatePart(event.start);

  const start = new Date(`${event.start}T12:00:00`);
  const end = new Date(`${event.end}T12:00:00`);

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    const monthYear = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(end);
    return `${start.getDate()}-${end.getDate()} ${monthYear}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${formatDateWithoutYear(event.start)} - ${formatDatePart(event.end)}`;
  }

  return `${formatDatePart(event.start)} - ${formatDatePart(event.end)}`;
}

function buildDescription(event: EventItem) {
  const location = [event.city, event.province].filter(Boolean).join(", ");
  return `Consulta fecha, ubicación, fuente oficial y entradas del ${event.title} en ${location || "España"}. Evento de ${event.discipline} en el calendario EventoMotor.`;
}

function buildAboutText(event: EventItem) {
  const location = [event.city, event.province].filter((value) => value && value !== "Por confirmar").join(", ");
  const region = event.region && event.region !== "Por confirmar" ? `, ${event.region}` : "";
  const source = event.source && event.source !== "Supabase" ? ` La información procede de ${event.source}.` : "";

  return `${event.title} es un evento de ${event.discipline || "motor"} previsto en ${location || "ubicación por confirmar"}${region}, del ${formatEventDate(event)}. Forma parte del calendario de eventos de motor en España para ${vehicleLabel(event).toLowerCase()}. Antes de desplazarte, consulta siempre la fuente oficial por si hubiera cambios de horario, inscripción o programa.${source}`;
}

function buildJsonLd(event: EventItem, url: string, imageUrl: string) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: buildDescription(event),
    startDate: event.start,
    endDate: event.end || event.start,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url,
    image: [imageUrl],
    location: {
      "@type": "Place",
      name: event.venue || event.city || "Por confirmar",
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city || undefined,
        addressRegion: event.province || undefined,
        addressCountry: "ES",
      },
    },
  };

  if (event.source) {
    jsonLd.organizer = {
      "@type": "Organization",
      name: event.source,
      url: event.sourceUrl || undefined,
    };
  }

  if (event.ticketUrl) {
    const offerData = event as EventOfferData;
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: event.ticketUrl,
      availability: "https://schema.org/InStock",
    };

    const hasNumericPrice = offerData.price !== null && offerData.price !== undefined && offerData.price !== "";
    const numericPrice = hasNumericPrice ? Number(offerData.price) : Number.NaN;
    const hasRealPrice = Number.isFinite(numericPrice) && (numericPrice > 0 || offerData.isFree === true);

    if (hasRealPrice) {
      offer.price = String(offerData.price);
      if (offerData.priceCurrency) {
        offer.priceCurrency = offerData.priceCurrency;
      }
    }

    if (offerData.validFrom) {
      offer.validFrom = offerData.validFrom;
    }

    jsonLd.offers = offer;
  }

  return jsonLd;
}

function relatedScore(current: EventItem, candidate: EventItem) {
  if (candidate.id === current.id || !candidate.start) return -1;

  const sameProvince = candidate.province === current.province;
  const sameDiscipline = candidate.discipline === current.discipline;
  const sameVehicleType = vehicleTypeOf(candidate) === vehicleTypeOf(current);

  if (sameProvince && sameDiscipline) return 40;
  if (sameProvince && sameVehicleType) return 30;
  if (sameDiscipline) return 20;
  if (sameVehicleType) return 10;

  return -1;
}

function getRelatedEvents(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => event.id !== current.id && event.start >= today)
    .map((event) => ({ event, score: relatedScore(current, event) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.event.start.localeCompare(b.event.start))
    .slice(0, 6)
    .map((item) => item.event);
}

function internalLinks(event: EventItem) {
  const type = vehicleTypeOf(event);
  const typeHref = type === "moto" ? "/eventos-moto" : "/calendario";

  return [
    {
      label: `Ver eventos en ${valueOrPending(event.province)}`,
      meta: "Misma provincia",
      href: `/eventos-moto/${getRegionSlug(event.province)}`,
    },
    {
      label: `Ver más eventos de ${valueOrPending(event.discipline)}`,
      meta: "Misma disciplina",
      href: `/eventos-moto/${getDisciplineSlug(event.discipline)}`,
    },
    {
      label: `Ver eventos de ${vehicleLabel(event).toLowerCase()}`,
      meta: "Mismo tipo de vehículo",
      href: typeHref,
    },
  ];
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) return {};

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/evento/${event.slug || slug}`;
  const year = event.start ? new Date(`${event.start}T12:00:00`).getFullYear() : "";
  const title = `${event.title}${year ? ` ${year}` : ""}`;
  const description = buildDescription(event);
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const image = absoluteImageUrl(eventImage, siteUrl);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "EventoMotor",
      type: "article",
      images: [{ url: image, alt: eventImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const events = await getVisibleEvents();
  const event = events.find((item) => item.slug === slug);

  if (!event) notFound();

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/evento/${event.slug || slug}`;
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const imageUrl = absoluteImageUrl(eventImage, siteUrl);
  const jsonLd = buildJsonLd(event, url, imageUrl);
  const relatedEvents = getRelatedEvents(event, events);
  const color = getDisciplineColor(event.discipline);
  const sourceAvailable = Boolean(event.sourceUrl);
  const links = internalLinks(event);
  const trackingEventParams = {
    event_slug: event.slug || slug,
    event_title: event.title,
    source: event.source,
  };

  return (
    <div className="emc-page">
      <ConceptStyles />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ConceptStaticHeader />

      <article>
        <section className="emc-event-hero">
          <div className="emc-container emc-event-hero-grid">
            <div>
              <div className="emc-event-breadcrumb">
                <Link href="/">Inicio</Link>
                <span>/</span>
                <Link href="/calendario">Calendario</Link>
                <span>/</span>
                <Link href={`/eventos-moto/${getDisciplineSlug(event.discipline)}`}>{event.discipline}</Link>
                <span>/</span>
                <strong>{event.title}</strong>
              </div>
              <div className="emc-event-chip-row">
                <span className="emc-badge">{vehicleLabel(event)}</span>
                <span className="emc-badge" style={{ borderColor: `${color.accent}66`, backgroundColor: `${color.accent}18` }}>
                  {event.discipline}
                </span>
              </div>
              <p className="emc-event-date-line">{formatEventDate(event).toUpperCase()}</p>
              <h1>{event.title}</h1>
              <p className="emc-event-location">
                {valueOrPending(event.venue)} / {valueOrPending(event.city)} / {valueOrPending(event.province)}
              </p>
              {event.championship || event.source ? (
                <p className="emc-event-subline">{[event.championship, event.source].filter(Boolean).join(" / ")}</p>
              ) : null}
              <p className="emc-event-intro">{buildAboutText(event)}</p>
            </div>

            <aside className="emc-event-side">
              <div className="emc-event-media-card">
                <Image
                  alt={eventImageAlt}
                  className="emc-event-image"
                  height={720}
                  priority
                  sizes="(max-width: 760px) 92vw, 460px"
                  src={eventImage}
                  unoptimized={isRemoteImage(eventImage)}
                  width={1152}
                />
              </div>

              <section className="emc-event-summary-card">
                <div className="emc-mini-head">
                  <h3>Ficha del evento</h3>
                  <span>{vehicleLabel(event)}</span>
                </div>
                <div className="emc-event-summary-list">
                  <SummaryRow label="Fecha" value={formatEventDate(event)} />
                  <SummaryRow label="Lugar" value={valueOrPending(event.venue)} />
                  <SummaryRow label="Ciudad/provincia" value={`${valueOrPending(event.city)} / ${valueOrPending(event.province)}`} />
                  <SummaryRow label="Tipo" value={vehicleLabel(event)} />
                  <SummaryRow label="Fuente" value={valueOrPending(event.source)} />
                </div>
                <div className="emc-event-actions">
                  {sourceAvailable ? (
                    <TrackAnchor
                      className={event.ticketUrl ? "emc-btn emc-btn-dark" : "emc-btn emc-btn-primary"}
                      eventName="click_official_source"
                      eventParams={trackingEventParams}
                      href={event.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ver fuente oficial
                    </TrackAnchor>
                  ) : null}
                  {event.ticketUrl ? (
                    <TrackAnchor
                      className="emc-btn emc-btn-primary"
                      eventName="click_tickets"
                      eventParams={trackingEventParams}
                      href={event.ticketUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Entradas / inscripción
                    </TrackAnchor>
                  ) : null}
                  <ShareEventButton title={event.title} url={url} />
                </div>
                {!sourceAvailable ? <p className="emc-event-note">Fuente oficial pendiente de revisión.</p> : null}
              </section>
            </aside>
          </div>
        </section>

        <section className="emc-section emc-event-detail-section">
          <div className="emc-container emc-event-detail-grid">
            <section className="emc-panel emc-event-copy-card">
              <div className="emc-kicker">Sobre el evento</div>
              <h2>{event.title}</h2>
              <p>{buildAboutText(event)}</p>
            </section>

            <section className="emc-panel emc-event-warning-card">
              <div className="emc-kicker">Antes de ir</div>
              <h3>Confirma la información oficial</h3>
              <p>Revisa la fuente oficial antes de desplazarte. Las fechas, horarios o inscripciones pueden cambiar.</p>
              {sourceAvailable ? (
                <TrackAnchor
                  className="emc-btn emc-btn-light"
                  eventName="click_official_source"
                  eventParams={trackingEventParams}
                  href={event.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir fuente
                </TrackAnchor>
              ) : null}
            </section>
          </div>
        </section>

        <section className="emc-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Información práctica</div>
                <h2>Datos clave para planificar</h2>
              </div>
            </div>
            <div className="emc-event-info-grid">
              <Info label="Fecha" value={formatEventDate(event)} />
              <Info label="Ubicación" value={valueOrPending(event.venue)} />
              <Info label="Ciudad" value={valueOrPending(event.city)} />
              <Info label="Provincia" value={valueOrPending(event.province)} />
              <Info label="Comunidad" value={valueOrPending(event.region)} />
              <Info label="Disciplina" value={valueOrPending(event.discipline)} />
              <Info label="Tipo de vehículo" value={vehicleLabel(event)} />
              <Info label="Fuente" value={valueOrPending(event.source)} />
            </div>
            <div className="emc-practical-actions">
              {sourceAvailable ? (
                <TrackAnchor
                  className={event.ticketUrl ? "emc-btn emc-btn-dark" : "emc-btn emc-btn-primary"}
                  eventName="click_official_source"
                  eventParams={trackingEventParams}
                  href={event.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ver fuente oficial
                </TrackAnchor>
              ) : null}
              {event.ticketUrl ? (
                <TrackAnchor
                  className="emc-btn emc-btn-primary"
                  eventName="click_tickets"
                  eventParams={trackingEventParams}
                  href={event.ticketUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Entradas / inscripción
                </TrackAnchor>
              ) : null}
            </div>
          </div>
        </section>

        <section className="emc-section emc-internal-links-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Explorar más</div>
                <h2>Eventos relacionados por contexto</h2>
              </div>
            </div>
            <div className="emc-internal-links">
              {links.map((link) => (
                <Link className="emc-internal-link-card" href={link.href} key={link.href}>
                  <span>{link.meta}</span>
                  <strong>{link.label}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {event.tags.length ? (
          <section className="emc-section emc-event-tags-section">
            <div className="emc-container">
              <section className="emc-panel emc-event-tags">
                <div className="emc-kicker">Etiquetas</div>
                <div>
                  {event.tags.map((tag) => (
                    <span className="emc-badge" key={`${event.id}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {relatedEvents.length ? (
          <section className="emc-section" id="relacionados">
            <div className="emc-container">
              <div className="emc-section-head">
                <div>
                  <div className="emc-kicker">Eventos relacionados</div>
                  <h2>También puede interesarte</h2>
                </div>
                <Link className="emc-btn emc-btn-dark" href="/calendario">
                  Ver calendario
                </Link>
              </div>
              <div className="emc-results-grid">
                {relatedEvents.map((related) => {
                  const relatedColor = getDisciplineColor(related.discipline);
                  const label = dayLabel(related);

                  return (
                    <TrackLink
                      className="emc-result-card"
                      eventName="click_event_detail"
                      eventParams={{
                        event_slug: related.slug,
                        event_title: related.title,
                        discipline: related.discipline,
                        zone: related.region || related.province,
                        vehicle_type: vehicleTypeOf(related),
                      }}
                      href={eventHref(related)}
                      key={related.id}
                      style={{ "--emc-card-accent": relatedColor.accent } as CSSProperties}
                    >
                      <div className="emc-result-date">
                        {label.day}
                        <small>{label.month}</small>
                      </div>
                      <div>
                        <div className="emc-result-meta">
                          <span className="emc-badge">{related.discipline}</span>
                          <span className="emc-badge">{vehicleLabel(related)}</span>
                        </div>
                        <h3>{related.title}</h3>
                        <p>{formatRange(related)} / {related.city}, {related.province}</p>
                        <span className="emc-card-action">Ver evento</span>
                      </div>
                    </TrackLink>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section className="emc-section">
          <div className="emc-container">
            <div className="emc-panel emc-pro-panel emc-event-cta">
              <div>
                <div className="emc-kicker">Más eventos</div>
                <h2>¿Buscas más planes de motor?</h2>
                <p className="emc-pro-copy">Explora el calendario completo o filtra por eventos de moto y coche.</p>
                <div className="emc-pro-actions">
                  <Link className="emc-btn emc-btn-primary" href="/calendario">
                    Ver calendario
                  </Link>
                  <Link className="emc-btn emc-btn-dark" href="/calendario">
                    Ver más eventos {vehicleLabel(event).toLowerCase()}
                  </Link>
                </div>
              </div>
              <div className="emc-checks">
                <div className="emc-check">
                  <strong>{vehicleLabel(event)}</strong>
                  <span>Filtro principal</span>
                </div>
                <div className="emc-check">
                  <strong>{event.discipline}</strong>
                  <span>Disciplina</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </article>

      <footer className="emc-footer">
        <div className="emc-container emc-footer-grid">
          <div>
            <div className="emc-footer-brand">
              <EventomotorLogo />
            </div>
            <p>Calendario de eventos de motor por fecha, zona y disciplina.</p>
            <p className="emc-footer-contact">
              Contacto y publicación de eventos: <TrackAnchor eventName="click_contact_email" eventParams={{ location: "event_detail_footer" }} href="mailto:info@eventomotor.com">info@eventomotor.com</TrackAnchor>
            </p>
          </div>
          <div className="emc-footer-legal">© {new Date().getFullYear()} EventoMotor</div>
        </div>
      </footer>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="emc-event-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
