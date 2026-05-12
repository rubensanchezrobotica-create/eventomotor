import type { Metadata } from "next";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Información sobre cookies necesarias, cookies analíticas y configuración del consentimiento en EventoMotor.",
  alternates: {
    canonical: `${SITE_URL}/cookies`,
  },
};

const cookieSections = [
  {
    title: "Qué son las cookies",
    text: "Las cookies y tecnologías similares permiten que una web recuerde información técnica o preferencias del usuario. En EventoMotor las usamos de forma limitada y con una finalidad clara.",
  },
  {
    title: "Cookies necesarias",
    text: "Son imprescindibles para guardar tu preferencia de consentimiento y mantener funciones básicas de la web. No se pueden desactivar desde este panel.",
  },
  {
    title: "Cookies analíticas",
    text: "Si las aceptas, cargamos Google Analytics 4 para conocer métricas agregadas de uso: páginas visitadas, interacción con filtros, eventos y enlaces. No debe usarse para enviar datos personales.",
  },
  {
    title: "Marketing",
    text: "La categoría queda preparada para el futuro, pero actualmente EventoMotor no carga herramientas de marketing desde este consentimiento.",
  },
];

export default function CookiesPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader compactActions />
      <main className="emc-contact-page emc-publish-page">
        <section className="emc-contact-hero">
          <div className="emc-container">
            <div className="emc-kicker">Legal</div>
            <h1>Política de cookies</h1>
            <p className="emc-contact-lead">
              Aquí puedes consultar qué categorías de cookies usa EventoMotor y cómo cambiar o retirar tu consentimiento.
            </p>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-panel emc-contact-list-panel">
              <div>
                <div className="emc-kicker">Consentimiento</div>
                <h2>Uso de cookies</h2>
                <p className="emc-contact-list-copy">
                  Puedes cambiar tu elección en cualquier momento desde el enlace “Configurar cookies” del pie de página.
                </p>
              </div>
              <div className="emc-contact-list">
                {cookieSections.map((section) => (
                  <div className="emc-contact-list-item" key={section.title}>
                    <span />
                    <div>
                      <strong>{section.title}</strong>
                      <small>{section.text}</small>
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
