import type { Metadata } from "next";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SITE_URL } from "@/lib/seo";
import legalStyles from "../legal-document.module.css";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: "Aviso legal e información general de EventoMotor.",
  alternates: {
    canonical: `${SITE_URL}/aviso-legal`,
  },
};

export default function AvisoLegalPage() {
  return (
    <div className={`emc-page ${legalStyles.legalPage}`}>
      <ConceptStyles />
      <ConceptStaticHeader compactActions />
      <main className="emc-contact-page emc-publish-page">
        <section className={`emc-contact-hero ${legalStyles.hero}`}>
          <div className={`emc-container ${legalStyles.heroInner}`}>
            <div className="emc-kicker">Legal</div>
            <h1>Aviso legal</h1>
            <p className={`emc-contact-lead ${legalStyles.lead}`}>
              Información general sobre el uso de EventoMotor y la naturaleza
              informativa del calendario de eventos.
            </p>
          </div>
        </section>

        <section className={`emc-section emc-contact-section ${legalStyles.content}`}>
          <div className={`emc-container ${legalStyles.contentInner}`}>
            <article className={`emc-panel emc-contact-list-panel emc-legal-document ${legalStyles.document}`}>
              <section>
                <h2>Titularidad</h2>
                <p>
                  El sitio web <code>eventomotor.com</code> corresponde al proyecto
                  EventoMotor, gestionado por:
                </p>
                <p><strong>Titular:</strong> Rubén Ginés Sánchez García</p>
                <p>
                  <strong>Contacto:</strong>{" "}
                  <a href="mailto:info@eventomotor.com">info@eventomotor.com</a>
                </p>
                <p><strong>País de establecimiento:</strong> España</p>
                <p>
                  EventoMotor es actualmente un proyecto gestionado por una persona
                  física y no una sociedad mercantil.
                </p>
              </section>

              <section>
                <h2>Finalidad del sitio</h2>
                <p>
                  EventoMotor ofrece información y herramientas para descubrir
                  eventos relacionados con el mundo del motor y permite que los
                  organizadores remitan solicitudes de publicación para su revisión.
                </p>
                <p>
                  La información publicada tiene carácter informativo. Las fechas,
                  ubicaciones, precios, horarios, condiciones de acceso y posibles
                  cambios o cancelaciones deben comprobarse en los canales oficiales
                  del organizador antes de asistir.
                </p>
              </section>

              <section>
                <h2>Contenidos remitidos por organizadores</h2>
                <p>
                  EventoMotor puede revisar, corregir, rechazar, retirar o actualizar
                  las solicitudes recibidas cuando existan errores, dudas sobre su
                  legitimidad, riesgos para terceros o incumplimientos de las
                  condiciones del sitio.
                </p>
                <p>
                  Quien remita información declara que está autorizado para
                  facilitarla y solicitar su publicación.
                </p>
              </section>

              <section>
                <h2>Propiedad intelectual</h2>
                <p>
                  Los contenidos propios, diseño, marca y elementos de EventoMotor
                  están protegidos por la normativa aplicable.
                </p>
                <p>
                  Los carteles, fotografías, marcas y materiales de terceros
                  pertenecen a sus respectivos titulares y se utilizan para informar
                  y promocionar los eventos correspondientes. Sus titulares pueden
                  solicitar una corrección o retirada escribiendo a{" "}
                  <a href="mailto:info@eventomotor.com">info@eventomotor.com</a>.
                </p>
              </section>

              <section>
                <h2>Enlaces externos</h2>
                <p>
                  EventoMotor puede enlazar a páginas de organizadores,
                  inscripciones, venta de entradas o redes sociales. EventoMotor no
                  controla esas páginas ni responde de su disponibilidad, seguridad,
                  condiciones o contenido.
                </p>
              </section>

              <section>
                <h2>Responsabilidad</h2>
                <p>
                  EventoMotor procura revisar y actualizar la información, pero no
                  garantiza que todos los datos facilitados por terceros permanezcan
                  completos o actualizados.
                </p>
                <p>
                  La asistencia, inscripción, compra de entradas o participación se
                  formaliza con el organizador o proveedor correspondiente, no con
                  EventoMotor, salvo que se indique expresamente lo contrario.
                </p>
              </section>

              <section>
                <h2>Contacto y retirada</h2>
                <p>
                  Para solicitar una corrección, retirada de contenido o comunicar
                  una incidencia:{" "}
                  <a href="mailto:info@eventomotor.com">info@eventomotor.com</a>.
                </p>
              </section>

              <aside>
                <strong>Revisión obligatoria:</strong> antes de introducir
                publicidad, patrocinios, afiliación, servicios de pago o cualquier
                monetización, debe revisarse la aplicación de la LSSI y la posible
                publicación de domicilio y NIF.
              </aside>
            </article>
          </div>
        </section>
      </main>
      <ConceptFooter />
    </div>
  );
}
