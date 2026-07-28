import type { EventFaqItem } from "@/lib/event-seo-overrides";
import styles from "./EventDetailView.module.css";

export default function EventFaq({
  eventTitle,
  items,
}: {
  eventTitle: string;
  items: readonly EventFaqItem[];
}) {
  if (!items.length) return null;

  return (
    <section aria-labelledby="event-faq-title" className={styles.faqSection}>
      <div className="emc-container">
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.eyebrow}>Preguntas frecuentes</span>
            <h2 id="event-faq-title">Preguntas frecuentes sobre {eventTitle}</h2>
          </div>
        </div>
        <div className={styles.faqList}>
          {items.map((item) => (
            <article className={styles.faqItem} key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
