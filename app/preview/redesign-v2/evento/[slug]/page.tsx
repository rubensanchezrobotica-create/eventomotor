import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import EventDetailV2 from "@/components/redesign-v2/event-detail/EventDetailV2";
import {
  buildEventDetailV2Model,
  madridDateKey,
} from "@/components/redesign-v2/event-detail/event-detail-model";
import { isRedesignPreviewAvailable } from "@/components/redesign-v2/redesign-v2-model";
import { getVehicleType } from "@/lib/event-classification";
import { getVisibleEvents } from "@/lib/public-events";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Ficha de evento V2 Preview | EventoMotor",
  description: "Vista previa interna de la ficha de evento V2 de EventoMotor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

type EventDetailPreviewPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventDetailPreviewPage({ params }: EventDetailPreviewPageProps) {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const { slug } = await params;
  const events = (await getVisibleEvents()).map((event) => ({
    ...event,
    vehicleType: getVehicleType(event),
  }));
  const event = events.find((candidate) => candidate.slug === slug);
  if (!event) notFound();

  const model = buildEventDetailV2Model(event, events, {
    siteUrl: getSiteUrl(),
    today: madridDateKey(new Date()),
  });
  if (!model) notFound();

  return <EventDetailV2 model={model} />;
}
