import Link from "next/link";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import styles from "./ContactV2.module.css";

const CONTACT_EMAIL = "info@eventomotor.com";
const GENERAL_EMAIL_HREF = `mailto:${CONTACT_EMAIL}?subject=Contacto%20EventoMotor`;

function DirectionalArrow() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" height="16" viewBox="0 0 16 16" width="16">
      <path d="M6 4h6v6M12 4 4 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

export default function ContactV2() {
  return (
    <div className={styles.content}>
      <section aria-labelledby="contact-email-title" className={styles.emailSection}>
        <div className={styles.emailCopy}>
          <span className={styles.eyebrow}>CORREO DIRECTO</span>
          <h2 id="contact-email-title">Escríbenos directamente</h2>
          <p>Para actualizar información, publicar un evento o plantear una colaboración relacionada con el motor.</p>
          <TrackAnchor
            className={styles.emailTextLink}
            eventName="click_contact_email"
            eventParams={{ location: "contact_page_card" }}
            href={GENERAL_EMAIL_HREF}
          >
            {CONTACT_EMAIL}
          </TrackAnchor>
        </div>
        <div className={styles.emailActions}>
          <TrackAnchor
            className={styles.primaryAction}
            eventName="click_contact_email"
            eventParams={{ location: "contact_page_cta" }}
            href={GENERAL_EMAIL_HREF}
          >
            Escribir a {CONTACT_EMAIL} <DirectionalArrow />
          </TrackAnchor>
          <Link className={styles.secondaryAction} href="/publicar-evento">Publicar un evento</Link>
        </div>
      </section>

      <section aria-labelledby="contact-reasons-title" className={styles.reasonsSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>ENCUENTRA TU CAMINO</span>
          <h2 id="contact-reasons-title">¿En qué podemos ayudarte?</h2>
          <p>Elige el motivo para escribirnos o utiliza el correo directo.</p>
        </div>
        <div className={styles.reasonsGrid}>
          <article className={styles.reason}>
            <span className={styles.number} aria-hidden="true">01</span>
            <h3>Corregir un evento</h3>
            <p>Avísanos si encuentras una fecha, ubicación o información que debamos actualizar.</p>
            <TrackAnchor
              eventName="click_contact_email"
              eventParams={{ location: "contact_reason_correction" }}
              href={`mailto:${CONTACT_EMAIL}?subject=Correcci%C3%B3n%20de%20evento`}
            >Enviar corrección <DirectionalArrow /></TrackAnchor>
          </article>
          <article className={styles.reason}>
            <span className={styles.number} aria-hidden="true">02</span>
            <h3>Publicar un evento</h3>
            <p>Los organizadores pueden enviarnos su evento gratuitamente desde el formulario de publicación.</p>
            <Link href="/publicar-evento">Ir al formulario <DirectionalArrow /></Link>
          </article>
          <article className={styles.reason}>
            <span className={styles.number} aria-hidden="true">03</span>
            <h3>Colaboraciones</h3>
            <p>Propuestas, medios, clubes, circuitos y proyectos relacionados con el mundo del motor.</p>
            <TrackAnchor
              eventName="click_contact_email"
              eventParams={{ location: "contact_reason_collaboration" }}
              href={`mailto:${CONTACT_EMAIL}?subject=Colaboraci%C3%B3n%20con%20EventoMotor`}
            >Proponer colaboración <DirectionalArrow /></TrackAnchor>
          </article>
        </div>
      </section>
    </div>
  );
}
