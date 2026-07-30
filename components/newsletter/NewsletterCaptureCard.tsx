import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import styles from "./NewsletterCaptureCard.module.css";

type NewsletterCaptureCardProps = {
  placement: "home" | "event";
};

export default function NewsletterCaptureCard({
  placement,
}: NewsletterCaptureCardProps) {
  const headingId = `newsletter-capture-${placement}-title`;

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-newsletter-capture={placement}
    >
      <div className={`emc-container ${styles.card}`}>
        <div className={styles.identity} aria-hidden="true">
          <EventomotorLogo iconOnly />
          <span>LA AGENDA MOTOR</span>
        </div>
        <div className={styles.copy}>
          <h2 id={headingId}>
            Tu próximo plan de motor, cada semana en tu correo.
          </h2>
          <p>
            Una selección de eventos, rutas y citas para que no se te escape el
            próximo fin de semana.
          </p>
        </div>
        <div className={styles.action}>
          <Link className={styles.button} href="/newsletter">
            Quiero recibirla
          </Link>
          <small>Gratis. Sin ruido. Puedes darte de baja cuando quieras.</small>
        </div>
      </div>
    </section>
  );
}
