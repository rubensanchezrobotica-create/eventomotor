import type { Metadata } from "next";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: "Aviso legal e información general de EventoMotor.",
  alternates: {
    canonical: `${SITE_URL}/aviso-legal`,
  },
};

const legalItems = [
  {
    title: "Titularidad",
    text: "EventoMotor. Datos fiscales, domicilio y razón social completa: pendiente de completar por el titular del proyecto.",
  },
  {
    title: "Contacto",
    text: CONTACT_EMAIL,
  },
  {
    title: "Objeto de la web",
    text: "EventoMotor ofrece información sobre eventos de motor, fichas informativas, enlaces a fuentes oficiales y vías de contacto para organizadores.",
  },
  {
    title: "Información de eventos",
    text: "Los datos se muestran con finalidad informativa. Antes de desplazarte, revisa siempre la fuente oficial por posibles cambios.",
  },
  {
    title: "Enlaces externos",
    text: "La web puede enlazar a fuentes oficiales, organizadores o plataformas de entradas. EventoMotor no controla el contenido de sitios externos.",
  },
  {
    title: "Uso responsable",
    text: "El usuario se compromete a utilizar la web de forma lícita y respetuosa con terceros.",
  },
];

export default function AvisoLegalPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader compactActions />
      <main className="emc-contact-page emc-publish-page">
        <section className="emc-contact-hero">
          <div className="emc-container">
            <div className="emc-kicker">Legal</div>
            <h1>Aviso legal</h1>
            <p className="emc-contact-lead">
              Información general sobre el uso de EventoMotor y la naturaleza informativa del calendario de eventos.
            </p>
          </div>
        </section>

        <section className="emc-section emc-contact-section">
          <div className="emc-container">
            <div className="emc-panel emc-contact-list-panel">
              <div>
                <div className="emc-kicker">Información general</div>
                <h2>Condiciones básicas</h2>
                <p className="emc-contact-list-copy">
                  Este aviso legal debe revisarse y completarse con los datos identificativos definitivos del titular.
                </p>
              </div>
              <div className="emc-contact-list">
                {legalItems.map((item) => (
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
