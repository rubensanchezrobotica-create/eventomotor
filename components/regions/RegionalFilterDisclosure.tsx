"use client";

import { useId, useState, type ReactNode } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import styles from "./RegionalLanding.module.css";

type RegionalFilterDisclosureProps = {
  activePeriodLabel?: string;
  analyticsEventName?: string;
  analyticsSource: string;
  children: ReactNode;
  region: string;
  totalLabel: string;
  toggleEventName?: string;
};

export default function RegionalFilterDisclosure({
  activePeriodLabel,
  analyticsEventName = "filter_region",
  analyticsSource,
  children,
  region,
  totalLabel,
  toggleEventName = "toggle_region_filters",
}: RegionalFilterDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div
      className={styles.filterDisclosure}
      onSubmit={(event) => {
        const form = event.target;
        if (form instanceof HTMLFormElement) {
          for (const field of Array.from(form.elements)) {
            if (
              (field instanceof HTMLInputElement || field instanceof HTMLSelectElement)
              && field.name
              && (!field.value || (field.name === "when" && field.value === "upcoming"))
            ) {
              field.disabled = true;
            }
          }
        }
        trackEvent(analyticsEventName, {
          action: "apply",
          page_path: currentPagePath(),
          region,
          source: analyticsSource,
        });
      }}
    >
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
          onClick={() => {
            setExpanded((current) => {
              trackEvent(toggleEventName, {
                expanded: !current,
                page_path: currentPagePath(),
                region,
                source: analyticsSource,
              });
              return !current;
            });
          }}
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
