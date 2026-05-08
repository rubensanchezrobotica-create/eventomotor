import Link from "next/link";

export default function ConceptHeader({ onCalendar }: { onCalendar: () => void }) {
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
          <button className="emc-navlink-button" onClick={onCalendar} type="button">
            Calendario
          </button>
          <a href="#explorar">Zonas</a>
          <a href="#formas">Formas de descubrir</a>
          <a href="#organizadores">Organizadores</a>
        </div>
        <div className="emc-nav-actions">
          <button className="emc-btn emc-btn-dark" onClick={onCalendar} type="button">
            Ver agenda
          </button>
          <a className="emc-btn emc-btn-primary" href="#organizadores">
            Publicar
          </a>
        </div>
      </nav>
    </>
  );
}
