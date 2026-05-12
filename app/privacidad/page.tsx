import type { Metadata } from "next";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Información básica sobre el tratamiento de datos personales en EventoMotor.",
  alternates: {
    canonical: `${SITE_URL}/privacidad`,
  },
};

const privacyItems = [
  {
    title: "Responsable",
    text: "EventoMotor. Datos fiscales o razón social completa: pendiente de completar por el titular del proyecto.",
  },
  {
    title: "Contacto",
    text: CONTACT_EMAIL,
  },
  {
    title: "Finalidades",
    text: "Responder consultas, revisar correcciones o propuestas, gestionar solicitudes de publicación de eventos y mantener el calendario de EventoMotor.",
  },
  {
    title: "Analítica web",
    text: "Si aceptas cookies analíticas, podemos usar Google Analytics 4 para medir uso agregado de la web y mejorar la experiencia.",
  },
  {
    title: "Conservación",
    text: "Los mensajes y datos enviados se conservarán durante el tiempo necesario para atender la consulta o revisar el evento, salvo obligación legal aplicable.",
  },
  {
    title: "Derechos",
    text: "Puedes solicitar acceso, rectificación, supresión, oposición, limitación u otros derechos aplicables escribiendo al email de contacto.",
  },
];

export default function PrivacidadPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader compactActions />
      <main className="emc-contact-page emc-publish-page">
        <section className="emc-contact-hero">
          <div className="emc-container">
            <div className="emc-kicker">Legal</div>
            <h1>Política de privacidad</h1>
            <p className="emc-contact-lead">
              Información básica sobre cómo EventoMotor trata los datos recibidos por contacto, propuestas y publicación de eventos.
            </p>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-panel emc-contact-list-panel">
              <div>
                <div className="emc-kicker">Datos personales</div>
                <h2>Tratamiento de datos</h2>
                <p className="emc-contact-list-copy">
                  Este texto es una base informativa y debe completarse con los datos legales definitivos del responsable si procede.
                </p>
              </div>
              <div className="emc-contact-list">
                {privacyItems.map((item) => (
                  <div className="emc-contact-list-item" key={item.title}>
                    <span />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.text}</small>
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
