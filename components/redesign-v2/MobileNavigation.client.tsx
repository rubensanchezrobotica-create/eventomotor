"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import styles from "./RedesignV2.module.css";

const defaultItems = [
  { href: "/#calendario", label: "Calendario" },
  { href: "/disciplinas", label: "Disciplinas" },
  { href: "/zonas", label: "Zonas" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/publicar-evento", label: "Publicar evento" },
] as const;

export type MobileNavigationItem = {
  href: string;
  label: string;
  previewFallback?: "production";
};

type MobileNavigationProps = {
  items?: readonly MobileNavigationItem[];
};

export default function MobileNavigation({ items = defaultItems }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  function closeAndFocus() {
    setOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }

  return (
    <div
      className={styles.mobileNavigation}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          closeAndFocus();
        }
      }}
    >
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        className={styles.menuToggle}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>
      {open ? (
        <nav aria-label="Navegación móvil" className={styles.mobileMenu} id={panelId}>
          {items.map((item) => (
            <Link
              data-preview-fallback={item.previewFallback}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
