import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { assignV2HomeEventImages } from "@/components/redesign-v2/discipline-fallback-resolver";
import { isRedesignPreviewAvailable, projectPreviewEvent } from "@/components/redesign-v2/redesign-v2-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import WeekendPageExperience from "@/components/redesign-v2/weekend/WeekendPageExperience.client";
import {
  calculateWeekendRange,
  eventIntersectsWeekend,
  parseWeekendUrlState,
  type WeekendQueryRecord,
} from "@/components/redesign-v2/weekend/weekend-page-model";
import { getVehicleType } from "@/lib/event-classification";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Este fin de semana V2 Preview | EventoMotor",
  description: "Vista previa interna de los eventos de motor de este fin de semana.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

type WeekendPreviewPageProps = { searchParams: Promise<WeekendQueryRecord> };

export default async function WeekendPreviewPage({ searchParams }: WeekendPreviewPageProps) {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const now = new Date();
  const range = calculateWeekendRange(now);
  const allVisibleEvents = (await getVisibleEvents()).map((event) => projectPreviewEvent({
    ...event,
    vehicleType: getVehicleType(event),
  }));
  const weekendEvents = allVisibleEvents.filter((event) => eventIntersectsWeekend(event, range));
  const images = assignV2HomeEventImages(weekendEvents);
  const imageByEventId = Object.fromEntries(weekendEvents.map((event, index) => [event.id, images[index]]));
  const upcomingCount = allVisibleEvents.filter((event) => (event.end || event.start) >= range.today).length;
  const initialState = parseWeekendUrlState(await searchParams);

  return (
    <V2PreviewShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Este fin de semana" }]}
      description="Carreras, concentraciones y planes para disfrutar del motor de viernes a domingo."
      eyebrow="Agenda del fin de semana"
      heroImageSrc="/images/redesign-v2/hero-eventomotor.webp"
      title="Este fin de semana"
      upcomingCount={upcomingCount}
    >
      <WeekendPageExperience events={weekendEvents} imageByEventId={imageByEventId} initialState={initialState} nowIso={now.toISOString()} range={range} />
    </V2PreviewShell>
  );
}
