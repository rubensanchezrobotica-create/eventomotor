import EventomotorLogo from "@/components/brand/EventomotorLogo";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";
import InteriorMobileNavigation from "./InteriorMobileNavigation.client";
import PreviewAwareLink from "./PreviewAwareLink";
import {
  resolvePreviewNavigationItems,
  type PreviewNavigationId,
} from "./preview-navigation";
import styles from "./V2PreviewShell.module.css";

type BreadcrumbItem = {
  label: string;
  navigationId?: PreviewNavigationId;
};

type V2PreviewShellProps = {
  breadcrumbs: readonly BreadcrumbItem[];
  children: React.ReactNode;
  currentNavigationId?: PreviewNavigationId;
  description: string;
  eyebrow: string;
  heroImageSrc?: string;
  title: string;
  upcomingCount: number;
};

const desktopNavigation = ["calendar", "disciplines", "territories", "contact"] as const;
const mobileNavigation = [
  "calendar",
  "disciplines",
  "territories",
  "contact",
  "publish",
] as const;

export default function V2PreviewShell({
  breadcrumbs,
  children,
  currentNavigationId,
  description,
  eyebrow,
  heroImageSrc,
  title,
  upcomingCount,
}: V2PreviewShellProps) {
  const year = new Intl.DateTimeFormat("es-ES", { year: "numeric" }).format(new Date());

  return (
    <div className={styles.root}>
      <a className={styles.skipLink} href="#contenido-redesign-v2-interior">Saltar al contenido</a>
      <header className={styles.header}>
        <div className={styles.utilityBar}>
          <div className={styles.shell}>
            <p><span aria-hidden="true">●</span> {upcomingCount} eventos próximos en la agenda</p>
            <PreviewAwareLink navigationId="newsletter">La Agenda Motor</PreviewAwareLink>
          </div>
        </div>
        <div className={`${styles.shell} ${styles.navbar}`}>
          <PreviewAwareLink className={styles.brand} navigationId="home" aria-label="EventoMotor V2, inicio">
            <EventomotorLogo />
          </PreviewAwareLink>
          <nav aria-label="Navegación principal" className={styles.desktopNav}>
            {desktopNavigation.map((id) => (
              <PreviewAwareLink aria-current={currentNavigationId === id ? "page" : undefined} key={id} navigationId={id} />
            ))}
          </nav>
          <div className={styles.navActions}>
            <PreviewAwareLink className={styles.publishButton} navigationId="publish" />
            <InteriorMobileNavigation items={resolvePreviewNavigationItems(mobileNavigation)} />
          </div>
        </div>
      </header>

      <main id="contenido-redesign-v2-interior">
        <section
          className={styles.pageHero}
          aria-labelledby="redesign-v2-interior-title"
          style={heroImageSrc ? { backgroundImage: `linear-gradient(90deg, rgba(5, 7, 10, 0.96) 0%, rgba(5, 7, 10, 0.8) 48%, rgba(5, 7, 10, 0.28) 100%), url(${heroImageSrc})` } : undefined}
        >
          <div className={`${styles.shell} ${styles.pageHeroInner}`}>
            <nav aria-label="Migas de pan" className={styles.breadcrumbWrap}>
              <ol className={styles.breadcrumbs}>
                {breadcrumbs.map((item, index) => (
                  <li key={`${item.label}-${index}`}>
                    {item.navigationId ? <PreviewAwareLink navigationId={item.navigationId}>{item.label}</PreviewAwareLink> : <span aria-current="page">{item.label}</span>}
                  </li>
                ))}
              </ol>
            </nav>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 id="redesign-v2-interior-title">{title}</h1>
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
            <PreviewAwareLink navigationId="calendar" />
            <PreviewAwareLink navigationId="disciplines" />
            <PreviewAwareLink navigationId="territories" />
          </nav>
          <nav aria-label="Enlaces de EventoMotor">
            <strong>EventoMotor</strong>
            <PreviewAwareLink navigationId="publish" />
            <PreviewAwareLink navigationId="newsletter" />
            <PreviewAwareLink navigationId="contact" />
          </nav>
          <nav aria-label="Enlaces legales">
            <strong>Legal</strong>
            <PreviewAwareLink navigationId="legal" />
            <PreviewAwareLink navigationId="privacy" />
            <PreviewAwareLink navigationId="cookies" />
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
