import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import RedesignV2Home from "@/components/redesign-v2/RedesignV2Home";
import { isRedesignPreviewAvailable } from "@/components/redesign-v2/redesign-v2-model";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Preview rediseño v2 | EventoMotor",
  description: "Vista previa interna del rediseño de EventoMotor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function RedesignV2PreviewPage() {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const events = await getVisibleEvents();
  return <RedesignV2Home events={events} nowIso={new Date().toISOString()} />;
}
