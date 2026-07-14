"use client";

import ConceptHomePage from "@/components/public/concept/ConceptHomePage";
import SearchPreview from "./SearchPreview";
import styles from "./SearchPreview.module.css";

type PreviewHomePageProps = {
  hasHeroImage?: boolean;
};

export default function PreviewHomePage({ hasHeroImage = false }: PreviewHomePageProps) {
  return (
    <ConceptHomePage
      className={styles.previewHome}
      explorerSummaryVariant="concise"
      footerVariant="compact"
      hasHeroImage={hasHeroImage}
      popularSearchesVariant="organized"
      searchPanel={SearchPreview}
      useCalendarCountGrammar
      zoneExplorerVariant="atmospheric"
    />
  );
}
