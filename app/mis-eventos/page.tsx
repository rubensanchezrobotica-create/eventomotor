import type { Metadata } from "next";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import MyEventsClient from "@/components/events/MyEventsClient";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mis eventos guardados",
  description: "Consulta los eventos de motor que has guardado en este dispositivo.",
  alternates: {
    canonical: `${SITE_URL}/mis-eventos`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function MisEventosPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />

      <main className="emc-contact-page emc-my-events-page">
        <section className="emc-my-events-hero">
          <div className="emc-container">
            <div className="emc-kicker">AGENDA PERSONAL</div>
            <h1>Mis eventos</h1>
            <p className="emc-my-events-lead">
              Tus eventos guardados en este dispositivo.
            </p>
            <p className="emc-my-events-note">No necesitas iniciar sesión. Se guardan solo en este navegador.</p>
          </div>
        </section>

        <section className="emc-my-events-section" aria-label="Agenda de eventos guardados">
          <div className="emc-container">
            <MyEventsClient />
          </div>
        </section>
      </main>

      <ConceptFooter />
    </div>
  );
}
