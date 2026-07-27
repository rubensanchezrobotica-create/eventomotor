"use client";

import { useEffect } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";

export default function RegionalLandingAnalytics({
  region,
}: {
  region: string;
}) {
  useEffect(() => {
    trackEvent("view_region_landing", {
      page_path: currentPagePath(),
      region,
    });
  }, [region]);

  return null;
}
