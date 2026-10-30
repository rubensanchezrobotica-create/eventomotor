"use client";

import { useEffect } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";

export default function MotorcycleConcentrationsAnalytics({ year }: { year: number }) {
  useEffect(() => {
    trackEvent("view_motorcycle_concentrations_landing", {
      page_path: currentPagePath(),
      source: `concentraciones_moteras_${year}`,
    });
  }, [year]);

  return null;
}
