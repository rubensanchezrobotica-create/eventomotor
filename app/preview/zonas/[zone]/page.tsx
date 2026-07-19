import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ZonePreviewPage from "@/components/zones/ZonePreviewPage";
import {
  buildZonePreviewMetadata,
  buildZonePreviewData,
  isZonePreviewAvailable,
  isZonePreviewId,
  parseZoneFilters,
} from "@/components/zones/zone-preview-model";
import type { MacroZoneId } from "@/lib/event-macro-zone";
import { getVisibleEvents } from "@/lib/public-events";

type ZonePreviewRouteProps = {
  params: Promise<{ zone: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: ZonePreviewRouteProps): Promise<Metadata> {
  const { zone } = await params;
  return buildZonePreviewMetadata(zone);
}

export default async function ZonePreviewRoute({
  params,
  searchParams,
}: ZonePreviewRouteProps) {
  await connection();

  if (!isZonePreviewAvailable(process.env.VERCEL_ENV)) {
    notFound();
  }

  const { zone } = await params;
  if (!isZonePreviewId(zone)) notFound();

  const [filtersParams, events] = await Promise.all([
    searchParams,
    getVisibleEvents(),
  ]);

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
