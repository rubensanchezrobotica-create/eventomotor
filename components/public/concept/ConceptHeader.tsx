"use client";

import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import { currentPagePath, trackEvent } from "@/lib/analytics";

type ConceptHeaderProps = {
  onCalendar: () => void;
};

export default function ConceptHeader({ onCalendar }: ConceptHeaderProps) {
  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="emc-topline" />
      <header className="emc-header-shell">
        <nav className="emc-nav">
          <Link className="emc-brand-logo" href="/" aria-label="EventoMotor inicio">
            <EventomotorLogo compactOnMobile />
          </Link>

          <div className="emc-navlinks">
            <button className="emc-navlink-button" onClick={onCalendar} type="button">
              Calendario
            </button>
            <button className="emc-navlink-button" onClick={() => scrollToSection("disciplinas")} type="button">
              Disciplinas
            </button>
            <button className="emc-navlink-button" onClick={() => scrollToSection("zonas")} type="button">
              Zonas
            </button>
            <Link className="emc-navlink-button" href="/contacto">
              Contacto
            </Link>
          </div>

          <div className="emc-nav-actions">
            <Link
              className="emc-btn emc-btn-primary"
              href="/publicar-evento"
              onClick={() => trackEvent("click_publish_event", { page_path: currentPagePath(), source: "header_cta" })}
            >
              Publicar
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
