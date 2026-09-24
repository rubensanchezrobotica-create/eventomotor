import Image from "next/image";
import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";
import NewsletterSignupForm from "@/components/newsletter/NewsletterSignupForm";
import { getCommercialCampaignRegistry } from "@/lib/commercial/campaign-registry.server";
import type { EventItem } from "@/types/event";
import EventCard from "./EventCard";
import SearchExperience from "./SearchExperience.client";
import { redesignV2DisplayPilot } from "./redesign-v2-fonts";
import { V2GlobalHeader } from "./site/V2InteriorShell";
import PreviewAwareLink from "./site/PreviewAwareLink";
import styles from "./RedesignV2.module.css";
import { assignV2HomeEventImages } from "./discipline-fallback-resolver";
import {
  buildDisciplineCards,
  buildTerritoryCards,
  prioritizeEditorialEvents,
  projectPreviewEvent,
  selectFeaturedEvent,
  upcomingPreviewEvents,
} from "./redesign-v2-model";

type RedesignV2HomeProps = {
  events: EventItem[];
  newsletterCanSubmitLive?: boolean;
  newsletterQaVisible?: boolean;
  newsletterVisible: boolean;
  nowIso: string;
  routeMode: "preview" | "public";
};

const HOME_ROUTES = {
  public: {
    calendar: "/calendario",
    disciplines: "/disciplinas",
    zones: "/zonas",
    newsletter: "/newsletter",
    publish: "/publicar-evento",
    contact: "/contacto",
  },
  preview: {
    calendar: "/preview/redesign-v2/calendario",
    disciplines: "/disciplinas",
    zones: "/preview/redesign-v2/zonas",
    newsletter: "/preview/redesign-v2/newsletter",
    publish: "/publicar-evento",
    contact: "/contacto",
  },
} as const;

const yearFormatter = new Intl.DateTimeFormat("es-ES", { year: "numeric" });

