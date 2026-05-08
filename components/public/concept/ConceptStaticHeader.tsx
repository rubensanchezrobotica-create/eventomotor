import Link from "next/link";

export default function ConceptStaticHeader() {
  return (
    <>
      <div className="emc-topline" />
      <nav className="emc-nav">
        <Link className="emc-brand-logo" href="/" aria-label="EventoMotor inicio">
          <span className="emc-brand-mark" aria-hidden="true">
            EM
          </span>
          <span className="emc-brand-word">
            Evento<span>Motor</span>
          </span>
        </Link>
        <div className="emc-navlinks">
          <Link href="/preview-concept#calendario">Calendario</Link>
          <Link href="/preview-concept#resultados">Eventos</Link>
          <Link href="/preview-concept#explorar">Zonas</Link>
          <Link href="/preview-concept#organizadores">Organizadores</Link>
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
