import { headers } from "next/headers";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackLink from "@/components/analytics/TrackLink";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";
import {
  currentNewsletterProductionCanaryEnvironment,
  currentNewsletterPublicLaunchEnvironment,
  evaluateNewsletterProductionCanaryResendConfiguration,
  evaluateNewsletterPublicLaunchResendConfiguration,
} from "@/lib/newsletter/resend-config.server";
import { isNewsletterPublicLaunchPageRequestAllowed } from "@/lib/newsletter/r5b-guard";
import InteriorMobileNavigation from "./InteriorMobileNavigation.client";
import PreviewAwareLink from "./PreviewAwareLink";
import {
  getInteriorNavigationIds,
  resolveInteriorNavigationItem,
  resolveInteriorNavigationItems,
  type InteriorNavigationMode,
  type PreviewNavigationId,
} from "./preview-navigation";
import styles from "./V2PreviewShell.module.css";

export type V2InteriorBreadcrumbItem = {
  label: string;
  navigationId?: PreviewNavigationId;
};

export type V2InteriorShellProps = {
  breadcrumbs: readonly V2InteriorBreadcrumbItem[];
  children: React.ReactNode;
  currentNavigationId?: PreviewNavigationId;
  description: string;
  eyebrow: string;
  heroImageSrc?: string;
  heroAside?: React.ReactNode;
  heroTitleFontClassName?: string;
  navigationMode: InteriorNavigationMode;
  title: string;
  trackPublicEventDetailNavigation?: boolean;
  upcomingCount?: number;
};

type V2GlobalHeaderProps = {
  currentNavigationId?: PreviewNavigationId;
  navigationMode: InteriorNavigationMode;
  newsletterVisible: boolean;
  publishTrackingSource?: "header_cta" | "static_header_cta";
  skipTargetId: string;
  upcomingCount?: number;
};

export function V2GlobalHeader({
  currentNavigationId,
  navigationMode,
  newsletterVisible,
  publishTrackingSource,
  skipTargetId,
  upcomingCount,
}: V2GlobalHeaderProps) {
  const desktopNavigation = getInteriorNavigationIds(navigationMode, "desktop");
  const mobileNavigation = getInteriorNavigationIds(navigationMode, "mobile");
  const publishTrackingParams = publishTrackingSource === "static_header_cta"
    ? { source: "static_header_cta" }
    : { source: "header_cta" };

  return (
    <>
      <a className={styles.skipLink} href={`#${skipTargetId}`}>Saltar al contenido</a>
      <header className={styles.header}>
        <div className={styles.utilityBar}>
          <div className={styles.shell}>
            <p><span aria-hidden="true">●</span> {upcomingCount === undefined ? "La agenda nacional del motor" : `${upcomingCount} eventos próximos en la agenda`}</p>
            {newsletterVisible ? <PreviewAwareLink mode={navigationMode} navigationId="newsletter">La Agenda Motor</PreviewAwareLink> : null}
          </div>
        </div>
        <div className={`${styles.shell} ${styles.navbar}`}>
          <PreviewAwareLink
            aria-label="EventoMotor, inicio"
            className={styles.brand}
            mode={navigationMode}
            navigationId="home"
          >
            <EventomotorLogo />
          </PreviewAwareLink>
          <nav aria-label="Navegación principal" className={styles.desktopNav}>
            {desktopNavigation.map((id) => (
              <PreviewAwareLink
                aria-current={currentNavigationId === id ? "page" : undefined}
                key={id}
                mode={navigationMode}
                navigationId={id}
              />
            ))}
          </nav>
          <div className={styles.navActions}>
            {publishTrackingSource ? (
              <TrackLink
                className={styles.publishButton}
                eventName="click_publish_event"
                eventParams={publishTrackingParams}
                href={resolveInteriorNavigationItem("publish", navigationMode).href}
              >Publicar evento</TrackLink>
            ) : (
              <PreviewAwareLink className={styles.publishButton} mode={navigationMode} navigationId="publish" />
            )}
            <InteriorMobileNavigation
              currentNavigationId={currentNavigationId}
              items={resolveInteriorNavigationItems(mobileNavigation, navigationMode)}
            />
          </div>
        </div>
      </header>
    </>
  );
}

