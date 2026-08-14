import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import CalendarPageExperience from "@/components/redesign-v2/calendar/CalendarPageExperience.client";
import { madridCalendarDateKey, parseCalendarUrlState, type CalendarQueryRecord } from "@/components/redesign-v2/calendar/calendar-page-model";
import { assignV2HomeEventImages } from "@/components/redesign-v2/discipline-fallback-resolver";
import { isRedesignPreviewAvailable, projectPreviewEvent } from "@/components/redesign-v2/redesign-v2-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import { getVehicleType } from "@/lib/event-classification";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Calendario V2 Preview | EventoMotor",
  description: "Vista previa interna del calendario V2 de EventoMotor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

type CalendarPreviewPageProps = { searchParams: Promise<CalendarQueryRecord> };

export default async function CalendarPreviewPage({ searchParams }: CalendarPreviewPageProps) {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

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
    <V2PreviewShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Calendario" }]}
      currentNavigationId="calendar"
      description="Elige un día y descubre qué eventos de motor se celebran en toda España."
      eyebrow="Agenda motor"
      title="Calendario de eventos de motor"
      upcomingCount={upcomingCount}
    >
      <CalendarPageExperience events={events} imageByEventId={imageByEventId} initialState={initialState} nowIso={now.toISOString()} today={today} />
    </V2PreviewShell>
  );
}
