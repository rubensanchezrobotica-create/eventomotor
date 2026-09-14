import type { Metadata } from "next";
import { connection } from "next/server";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import ZonesDirectoryPage from "@/components/redesign-v2/zones/ZonesDirectoryPage";
import { buildTerritoryDirectoryModel } from "@/components/redesign-v2/zones/territory-directory-model";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Zonas",
  description:
    "Explora eventos de motor por zonas de España: norte, centro, Cataluña y Aragón, Levante, sur y Canarias.",
  alternates: {
    canonical: `${SITE_URL}/zonas`,
  },
};

export default async function ZonasPage() {
  await connection();
  const model = buildTerritoryDirectoryModel(await getVisibleEvents(), new Date(), {
    routeMode: "public",
  });

  return (
    <V2InteriorShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Zonas" }]}
      currentNavigationId="territories"
      description="Explora los próximos eventos de motor por comunidad autónoma."
      eyebrow="Por territorio"
      navigationMode="public"
      title="Zonas"
      upcomingCount={model.totalUpcomingEventCount}
    >
      <ZonesDirectoryPage model={model} />
    </V2InteriorShell>
  );
}
