import type { Metadata } from "next";
import { connection } from "next/server";
import CalendarPageExperience from "@/components/redesign-v2/calendar/CalendarPageExperience.client";
import {
  madridCalendarDateKey,
  parseCalendarUrlState,
  type CalendarQueryRecord,
} from "@/components/redesign-v2/calendar/calendar-page-model";
import { assignV2HomeEventImages } from "@/components/redesign-v2/discipline-fallback-resolver";
import { projectPreviewEvent } from "@/components/redesign-v2/redesign-v2-model";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { getVehicleType } from "@/lib/event-classification";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Calendario de eventos de motor",
  description: "Descubre todos los eventos de motor en España por fecha.",
  alternates: {
    canonical: `${SITE_URL}/calendario`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

type CalendarPageProps = { searchParams: Promise<CalendarQueryRecord> };

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  await connection();

  const now = new Date();
  const today = madridCalendarDateKey(now);
  const initialState = parseCalendarUrlState(await searchParams, today);
  const events = (await getVisibleEvents()).map((event) => projectPreviewEvent({
    ...event,
    vehicleType: getVehicleType(event),
  }));
  const images = assignV2HomeEventImages(events);
  const imageByEventId = Object.fromEntries(events.map((event, index) => [event.id, images[index]]));
  const upcomingCount = events.filter((event) => (event.end || event.start) >= today).length;

  return (
    <V2InteriorShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Calendario" }]}
      currentNavigationId="calendar"
      description="Descubre todos los eventos de motor en España por fecha."
      eyebrow="Agenda motor"
      heroImageSrc="/images/redesign-v2/hero-eventomotor.webp"
      navigationMode="public"
      title="Calendario de eventos"
      upcomingCount={upcomingCount}
    >
      <CalendarPageExperience
        events={events}
        imageByEventId={imageByEventId}
        initialState={initialState}
        nowIso={now.toISOString()}
        today={today}
      />
    </V2InteriorShell>
  );
}
