import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";

export default function ConceptStaticHeader() {
  return (
    <>
      <div className="emc-topline" />
      <nav className="emc-nav">
        <Link className="emc-brand-logo" href="/" aria-label="EventoMotor inicio">
          <EventomotorLogo compactOnMobile />
        </Link>
        <div className="emc-navlinks">
          <Link href="/preview-concept#calendario">Calendario</Link>
          <Link href="/preview-concept#disciplinas">Disciplinas</Link>
          <Link href="/preview-concept#zonas">Zonas</Link>
          <Link href="/preview-concept#publicar">Publicar</Link>
        </div>
        <div className="emc-nav-actions">
          <Link className="emc-btn emc-btn-dark" href="/preview-concept#calendario">
            Ver agenda
          </Link>
          <a className="emc-btn emc-btn-primary" href="mailto:hola@eventomotor.com?subject=Publicar%20evento%20en%20EventoMotor">
            Publicar
          </a>
        </div>
      </nav>
    </>
  );
}
