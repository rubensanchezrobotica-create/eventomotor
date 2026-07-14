import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import EventDetailPreview from "@/components/preview/event-detail/EventDetailPreview";
import { isEventDetailPreviewAvailable } from "@/components/preview/event-detail/event-detail-preview-model";
import { getVisibleEvents } from "@/lib/public-events";
import { getSiteUrl } from "@/lib/site-url";

type EventDetailPreviewPageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: {
    absolute: "Preview de ficha de evento | EventoMotor",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function EventDetailPreviewPage({ params }: EventDetailPreviewPageProps) {
  await connection();

  const vercelEnvironmentKey = "VERCEL_ENV";

  if (!isEventDetailPreviewAvailable(process.env[vercelEnvironmentKey])) {
    notFound();
  }

  const { slug } = await params;
  const events = await getVisibleEvents();
  const event = events.find((item) => item.slug === slug);

  if (!event) notFound();

  return <EventDetailPreview event={event} events={events} siteUrl={getSiteUrl()} />;
}
