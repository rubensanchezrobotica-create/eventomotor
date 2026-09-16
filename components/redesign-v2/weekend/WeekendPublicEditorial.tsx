import Link from "next/link";
import { Archivo } from "next/font/google";
import TrackLink from "@/components/analytics/TrackLink";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import {
  WEEKEND_FAQS,
  WEEKEND_GUIDE_PARAGRAPHS,
  WEEKEND_SEO_LINKS,
} from "@/components/preview/weekend/weekend-public-content";
import styles from "./WeekendPageExperience.module.css";

const faqFont = Archivo({
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-v2-weekend-faq",
});

export default function WeekendPublicEditorial() {
  return (
    <section aria-label="Guía de la agenda del fin de semana" className={`${styles.publicEditorial} ${redesignV2DisplayPilot.variable} ${faqFont.variable}`}>
      <div className={styles.organizerCard}>
        <div>
          <span className={styles.editorialEyebrow}>Para organizadores</span>
          <h2>¿Organizas un evento de motor?</h2>
          <p>Añade tu evento a EventoMotor y haz que los aficionados lo encuentren en la agenda.</p>
        </div>
        <TrackLink
          className={styles.organizerLink}
          eventName="click_publish_event"
          eventParams={{ source: "weekend_public_organizer_cta" }}
          href="/publicar-evento"
        >
          Publicar un evento
        </TrackLink>
      </div>

      <div className={styles.editorialGrid}>
        <article className={styles.editorialGuide}>
          <span className={styles.editorialEyebrow}>Guía de la agenda</span>
          <h2>Sobre esta agenda</h2>
          {WEEKEND_GUIDE_PARAGRAPHS.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <nav aria-label="Más formas de descubrir eventos" className={styles.editorialLinks}>
            {WEEKEND_SEO_LINKS.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
            <Link href="/publicar-evento">Publicar un evento</Link>
          </nav>
        </article>

        <section aria-label="Preguntas frecuentes" className={styles.editorialFaq}>
          {WEEKEND_FAQS.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      </div>
    </section>
  );
}
