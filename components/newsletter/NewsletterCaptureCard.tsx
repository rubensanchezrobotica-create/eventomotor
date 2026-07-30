import Link from "next/link";
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
        <span className={styles.eyebrow}>LA AGENDA MOTOR</span>
        <div className={styles.copy}>
          <h2 id={headingId}>Recibe La Agenda Motor cada semana</h2>
          <p>
            Una selección de eventos y planes de motor para que no se te escape
            el próximo fin de semana.
          </p>
        </div>
        <div className={styles.action}>
          <Link className={styles.button} href="/newsletter">
            Quiero recibirla
          </Link>
          <small>Gratis · Sin ruido · Baja en cualquier momento</small>
        </div>
      </div>
    </section>
  );
}
