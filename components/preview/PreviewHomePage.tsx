"use client";

import type { ReactNode } from "react";
import ConceptHomePage from "@/components/public/concept/ConceptHomePage";
import type { EventItem } from "@/types/event";
import SearchPreview from "./SearchPreview";
import styles from "./SearchPreview.module.css";

type PreviewHomePageProps = {
  hasHeroImage?: boolean;
  initialEvents?: EventItem[];
  newsletterCapture?: ReactNode;
  newsletterPublicLaunchEnabled?: boolean;
};

export default function PreviewHomePage({
  hasHeroImage = false,
  initialEvents = [],
  newsletterCapture,
  newsletterPublicLaunchEnabled = false,
}: PreviewHomePageProps) {
  return (
    <ConceptHomePage
      className={styles.previewHome}
      explorerSummaryVariant="concise"
      footerVariant="compact"
      hasHeroImage={hasHeroImage}
      initialEvents={initialEvents}
      newsletterCapture={newsletterCapture}
      newsletterPublicLaunchEnabled={newsletterPublicLaunchEnabled}
      popularSearchesVariant="organized"
      searchPanel={SearchPreview}
      useCalendarCountGrammar
      zoneExplorerVariant="atmospheric"
    />
  );
}
