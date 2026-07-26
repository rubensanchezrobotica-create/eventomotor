import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";
import { formatPreviewDisplayText } from "@/components/preview/preview-geography";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

export type FooterVariant = "default" | "compact";

type FooterLink = {
  label: string;
  href: string;
};

type ConceptFooterProps = {
  contactTrackingLocation?: string;
  variant?: FooterVariant;
};

function renderFooterLink(link: FooterLink, useCanonicalCopy = false) {
  const label = useCanonicalCopy ? formatPreviewDisplayText(link.label) : link.label;

  return link.href === "/publicar-evento" ? (
    <TrackLink
      eventName="click_publish_event"
      eventParams={{ source: "footer_link" }}
      href={link.href}
      key={link.label}
    >
      {label}
    </TrackLink>
  ) : (
    <Link href={link.href} key={link.label}>{label}</Link>
  );
}

export default function ConceptFooter({ contactTrackingLocation = "footer", variant = "default" }: ConceptFooterProps) {
  const footerColumns = [
    {
      title: "Calendario",
      links: [
        { label: "Calendario", href: PUBLIC_NAVIGATION.calendar },
        { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
        { label: "Mis eventos", href: PUBLIC_NAVIGATION.savedEvents },
      ],
    },
    {
      title: "Rallyes",
      links: [
        { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
        { label: "Rallysprint en Espana 2026", href: "/rallysprint-espana-2026" },
        { label: "Rallyes en Valencia 2026", href: "/rallyes-valencia-2026" },
      ],
    },
    {
      title: "Motos",
      links: [
        { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
        { label: "Concentraciones", href: "/disciplinas/concentraciones" },
        { label: "Rutas moteras", href: "/disciplinas/rutas" },
      ],
    },
    {
      title: "Zonas",
      links: [
        { label: "Eventos motor Cataluna", href: "/eventos-motor-cataluna" },
        { label: "Eventos motor Comunidad Valenciana", href: "/eventos-motor-comunidad-valenciana" },
        { label: "Eventos motor Madrid", href: "/eventos-motor-madrid" },
        { label: "Eventos motor Andalucia", href: "/eventos-motor-andalucia" },
        { label: "Eventos motor Galicia", href: "/eventos-motor-galicia" },
        { label: "Eventos motor Aragon", href: "/eventos-motor-aragon" },
        { label: "Eventos motor Castilla-La Mancha", href: "/eventos-motor-castilla-la-mancha" },
        { label: "Eventos motor Canarias", href: "/eventos-motor-canarias" },
        { label: "Eventos motor Murcia", href: "/eventos-motor-murcia" },
        { label: "Eventos motor Castilla y Leon", href: "/eventos-motor-castilla-y-leon" },
        { label: "Eventos motor Asturias", href: "/eventos-motor-asturias" },
        { label: "Eventos motor Cantabria", href: "/eventos-motor-cantabria" },
        { label: "Eventos motor Navarra", href: "/eventos-motor-navarra" },
        { label: "Eventos motor Extremadura", href: "/eventos-motor-extremadura" },
        { label: "Eventos motor Baleares", href: "/eventos-motor-baleares" },
        { label: "Eventos motor País Vasco", href: "/eventos-motor-pais-vasco" },
        { label: "Eventos de motor en Barcelona", href: "/eventos-motor-barcelona" },
        { label: "Eventos de motor en Valencia", href: "/eventos-motor-valencia" },
      ],
    },
    {
      title: "Disciplinas",
      links: [
        { label: "Karting", href: "/disciplinas/karting" },
        { label: "Ferias del motor", href: "/disciplinas/ferias" },
        { label: "Circuito", href: "/disciplinas/circuito" },
        { label: "Offroad", href: "/disciplinas/offroad" },
      ],
    },
    {
      title: "Organizadores",
      links: [
        { label: "Publicar evento", href: PUBLIC_NAVIGATION.publish },
        { label: "Contacto", href: PUBLIC_NAVIGATION.contact },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Aviso legal", href: "/aviso-legal" },
        { label: "Privacidad", href: "/privacidad" },
        { label: "Cookies", href: "/cookies" },
      ],
    },
  ];
  const zoneLinks = footerColumns.find((column) => column.title === "Zonas")?.links || [];
  const compactColumns = [
    {
      id: "calendar",
      title: "Calendario",
      links: footerColumns.find((column) => column.title === "Calendario")?.links || [],
    },
    {
      id: "motor",
      title: "Motor",
      links: footerColumns
        .filter((column) => ["Rallyes", "Motos", "Disciplinas"].includes(column.title))
        .flatMap((column) => column.links),
    },
    {
      id: "explore",
      title: "Explorar",
      links: zoneLinks.slice(0, 5),
    },
    {
      id: "organizers",
      title: "Organizadores",
      links: footerColumns.find((column) => column.title === "Organizadores")?.links || [],
    },
    {
      id: "legal",
      title: "Legal",
      links: footerColumns.find((column) => column.title === "Legal")?.links || [],
    },
  ];

  return (
    <footer className={variant === "compact" ? "emc-footer emc-footer-compact" : "emc-footer"}>
      <div className="emc-container emc-footer-grid">
        <div>
          <div className="emc-footer-brand">
            <EventomotorLogo />
          </div>
          <p>Calendario nacional de eventos de motor: rallyes, motos, coches, rutas, circuito y concentraciones.</p>
          <p className="emc-footer-contact">
            {variant === "compact" ? "Contacto y publicación de eventos: " : "Contacto y publicacion de eventos: "}<TrackAnchor eventName="click_contact_email" eventParams={{ location: contactTrackingLocation }} href="mailto:info@eventomotor.com">info@eventomotor.com</TrackAnchor>
          </p>
        </div>
        <nav className="emc-footer-links" aria-label={variant === "compact" ? "Enlaces de pie de página" : "Enlaces de pie de pagina"}>
          {(variant === "compact" ? compactColumns : footerColumns).map((column) => (
            <div
              className={`emc-footer-column ${variant === "compact" && "id" in column ? `emc-footer-column-${column.id}` : ""}`}
              key={column.title}
            >
              <strong>{column.title}</strong>
              {column.links.map((link) => renderFooterLink(link, variant === "compact"))}
              {variant === "compact" && "id" in column && column.id === "explore" ? (
                <details className="emc-footer-zone-details">
                  <summary>Ver todas las zonas</summary>
                  <div className="emc-footer-zone-secondary" data-footer-zone-links="remaining">
                    {zoneLinks.slice(5).map((link) => renderFooterLink(link, true))}
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="emc-footer-legal">© {new Date().getFullYear()} EventoMotor / {variant === "compact" ? "La brújula del motor" : "La brujula del motor"}</div>
        <div className="emc-footer-cookie-settings">
          <CookieSettingsButton />
        </div>
      </div>
    </footer>
  );
}
