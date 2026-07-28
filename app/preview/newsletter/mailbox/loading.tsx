import styles from "./NewsletterMailbox.module.css";

export default function NewsletterMailboxLoading() {
  return (
    <main className={styles.mailbox}>
      <div className="emc-container">
        <section className={styles.statusCard} aria-live="polite" role="status">
          <span className={styles.label}>BUZÓN LOCAL</span>
          <h2>Cargando capturas…</h2>
          <p>La lectura se realiza exclusivamente en el servidor local.</p>
        </section>
      </div>
    </main>
  );
}
