import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import DisciplinePreviewPage from "@/components/disciplines/DisciplinePreviewPage";
import {
  buildDisciplinePreviewData,
  buildDisciplinePreviewMetadata,
  isDisciplinePreviewAvailable,
  isDisciplineSlug,
  parseDisciplineFilters,
} from "@/components/disciplines/discipline-preview-model";
import { getVisibleEvents } from "@/lib/public-events";

type DisciplinePreviewRouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: DisciplinePreviewRouteProps): Promise<Metadata> {
  const { slug } = await params;
  return buildDisciplinePreviewMetadata(slug);
}

export default async function DisciplinePreviewRoute({
  params,
  searchParams,
}: DisciplinePreviewRouteProps) {
  await connection();

  if (!isDisciplinePreviewAvailable(process.env.VERCEL_ENV)) notFound();

  const { slug } = await params;
  if (!isDisciplineSlug(slug)) notFound();

  const [filterParams, events] = await Promise.all([searchParams, getVisibleEvents()]);
  const now = new Date();

  return (
    <DisciplinePreviewPage
      data={buildDisciplinePreviewData(events, slug, now)}
      initialFilters={parseDisciplineFilters(filterParams)}
      mode="preview"
      nowIso={now.toISOString()}
      pathname={`/preview/disciplinas/${slug}`}
    />
  );
}
