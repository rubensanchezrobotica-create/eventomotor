import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DisciplinePreviewPage from "@/components/disciplines/DisciplinePreviewPage";
import {
  buildDisciplinePreviewData,
  buildDisciplinePublicMetadata,
  isDisciplineSlug,
  parseDisciplineFilters,
} from "@/components/disciplines/discipline-preview-model";
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

  return (
    <DisciplinePreviewPage
      data={buildDisciplinePreviewData(events, slug, now)}
      initialFilters={parseDisciplineFilters(filterParams)}
      mode="public"
      nowIso={now.toISOString()}
      pathname={`/disciplinas/${slug}`}
    />
  );
}
