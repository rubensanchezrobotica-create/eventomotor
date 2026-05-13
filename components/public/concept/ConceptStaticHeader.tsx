import Link from "next/link";
import TrackLink from "@/components/analytics/TrackLink";
import EventomotorLogo from "@/components/brand/EventomotorLogo";

type ConceptStaticHeaderProps = {
  compactActions?: boolean;
};

export default function ConceptStaticHeader({ compactActions = false }: ConceptStaticHeaderProps) {
  return (
    <>
      <div className="emc-topline" />
      <nav className="emc-nav">
        <Link className="emc-brand-logo" href="/" aria-label="EventoMotor inicio">
          <EventomotorLogo compactOnMobile />
        </Link>
        <div className="emc-navlinks">
          <Link href="/calendario">Calendario</Link>
          <Link href="/#disciplinas">Disciplinas</Link>
          <Link href="/#zonas">Zonas</Link>
          <Link href="/contacto">Contacto</Link>
        </div>
        <div className="emc-nav-actions">
          {compactActions ? null : (
            <Link className="emc-btn emc-btn-dark" href="/calendario">
              Ver agenda
            </Link>
          )}
          <TrackLink
            className="emc-btn emc-btn-primary"
            eventName="click_publish_event"
            eventParams={{ source: "static_header_cta" }}
            href="/publicar-evento"
          >
            Publicar
          </TrackLink>
        </div>
      </nav>
    </>
  );
}
