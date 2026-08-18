import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import DisciplineDetailPage from "@/components/redesign-v2/discipline-detail/DisciplineDetailPage";
import {
  buildDisciplineDetailPageModel,
  parseDisciplineDetailPage,
  resolveDisciplineDetailDefinition,
  resolveDisciplineHeroVisual,
} from "@/components/redesign-v2/discipline-detail/discipline-detail-model";
import { isRedesignPreviewAvailable } from "@/components/redesign-v2/redesign-v2-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import { getVehicleType } from "@/lib/event-classification";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Disciplina V2 Preview | EventoMotor",
  description: "Vista previa interna de una disciplina en EventoMotor V2.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

type DisciplineDetailPreviewPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function DisciplineDetailPreviewPage({
  params,
  searchParams,
}: DisciplineDetailPreviewPageProps) {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const { slug } = await params;
  const definition = resolveDisciplineDetailDefinition(slug);
  if (!definition) notFound();
  const heroVisual = resolveDisciplineHeroVisual(definition.slug);

  const [query, visibleEvents] = await Promise.all([searchParams, getVisibleEvents()]);
  const now = new Date();
  const events = visibleEvents.map((event) => ({
    ...event,
    vehicleType: getVehicleType(event),
  }));
  const model = buildDisciplineDetailPageModel(events, definition.slug, {
    now,
    page: parseDisciplineDetailPage(query.page),
  });

  return (
    <V2PreviewShell
      breadcrumbs={[
        { label: "Inicio", navigationId: "home" },
        { label: "Disciplinas", navigationId: "disciplines" },
        { label: definition.title },
      ]}
      currentNavigationId="disciplines"
      description={definition.description}
      eyebrow="Disciplina"
      heroImageSrc={heroVisual?.src}
      title={definition.title}
      upcomingCount={model.siteUpcomingCount}
    >
      <DisciplineDetailPage model={model} nowIso={now.toISOString()} />
    </V2PreviewShell>
  );
}
