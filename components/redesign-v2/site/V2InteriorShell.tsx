import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackLink from "@/components/analytics/TrackLink";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";
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
  heroTitleFontClassName?: string;
  navigationMode: InteriorNavigationMode;
  title: string;
  trackPublicEventDetailNavigation?: boolean;
  upcomingCount: number;
};

export default function V2InteriorShell({
  breadcrumbs,
  children,
  currentNavigationId,
  description,
  eyebrow,
  heroImageSrc,
  heroTitleFontClassName,
  navigationMode,
  title,
  trackPublicEventDetailNavigation = false,
  upcomingCount,
}: V2InteriorShellProps) {
  const year = new Intl.DateTimeFormat("es-ES", { year: "numeric" }).format(new Date());
  const desktopNavigation = getInteriorNavigationIds(navigationMode, "desktop");
  const mobileNavigation = getInteriorNavigationIds(navigationMode, "mobile");

  return (
    <div className={styles.root} data-v2-route-context={navigationMode}>
      <a className={styles.skipLink} href="#contenido-redesign-v2-interior">Saltar al contenido</a>
      <header className={styles.header}>
        <div className={styles.utilityBar}>
          <div className={styles.shell}>
            <p><span aria-hidden="true">●</span> {upcomingCount} eventos próximos en la agenda</p>
            <PreviewAwareLink mode={navigationMode} navigationId="newsletter">La Agenda Motor</PreviewAwareLink>
          </div>
        </div>
        <div className={`${styles.shell} ${styles.navbar}`}>
          <PreviewAwareLink
            aria-label="EventoMotor V2, inicio"
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
            {navigationMode === "preview" ? (
              <PreviewAwareLink
                aria-current={currentNavigationId === "favorites" ? "page" : undefined}
                className={styles.favoritesLink}
                mode={navigationMode}
                navigationId="favorites"
              />
            ) : null}
            {trackPublicEventDetailNavigation && navigationMode === "public" ? (
              <TrackLink
                className={styles.publishButton}
                eventName="click_publish_event"
                eventParams={{ source: "static_header_cta" }}
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

      <main id="contenido-redesign-v2-interior">
        <section
          aria-labelledby="redesign-v2-interior-title"
          className={styles.pageHero}
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
            <PreviewAwareLink mode={navigationMode} navigationId="newsletter" />
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
