import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import { OPPORTUNITY_PAGES } from "@/lib/opportunity-pages";

export default function ConceptFooter() {
  const footerColumns = [
    {
      title: "EventoMotor",
      links: [
        { label: "Calendario", href: "/#calendario" },
        { label: "Contacto", href: "/contacto" },
      ],
    },
    {
      title: "Explorar",
      links: [
        { label: "Zonas", href: "/#zonas" },
        { label: "Disciplinas", href: "/#disciplinas" },
      ],
    },
    {
      title: "Organizadores",
      links: [
        { label: "Publicar evento", href: "/publicar-evento" },
      ],
    },
    {
      title: "Búsquedas populares",
      links: OPPORTUNITY_PAGES.map((page) => ({
        label: page.h1,
        href: `/${page.slug}`,
      })),
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

  return (
    <footer className="emc-footer">
      <div className="emc-container emc-footer-grid">
        <div>
          <div className="emc-footer-brand">
            <EventomotorLogo />
          </div>
          <p>Calendario nacional de eventos de motor: rallyes, motos, coches, rutas, circuito y concentraciones.</p>
          <p className="emc-footer-contact">
            Contacto y publicación de eventos: <TrackAnchor eventName="click_contact_email" eventParams={{ location: "footer" }} href="mailto:info@eventomotor.com">info@eventomotor.com</TrackAnchor>
          </p>
        </div>
        <nav className="emc-footer-links" aria-label="Enlaces de pie de página">
          {footerColumns.map((column) => (
            <div className="emc-footer-column" key={column.title}>
              <strong>{column.title}</strong>
              {column.links.map((link) =>
                link.href === "/publicar-evento" ? (
                  <TrackLink
                    eventName="click_publish_event"
                    eventParams={{ source: "footer_link" }}
                    href={link.href}
                    key={link.label}
                  >
                    {link.label}
                  </TrackLink>
                ) : (
                  <a href={link.href} key={link.label}>{link.label}</a>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="emc-footer-legal">© {new Date().getFullYear()} EventoMotor / La brújula del motor</div>
      </div>
    </footer>
  );
}
