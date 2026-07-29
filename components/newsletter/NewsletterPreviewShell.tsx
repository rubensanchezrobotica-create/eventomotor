"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import styles from "./NewsletterPreview.module.css";

const TOKEN_ACTION_PATHS = new Set([
  "/preview/newsletter/confirm",
  "/preview/newsletter/unsubscribe",
]);

export default function NewsletterPreviewShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isTokenAction = TOKEN_ACTION_PATHS.has(pathname);

  if (isTokenAction) {
    return (
      <>
        <header className={styles.taskHeader}>
          <div className={`emc-container ${styles.taskHeaderInner}`}>
            <Link
              aria-label="EventoMotor inicio"
              className={styles.taskBrand}
              href="/"
            >
              <EventomotorLogo />
            </Link>
            <span>La Agenda Motor</span>
          </div>
        </header>
        {children}
        <footer className={styles.taskFooter}>
          <div className="emc-container">
            <span>EventoMotor</span>
            <Link href="/privacidad">Privacidad</Link>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <header className={`emc-header-shell ${styles.headerShell}`}>
        <ConceptStaticHeader compactActions />
      </header>
      {children}
      <ConceptFooter
        contactTrackingLocation="newsletter_preview_footer"
        variant="compact"
      />
    </>
  );
}
