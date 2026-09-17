import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildDisciplinePreviewData,
  buildDisciplinePublicMetadata,
  isDisciplineSlug,
  parseDisciplineFilters,
} from "@/components/disciplines/discipline-preview-model";
import DisciplineDetailPage from "@/components/redesign-v2/discipline-detail/DisciplineDetailPage";
import {
  buildPublicDisciplineDetailPageModel,
  parseDisciplineDetailPage,
  resolveDisciplineHeroVisual,
} from "@/components/redesign-v2/discipline-detail/discipline-detail-model";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { getVisibleEvents } from "@/lib/public-events";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";

type DisciplinePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SEO_DISCIPLINES.map((discipline) => ({ slug: discipline.slug }));
}

export async function generateMetadata({ params }: DisciplinePageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildDisciplinePublicMetadata(slug);
}

export default async function DisciplinePage({ params, searchParams }: DisciplinePageProps) {
  const { slug } = await params;
  if (!isDisciplineSlug(slug)) notFound();

  const [filterParams, events] = await Promise.all([searchParams, getVisibleEvents()]);
  const now = new Date();
  const data = buildDisciplinePreviewData(events, slug, now);
  const filters = parseDisciplineFilters(filterParams);
  const model = buildPublicDisciplineDetailPageModel(events, data, filters, {
    now,
    page: parseDisciplineDetailPage(filterParams.page),
  });
  const heroVisual = resolveDisciplineHeroVisual(slug);

  return (
    <div className={redesignV2DisplayPilot.variable} data-v2-display-font-pilot="archivo">
      <V2InteriorShell
        breadcrumbs={[
          { label: "Inicio", navigationId: "home" },
          { label: "Disciplinas", navigationId: "disciplines" },
          { label: data.discipline.title },
        ]}
        currentNavigationId="disciplines"
        description={data.editorial.heroDescription}
        eyebrow="Disciplina"
        heroImageSrc={heroVisual?.src}
        navigationMode="public"
        title={data.discipline.h1}
        upcomingCount={model.siteUpcomingCount}
      >
        <DisciplineDetailPage
          model={model}
          nowIso={now.toISOString()}
          publicData={data}
          publicFilters={filters}
          routeContext="public"
        />
      </V2InteriorShell>
    </div>
  );
}
