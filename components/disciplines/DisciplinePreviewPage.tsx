import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import DisciplineExplorer from "./DisciplineExplorer";
import DisciplineHistory from "./DisciplineHistory";
import DisciplineSeoDisclosure from "./DisciplineSeoDisclosure";
import type {
  DisciplineFilters,
  DisciplinePreviewData,
} from "./discipline-preview-model";
import scaleStyles from "@/components/shared/ExplorerPageScale.module.css";
import zoneStyles from "@/components/zones/ZonePreview.module.css";
import styles from "./DisciplinePreview.module.css";

type DisciplinePreviewPageProps = {
  data: DisciplinePreviewData;
  initialFilters: DisciplineFilters;
  mode: "preview" | "public";
  nowIso: string;
  pathname: string;
};

function introParagraphs(intro: string) {
  const sentences = intro.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()) || [intro];
  const midpoint = Math.ceil(sentences.length / 2);
  return [
    sentences.slice(0, midpoint).join(" "),
    sentences.slice(midpoint).join(" "),
  ].filter(Boolean);
}

export default function DisciplinePreviewPage({
  data,
  initialFilters,
  mode,
  nowIso,
  pathname,
}: DisciplinePreviewPageProps) {
  const paragraphs = introParagraphs(data.discipline.intro);
  const disciplineName = data.discipline.title.toLocaleLowerCase("es");
  const analyticsSource = mode === "preview" ? "discipline_preview" : "discipline_public";
  const disciplineBasePath = mode === "preview" ? "/preview/disciplinas" : "/disciplinas";

  return (
    <div className={`emc-page ${zoneStyles.page} ${styles.page} ${scaleStyles.explorerScale}`}>
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <section className={`${zoneStyles.heroSection} ${styles.heroSection}`}>
          <div className="emc-container">
            <nav aria-label="Migas de pan" className={zoneStyles.breadcrumb}>
              <ol>
                <li className={zoneStyles.breadcrumbHome}><Link href="/">Inicio</Link></li>
                <li aria-hidden="true" className={zoneStyles.breadcrumbHome}>/</li>
                <li><Link href="/disciplinas">Disciplinas</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{data.discipline.title}</li>
              </ol>
            </nav>
            <span className={zoneStyles.eyebrow}>Disciplina</span>
            <h1>{data.discipline.h1}</h1>
            <p className={zoneStyles.heroLead}>{data.editorial.heroDescription}</p>
            <p className={zoneStyles.heroStats} aria-label="Resumen de próximos eventos">
              <span>
                <strong>{data.stats.upcoming}</strong>{" "}
                {data.stats.upcoming === 1 ? "próximo evento" : "próximos eventos"}
              </span>
            </p>
            <nav aria-label="Cambiar disciplina" className={`${zoneStyles.zoneNav} ${styles.disciplineNav}`}>
              {SEO_DISCIPLINES.map((discipline) => (
                <TrackLink
                  aria-current={discipline.slug === data.discipline.slug ? "page" : undefined}
                  className={discipline.slug === data.discipline.slug ? zoneStyles.zoneNavActive : ""}
                  eventName="change_discipline"
                  eventParams={{
                    from_discipline: data.discipline.slug,
                    source: `${analyticsSource}_hero`,
                    to_discipline: discipline.slug,
                  }}
                  href={`${disciplineBasePath}/${discipline.slug}`}
                  key={discipline.slug}
                >
                  {discipline.title}
                </TrackLink>
              ))}
            </nav>
          </div>
        </section>

        <DisciplineExplorer
          analyticsSource={analyticsSource}
          data={data}
          disciplineBasePath={disciplineBasePath}
          initialFilters={initialFilters}
          nowIso={nowIso}
          pathname={pathname}
        />

        <section className={zoneStyles.organizerSection}>
          <div className={`emc-container ${zoneStyles.organizerCard}`}>
            <div>
              <span className={zoneStyles.eyebrow}>Para organizadores</span>
              <h2>{data.editorial.ctaTitle}</h2>
              <p>{data.editorial.ctaText}</p>
            </div>
            <TrackLink
              className="emc-btn emc-btn-primary"
              eventName="click_publish_event"
              eventParams={{ source: `${analyticsSource}_${data.discipline.slug}` }}
              href="/publicar-evento"
            >
              Publicar un evento
            </TrackLink>
          </div>
        </section>

        <section className={zoneStyles.seoSection}>
          <div className={`emc-container ${zoneStyles.seoContent}`}>
            <span className={zoneStyles.eyebrow}>Guía de la disciplina</span>
            <h2>Sobre los {disciplineName} en España</h2>
            <p>{paragraphs[0]}</p>
            <DisciplineSeoDisclosure>
              {paragraphs.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <div className={zoneStyles.internalLinks}>
                <Link href={PUBLIC_NAVIGATION.calendar}>Calendario completo</Link>
                <Link href="/eventos-motor-este-fin-de-semana">Eventos este fin de semana</Link>
                {mode === "preview" ? (
                  <Link href={`/disciplinas/${data.discipline.slug}`}>Página pública actual</Link>
                ) : null}
                <Link href="/zonas">Explorar por zonas</Link>
                <Link href="/publicar-evento">Publicar evento</Link>
              </div>
              <div className={zoneStyles.faqBlock} aria-label="Preguntas frecuentes">
                <h3 className={styles.faqTitle}>Preguntas frecuentes</h3>
                <details>
                  <summary>¿Qué eventos aparecen en esta disciplina?</summary>
                  <p>
                    Se muestran eventos visibles cuya disciplina o tipo de vehículo estructurado
                    permite una clasificación inequívoca.
                  </p>
                </details>
                <details>
                  <summary>¿Cómo encuentro un evento próximo?</summary>
                  <p>
                    Utiliza provincia y periodo para acotar la agenda; en Más filtros puedes elegir
                    modalidad, vehículo o buscar por título y localidad.
                  </p>
                </details>
                <details>
                  <summary>¿Debo confirmar la información antes de asistir?</summary>
                  <p>
                    Sí. Consulta siempre la ficha y la fuente oficial porque horarios, ubicación,
                    inscripciones o programa pueden cambiar.
                  </p>
                </details>
              </div>
            </DisciplineSeoDisclosure>
          </div>
        </section>

        {data.pastEvents.length ? (
          <section className={zoneStyles.pastSection}>
            <div className="emc-container">
              <DisciplineHistory
                eventSource={`${analyticsSource}_history`}
                events={data.pastEvents}
                title={data.discipline.title}
              />
            </div>
          </section>
        ) : null}

        <section aria-labelledby="other-disciplines-title" className={styles.otherSection}>
          <div className="emc-container">
            <span className={zoneStyles.eyebrow}>Sigue explorando</span>
            <h2 id="other-disciplines-title">Explora otras disciplinas</h2>
            <div className={styles.otherGrid}>
              {data.otherDisciplines.map((discipline) => (
                <TrackLink
                  eventName="change_discipline"
                  eventParams={{
                    from_discipline: data.discipline.slug,
                    source: `${analyticsSource}_other`,
                    to_discipline: discipline.slug,
                  }}
                  href={`${disciplineBasePath}/${discipline.slug}`}
                  key={discipline.slug}
                >
                  <strong>{discipline.title}</strong>
                  <span>
                    {discipline.count} {discipline.count === 1 ? "próximo evento" : "próximos eventos"}
                  </span>
                  <span aria-hidden="true">→</span>
                </TrackLink>
              ))}
            </div>
          </div>
        </section>
      </main>

      <ConceptFooter />
    </div>
  );
}
