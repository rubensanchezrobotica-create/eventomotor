import type { Metadata } from "next";
import Link from "next/link";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sin conexión",
  description: "Página offline de EventoMotor.",
  alternates: {
    canonical: `${SITE_URL}/offline`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflinePage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader compactActions />
      <main className="emc-contact-page">
        <section className="emc-contact-hero">
          <div className="emc-container emc-contact-grid">
            <div>
              <div className="emc-kicker">Modo offline</div>
              <h1>Estás sin conexión</h1>
              <p className="emc-contact-lead">
                Puedes volver a intentarlo cuando recuperes conexión.
              </p>
              <div className="emc-contact-actions">
                <Link className="emc-btn emc-btn-primary" href="/">
                  Volver al inicio
                </Link>
              </div>
            </div>
            <aside className="emc-contact-card" aria-label="Estado de conexión">
              <span>EventoMotor PWA</span>
              <p>
                La agenda se actualiza desde internet. Para evitar información antigua, los eventos y la API no se guardan en caché offline.
              </p>
              <small>Recarga la página cuando vuelva la conexión.</small>
            </aside>
          </div>
        </section>
      </main>
      <ConceptFooter />
    </div>
  );
}
