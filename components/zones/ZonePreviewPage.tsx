import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SEO_ZONES } from "@/lib/seo-taxonomy";
import type { ZoneFilters, ZonePreviewData } from "./zone-preview-model";
import ZoneEventCard from "./ZoneEventCard";
import ZoneExplorer from "./ZoneExplorer";
import ZoneMobileSelector from "./ZoneMobileSelector";
import styles from "./ZonePreview.module.css";

type ZonePreviewPageProps = {
  data: ZonePreviewData;
  initialFilters: ZoneFilters;
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

export default function ZonePreviewPage({
  data,
  initialFilters,
  nowIso,
  pathname,
}: ZonePreviewPageProps) {
  const zoneName = data.zone.title.toLowerCase();
  const publicZoneHref = `/zonas/${data.zone.id}`;
  const paragraphs = introParagraphs(data.zone.intro);

  return (
    <div className={`emc-page ${styles.page}`}>
      <ConceptStyles />
      <ConceptStaticHeader />

      <main>
        <section className={styles.heroSection}>
          <div className="emc-container">
            <nav aria-label="Migas de pan" className={styles.breadcrumb}>
              <ol>
                <li><Link href="/">Inicio</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/zonas">Zonas</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">Zona {zoneName}</li>
              </ol>
            </nav>
            <span className={styles.eyebrow}>Zona {data.zone.title}</span>
            <h1>{data.zone.h1}</h1>
            <p className={styles.heroLead}>{data.zone.description}</p>
            <p className={styles.heroStats} aria-label="Resumen de próximos eventos">
              <span><strong>{data.stats.future}</strong> próximos eventos</span>
              <span className={styles.heroSecondaryStat}>
                <span aria-hidden="true">·</span>
                <strong>{data.stats.provinces}</strong> provincias
              </span>
              <span className={styles.heroSecondaryStat}>
                <span aria-hidden="true">·</span>
                <strong>{data.stats.disciplines}</strong> disciplinas registradas
              </span>
            </p>
            <div className={styles.heroActions}>
              <a className="emc-btn emc-btn-primary" href="#eventos">
                <span className={styles.desktopOnly}>Ver próximos eventos</span>
                <span className={styles.mobileOnly}>Ver eventos</span>
              </a>
            </div>
            <nav aria-label="Cambiar zona" className={styles.zoneNav}>
              {SEO_ZONES.map((zone) => (
                <Link
                  aria-current={zone.slug === data.zone.id ? "page" : undefined}
                  className={zone.slug === data.zone.id ? styles.zoneNavActive : ""}
                  href={`/preview/zonas/${zone.slug}`}
                  key={zone.slug}
                >
                  {zone.title}
                </Link>
              ))}
            </nav>
            <ZoneMobileSelector currentZone={data.zone.id} />
          </div>
        </section>

        <ZoneExplorer
          data={data}
          initialFilters={initialFilters}
          nowIso={nowIso}
          pathname={pathname}
        />

        <section className={styles.organizerSection}>
          <div className={`emc-container ${styles.organizerCard}`}>
            <div>
              <span className={styles.eyebrow}>Para organizadores</span>
              <h2>
                <span className={styles.desktopOnly}>¿Organizas un evento en la zona {zoneName}?</span>
                <span className={styles.mobileOnly}>¿Organizas un evento?</span>
              </h2>
              <p>
                <span className={styles.desktopOnly}>
                  Añade tu evento a EventoMotor y haz que los aficionados de tu zona lo encuentren
                  en la agenda.
                </span>
                <span className={styles.mobileOnly}>
                  Añade tu evento a EventoMotor y llega a más aficionados de tu zona.
                </span>
              </p>
            </div>
            <TrackLink
              className="emc-btn emc-btn-primary"
              eventName="click_publish_event"
              eventParams={{ source: `zone_preview_${data.zone.id}` }}
              href="/publicar-evento"
            >
              Publicar un evento
            </TrackLink>
          </div>
        </section>

        <section className={styles.seoSection}>
          <div className={`emc-container ${styles.seoContent}`}>
            <span className={styles.eyebrow}>Guía territorial</span>
            <h2>Sobre los eventos de motor en la zona {zoneName}</h2>
            {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <div className={styles.internalLinks}>
              <Link href="/calendario">Calendario completo</Link>
              <Link href="/eventos-motor-este-fin-de-semana">Eventos este fin de semana</Link>
              <Link href={publicZoneHref}>Página pública actual</Link>
              <Link href="/disciplinas/rallyes">Rallyes</Link>
              <Link href="/disciplinas/circuito">Circuito</Link>
              <Link href="/disciplinas/concentraciones">Concentraciones</Link>
              <Link href="/publicar-evento">Publicar evento</Link>
            </div>
            <div className={styles.faqBlock} aria-label="Preguntas frecuentes">
              <details>
                <summary>¿Qué eventos aparecen en esta zona?</summary>
                <p>
                  Se incluyen los eventos visibles clasificados mediante provincia, región o,
                  cuando es seguro, una localidad equivalente.
                </p>
              </details>
              <details>
                <summary>¿Cómo encuentro eventos próximos?</summary>
                <p>
                  La vista inicial muestra únicamente eventos próximos o en curso y permite
                  filtrar por provincia, disciplina, periodo y texto.
                </p>
              </details>
              <details>
                <summary>¿Debo confirmar la información antes de asistir?</summary>
                <p>
                  Sí. Consulta la ficha y la fuente oficial porque horarios, ubicaciones o
                  inscripciones pueden cambiar.
                </p>
              </details>
              <details>
                <summary>¿Cómo publico un evento de esta zona?</summary>
                <p>
                  Utiliza el formulario de publicación e incluye fecha, localidad, disciplina y
                  una fuente verificable.
                </p>
              </details>
            </div>
          </div>
        </section>

        {data.pastEvents.length ? (
          <section className={styles.pastSection}>
            <div className="emc-container">
              <details className={styles.pastDetails}>
                <summary>
                  <span>
                    <strong>Eventos anteriores de la zona {zoneName}</strong>
                    <small>{data.pastEvents.length} eventos históricos</small>
                  </span>
                  <span aria-hidden="true">+</span>
                </summary>
                <div className={styles.pastGrid}>
                  {data.pastEvents.slice(0, 12).map((event) => (
                    <ZoneEventCard
                      event={event}
                      key={event.slug || event.id}
                      source="zone_preview_history"
                    />
                  ))}
                </div>
                {data.pastEvents.length > 12 ? (
                  <p className={styles.pastNote}>
                    Se muestran los 12 eventos anteriores más recientes de{" "}
                    {data.pastEvents.length}. Consulta el calendario para ampliar el histórico.
                  </p>
                ) : null}
              </details>
            </div>
          </section>
        ) : null}
      </main>

      <ConceptFooter />
    </div>
  );
}
