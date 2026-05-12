import type { Metadata } from "next";
import Link from "next/link";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SITE_URL } from "@/lib/seo";

const CONTACT_EMAIL = "info@eventomotor.com";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contacta con EventoMotor para dudas, correcciones de eventos, colaboraciones o propuestas.",
  alternates: {
    canonical: `${SITE_URL}/contacto`,
  },
};

export default function ContactoPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />

      <main className="emc-contact-page">
        <section className="emc-contact-hero">
          <div className="emc-container emc-contact-grid">
            <div>
              <div className="emc-kicker">Contacto</div>
              <h1>Contacta con EventoMotor</h1>
              <p className="emc-contact-lead">
                Para dudas, correcciones de eventos, colaboraciones o propuestas, puedes escribirnos directamente.
              </p>
              <div className="emc-contact-actions">
                <TrackAnchor
                  className="emc-btn emc-btn-primary"
                  eventName="click_contact_email"
                  eventParams={{ location: "contact_page_cta" }}
                  href={`mailto:${CONTACT_EMAIL}?subject=Contacto%20EventoMotor`}
                >
                  Escribir email
                </TrackAnchor>
                <Link className="emc-btn emc-btn-dark" href="/">
                  Volver al calendario
                </Link>
              </div>
            </div>

            <aside className="emc-panel emc-contact-card" aria-label="Correo de contacto">
              <span>Email</span>
              <TrackAnchor
                eventName="click_contact_email"
                eventParams={{ location: "contact_page_card" }}
                href={`mailto:${CONTACT_EMAIL}?subject=Contacto%20EventoMotor`}
              >
                {CONTACT_EMAIL}
              </TrackAnchor>
              <p>Contacto y publicación de eventos de motor en España.</p>
            </aside>
          </div>
        </section>
      </main>

      <ConceptFooter />
    </div>
  );
}
