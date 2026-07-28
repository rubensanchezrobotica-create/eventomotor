"use client";

import Link from "next/link";
import type { RenderedNewsletterEmail } from "@/emails/newsletter/email-types";
import NewsletterCaptureVariants from "./NewsletterCaptureVariants";
import NewsletterEmailShowcase from "./NewsletterEmailShowcase";
import NewsletterSignupForm from "./NewsletterSignupForm";
import type { NewsletterPreviewOptions } from "./newsletter-preview-model";
import styles from "./NewsletterPreview.module.css";

type NewsletterPreviewPageProps = {
  emails: RenderedNewsletterEmail[];
  initialOptions: NewsletterPreviewOptions;
};

const benefits = [
  { number: "01", title: "Eventos seleccionados", copy: "Una edición breve con contexto, no un volcado de resultados." },
  { number: "02", title: "Cerca de ti", copy: "La provincia elegida organiza la selección sin encerrarte en una sola zona." },
  { number: "03", title: "Fin de semana preparado", copy: "Fechas claras y planes comparables para decidir con tiempo." },
  { number: "04", title: "Menos tiempo buscando", copy: "Concentraciones, rallyes, clásicos, motos y circuito en un solo vistazo." },
];

const flow = [
  { step: "1", title: "Registro", copy: "Email y provincia" },
  { step: "2", title: "Confirmación", copy: "Doble opt-in" },
  { step: "3", title: "Bienvenida", copy: "Expectativas claras" },
  { step: "4", title: "Agenda semanal", copy: "Selección editorial" },
];

export default function NewsletterPreviewPage({ emails, initialOptions }: NewsletterPreviewPageProps) {
  const weeklyEmail = emails.find((email) => email.kind === "weekly");

  return (
    <main>
      <section className={styles.hero} id="producto-newsletter">
        <div className={`emc-container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>LA AGENDA MOTOR · EVENTOMOTOR</span>
            <h1>Tu próximo plan de motor, <em>cada semana</em> en tu correo.</h1>
            <p>Concentraciones, rallyes, clásicos, motos, circuitos y mucho más, seleccionados cerca de ti.</p>
            <div className={styles.heroProof} aria-label="Resumen del producto">
              <span><strong>1</strong> correo semanal</span>
              <span><strong>3–7</strong> planes seleccionados</span>
              <span className={styles.proofText}>Solo lo que merece la pena</span>
            </div>
          </div>
          <div className={styles.signupCard}>
            <div className={styles.signupCardHeader}>
              <span>LA AGENDA MOTOR</span>
              <strong>El próximo plan empieza aquí</strong>
              <p>Elige tu provincia y recibe una selección semanal pensada para ti.</p>
            </div>
            <NewsletterSignupForm />
            <p className={styles.internalFormNotice}>
              Entorno interno: el envío real de correo todavía no está habilitado.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section} id="beneficios">
        <div className="emc-container">
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>TU SEMANA, MEJOR ELEGIDA</span>
            <h2>Menos tiempo buscando. Más planes que merecen la pena.</h2>
            <p>La promesa editorial se apoya en cuatro beneficios concretos y fáciles de comprobar.</p>
          </div>
          <div className={styles.benefitGrid}>
            {benefits.map((benefit) => (
              <article key={benefit.number}>
                <span>{benefit.number}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {weeklyEmail ? (
        <section className={styles.agendaSampleSection} id="muestra-agenda">
          <div className={`emc-container ${styles.agendaSampleGrid}`}>
            <div className={styles.agendaSampleCopy}>
              <span className={styles.eyebrow}>UNA EDICIÓN, DE UN VISTAZO</span>
              <h2>Así llegará La Agenda Motor a tu bandeja.</h2>
              <p>Una selección breve, contextual y fácil de recorrer para decidir el siguiente plan sin perder tiempo.</p>
              <a href="#laboratorio-r2">Explorar la preview completa</a>
            </div>
            <div className={styles.agendaSampleFrame}>
              <iframe
                sandbox=""
                srcDoc={weeklyEmail.html}
                tabIndex={-1}
                title="Muestra recortada del email semanal La Agenda Motor"
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.flowSection} id="flujo-newsletter">
        <div className="emc-container">
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>FLUJO VISUAL</span>
            <h2>De descubrirla a recibirla</h2>
          </div>
          <ol className={styles.flowList}>
            {flow.map((item, index) => (
              <li key={item.step}>
                <span>{item.step}</span>
                <div><strong>{item.title}</strong><small>{item.copy}</small></div>
                {index < flow.length - 1 ? <i aria-hidden="true">→</i> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.labSection} id="laboratorio-r2">
        <div className="emc-container">
          <div className={styles.labIntro}>
            <div>
              <span className={styles.internalBadge}>PREVIEW INTERNA · R2</span>
              <h2>Laboratorio interno R2</h2>
              <p>Estados, integraciones futuras y render técnico. Sin envíos, persistencia ni servicios externos.</p>
            </div>
            <Link href="/preview-concept">← Volver a la preview principal</Link>
          </div>

          <div className={styles.labBlock}>
            <div className={styles.labBlockHeading}>
              <span>ESTADOS DEL FORMULARIO</span>
              <h3>Comportamientos previstos</h3>
            </div>
            <NewsletterSignupForm initialState={initialOptions.formState} variant="lab" />
          </div>

          <div className={styles.labBlock} id="variantes">
            <div className={styles.labBlockHeading}>
              <span>CAPTACIÓN FUTURA</span>
              <h3>Cuatro contextos, un mismo producto</h3>
              <p>Ninguna variante está integrada en páginas públicas.</p>
            </div>
            <NewsletterCaptureVariants />
          </div>

          <div className={styles.labBlock} id="emails">
            <div className={styles.labBlockHeading}>
              <span>RENDER TÉCNICO</span>
              <h3>Tres emails, una única fuente real</h3>
              <p>El visor muestra exactamente el HTML generado por cada componente React Email.</p>
            </div>
            <NewsletterEmailShowcase
              emails={emails}
              initialKind={initialOptions.emailKind}
              initialViewport={initialOptions.emailViewport}
            />
          </div>

          <div className={styles.notesCard}>
            <div>
              <span className={styles.eyebrow}>NOTAS Y LÍMITES DEL MVP</span>
              <h2>Qué estamos evaluando en R2</h2>
            </div>
            <div className={styles.notesGrid}>
              <article><strong>Implementado</strong><p>Preview conectada a los contratos HTTP internos, estados, plantillas, HTML y texto plano.</p></article>
              <article><strong>Simulado</strong><p>Contenido editorial, variantes futuras y estados visuales del laboratorio.</p></article>
              <article><strong>R3B.2</strong><p>Solicitud, confirmación y baja mediante POST, con producción y correo real bloqueados.</p></article>
              <article><strong>Revisión legal</strong><p>Consentimiento, preferencias, baja y textos definitivos deben aprobarse antes de una integración pública.</p></article>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
