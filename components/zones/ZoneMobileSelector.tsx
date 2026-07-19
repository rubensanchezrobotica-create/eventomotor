"use client";

import { useRouter } from "next/navigation";
import { SEO_ZONES } from "@/lib/seo-taxonomy";
import type { MacroZoneId } from "@/lib/event-macro-zone";
import styles from "./ZonePreview.module.css";

type ZoneMobileSelectorProps = {
  currentZone: MacroZoneId;
};

export default function ZoneMobileSelector({ currentZone }: ZoneMobileSelectorProps) {
  const router = useRouter();

  return (
    <label className={styles.zoneMobileSelector}>
      <span>Zona</span>
      <select
        aria-label="Cambiar zona territorial"
        onChange={(event) => router.push(`/preview/zonas/${event.target.value}`)}
        value={currentZone}
      >
        {SEO_ZONES.map((zone) => (
          <option key={zone.slug} value={zone.slug}>{zone.title}</option>
        ))}
      </select>
    </label>
  );
}
