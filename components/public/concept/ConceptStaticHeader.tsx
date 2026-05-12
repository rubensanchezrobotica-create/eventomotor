import Link from "next/link";
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
          <Link href="/#calendario">Calendario</Link>
          <Link href="/#disciplinas">Disciplinas</Link>
          <Link href="/#zonas">Zonas</Link>
          <Link href="/contacto">Contacto</Link>
        </div>
        <div className="emc-nav-actions">
          {compactActions ? null : (
            <Link className="emc-btn emc-btn-dark" href="/#calendario">
              Ver agenda
            </Link>
          )}
          <Link className="emc-btn emc-btn-primary" href="/publicar-evento">
            Publicar
          </Link>
        </div>
      </nav>
    </>
  );
}
