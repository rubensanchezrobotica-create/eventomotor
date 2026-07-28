import type { Metadata } from "next";
import Link from "next/link";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import EventSubmissionForm from "@/components/public/EventSubmissionForm";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import { SITE_URL } from "@/lib/seo";

const CONTACT_EMAIL = "info@eventomotor.com";
const EVENT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=Publicar%20evento%20en%20EventoMotor`;

const publishBenefits = [
  {
    title: "Publicación gratuita",
    detail: "Puedes enviar tu evento para revisión sin coste.",
  },
  {
    title: "Ficha individual del evento",
    detail: "Una página propia para compartir y enlazar desde otros canales.",
  },
  {
    title: "Fuente oficial o entradas",
    detail: "Enlazamos a la web, cartel, inscripción o venta cuando existe.",
  },
  {
    title: "Calendario, zonas y disciplinas",
    detail: "El evento puede aparecer por fecha, provincia, zona y tipo.",
  },
  {
    title: "Revisión antes de publicar",
    detail: "Comprobamos que haya datos verificables para mantener calidad.",
  },
  {
    title: "Búsquedas de motor",
    detail: "Las fichas pueden posicionar para consultas relacionadas con eventos.",
  },
];

const acceptedEvents = [
  "Concentraciones moteras",
  "Motoalmuerzos y matinales",
  "Rallyes y rallysprint",
  "Trackdays, tandas y rodadas",
  "Ferias y salones",
  "Rutas mototurísticas",
  "Karting",
  "4x4 y offroad",
  "Eventos clásicos y custom",
];

const publishPlacements = [
  {
    title: "Calendario nacional",
    detail: "Visible por fecha",
  },
  {
    title: "Mapa por zonas",
    detail: "Descubrimiento territorial",
  },
  {
    title: "Búsquedas por disciplina",
    detail: "Usuarios con intención clara",
  },
  {
    title: "Ficha individual del evento",
    detail: "Página propia para compartir",
  },
  {
    title: "Enlaces a fuente oficial y entradas",
    detail: "Clics hacia tu web o entradas",
  },
];

const processSteps = [
  "Envías la información del evento",
  "Revisamos que tenga fuente oficial o datos verificables",
  "Publicamos la ficha si encaja con EventoMotor",
  "El evento puede aparecer en calendario, zona y disciplina",
];

const requestedData = [
  {
    title: "Nombre del evento",
    detail: "Tal como aparece en la comunicación oficial.",
  },
  {
    title: "Fecha",
    detail: "Día o rango completo si dura varias jornadas.",
  },
  {
    title: "Ubicación",
    detail: "Ciudad, provincia y recinto si existe.",
  },
  {
    title: "Disciplina",
    detail: "Rally, concentración, circuito, ruta, feria, offroad...",
  },
  {
    title: "Web oficial o fuente",
    detail: "Imprescindible para poder verificar la publicación.",
  },
  {
    title: "Enlace de entradas si existe",
    detail: "También sirve inscripción, reservas o formulario oficial.",
  },
  {
    title: "Cartel o imagen si existe",
    detail: "Preferiblemente en buena calidad.",
  },
  {
    title: "Breve descripción del evento",
    detail: "Sin inventar programa: solo información confirmada.",
  },
];

const publishInternalLinks = [
  { label: "Calendario de eventos", href: PUBLIC_NAVIGATION.calendar },
  { label: "Eventos este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
  { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
  { label: "Rallyes en España 2026", href: "/rallyes-espana-2026" },
  { label: "Trackdays en España 2026", href: "/trackdays-espana-2026" },
];

export const metadata: Metadata = {
  title: "Publicar evento de motor gratis",
  description:
    "Publica gratis tu concentración motera, rallye, rodada, feria, ruta o evento de motor en EventoMotor. Revisamos la información y enlazamos a la fuente oficial.",
  alternates: {
    canonical: `${SITE_URL}/publicar-evento`,
  },
};

export default function PublicarEventoPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader compactActions />

      <main className="emc-contact-page emc-publish-page">
        <section className="emc-contact-hero">
          <div className="emc-container emc-contact-grid">
            <div>
              <div className="emc-kicker">Organizadores</div>
              <h1>Publica tu evento en EventoMotor</h1>
              <p className="emc-contact-lead">
                Da visibilidad a tu concentración, rallye, rodada, feria, ruta, curso o quedada en un calendario especializado en eventos de motor.
              </p>
              <div className="emc-contact-actions">
                <TrackAnchor
                  className="emc-btn emc-btn-primary"
                  eventName="click_publish_event"
                  eventParams={{ source: "publish_page_cta" }}
                  href="#enviar-evento"
                >
                  Enviar evento
                </TrackAnchor>
                <Link className="emc-contact-secondary-link" href={PUBLIC_NAVIGATION.calendar}>
                  Ver calendario
                </Link>
              </div>
            </div>

            <aside className="emc-panel emc-contact-card" aria-label="Correo para publicar eventos">
              <span>PUBLICACIÓN GRATUITA</span>
              <h2>Envía tu evento</h2>
              <TrackAnchor
                eventName="click_contact_email"
                eventParams={{ location: "publish_page_email_card" }}
                href={EVENT_MAILTO}
              >
                {CONTACT_EMAIL}
              </TrackAnchor>
              <p>Incluye fecha, ubicación, tipo de evento y fuente oficial para poder revisarlo correctamente.</p>
              <small>Siempre que sea posible enlazamos a la fuente oficial del evento.</small>
            </aside>
          </div>
        </section>

        <section className="emc-section emc-publish-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Por qué publicar</div>
                <h2>Más visibilidad para eventos reales de motor</h2>
              </div>
              <p>
                EventoMotor es un calendario especializado en eventos de motor en España, con páginas por fecha, zona, disciplina y fichas indexables en Google.
              </p>
            </div>
            <div className="emc-publish-grid emc-publish-benefits-grid">
              {publishBenefits.map((item) => (
                <div className="emc-publish-card" key={item.title}>
                  <span />
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="emc-section emc-contact-section" id="enviar-evento">
          <div className="emc-container">
            <EventSubmissionForm />
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-panel emc-publish-accepted">
              <div>
                <div className="emc-kicker">Qué eventos aceptamos</div>
                <h2>Eventos de motor con fecha, ubicación y fuente verificable</h2>
                <p>
                  Revisamos eventos reales relacionados con motos, coches, competición, rutas, ferias, circuito, karting, offroad, clásicos y cultura custom.
                </p>
              </div>
              <div className="emc-publish-chip-grid">
                {acceptedEvents.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="emc-section emc-publish-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Visibilidad</div>
                <h2>Dónde puede aparecer tu evento</h2>
              </div>
            </div>
            <div className="emc-publish-grid">
              {publishPlacements.map((item) => (
                <div className="emc-publish-card" key={item.title}>
                  <span />
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-panel emc-publish-process">
              <div>
                <div className="emc-kicker">Proceso</div>
                <h2>Cómo funciona</h2>
              </div>
              <div className="emc-publish-process-grid">
                {processSteps.map((step, index) => (
                  <div className="emc-publish-process-step" key={step}>
                    <span>{index + 1}</span>
                    <strong>{step}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-panel emc-publish-criteria">
              <div className="emc-kicker">Confianza</div>
              <h2>EventoMotor no organiza los eventos publicados</h2>
              <p>
                La información se revisa y se enlaza siempre que sea posible a la fuente oficial del evento. Los horarios, inscripciones, recorridos, precios o cambios de última hora deben confirmarse con el organizador.
              </p>
              <div className="emc-kicker emc-publish-kicker-spaced">Criterios</div>
              <h2>Criterios de publicación</h2>
              <p>
                Publicamos eventos reales de motor con fecha, ubicación y fuente verificable. Damos prioridad a eventos con información oficial, web, cartel o enlace de entradas.
              </p>
              <p>
                No publicamos eventos sin fuente verificable. Priorizamos la información oficial para mantener el calendario actualizado y fiable.
              </p>
            </div>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-panel emc-contact-list-panel">
              <div>
                <div className="emc-kicker">Datos necesarios</div>
                <h2>Qué debes enviar</h2>
                <p className="emc-contact-list-copy">
                  Cuanto más clara sea la información, más rápido podremos revisar el evento y preparar una ficha útil para los usuarios.
                </p>
              </div>
              <div className="emc-contact-list">
                {requestedData.map((item) => (
                  <div className="emc-contact-list-item" key={item.title}>
                    <span />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="emc-section emc-internal-links-section emc-opportunity-links-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Explora EventoMotor</div>
                <h2>Consulta ejemplos de páginas donde puede aparecer un evento</h2>
              </div>
            </div>
            <div className="emc-internal-links">
              {publishInternalLinks.map((link) => (
                <Link className="emc-internal-link-card" href={link.href} key={link.href}>
                  <span>Enlace interno</span>
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
