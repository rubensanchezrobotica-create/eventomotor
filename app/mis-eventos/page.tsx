import type { Metadata } from "next";
import { connection } from "next/server";
import MyEventsClient from "@/components/events/MyEventsClient";
import styles from "@/components/events/MyEventsV2.module.css";
import { madridCalendarDateKey } from "@/components/redesign-v2/calendar/calendar-page-model";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mis eventos guardados",
  description: "Consulta los eventos de motor que has guardado en este dispositivo.",
  alternates: {
    canonical: `${SITE_URL}/mis-eventos`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default async function MisEventosPage() {
  await connection();
  const today = madridCalendarDateKey();
  const upcomingCount = (await getVisibleEvents()).filter(
    (event) => (event.end || event.start) >= today,
  ).length;

  return (
    <div className={`${styles.pageScope} ${redesignV2DisplayPilot.variable}`}>
      <V2InteriorShell
        breadcrumbs={[
          { label: "Inicio", navigationId: "home" },
          { label: "Mis eventos" },
        ]}
        currentNavigationId="favorites"
        description="Tus eventos guardados en este dispositivo, reunidos para volver a ellos rápidamente. No necesitas una cuenta."
        eyebrow="Tu agenda"
        navigationMode="public"
        title="Mis eventos"
        upcomingCount={upcomingCount}
      >
        <MyEventsClient />
      </V2InteriorShell>
    </div>
  );
}
