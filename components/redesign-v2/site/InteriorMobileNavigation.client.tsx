"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { ResolvedPreviewNavigationItem } from "./preview-navigation";
import styles from "./V2PreviewShell.module.css";

type InteriorMobileNavigationProps = {
  items: readonly ResolvedPreviewNavigationItem[];
};

export default function InteriorMobileNavigation({ items }: InteriorMobileNavigationProps) {
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
              key={item.id}
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
