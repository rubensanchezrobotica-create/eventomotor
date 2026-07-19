"use client";

import { useState, type ReactNode } from "react";
import styles from "./ZonePreview.module.css";

type ZoneSeoDisclosureProps = {
  children: ReactNode;
};

const CONTENT_ID = "zone-guide-more-content";

export default function ZoneSeoDisclosure({ children }: ZoneSeoDisclosureProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        aria-controls={CONTENT_ID}
        aria-expanded={expanded}
        className={styles.seoDisclosureToggle}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded ? "Ocultar información" : "Leer más sobre esta zona"}
      </button>
      <div
        className={`${styles.seoDisclosureContent} ${
          expanded ? styles.seoDisclosureContentOpen : ""
        }`}
        id={CONTENT_ID}
      >
        {children}
      </div>
    </>
  );
}
