"use client";

import { useEffect } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";

export default function MotorcycleConcentrationsAnalytics() {
  useEffect(() => {
    trackEvent("view_motorcycle_concentrations_landing", {
      page_path: currentPagePath(),
      source: "concentraciones_moteras_2026",
    });
  }, []);

  return null;
}
