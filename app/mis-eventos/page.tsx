import type { Metadata } from "next";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import MyEventsClient from "@/components/events/MyEventsClient";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mis eventos guardados | EventoMotor",
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

      <main className="emc-contact-page">
        <section className="emc-contact-hero emc-my-events-hero">
          <div className="emc-container">
            <div className="emc-kicker">Agenda personal</div>
            <h1>Mis eventos</h1>
            <p className="emc-contact-lead">
              Tu agenda personal de eventos guardados en este dispositivo.
              <span>No necesitas iniciar sesión. Los eventos se guardan solo en este navegador.</span>
            </p>
          </div>
        </section>

        <section className="emc-section emc-contact-section emc-my-events-section">
          <div className="emc-container">
            <MyEventsClient />
          </div>
        </section>
      </main>

      <ConceptFooter />
    </div>
  );
}
