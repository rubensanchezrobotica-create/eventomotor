import Image from "next/image";
import Link from "next/link";
import CompactAgendaSignup from "@/components/redesign-v2/newsletter/CompactAgendaSignup.client";
import { disciplineUpcomingCountLabel, type DisciplinesPageModel } from "./disciplines-model";
import styles from "./DisciplinesPage.module.css";

type DisciplinesPageProps = {
  model: DisciplinesPageModel;
};

export default function DisciplinesPage({ model }: DisciplinesPageProps) {
  return (
    <section className={styles.section} aria-labelledby="disciplinas-v2-grid-title">
      <div className={styles.shell}>
        <header className={styles.intro}>
          <h2 id="disciplinas-v2-grid-title">Elige tu disciplina</h2>
        </header>

        <ul className={styles.grid}>
          {model.cards.map((card, index) => (
            <li key={card.slug}>
              <Link className={styles.card} href={card.href}>
                <span className={styles.iconWrap} aria-hidden="true">
                  <Image
                    alt=""
                    className={styles.icon}
                    height={160}
                    priority={index < 4}
                    sizes="(max-width: 560px) 88px, (max-width: 900px) 120px, 148px"
                    src={card.icon}
                    width={160}
                  />
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardLabel}>Disciplina</span>
                  <h3>{card.label}</h3>
                  <span className={styles.description}>{card.description}</span>
                  <span className={styles.cardFooter}>
                    <span className={card.upcomingCount === 0 ? styles.emptyCount : styles.count}>
                      {disciplineUpcomingCountLabel(card.upcomingCount)}
                    </span>
                    <span className={styles.arrow} aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <aside className={styles.calendarCta} aria-label="Explorar la agenda completa">
          <div>
            <span className={styles.kicker}>Agenda completa</span>
            <h2>¿Prefieres empezar por la fecha?</h2>
            <p>Consulta toda la agenda por fecha y descubre los próximos eventos del motor.</p>
          </div>
          <Link href="/preview/redesign-v2/calendario">Abrir calendario <span aria-hidden="true">→</span></Link>
        </aside>

        <CompactAgendaSignup
          description="Una selección de próximos eventos para vivir el motor."
          eyebrow="La Agenda Motor"
          title="Tu agenda de motor, cada semana"
        />
      </div>
    </section>
  );
}
