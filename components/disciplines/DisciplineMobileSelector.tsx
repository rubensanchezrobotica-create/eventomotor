"use client";

import { useRouter } from "next/navigation";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { DisciplineSlug } from "./discipline-preview-model";
import zoneStyles from "@/components/zones/ZonePreview.module.css";
import styles from "./DisciplinePreview.module.css";

type DisciplineMobileSelectorProps = {
  currentDiscipline: DisciplineSlug;
};

export default function DisciplineMobileSelector({
  currentDiscipline,
}: DisciplineMobileSelectorProps) {
  const router = useRouter();
  const current = SEO_DISCIPLINES.find((discipline) => discipline.slug === currentDiscipline);

  return (
    <label className={`${zoneStyles.zoneMobileSelector} ${styles.disciplineSelector}`}>
      <span className={zoneStyles.zoneMobileLabel}>Buscar en</span>
      <span aria-hidden="true" className={zoneStyles.zoneMobileDisplay}>
        <strong>{current?.title || currentDiscipline}</strong>
        <span className={zoneStyles.zoneMobileChevron}>›</span>
      </span>
      <select
        aria-label={`Buscar eventos de otra disciplina. Disciplina actual: ${current?.title || currentDiscipline}`}
        onChange={(event) => {
          trackEvent("change_discipline", {
            from_discipline: currentDiscipline,
            page_path: currentPagePath(),
            source: "discipline_preview_filter",
            to_discipline: event.target.value,
          });
          router.push(`/preview/disciplinas/${event.target.value}`);
        }}
        value={currentDiscipline}
      >
        {SEO_DISCIPLINES.map((discipline) => (
          <option key={discipline.slug} value={discipline.slug}>{discipline.title}</option>
        ))}
      </select>
    </label>
  );
}
