import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ZonePreviewPage from "@/components/zones/ZonePreviewPage";
import {
  buildZonePreviewData,
  isZonePreviewAvailable,
  parseZoneFilters,
} from "@/components/zones/zone-preview-model";
import { MACRO_ZONE_IDS, type MacroZoneId } from "@/lib/event-macro-zone";
import { getVisibleEvents } from "@/lib/public-events";
import { SEO_ZONES } from "@/lib/seo-taxonomy";

type ZonePreviewRouteProps = {
  params: Promise<{ zone: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: ZonePreviewRouteProps): Promise<Metadata> {
  const { zone } = await params;
  const config = SEO_ZONES.find((item) => item.slug === zone);

  return {
    title: config
      ? `Preview territorial: ${config.title} | EventoMotor`
      : "Preview territorial | EventoMotor",
    description: "Preview local aislada del rediseño de páginas territoriales de EventoMotor.",
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default async function ZonePreviewRoute({
  params,
  searchParams,
}: ZonePreviewRouteProps) {
  await connection();

  if (!isZonePreviewAvailable(process.env.NODE_ENV, process.env.VERCEL_ENV)) {
    notFound();
  }

  const [{ zone }, filtersParams, events] = await Promise.all([
    params,
    searchParams,
    getVisibleEvents(),
  ]);

  if (!MACRO_ZONE_IDS.includes(zone as MacroZoneId)) notFound();

  const now = new Date();
  const data = buildZonePreviewData(events, zone as MacroZoneId, now);
  const initialFilters = parseZoneFilters(filtersParams);

  return (
    <ZonePreviewPage
      data={data}
      initialFilters={initialFilters}
      nowIso={now.toISOString()}
      pathname={`/preview/zonas/${zone}`}
    />
  );
}
