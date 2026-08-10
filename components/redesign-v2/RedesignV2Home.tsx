import Image from "next/image";
import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";
import NewsletterSignupForm from "@/components/newsletter/NewsletterSignupForm";
import type { EventItem } from "@/types/event";
import EventCard from "./EventCard";
import MobileNavigation from "./MobileNavigation.client";
import SearchExperience from "./SearchExperience.client";
import styles from "./RedesignV2.module.css";
import {
  buildDisciplineCards,
  buildTerritoryCards,
  prioritizeEditorialEvents,
  projectPreviewEvent,
  resolveRedesignEventImages,
  selectFeaturedEvent,
  upcomingPreviewEvents,
} from "./redesign-v2-model";

type RedesignV2HomeProps = {
  events: EventItem[];
  nowIso: string;
};

const yearFormatter = new Intl.DateTimeFormat("es-ES", { year: "numeric" });

export default function RedesignV2Home({ events, nowIso }: RedesignV2HomeProps) {
  const projected = events.map(projectPreviewEvent);
  const upcoming = upcomingPreviewEvents(projected, nowIso);
  const editorialEvents = prioritizeEditorialEvents(upcoming);
  const featured = selectFeaturedEvent(editorialEvents);
  const resolvedImages = resolveRedesignEventImages(editorialEvents);
  const imageByEventId = new Map(editorialEvents.map((event, index) => [event.id, resolvedImages[index]]));
  const disciplines = buildDisciplineCards(upcoming);
  const territories = buildTerritoryCards(upcoming);
  const representedTerritories = new Set(upcoming.map((event) => event.region).filter(Boolean)).size;
  const representedDisciplines = new Set(upcoming.map((event) => event.discipline).filter(Boolean)).size;

  return (
    <div className={styles.root}>
      <a className={styles.skipLink} href="#contenido-redesign-v2">Saltar al contenido</a>
      <header className={styles.header}>
        <div className={styles.utilityBar}>
          <div className={styles.shell}>
            <p><span aria-hidden="true">●</span> {upcoming.length} eventos próximos en la agenda</p>
            <Link href="/newsletter">La Agenda Motor</Link>
          </div>
        </div>
        <div className={`${styles.shell} ${styles.navbar}`}>
          <Link className={styles.brand} href="/" aria-label="EventoMotor, inicio">
            <EventomotorLogo />
          </Link>
          <nav aria-label="Navegación principal" className={styles.desktopNav}>
            <Link href="/#calendario">Calendario</Link>
            <Link href="/disciplinas">Disciplinas</Link>
            <Link href="/zonas">Zonas</Link>
            <Link href="/contacto">Contacto</Link>
          </nav>
          <div className={styles.navActions}>
            <Link className={styles.publishButton} href="/publicar-evento">Publicar evento</Link>
            <MobileNavigation />
          </div>
        </div>
      </header>

      <main id="contenido-redesign-v2">
        <section className={styles.hero} aria-labelledby="redesign-v2-title">
          <Image
            alt="Coche deportivo en carretera al atardecer"
            className={styles.heroImage}
            fill
            preload
            quality={75}
            sizes="100vw"
            src="/images/redesign-v2/hero-eventomotor.webp"
          />
          <div className={styles.heroOverlay} />
          <div className={`${styles.shell} ${styles.heroLayout}`}>
            <div className={styles.heroCopy}>
              <span className={styles.heroEyebrow}>La agenda de motor de España</span>
              <h1 id="redesign-v2-title">Tu próximo plan de motor empieza aquí</h1>
              <p>Rallyes, concentraciones, tandas, rutas, clásicos, ferias y competiciones: encuentra un plan fiable por fecha y zona.</p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="#proximos-eventos">Ver próximos eventos <span aria-hidden="true">→</span></Link>
                <Link className={styles.heroTextLink} href="/#calendario">Explorar calendario</Link>
              </div>
              <div className={styles.trustLine}>
                <span><strong>{upcoming.length}</strong> próximos</span>
                <span><strong>{representedTerritories}</strong> territorios</span>
                <span><strong>{representedDisciplines}</strong> disciplinas</span>
              </div>
            </div>
            {featured.event ? (
              <aside className={styles.featuredWrap} aria-label={featured.eyebrow}>
                <EventCard
                  event={featured.event}
                  featured
                  featuredLabel={featured.eyebrow}
                  nowIso={nowIso}
                  resolvedImage={imageByEventId.get(featured.event.id)}
                />
              </aside>
            ) : null}
          </div>
        </section>

        <section className={`${styles.shell} ${styles.eventsSection}`} id="proximos-eventos" aria-labelledby="events-title">
          <h2 className={styles.visuallyHidden} id="events-title">Buscar y descubrir próximos eventos</h2>
          <SearchExperience
            events={editorialEvents}
            excludeEventId={featured.event?.id}
            nowIso={nowIso}
          />
        </section>

        <section className={styles.disciplineSection} aria-labelledby="disciplines-title">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.kicker}>Elige tu pasión</span>
                <h2 id="disciplines-title">Explora por disciplina</h2>
              </div>
              <Link href="/disciplinas">Ver todas <span aria-hidden="true">→</span></Link>
            </div>
            <div aria-label="Disciplinas de motor" className={styles.disciplineRail}>
              {disciplines.map((discipline) => (
                <Link className={styles.disciplineCard} href={discipline.href} key={discipline.name}>
                  <span aria-hidden="true" className={styles.disciplineIcon}>
                    <Image
                      alt=""
                      className={styles.disciplineIconImage}
                      height={192}
                      sizes="(max-width: 760px) 36vw, 160px"
                      src={discipline.image}
                      width={256}
                    />
                  </span>
                  <span className={styles.disciplineCardCopy}>
                    <strong>{discipline.name}</strong>
                    <span>{discipline.count} {discipline.count === 1 ? "evento" : "eventos"}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.territorySection} aria-labelledby="territories-title">
          <div className={styles.shell}>
            <div className={styles.centerHeading}>
              <span className={styles.kicker}>Más cerca de ti</span>
              <h2 id="territories-title">El motor recorre España</h2>
              <p>Encuentra la próxima cita en tu zona.</p>
            </div>
            <div className={styles.territoryGrid}>
              {territories.map((territory) => (
                <Link className={styles.territoryCard} href={territory.href} key={territory.name}>
                  <Image alt="" className={styles.coverImage} fill sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 17vw" src={territory.image} />
                  <span className={styles.photoShade} />
                  <span className={styles.photoCardCopy}>
                    <strong>{territory.name}</strong>
                    <span>{territory.count} {territory.count === 1 ? "evento" : "eventos"}</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className={styles.centerAction}>
              <Link className={styles.outlineButton} href="/zonas">Explorar todas las zonas</Link>
            </div>
          </div>
        </section>

        <section className={styles.newsletterSection} aria-labelledby="newsletter-title">
          <div className={`${styles.shell} ${styles.newsletterLayout}`}>
            <div className={styles.newsletterCopy}>
              <span className={styles.kicker}>La Agenda Motor, por EventoMotor</span>
              <h2 id="newsletter-title">Tu próximo plan de motor, cada semana en tu correo.</h2>
              <p>Concentraciones, rallyes, clásicos, motos, circuitos y mucho más, seleccionados cerca de ti.</p>
              <div className={styles.newsletterForm}>
                <NewsletterSignupForm appearance="homeEditorial" />
              </div>
            </div>
            <div className={styles.newsletterVisual}>
              <span className={styles.newsletterGlow} />
              <Image alt="La Agenda Motor de EventoMotor en un teléfono móvil" fill sizes="(max-width: 800px) 100vw, 45vw" src="/images/redesign-v2/newsletter-phone.webp" />
            </div>
          </div>
        </section>

        <section className={styles.organizerSection} aria-labelledby="organizer-title">
          <div className={`${styles.shell} ${styles.organizerLayout}`}>
            <div>
              <span className={styles.kicker}>Haz que te encuentren</span>
              <h2 id="organizer-title">¿Organizas un evento de motor?</h2>
              <p>Publica tu cita en la agenda nacional y llega a una comunidad que ya está buscando su próxima experiencia.</p>
            </div>
            <Link className={styles.lightButton} href="/publicar-evento">Publicar mi evento <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerGrid}`}>
          <div className={styles.footerBrand}>
            <EventomotorLogo />
            <p>La agenda nacional para vivir el motor dentro y fuera de la pista.</p>
          </div>
          <nav aria-label="Enlaces de calendario">
            <strong>Calendario</strong>
            <Link href="/#calendario">Próximos eventos</Link>
            <Link href="/disciplinas">Disciplinas</Link>
            <Link href="/zonas">Zonas</Link>
          </nav>
          <nav aria-label="Enlaces para organizadores">
            <strong>EventoMotor</strong>
            <Link href="/publicar-evento">Publicar evento</Link>
            <Link href="/newsletter">Newsletter</Link>
            <Link href="/contacto">Contacto</Link>
          </nav>
          <nav aria-label="Enlaces legales">
            <strong>Legal</strong>
            <Link href="/aviso-legal">Aviso legal</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/cookies">Cookies</Link>
            <CookieSettingsButton />
          </nav>
        </div>
        <div className={`${styles.shell} ${styles.footerBottom}`}>
          <span>© {yearFormatter.format(new Date(nowIso))} EventoMotor</span>
          <span>Hecho para quienes viven el motor</span>
        </div>
      </footer>
    </div>
  );
}
