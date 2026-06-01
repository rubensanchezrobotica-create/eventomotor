import type { CSSProperties } from "react";
import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { eventAnalyticsParams } from "@/lib/analytics";
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
  if (!first) return "Sin próximas citas";

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
        ...eventAnalyticsParams(event),
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

function eventText(event: EventItem) {
  return [
    event.title,
    event.championship,
    event.discipline,
    event.venue,
    event.city,
    event.province,
    event.region,
    event.vehicleType,
    event.vehicle_type,
    ...(event.tags || []),
  ].join(" ").toLowerCase();
}

function hasAny(event: EventItem, terms: string[]) {
  const text = eventText(event);
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function eventDate(event: EventItem, field: "start" | "end") {
  return new Date(`${event[field] || event.start}T12:00:00`);
}

function isUpcomingEvent(event: EventItem, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDate(event, "end").getTime() >= today.getTime();
}

function overlapsDay(event: EventItem, date: Date) {
  const start = eventDate(event, "start");
  const end = eventDate(event, "end");
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  return start.getTime() <= dayEnd.getTime() && end.getTime() >= dayStart.getTime();
}

function weekendDays(now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay();
  const daysUntilSaturday = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { saturday, sunday };
}

function groupCount(events: EventItem[], terms: string[]) {
  return events.filter((event) => hasAny(event, terms)).length;
}

function provinceList(events: EventItem[]) {
  return Array.from(new Set(events.map((event) => event.province).filter(Boolean))).slice(0, 8);
}

function featuredWeekendEvents(events: EventItem[]) {
  const featured = events.filter((event) => event.featured);
  return (featured.length ? featured : events).slice(0, 3);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function monthKey(event: EventItem) {
  const date = eventDate(event, "start");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function groupEventsByMonth(events: EventItem[]) {
  const groups = new Map<string, { label: string; events: EventItem[] }>();

  for (const event of events) {
    const key = monthKey(event);
    if (!groups.has(key)) {
      groups.set(key, { label: monthLabel(eventDate(event, "start")), events: [] });
    }
    groups.get(key)?.events.push(event);
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    count: group.events.length,
    events: group.events,
  }));
}

function itemListJsonLd(page: OpportunityPageConfig, events: EventItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page.h1,
    itemListElement: events.slice(0, 20).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}${eventHref(event)}`,
      name: event.title,
    })),
  };
}

function CompactEventList({ events, emptyText = "Sin eventos en este grupo ahora mismo." }: { events: EventItem[]; emptyText?: string }) {
  if (!events.length) {
    return <p className="emc-weekend-empty">{emptyText}</p>;
  }

  return (
    <div className="emc-weekend-mini-list">
      {events.slice(0, 4).map((event) => (
        <Link href={eventHref(event)} key={event.id}>
          <strong>{event.title}</strong>
          <span>{formatRange(event)} / {event.city}, {event.province}</span>
        </Link>
      ))}
    </div>
  );
}

function CountGrid({ items }: { items: Array<{ label: string; count: number; href?: string }> }) {
  return (
    <div className="emc-weekend-count-grid">
      {items.map((item) => (
        <Link className={item.count ? "emc-weekend-count-card" : "emc-weekend-count-card emc-muted"} href={item.href || "/calendario"} key={item.label}>
          <strong>{item.count}</strong>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

function ConcentracionesSeoHub({ events, now }: { events: EventItem[]; now: Date }) {
  const upcomingEvents = events.filter((event) => isUpcomingEvent(event, now));
  const { saturday, sunday } = weekendDays(now);
  const weekendEvents = upcomingEvents.filter((event) => overlapsDay(event, saturday) || overlapsDay(event, sunday));
  const matinalEvents = upcomingEvents.filter((event) =>
    hasAny(event, ["matinal", "motoalmuerzo", "almuerzo", "quedada", "encuentro motero", "ruta solidaria"]),
  );
  const monthGroups = groupEventsByMonth(upcomingEvents).slice(0, 6);
  const provinces = provinceList(upcomingEvents);
  const nextEvent = upcomingEvents[0];

  return (
    <>
      <section className="emc-section emc-weekend-hub-section">
        <div className="emc-container">
          <div className="emc-weekend-update">
            <span>Calendario actualizado con concentraciones, matinales y motoalmuerzos publicados en EventoMotor.</span>
            {provinces.length ? <strong>{provinces.join(" / ")}</strong> : null}
          </div>

          <div className="emc-weekend-grid">
            <article className="emc-weekend-panel">
              <div className="emc-kicker">Resumen</div>
              <h2>{upcomingEvents.length} concentraciones próximas</h2>
              <p className="emc-weekend-empty">{provinces.length} provincias con eventos moteros visibles en esta página.</p>
            </article>
            <article className="emc-weekend-panel">
              <div className="emc-kicker">Próxima cita</div>
              <h2>{nextEvent ? nextEvent.title : "Sin próximas citas publicadas"}</h2>
              {nextEvent ? (
                <div className="emc-weekend-mini-list">
                  <Link href={eventHref(nextEvent)}>
                    <strong>{formatRange(nextEvent)}</strong>
                    <span>{nextEvent.city}, {nextEvent.province}</span>
                  </Link>
                </div>
              ) : null}
            </article>
            <article className="emc-weekend-panel">
              <div className="emc-kicker">Próximas fechas</div>
              <h2>{monthGroups.slice(0, 3).map((group) => group.label.split(" ")[0]).join(" / ") || "Sin próximos meses"}</h2>
              <p className="emc-weekend-empty">Solo se muestran meses con concentraciones futuras publicadas.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="emc-section emc-weekend-group-section">
        <div className="emc-container">
          <div className="emc-weekend-group-layout">
            <div>
              <div className="emc-kicker">Este fin de semana</div>
              <h3>Concentraciones moteras este fin de semana</h3>
              <CompactEventList
                emptyText="No hay concentraciones publicadas para este fin de semana. Consulta el calendario completo."
                events={weekendEvents}
              />
              <div className="emc-contact-actions emc-opportunity-actions">
                <Link className="emc-contact-secondary-link" href="/eventos-motor-este-fin-de-semana">
                  Ver todos los eventos del fin de semana
                </Link>
              </div>
            </div>
            <div>
              <div className="emc-kicker">Matinales y motoalmuerzos</div>
              <h3>Planes moteros de mañana y quedadas</h3>
              <CompactEventList events={matinalEvents} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function WeekendSeoHub({ events, now }: { events: EventItem[]; now: Date }) {
  const { saturday, sunday } = weekendDays(now);
  const saturdayEvents = events.filter((event) => overlapsDay(event, saturday));
  const sundayEvents = events.filter((event) => overlapsDay(event, sunday));
  const multiDayEvents = events.filter((event) => eventDate(event, "end").getTime() > eventDate(event, "start").getTime());
  const provinces = provinceList(events);
  const featured = featuredWeekendEvents(events);
  const disciplineGroups = [
    { label: "Rallyes", href: "/rallyes-espana-2026", count: groupCount(events, ["rally", "rallye", "rallysprint", "subida", "baja"]) },
    { label: "Concentraciones", href: "/concentraciones-moteras-2026", count: groupCount(events, ["concentracion", "concentración", "motoalmuerzo", "quedada", "biker", "custom"]) },
    { label: "Circuito / Rodadas", href: "/rodadas-moto-2026", count: groupCount(events, ["circuito", "rodada", "tandas", "trackday", "track day"]) },
    { label: "Karting", href: "/karting-espana-2026", count: groupCount(events, ["karting", "kart"]) },
    { label: "Ferias", href: "/ferias-motor-espana-2026", count: groupCount(events, ["feria", "salon", "salón", "expo", "exposicion", "exposición"]) },
    { label: "Clásicos", href: "/disciplinas/clasicos", count: groupCount(events, ["clasico", "clásico", "classic", "historico", "histórico"]) },
    { label: "Offroad", href: "/disciplinas/offroad", count: groupCount(events, ["enduro", "motocross", "trial", "offroad", "4x4"]) },
    { label: "Rutas", href: "/disciplinas/rutas", count: groupCount(events, ["ruta", "mototurismo", "touring"]) },
  ];
  const zoneGroups = [
    { label: "Cataluña / Aragón", count: groupCount(events, ["cataluna", "cataluña", "catalunya", "barcelona", "girona", "tarragona", "lleida", "aragon", "aragón", "zaragoza", "huesca", "teruel"]) },
    { label: "Levante", count: groupCount(events, ["valencia", "alicante", "castellon", "castellón", "murcia", "levante"]) },
    { label: "Centro", count: groupCount(events, ["madrid", "castilla", "toledo", "guadalajara", "cuenca", "avila", "ávila", "segovia"]) },
    { label: "Norte", count: groupCount(events, ["galicia", "asturias", "cantabria", "pais vasco", "país vasco", "navarra", "la rioja", "burgos", "leon", "león"]) },
    { label: "Sur", count: groupCount(events, ["andalucia", "andalucía", "sevilla", "malaga", "málaga", "cadiz", "cádiz", "cordoba", "córdoba", "granada", "huelva", "jaen", "jaén", "almeria", "almería"]) },
    { label: "Canarias", count: groupCount(events, ["canarias", "tenerife", "gran canaria", "las palmas"]) },
  ];

  return (
    <>
      <section className="emc-section emc-weekend-hub-section">
        <div className="emc-container">
          <div className="emc-weekend-update">
            <span>Agenda actualizada automáticamente con eventos publicados en EventoMotor.</span>
            {provinces.length ? <strong>{provinces.join(" / ")}</strong> : null}
          </div>

          {featured.length ? (
            <div className="emc-weekend-featured">
              <div className="emc-section-head">
                <div>
                  <div className="emc-kicker">Selección rápida</div>
                  <h2>Eventos destacados del fin de semana</h2>
                </div>
                <p>Usamos eventos marcados como destacados cuando existen; si no, mostramos las próximas citas publicadas.</p>
              </div>
              <div className="emc-results-grid">
                {featured.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="emc-weekend-grid">
            <article className="emc-weekend-panel">
              <div className="emc-kicker">Por día</div>
              <h2>Sábado</h2>
              <CompactEventList events={saturdayEvents} />
            </article>
            <article className="emc-weekend-panel">
              <div className="emc-kicker">Por día</div>
              <h2>Domingo</h2>
              <CompactEventList events={sundayEvents} />
            </article>
            <article className="emc-weekend-panel">
              <div className="emc-kicker">Varios días</div>
              <h2>Eventos de varios días</h2>
              <CompactEventList events={multiDayEvents} />
            </article>
          </div>
        </div>
      </section>

      <section className="emc-section emc-weekend-group-section">
        <div className="emc-container">
          <div className="emc-section-head">
            <div>
              <div className="emc-kicker">Explora rápido</div>
              <h2>Eventos por disciplina y zona</h2>
            </div>
            <p>Resumen útil para decidir qué ver este fin de semana sin recorrer todo el calendario.</p>
          </div>
          <div className="emc-weekend-group-layout">
            <div>
              <h3>Por disciplina</h3>
              <CountGrid items={disciplineGroups} />
            </div>
            <div>
              <h3>Por zona</h3>
              <CountGrid items={zoneGroups} />
            </div>
          </div>
        </div>
      </section>
    </>
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
  const visibleEvents = await getVisibleEvents();
  const primaryEvents = visibleEvents.filter((event) => page.filter(event, now));
  const fallbackEvents =
    page.fallbackFilter && primaryEvents.length < 6
      ? visibleEvents.filter((event) => page.fallbackFilter?.(event, now) && !primaryEvents.some((item) => item.id === event.id))
      : [];
  const isWeekendPage = page.slug === "eventos-motor-este-fin-de-semana";
  const isConcentracionesPage = page.slug === "concentraciones-moteras-2026";
  const events = [...primaryEvents, ...fallbackEvents].sort((a, b) => a.start.localeCompare(b.start));
  const displayEvents = isConcentracionesPage ? events.filter((event) => isUpcomingEvent(event, now)) : events;
  const hasItemListSchema = (isWeekendPage || isConcentracionesPage) && displayEvents.length > 0;
  const relatedOpportunityLinks = OPPORTUNITY_PAGES.filter((item) => item.slug !== page.slug).slice(0, 4);
  const stats = [
    { label: "Eventos", value: displayEvents.length.toString() },
    { label: "Provincias", value: uniqueCount(displayEvents.map((event) => event.province)).toString() },
    { label: "Disciplinas", value: uniqueCount(displayEvents.map((event) => event.discipline)).toString() },
    { label: "Próxima cita", value: nextEventLabel(displayEvents) },
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
      {hasItemListSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd(page, displayEvents)) }}
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

        {isWeekendPage ? <WeekendSeoHub events={events} now={now} /> : null}
        {isConcentracionesPage ? <ConcentracionesSeoHub events={displayEvents} now={now} /> : null}

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-section-head emc-opportunity-events-head">
              <div>
                <div className="emc-kicker">Resultados filtrados</div>
                <h2>{page.resultsTitle}</h2>
              </div>
              <p>
                <span className="emc-opportunity-count-badge">{displayEvents.length} eventos</span>
                Resultados publicados en EventoMotor y enlazados a fichas individuales cuando existe información suficiente.
              </p>
            </div>

            {displayEvents.length ? (
              <div className="emc-results-grid">
                {displayEvents.map((event) => (
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
