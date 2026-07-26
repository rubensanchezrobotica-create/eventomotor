"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getPublicNavigationSection,
  PRIMARY_NAVIGATION_ITEMS,
} from "@/lib/public-navigation";

export default function PublicNavigationMenu() {
  const pathname = usePathname();
  const activeSection = getPublicNavigationSection(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigationLinks(className?: string) {
    return PRIMARY_NAVIGATION_ITEMS.map((item) => (
      <Link
        aria-current={activeSection === item.id ? "page" : undefined}
        className={className}
        href={item.href}
        key={item.id}
        onNavigate={() => setMobileOpen(false)}
      >
        {item.label}
      </Link>
    ));
  }

  return (
    <>
      <div className="emc-navlinks">{navigationLinks()}</div>
      <div className="emc-mobile-navigation">
        <button
          aria-controls="emc-mobile-navigation-panel"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          className="emc-mobile-navigation-toggle"
          onClick={() => setMobileOpen((current) => !current)}
          type="button"
        >
          Menú
        </button>
        {mobileOpen ? (
          <nav aria-label="Navegación móvil" className="emc-mobile-navigation-panel" id="emc-mobile-navigation-panel">
            {navigationLinks("emc-mobile-navigation-link")}
          </nav>
        ) : null}
      </div>
    </>
  );
}