export default function RedesignV2Home({ events, newsletterCanSubmitLive = false, newsletterQaVisible = false, newsletterVisible: publicNewsletterVisible, nowIso, routeMode }: RedesignV2HomeProps) {
  const newsletterVisible = publicNewsletterVisible || newsletterQaVisible;
  const routes = HOME_ROUTES[routeMode];
  const canSubmitLive = routeMode === "public" && newsletterCanSubmitLive;
  const newsletterLinkMode = canSubmitLive ? "public" : "preview";
  const projected = events.map(projectPreviewEvent);
  const upcoming = upcomingPreviewEvents(projected, nowIso);
  const editorialEvents = prioritizeEditorialEvents(upcoming);
  const featured = selectFeaturedEvent(editorialEvents);
  const resolvedImages = assignV2HomeEventImages(editorialEvents);
  const imageByEventId = Object.fromEntries(editorialEvents.map((event, index) => [event.id, resolvedImages[index]]));
  const disciplines = buildDisciplineCards(upcoming);
  const territories = buildTerritoryCards(upcoming);
  const representedTerritories = new Set(upcoming.map((event) => event.region).filter(Boolean)).size;
  const representedDisciplines = new Set(upcoming.map((event) => event.discipline).filter(Boolean)).size;
  const commercialCampaigns = getCommercialCampaignRegistry();

  return (
    <div className={`${styles.root} ${redesignV2DisplayPilot.variable}`}>
      <V2GlobalHeader
        navigationMode={routeMode}
        newsletterLinkMode={newsletterLinkMode}
        newsletterVisible={newsletterVisible}
        publishTrackingSource="header_cta"
        skipTargetId="contenido-redesign-v2"
        upcomingCount={upcoming.length}
      />

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
                <Link className={styles.heroTextLink} href={routes.calendar}>Explorar calendario</Link>
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
                  resolvedImage={imageByEventId[featured.event.id]}
                  routeMode={routeMode}
                />
              </aside>
            ) : null}
          </div>
        </section>

        <section className={`${styles.shell} ${styles.eventsSection}`} id="calendario" aria-labelledby="proximos-eventos">
          <h2 className={styles.visuallyHidden} id="proximos-eventos">Buscar y descubrir próximos eventos</h2>
          <SearchExperience
            calendarHref={routes.calendar}
            commercialCampaigns={commercialCampaigns}
            events={editorialEvents}
            excludeEventId={featured.event?.id}
            imageByEventId={imageByEventId}
            nowIso={nowIso}
            routeMode={routeMode}
          />
        </section>

        <section className={styles.disciplineSection} aria-labelledby="disciplines-title">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.kicker}>Elige tu pasión</span>
                <h2 id="disciplines-title">Explora por disciplina</h2>
              </div>
              <Link href={routes.disciplines}>Ver todas <span aria-hidden="true">→</span></Link>
            </div>
            <div aria-label="Disciplinas de motor" className={styles.disciplineRail}>
              {disciplines.map((discipline) => (
                <TrackLink className={styles.disciplineCard} eventName="filter_discipline" eventParams={{ discipline: discipline.name }} href={discipline.href} key={discipline.name}>
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
                </TrackLink>
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
                <TrackLink className={styles.territoryCard} eventName="filter_zone" eventParams={{ zone: territory.name }} href={territory.href} key={territory.name}>
                  <Image alt="" className={styles.coverImage} fill sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 17vw" src={territory.image} />
                  <span className={styles.photoShade} />
                  <span className={styles.photoCardCopy}>
                    <strong>{territory.name}</strong>
                    <span>{territory.count} {territory.count === 1 ? "evento" : "eventos"}</span>
                  </span>
                </TrackLink>
              ))}
            </div>
            <div className={styles.centerAction}>
              <Link className={styles.outlineButton} href={routes.zones}>Explorar todas las zonas</Link>
            </div>
          </div>
        </section>

        {newsletterVisible ? <section className={styles.newsletterSection} aria-labelledby="newsletter-title">
          <div className={`${styles.shell} ${styles.newsletterLayout}`}>
            <div className={styles.newsletterCopy}>
              <span className={styles.kicker}>La Agenda Motor, por EventoMotor</span>
              <h2 id="newsletter-title">Tu próximo plan de motor, cada semana en tu correo.</h2>
              <p>Concentraciones, rallyes, clásicos, motos, circuitos y mucho más, seleccionados cerca de ti.</p>
              <div className={styles.newsletterForm}>
                <NewsletterSignupForm appearance="homeEditorial" previewOnly={!canSubmitLive} />
              </div>
            </div>
            <div className={styles.newsletterVisual}>
              <span className={styles.newsletterGlow} />
              <Image alt="La Agenda Motor de EventoMotor en un teléfono móvil" fill sizes="(max-width: 800px) 100vw, 45vw" src="/images/redesign-v2/newsletter-phone.webp" />
            </div>
          </div>
        </section> : null}

        <section className={styles.organizerSection} aria-labelledby="organizer-title">
          <div className={`${styles.shell} ${styles.organizerLayout}`}>
            <div>
              <span className={styles.kicker}>Haz que te encuentren</span>
              <h2 id="organizer-title">¿Organizas un evento de motor?</h2>
              <p>Publica tu cita en la agenda nacional y llega a una comunidad que ya está buscando su próxima experiencia.</p>
            </div>
            <TrackLink className={styles.lightButton} eventName="click_publish_event" eventParams={{ source: "home_organizer_cta" }} href={routes.publish}>Publicar mi evento <span aria-hidden="true">→</span></TrackLink>
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
            <Link href={routes.calendar}>Próximos eventos</Link>
            <Link href={routes.disciplines}>Disciplinas</Link>
            <Link href={routes.zones}>Zonas</Link>
          </nav>
          <nav aria-label="Enlaces para organizadores">
            <strong>EventoMotor</strong>
            <TrackLink eventName="click_publish_event" eventParams={{ source: "footer_link" }} href={routes.publish}>Publicar evento</TrackLink>
            {newsletterVisible ? <PreviewAwareLink mode={newsletterLinkMode} navigationId="newsletter" /> : null}
            <Link href={routes.contact}>Contacto</Link>
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
