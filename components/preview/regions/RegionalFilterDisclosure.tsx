"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./RegionalLandingPreview.module.css";

type RegionalFilterDisclosureProps = {
  activePeriodLabel?: string;
  children: ReactNode;
  totalLabel: string;
};

export default function RegionalFilterDisclosure({
  activePeriodLabel,
  children,
  totalLabel,
}: RegionalFilterDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className={styles.filterDisclosure}>
      <div className={styles.filterSummary}>
        <div className={styles.filterSummaryText}>
          <strong>{totalLabel}</strong>
          <span className={styles.sortLabel}>· Ordenados por fecha</span>
          {activePeriodLabel ? <span>{activePeriodLabel}</span> : null}
        </div>
        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          className={styles.filterToggle}
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          Filtrar
        </button>
      </div>
      <div
        className={`${styles.filterPanel} ${expanded ? styles.filterPanelOpen : ""}`}
        id={panelId}
      >
        {children}
      </div>
    </div>
  );
}
