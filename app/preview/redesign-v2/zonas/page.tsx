import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isRedesignPreviewAvailable } from "@/components/redesign-v2/redesign-v2-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import ZonesDirectoryPage from "@/components/redesign-v2/zones/ZonesDirectoryPage";
import { buildTerritoryDirectoryModel } from "@/components/redesign-v2/zones/territory-directory-model";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Zonas V2 Preview | EventoMotor",
  description: "Vista previa interna del directorio territorial V2 de EventoMotor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default async function ZonesPreviewPage() {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const model = buildTerritoryDirectoryModel(await getVisibleEvents(), new Date());

  return (
    <V2PreviewShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Zonas" }]}
      currentNavigationId="territories"
      description="Explora los próximos eventos de motor por comunidad autónoma."
      eyebrow="Por territorio"
      title="Zonas"
      upcomingCount={model.totalUpcomingEventCount}
    >
      <ZonesDirectoryPage model={model} />
    </V2PreviewShell>
  );
}
