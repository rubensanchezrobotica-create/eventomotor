import type { Metadata } from "next";
import Link from "next/link";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SITE_URL } from "@/lib/seo";

const CONTACT_EMAIL = "info@eventomotor.com";
const EVENT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=Publicar%20evento%20en%20EventoMotor`;

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
  "Envías la información oficial",
  "Revisamos la fuente",
  "Creamos o actualizamos la ficha",
  "El evento aparece en calendario, zonas y disciplinas",
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

export const metadata: Metadata = {
  title: "Publicar evento de motor",
  description:
    "Envía tu evento de motor a EventoMotor para aparecer en el calendario nacional, mapa por zonas, búsquedas por disciplina y fichas de eventos.",
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
                Si organizas un evento de motor, envíanos la información oficial y revisaremos su publicación en el calendario, el mapa por zonas y una ficha individual del evento.
              </p>
              <div className="emc-contact-actions">
                <TrackAnchor
                  className="emc-btn emc-btn-primary"
                  eventName="click_publish_event"
                  eventParams={{ source: "publish_page_cta" }}
                  href={EVENT_MAILTO}
                >
                  Enviar evento
                </TrackAnchor>
                <Link className="emc-contact-secondary-link" href="/contacto">
                  Tengo otra consulta
                </Link>
              </div>
            </div>

            <aside className="emc-panel emc-contact-card" aria-label="Correo para publicar eventos">
              <span>EMAIL PARA ORGANIZADORES</span>
              <TrackAnchor
                eventName="click_contact_email"
                eventParams={{ location: "publish_page_email_card" }}
                href={EVENT_MAILTO}
              >
                {CONTACT_EMAIL}
              </TrackAnchor>
              <p>Incluye la fuente oficial para poder revisar la información con criterio.</p>
              <small>Respondemos normalmente en 24-48 h.</small>
            </aside>
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
              <div className="emc-kicker">Criterios</div>
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
      </main>

      <ConceptFooter />
    </div>
  );
}
