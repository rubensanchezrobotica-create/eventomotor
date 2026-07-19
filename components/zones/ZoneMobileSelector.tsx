"use client";

import { useRouter } from "next/navigation";
import { SEO_ZONES } from "@/lib/seo-taxonomy";
import type { MacroZoneId } from "@/lib/event-macro-zone";
import styles from "./ZonePreview.module.css";

type ZoneMobileSelectorProps = {
  basePath: "/preview/zonas" | "/zonas";
  currentZone: MacroZoneId;
};

export default function ZoneMobileSelector({ basePath, currentZone }: ZoneMobileSelectorProps) {
  const router = useRouter();
  const currentZoneData = SEO_ZONES.find((zone) => zone.slug === currentZone);

  return (
    <label className={styles.zoneMobileSelector}>
      <span className={styles.zoneMobileLabel}>Buscar en</span>
      <span aria-hidden="true" className={styles.zoneMobileDisplay}>
        <span className={styles.zoneMobileIcon} />
        <strong>{currentZoneData?.title ?? currentZone}</strong>
        <span className={styles.zoneMobileChevron}>›</span>
      </span>
      <select
        aria-label={`Buscar eventos en otra zona. Zona actual: ${currentZoneData?.title ?? currentZone}`}
        onChange={(event) => router.push(`${basePath}/${event.target.value}`)}
        value={currentZone}
      >
        {SEO_ZONES.map((zone) => (
          <option key={zone.slug} value={zone.slug}>{zone.title}</option>
        ))}
      </select>
    </label>
  );
}
