import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShareEventButton from "@/components/ShareEventButton";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import type { EventItem } from "@/types/event";

type EventPageProps = {
  params: Promise<{ slug: string }>;
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
  const location = [event.city, event.province].filter(Boolean).join("/");
  return `Encuentra fecha, ubicación, disciplina y fuente oficial de ${event.title}, evento de ${event.discipline} en ${location || "España"}.`;
}

function buildAboutText(event: EventItem) {
  const location = [event.city, event.province].filter((value) => value && value !== "Por confirmar").join(", ");
  const venue = event.venue && event.venue !== "Por confirmar" ? ` Se celebrará en ${event.venue}.` : "";
  return `Evento de ${event.discipline || "motor"} previsto en ${location || "ubicación por confirmar"} del ${formatEventDate(event)}.${venue} Consulta siempre la fuente oficial antes de desplazarte.`;
}

function buildJsonLd(event: EventItem, url: string) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start,
    endDate: event.end || event.start,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url,
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
    jsonLd.offers = {
      "@type": "Offer",
      url: event.ticketUrl,
      availability: "https://schema.org/InStock",
    };
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

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) return {};

  const url = `${getSiteUrl()}/evento/${event.slug || slug}`;
  const title = `${event.title} | ${event.discipline} en ${event.province} | EventoMotor`;
  const description = buildDescription(event);

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
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const events = await getVisibleEvents();
  const event = events.find((item) => item.slug === slug);

  if (!event) notFound();

  const url = `${getSiteUrl()}/evento/${event.slug || slug}`;
  const jsonLd = buildJsonLd(event, url);
  const relatedEvents = getRelatedEvents(event, events);
  const color = getDisciplineColor(event.discipline);
  const sourceAvailable = Boolean(event.sourceUrl);

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
                <Link href="/preview-concept#resultados">Eventos</Link>
                <span>/</span>
                <span>{event.discipline}</span>
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

            <aside className="emc-event-summary-card">
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
                  <a className="emc-btn emc-btn-primary" href={event.sourceUrl} rel="noreferrer" target="_blank">
                    Ver fuente oficial
                  </a>
                ) : null}
                {event.ticketUrl ? (
                  <a className="emc-btn emc-btn-light" href={event.ticketUrl} rel="noreferrer" target="_blank">
                    Entradas / inscripción
                  </a>
                ) : null}
                <ShareEventButton title={event.title} url={url} />
              </div>
              {!sourceAvailable ? <p className="emc-event-note">Fuente oficial pendiente de revisión.</p> : null}
            </aside>
          </div>
        </section>

        <section className="emc-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Información rápida</div>
                <h2>Datos clave</h2>
              </div>
            </div>
            <div className="emc-event-info-grid">
              <Info label="Fecha" value={formatEventDate(event)} />
              <Info label="Lugar / circuito" value={valueOrPending(event.venue)} />
              <Info label="Ciudad" value={valueOrPending(event.city)} />
              <Info label="Provincia" value={valueOrPending(event.province)} />
              <Info label="Comunidad" value={valueOrPending(event.region)} />
              <Info label="Disciplina" value={valueOrPending(event.discipline)} />
              <Info label="Tipo" value={vehicleLabel(event)} />
              <Info label="Fuente" value={valueOrPending(event.source)} />
            </div>
          </div>
        </section>

        <section className="emc-section emc-event-detail-section">
          <div className="emc-container emc-event-detail-grid">
            <section className="emc-panel emc-event-copy-card">
              <div className="emc-kicker">Sobre el evento</div>
              <h2>{event.title}</h2>
              <p>{buildAboutText(event)}</p>
              {!sourceAvailable ? <small>Fuente oficial pendiente de revisión.</small> : null}
            </section>

            {event.tags.length ? (
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
            ) : null}
          </div>
        </section>

        {relatedEvents.length ? (
          <section className="emc-section" id="relacionados">
            <div className="emc-container">
              <div className="emc-section-head">
                <div>
                  <div className="emc-kicker">Eventos relacionados</div>
                  <h2>También puede interesarte</h2>
                </div>
                <Link className="emc-btn emc-btn-dark" href="/preview-concept#calendario">
                  Ver calendario
                </Link>
              </div>
              <div className="emc-results-grid">
                {relatedEvents.map((related) => {
                  const relatedColor = getDisciplineColor(related.discipline);
                  const label = dayLabel(related);

                  return (
                    <Link
                      className="emc-result-card"
                      href={eventHref(related)}
                      key={related.id}
                      style={{ "--emc-card-accent": relatedColor.accent } as React.CSSProperties}
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
                    </Link>
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
                  <Link className="emc-btn emc-btn-primary" href="/preview-concept#calendario">
                    Ver calendario
                  </Link>
                  <Link className="emc-btn emc-btn-dark" href="/preview-concept#resultados">
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
              <span className="emc-brand-mark" aria-hidden="true">EM</span>
              <span className="emc-brand-word">
                Evento<span>Motor</span>
              </span>
            </div>
            <p>Calendario de eventos de motor por fecha, zona y disciplina.</p>
          </div>
          <div>© {new Date().getFullYear()} EventoMotor</div>
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
