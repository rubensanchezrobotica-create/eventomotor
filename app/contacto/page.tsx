import type { Metadata } from "next";
import Link from "next/link";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { HOME_SECTION_LINKS } from "@/lib/public-navigation";
import { SITE_URL } from "@/lib/seo";

const CONTACT_EMAIL = "info@eventomotor.com";

export const metadata: Metadata = {
  title: "Contacto y publicación de eventos",
  description:
    "Contacta con EventoMotor para corregir o publicar eventos de motor, proponer colaboraciones o enviarnos información.",
  alternates: {
    canonical: `${SITE_URL}/contacto`,
  },
};

export default function ContactoPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />

      <main className="emc-contact-page emc-contact-compact-page">
        <section className="emc-contact-hero emc-contact-compact-hero">
          <div className="emc-container">
            <div className="emc-contact-grid">
              <div className="emc-contact-copy">
                <div className="emc-kicker">CONTACTO</div>
                <h1>Contacta con EventoMotor</h1>
                <p className="emc-contact-lead">
                  Para correcciones, publicación de eventos, colaboraciones o propuestas, escríbenos directamente.
                </p>
                <div className="emc-contact-actions">
                  <TrackAnchor
                    className="emc-btn emc-btn-primary"
                    eventName="click_contact_email"
                    eventParams={{ location: "contact_page_cta" }}
                    href={`mailto:${CONTACT_EMAIL}?subject=Contacto%20EventoMotor`}
                  >
                    Escribir a {CONTACT_EMAIL}
                  </TrackAnchor>
                  <Link className="emc-btn emc-btn-dark" href="/publicar-evento">
                    Publicar un evento
                  </Link>
                </div>
                <Link className="emc-contact-calendar-link" href={HOME_SECTION_LINKS.calendar}>
                  Volver al calendario
                </Link>
              </div>

              <aside className="emc-panel emc-contact-card" aria-labelledby="contact-email-title">
                <div className="emc-contact-mail-icon" aria-hidden="true" />
                <span>Correo directo</span>
                <h2 id="contact-email-title">Escríbenos directamente</h2>
                <TrackAnchor
                  eventName="click_contact_email"
                  eventParams={{ location: "contact_page_card" }}
                  href={`mailto:${CONTACT_EMAIL}?subject=Contacto%20EventoMotor`}
                >
                  {CONTACT_EMAIL}
                </TrackAnchor>
                <p>
                  Para actualizar información, publicar un evento o plantear una colaboración relacionada con el motor.
                </p>
              </aside>
            </div>

            <div className="emc-contact-reasons">
              <div className="emc-contact-reasons-heading">
                <h2>¿En qué podemos ayudarte?</h2>
                <p>Elige el motivo para escribirnos o utiliza el correo directo.</p>
              </div>
              <div className="emc-contact-reasons-grid">
                <article className="emc-contact-reason">
                  <span aria-hidden="true">01</span>
                  <h3>Corregir un evento</h3>
                  <p>Avísanos si encuentras una fecha, ubicación o información que debamos actualizar.</p>
                  <TrackAnchor
                    eventName="click_contact_email"
                    eventParams={{ location: "contact_reason_correction" }}
                    href={`mailto:${CONTACT_EMAIL}?subject=Correcci%C3%B3n%20de%20evento`}
                  >
                    Enviar corrección
                  </TrackAnchor>
                </article>
                <article className="emc-contact-reason">
                  <span aria-hidden="true">02</span>
                  <h3>Publicar un evento</h3>
                  <p>Los organizadores pueden enviarnos su evento gratuitamente desde el formulario de publicación.</p>
                  <Link href="/publicar-evento">Ir al formulario</Link>
                </article>
                <article className="emc-contact-reason">
                  <span aria-hidden="true">03</span>
                  <h3>Colaboraciones</h3>
                  <p>Propuestas, medios, clubes, circuitos y proyectos relacionados con el mundo del motor.</p>
                  <TrackAnchor
                    eventName="click_contact_email"
                    eventParams={{ location: "contact_reason_collaboration" }}
                    href={`mailto:${CONTACT_EMAIL}?subject=Colaboraci%C3%B3n%20con%20EventoMotor`}
                  >
                    Proponer colaboración
                  </TrackAnchor>
                </article>
              </div>
            </div>
          </div>
        </section>
      </main>

      <ConceptFooter />
    </div>
  );
}
