"use client";

import Link from "next/link";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import PublicNavigationMenu from "@/components/public/concept/PublicNavigationMenu";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

type ConceptHeaderProps = {
  onCalendar: () => void;
};

export default function ConceptHeader({ onCalendar }: ConceptHeaderProps) {
  return (
    <>
      <div className="emc-topline" />
      <header className="emc-header-shell">
        <nav className="emc-nav">
          <Link className="emc-brand-logo" href={PUBLIC_NAVIGATION.home} aria-label="EventoMotor inicio">
            <EventomotorLogo compactOnMobile />
          </Link>

          <PublicNavigationMenu onCalendar={onCalendar} />

          <div className="emc-nav-actions">
            <Link
              className="emc-btn emc-btn-primary"
              href={PUBLIC_NAVIGATION.publish}
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
