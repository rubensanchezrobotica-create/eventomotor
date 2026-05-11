"use client";

import Link from "next/link";

type ConceptHeaderProps = {
  onCalendar: () => void;
};

export default function ConceptHeader({ onCalendar }: ConceptHeaderProps) {
  return (
    <>
      <div className="emc-topline" />
      <header className="emc-header-shell">
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
            <a href="#calendario">Zonas</a>
          </div>

          <div className="emc-nav-actions">
            <a className="emc-btn emc-btn-primary" href="#organizadores">
              Publicar
            </a>
          </div>
        </nav>
      </header>
    </>
  );
}