export default async function V2InteriorShell({
  breadcrumbs,
  children,
  currentNavigationId,
  description,
  eyebrow,
  heroImageSrc,
  heroAside,
  heroTitleFontClassName,
  navigationMode,
  title,
  trackPublicEventDetailNavigation = false,
  upcomingCount,
}: V2InteriorShellProps) {
  const year = new Intl.DateTimeFormat("es-ES", { year: "numeric" }).format(new Date());
  const newsletterVisible = navigationMode === "preview" || await (async () => {
    const requestHeaders = await headers();
    const publicConfiguration = evaluateNewsletterPublicLaunchResendConfiguration(
      currentNewsletterPublicLaunchEnvironment(),
    );
    const canaryConfiguration = evaluateNewsletterProductionCanaryResendConfiguration(
      currentNewsletterProductionCanaryEnvironment(),
    );
    return publicConfiguration.enabled &&
      !canaryConfiguration.enabled &&
      isNewsletterPublicLaunchPageRequestAllowed(
        publicConfiguration,
        requestHeaders.get("host"),
        requestHeaders.get("x-forwarded-proto"),
      );
  })();

  return (
    <div className={styles.root} data-v2-route-context={navigationMode}>
      <V2GlobalHeader
        currentNavigationId={currentNavigationId}
        navigationMode={navigationMode}
        newsletterVisible={newsletterVisible}
        publishTrackingSource={trackPublicEventDetailNavigation && navigationMode === "public" ? "static_header_cta" : undefined}
        skipTargetId="contenido-redesign-v2-interior"
        upcomingCount={upcomingCount}
      />

      <main id="contenido-redesign-v2-interior">
        <section
          aria-labelledby="redesign-v2-interior-title"
          className={`${styles.pageHero} ${heroAside ? styles.pageHeroWithAside : ""}`}
          style={heroImageSrc ? { backgroundImage: `linear-gradient(90deg, rgba(5, 7, 10, 0.96) 0%, rgba(5, 7, 10, 0.8) 48%, rgba(5, 7, 10, 0.28) 100%), url(${heroImageSrc})` } : undefined}
        >
          <div className={`${styles.shell} ${styles.pageHeroInner}`}>
            <nav aria-label="Migas de pan" className={styles.breadcrumbWrap}>
              <ol className={styles.breadcrumbs}>
                {breadcrumbs.map((item, index) => (
                  <li key={`${item.label}-${index}`}>
                    {item.navigationId ? (
                      <PreviewAwareLink mode={navigationMode} navigationId={item.navigationId}>
                        {item.label}
                      </PreviewAwareLink>
                    ) : <span aria-current="page">{item.label}</span>}
                  </li>
                ))}
              </ol>
            </nav>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1
              className={heroTitleFontClassName}
              data-v2-display-h1={heroTitleFontClassName ? "archivo" : undefined}
              id="redesign-v2-interior-title"
            >{title}</h1>
            <p>{description}</p>
            {heroAside ? <div className={styles.heroAside}>{heroAside}</div> : null}
          </div>
        </section>

        {children}
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerGrid}`}>
          <div className={styles.footerBrand}>
            <EventomotorLogo />
            <p>La agenda nacional para vivir el motor dentro y fuera de la pista.</p>
          </div>
          <nav aria-label="Enlaces de agenda">
            <strong>Agenda</strong>
            <PreviewAwareLink mode={navigationMode} navigationId="calendar" />
            <PreviewAwareLink mode={navigationMode} navigationId="disciplines" />
            <PreviewAwareLink mode={navigationMode} navigationId="territories" />
          </nav>
          <nav aria-label="Enlaces de EventoMotor">
            <strong>EventoMotor</strong>
            {trackPublicEventDetailNavigation && navigationMode === "public" ? (
              <TrackLink
                eventName="click_publish_event"
                eventParams={{ source: "footer_link" }}
                href={resolveInteriorNavigationItem("publish", navigationMode).href}
              >Publicar evento</TrackLink>
            ) : (
              <PreviewAwareLink mode={navigationMode} navigationId="publish" />
            )}
            {newsletterVisible ? <PreviewAwareLink mode={navigationMode} navigationId="newsletter" /> : null}
            <PreviewAwareLink mode={navigationMode} navigationId="contact" />
          </nav>
          <nav aria-label="Enlaces legales">
            <strong>Legal</strong>
            <PreviewAwareLink mode={navigationMode} navigationId="legal" />
            <PreviewAwareLink mode={navigationMode} navigationId="privacy" />
            <PreviewAwareLink mode={navigationMode} navigationId="cookies" />
            <CookieSettingsButton />
          </nav>
        </div>
        <div className={`${styles.shell} ${styles.footerBottom}`}>
          <span>© {year} EventoMotor</span>
          <span>Hecho para quienes viven el motor</span>
        </div>
      </footer>
    </div>
  );
}
