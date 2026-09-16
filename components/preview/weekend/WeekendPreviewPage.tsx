import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { WEEKEND_FAQS, WEEKEND_GUIDE_PARAGRAPHS, WEEKEND_SEO_LINKS } from "./weekend-public-content";
import type { WeekendFilters, WeekendPreviewData } from "./weekend-preview-model";
import WeekendExplorer from "./WeekendExplorer";
import styles from "./WeekendPreview.module.css";

type WeekendPreviewPageProps = {
  data: WeekendPreviewData;
  initialFilters: WeekendFilters;
  pathname: string;
};

export { WEEKEND_FAQS } from "./weekend-public-content";

export default function WeekendPreviewPage({
  data,
  initialFilters,
  pathname,
}: WeekendPreviewPageProps) {
  const isPreview = pathname.startsWith("/preview/");

  return (
    <div className={`emc-page ${styles.page}`}>
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <section className={styles.heroSection}>
          <div className={`emc-container ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <nav aria-label="Migas de pan" className={styles.breadcrumb}>
                <ol>
                  <li><Link href="/">Inicio</Link></li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page">Eventos de motor este fin de semana</li>
                </ol>
              </nav>
              <span className={styles.heroEyebrow}>{data.rangeLabel.toUpperCase()}</span>
              <h1>
                <span>Eventos de motor</span>
                {" "}
                <span>este fin de semana</span>
              </h1>
              <p className={styles.heroLead}>
                Encuentra concentraciones, rallyes, tandas, clásicos, ferias y competiciones
                previstas para este fin de semana en España.
              </p>
              <p className={styles.heroSummary}>
                <strong>{data.stats.events} eventos</strong>
                <span>·</span>
                <strong>{data.stats.provinces} provincias</strong>
                <span>·</span>
                <strong>{data.stats.disciplines} disciplinas</strong>
                <span>·</span>
                <span>Actualizado hoy</span>
              </p>
              <div className={styles.heroActions}>
                <a className="emc-btn emc-btn-primary" href="#eventos">Ver eventos</a>
                <Link href={PUBLIC_NAVIGATION.calendar}>Calendario completo</Link>
              </div>
            </div>
          </div>
        </section>

        <WeekendExplorer
          data={data}
          initialFilters={initialFilters}
          pathname={pathname}
        />

        <section className={styles.organizerSection}>
          <div className={`emc-container ${styles.organizerCard}`}>
            <div>
              <span className={styles.eyebrow}>Para organizadores</span>
              <h2>¿Organizas un evento de motor?</h2>
              <p>
                Añade tu evento a EventoMotor y haz que los aficionados lo encuentren en la agenda.
              </p>
            </div>
            <TrackLink
              className="emc-btn emc-btn-primary"
              eventName="click_publish_event"
              eventParams={{
                source: isPreview
                  ? "weekend_preview_organizer_cta"
                  : "weekend_public_organizer_cta",
              }}
              href="/publicar-evento"
            >
              Publicar un evento
            </TrackLink>
          </div>
        </section>

        <section className={styles.seoSection}>
          <div className={`emc-container ${styles.seoContent}`}>
            <article className={styles.seoCopy}>
              <span className={styles.eyebrow}>Guía de la agenda</span>
              <h2>Sobre esta agenda</h2>
              {WEEKEND_GUIDE_PARAGRAPHS.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <div className={styles.seoLinks}>
                {WEEKEND_SEO_LINKS.map((link) => (
                  <Link href={link.href} key={link.href}>{link.label}</Link>
                ))}
                <Link href="/publicar-evento">Publicar un evento</Link>
              </div>
            </article>

            <section className={styles.faqBlock} aria-label="Preguntas frecuentes">
              {WEEKEND_FAQS.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </section>
          </div>
        </section>
      </main>

      <ConceptFooter variant="compact" />
    </div>
  );
}
