import type { CSSProperties } from "react";
import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { OPPORTUNITY_PAGES, type OpportunityPage as OpportunityPageConfig } from "@/lib/opportunity-pages";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import type { EventItem } from "@/types/event";

function uniqueCount(values: Array<string | undefined>) {
  return new Set(values.filter(Boolean).map((value) => value?.trim()).filter(Boolean)).size;
}

function nextEventLabel(events: EventItem[]) {
  const first = events[0];
  if (!first) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${first.start}T12:00:00`));
}

function statClassName(label: string) {
  return label === "Próxima cita" ? "emc-opportunity-stat emc-opportunity-stat-date" : "emc-opportunity-stat";
}

function EventCard({ event }: { event: EventItem }) {
  const color = getDisciplineColor(event.discipline);
  const label = dayLabel(event);
  const vehicleType = event.vehicleType || event.vehicle_type;

  return (
    <TrackLink
      className={event.featured ? "emc-result-card emc-opportunity-card emc-opportunity-card-featured" : "emc-result-card emc-opportunity-card"}
      eventName="click_event_detail"
      eventParams={{
        event_slug: event.slug,
        event_title: event.title,
        discipline: event.discipline,
        zone: event.region || event.province,
        vehicle_type: vehicleType || "otros",
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
          {vehicleType ? <span className="emc-badge">{vehicleType}</span> : null}
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

function faqJsonLd(page: OpportunityPageConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export default async function OpportunityPage({ page }: { page: OpportunityPageConfig }) {
  const now = new Date();
  const events = (await getVisibleEvents())
    .filter((event) => page.filter(event, now))
    .sort((a, b) => a.start.localeCompare(b.start));
  const relatedOpportunityLinks = OPPORTUNITY_PAGES.filter((item) => item.slug !== page.slug).slice(0, 4);
  const stats = [
    { label: "Eventos", value: events.length.toString() },
    { label: "Provincias", value: uniqueCount(events.map((event) => event.province)).toString() },
    { label: "Disciplinas", value: uniqueCount(events.map((event) => event.discipline)).toString() },
    { label: "Próxima cita", value: nextEventLabel(events) },
  ];

  return (
    <div className="emc-page">
      <ConceptStyles />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(page)) }}
      />
      {page.faqs.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(page)) }}
        />
      ) : null}
      <ConceptStaticHeader />
      <main className="emc-contact-page emc-opportunity-page">
        <section className="emc-opportunity-hero">
          <div className="emc-container emc-opportunity-hero-grid">
            <div>
              <div className="emc-event-breadcrumb">
                <Link href="/">Inicio</Link>
                <span>/</span>
                <strong>{page.h1}</strong>
              </div>
              <div className="emc-kicker">{page.eyebrow}</div>
              <h1>{page.h1}</h1>
              <p className="emc-opportunity-lead">{page.lead}</p>
              <div className="emc-contact-actions emc-opportunity-actions">
                <Link className="emc-btn emc-btn-primary" href="/calendario">
                  Ver calendario completo
                </Link>
                <Link className="emc-contact-secondary-link" href="/publicar-evento">
                  Publicar evento
                </Link>
              </div>
            </div>

            <aside className="emc-opportunity-stats" aria-label="Resumen de esta página">
              {stats.map((stat) => (
                <div className={statClassName(stat.label)} key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-section-head emc-opportunity-events-head">
              <div>
                <div className="emc-kicker">Resultados filtrados</div>
                <h2>{page.resultsTitle}</h2>
              </div>
              <p>
                <span className="emc-opportunity-count-badge">{events.length} eventos</span>
                Resultados publicados en EventoMotor y enlazados a fichas individuales cuando existe información suficiente.
              </p>
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
                  <Link className="emc-btn emc-btn-primary" href="/calendario">
                    Consultar calendario completo
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="emc-section emc-opportunity-editorial-section">
          <div className="emc-container">
            <div className="emc-opportunity-editorial">
              <div>
                <div className="emc-kicker">Guía rápida</div>
                <h2>Qué encontrarás en esta página</h2>
                <p className="emc-opportunity-intro">{page.intro}</p>
              </div>
              <div className="emc-opportunity-mini-grid">
                {page.editorialBlocks.map((block) => (
                  <article className="emc-opportunity-mini-card" key={block.title}>
                    <span />
                    <strong>{block.title}</strong>
                    <p>{block.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="emc-section emc-opportunity-use-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Uso recomendado</div>
                <h2>Cómo usar este calendario</h2>
              </div>
              <p>Empieza por fecha y ubicación, abre la ficha que te interese y confirma los detalles en la fuente oficial.</p>
            </div>
            <div className="emc-opportunity-steps">
              {page.usageSteps.map((step, index) => (
                <article className="emc-opportunity-step" key={step.title}>
                  <span>{index + 1}</span>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {page.faqs.length ? (
          <section className="emc-section emc-opportunity-faq-section">
            <div className="emc-container">
              <div className="emc-section-head">
                <div>
                  <div className="emc-kicker">Preguntas frecuentes</div>
                  <h2>Dudas habituales</h2>
                </div>
              </div>
              <div className="emc-opportunity-faq-list">
                {page.faqs.map((faq) => (
                  <article className="emc-opportunity-faq" key={faq.question}>
                    <h3>{faq.question}</h3>
                    <p>{faq.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="emc-section emc-internal-links-section emc-opportunity-links-section">
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
              {relatedOpportunityLinks.map((link) => (
                <Link className="emc-internal-link-card" href={`/${link.slug}`} key={link.slug}>
                  <span>Búsqueda popular</span>
                  <strong>{link.h1}</strong>
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
