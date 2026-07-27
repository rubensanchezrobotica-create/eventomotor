import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import { SEO_ZONES } from "@/lib/seo-taxonomy";

export type FooterVariant = "default" | "compact";

type FooterLink = {
  label: string;
  href: string;
};

type FooterColumn = {
  id: string;
  title: string;
  links: readonly FooterLink[];
};

type ConceptFooterProps = {
  contactTrackingLocation?: string;
  variant?: FooterVariant;
};

export const PUBLIC_FOOTER_COLUMNS = [
  {
    id: "calendar",
    title: "Calendario",
    links: [
      { label: "Calendario", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Mis eventos", href: PUBLIC_NAVIGATION.savedEvents },
    ],
  },
  {
    id: "competition",
    title: "Rallies y competición",
    links: [
      { label: "Rallyes en España 2026", href: "/rallyes-espana-2026" },
      { label: "Rallysprint en España 2026", href: "/rallysprint-espana-2026" },
      { label: "Rallyes en Valencia 2026", href: "/rallyes-valencia-2026" },
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Karting", href: "/disciplinas/karting" },
    ],
  },
  {
    id: "meetups",
    title: "Motos y encuentros",
    links: [
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Clásicos", href: "/disciplinas/clasicos" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
    ],
  },
  {
    id: "zones",
    title: "Zonas",
    links: [
      { label: "Todas las zonas", href: "/zonas" },
      ...SEO_ZONES.map((zone) => ({ label: zone.title, href: `/zonas/${zone.slug}` })),
    ],
  },
  {
    id: "organizers",
    title: "Organizadores",
    links: [
      { label: "Publicar evento", href: PUBLIC_NAVIGATION.publish },
      { label: "Contacto", href: PUBLIC_NAVIGATION.contact },
    ],
  },
  {
    id: "legal",
    title: "Legal",
    links: [
      { label: "Aviso legal", href: "/aviso-legal" },
      { label: "Privacidad", href: "/privacidad" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
] as const satisfies readonly FooterColumn[];

function renderFooterLink(link: FooterLink) {
  return link.href === "/publicar-evento" ? (
    <TrackLink
      eventName="click_publish_event"
      eventParams={{ source: "footer_link" }}
      href={link.href}
      key={link.label}
    >
      {link.label}
    </TrackLink>
  ) : (
    <Link href={link.href} key={link.label}>{link.label}</Link>
  );
}

export default function ConceptFooter({ contactTrackingLocation = "footer", variant = "default" }: ConceptFooterProps) {
  return (
    <footer className={variant === "compact" ? "emc-footer emc-footer-compact" : "emc-footer"}>
      <div className="emc-container emc-footer-grid">
        <div>
          <div className="emc-footer-brand">
            <EventomotorLogo />
          </div>
          <p>Calendario nacional de eventos de motor: rallies, motos, coches, rutas, circuito y concentraciones.</p>
          <p className="emc-footer-contact">
            Contacto y publicación de eventos: <TrackAnchor eventName="click_contact_email" eventParams={{ location: contactTrackingLocation }} href="mailto:info@eventomotor.com">info@eventomotor.com</TrackAnchor>
          </p>
        </div>
        <nav className="emc-footer-links" aria-label="Enlaces de pie de página">
          {PUBLIC_FOOTER_COLUMNS.map((column) => (
            <div
              className={`emc-footer-column emc-footer-column-${column.id}`}
              key={column.title}
            >
              <strong>{column.title}</strong>
              {column.links.map(renderFooterLink)}
            </div>
          ))}
        </nav>
        <div className="emc-footer-bottom">
          <div className="emc-footer-legal">© {new Date().getFullYear()} EventoMotor. Todos los derechos reservados.</div>
          <div className="emc-footer-cookie-settings">
            <CookieSettingsButton />
          </div>
        </div>
      </div>
    </footer>
  );
}
