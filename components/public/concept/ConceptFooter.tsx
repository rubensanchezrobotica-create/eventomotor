import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import CookieSettingsButton from "@/components/cookies/CookieSettingsButton";

export default function ConceptFooter() {
  const footerColumns = [
    {
      title: "Calendario",
      links: [
        { label: "Calendario", href: "/calendario" },
        { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
        { label: "Mis eventos", href: "/mis-eventos" },
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
        { label: "Publicar evento", href: "/publicar-evento" },
        { label: "Contacto", href: "/contacto" },
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

  return (
    <footer className="emc-footer">
      <div className="emc-container emc-footer-grid">
        <div>
          <div className="emc-footer-brand">
            <EventomotorLogo />
          </div>
          <p>Calendario nacional de eventos de motor: rallyes, motos, coches, rutas, circuito y concentraciones.</p>
          <p className="emc-footer-contact">
            Contacto y publicacion de eventos: <TrackAnchor eventName="click_contact_email" eventParams={{ location: "footer" }} href="mailto:info@eventomotor.com">info@eventomotor.com</TrackAnchor>
          </p>
        </div>
        <nav className="emc-footer-links" aria-label="Enlaces de pie de pagina">
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
                  <Link href={link.href} key={link.label}>{link.label}</Link>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="emc-footer-legal">© {new Date().getFullYear()} EventoMotor / La brujula del motor</div>
        <div className="emc-footer-cookie-settings">
          <CookieSettingsButton />
        </div>
      </div>
    </footer>
  );
}
