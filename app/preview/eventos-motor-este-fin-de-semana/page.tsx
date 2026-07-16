import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import WeekendPreviewPage from "@/components/preview/weekend/WeekendPreviewPage";
import {
  buildWeekendPreviewData,
  isWeekendPreviewAvailable,
  parseWeekendFilters,
} from "@/components/preview/weekend/weekend-preview-model";
import { getVisibleEvents } from "@/lib/public-events";

type WeekendPreviewRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: {
    absolute: "Preview de eventos de motor este fin de semana | EventoMotor",
  },
  description: "Preview local aislada de la nueva agenda de fin de semana de EventoMotor.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function WeekendPreviewRoute({ searchParams }: WeekendPreviewRouteProps) {
  await connection();

  if (!isWeekendPreviewAvailable(process.env.NODE_ENV, process.env.VERCEL_ENV)) {
    notFound();
  }

  const [events, params] = await Promise.all([
    getVisibleEvents(),
    searchParams,
  ]);
  const data = buildWeekendPreviewData(events, new Date());
  const initialFilters = parseWeekendFilters(params);

  return (
    <WeekendPreviewPage
      data={data}
      initialFilters={initialFilters}
      pathname="/preview/eventos-motor-este-fin-de-semana"
    />
  );
}
