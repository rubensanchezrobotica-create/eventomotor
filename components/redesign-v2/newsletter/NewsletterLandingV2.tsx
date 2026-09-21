import Link from "next/link";
import NewsletterSignupForm from "@/components/newsletter/NewsletterSignupForm";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import styles from "./NewsletterLandingV2.module.css";

type NewsletterLandingContext = "public" | "preview";

const benefits = [
  {
    number: "01",
    title: "Eventos destacados",
    copy: "Una selección de citas de motor con fechas y contexto para descubrirlas de un vistazo.",
  },
  {
    number: "02",
    title: "El fin de semana",
    copy: "Planes que te ayudan a decidir qué hacer cuando llegan el sábado y el domingo.",
  },
  {
    number: "03",
    title: "Lo que viene",
    copy: "Próximas fechas para mirar un poco más allá y organizarte con tiempo.",
  },
] as const;

export default function NewsletterLandingV2({ context }: { context: NewsletterLandingContext }) {
  const heroSignup = (
    <div className={`${styles.signupCard} ${redesignV2DisplayPilot.variable}`} id="suscribete-agenda">
      <div className={styles.signupHeading}>
        <span>UN CORREO. MÁS PLANES.</span>
        <strong>Recibe La Agenda Motor</strong>
        <p>Gratis. Confirma tu suscripción por correo para empezar.</p>
      </div>
      {context === "preview" ? (
        <p className={styles.previewNotice}>Vista de diseño · No se realizan suscripciones desde Preview</p>
      ) : null}
      <NewsletterSignupForm appearance="homeEditorial" previewOnly={context === "preview"} />
    </div>
  );

  return (
    <V2InteriorShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "La Agenda Motor" }]}
      currentNavigationId="newsletter"
      description="Una selección editorial de eventos y planes de motor para saber qué viene y decidir tu próximo fin de semana."
      eyebrow="La Agenda Motor"
      heroAside={heroSignup}
      heroTitleFontClassName={redesignV2DisplayPilot.variable}
      navigationMode={context}
      title="Tu próximo plan de motor, cada semana en tu correo."
    >
      <div className={`${styles.content} ${redesignV2DisplayPilot.variable}`} data-newsletter-v2-context={context}>
        <section aria-labelledby="newsletter-v2-benefits" className={styles.benefitsSection}>
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>LA SELECCIÓN EDITORIAL</span>
              <h2 id="newsletter-v2-benefits">Qué encontrarás en La Agenda Motor</h2>
              <p>No es una lista interminable: son ideas para vivir el motor, con el contexto que necesitas para elegir.</p>
            </div>
            <div className={styles.benefitsGrid}>
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

        <section aria-labelledby="newsletter-v2-flow" className={styles.flowSection}>
          <div className={`${styles.shell} ${styles.flowLayout}`}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>ASÍ DE SENCILLO</span>
              <h2 id="newsletter-v2-flow">La agenda llega a ti</h2>
              <p>Deja tu correo, confirma la solicitud desde el mensaje que recibirás y descubre la selección semanal.</p>
            </div>
            <ol className={styles.flowList}>
              <li><span>01</span><div><strong>Suscríbete</strong><p>El correo es obligatorio; la provincia es opcional.</p></div></li>
              <li><span>02</span><div><strong>Confirma por email</strong><p>La suscripción solo se activa cuando confirmas el enlace.</p></div></li>
              <li><span>03</span><div><strong>Recibe la selección</strong><p>Una edición semanal con eventos y planes de motor.</p></div></li>
            </ol>
          </div>
        </section>

        <section aria-labelledby="newsletter-v2-close" className={styles.closeSection}>
          <div className={`${styles.shell} ${styles.closeLayout}`}>
            <div>
              <span className={styles.eyebrow}>TU SIGUIENTE PLAN EMPIEZA AQUÍ</span>
              <h2 id="newsletter-v2-close">Menos búsqueda. Más motor.</h2>
              <p>Confirma tu alta por correo. Puedes darte de baja cuando quieras; consulta nuestra{" "}
                <Link href="/privacidad">Política de privacidad</Link> y el{" "}
                <Link href="/aviso-legal">Aviso legal</Link>.
              </p>
            </div>
            <a className={styles.closeButton} href="#suscribete-agenda">Quiero recibir La Agenda Motor <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </div>
    </V2InteriorShell>
  );
}
