import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import { isRedesignPreviewAvailable } from "@/components/redesign-v2/redesign-v2-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import TerritoryDetailPage from "@/components/redesign-v2/zones/TerritoryDetailPage";
import {
  buildTerritoryDetailPageModel,
  parseTerritoryDetailQuery,
  resolvePreviewTerritory,
  territoryDetailHeroSummary,
} from "@/components/redesign-v2/zones/territory-detail-model";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Territorio V2 Preview | EventoMotor",
  description: "Vista previa interna del detalle territorial V2 de EventoMotor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

type TerritoryDetailPreviewPageProps = {
  params: Promise<{ territory: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TerritoryDetailPreviewPage({
  params,
  searchParams,
}: TerritoryDetailPreviewPageProps) {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const { territory: territorySlug } = await params;
  const territory = resolvePreviewTerritory(territorySlug);
  if (!territory) notFound();

  const [queryParams, events] = await Promise.all([searchParams, getVisibleEvents()]);
  const now = new Date();
  const model = buildTerritoryDetailPageModel(events, territory, {
    now,
    query: parseTerritoryDetailQuery(queryParams),
  });

  return (
    <div className={redesignV2DisplayPilot.variable} data-v2-display-font-pilot="archivo">
      <V2PreviewShell
        breadcrumbs={[
          { label: "Inicio", navigationId: "home" },
          { label: "Zonas", navigationId: "territories" },
          { label: territory.displayName },
        ]}
        currentNavigationId="territories"
        description={territoryDetailHeroSummary(model)}
        eyebrow="Territorio"
        title={territory.displayName}
        upcomingCount={model.siteUpcomingCount}
      >
        <TerritoryDetailPage model={model} nowIso={now.toISOString()} />
      </V2PreviewShell>
    </div>
  );
}
