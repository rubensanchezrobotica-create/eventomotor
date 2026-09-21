import type { Metadata } from "next";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { SITE_URL } from "@/lib/seo";
import legalStyles from "../legal-document.module.css";

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
    <div className={`${legalStyles.legalPage} ${redesignV2DisplayPilot.variable}`}>
      <V2InteriorShell
        breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Cookies" }]}
        description="Aquí puedes consultar qué categorías de cookies usa EventoMotor y cómo cambiar o retirar tu consentimiento."
        eyebrow="Legal"
        heroTitleFontClassName={redesignV2DisplayPilot.variable}
        navigationMode="public"
        title="Política de cookies"
      >
        <div className={legalStyles.content}>
          <article className={legalStyles.document}>
            <section>
              <span className={legalStyles.sectionEyebrow}>Consentimiento</span>
              <h2>Uso de cookies</h2>
              <p>
                Puedes cambiar tu elección en cualquier momento desde el enlace “Configurar cookies” del pie de página.
              </p>
            </section>
            <div className={legalStyles.cookieCategories}>
              {cookieSections.map((section) => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  <p>{section.text}</p>
                </section>
              ))}
            </div>
          </article>
        </div>
      </V2InteriorShell>
    </div>
  );
}
