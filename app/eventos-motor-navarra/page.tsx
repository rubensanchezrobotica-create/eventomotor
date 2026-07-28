import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicRegionalLanding from "@/components/regions/PublicRegionalLanding";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("eventos-motor-navarra");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function EventosMotorNavarraPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!page) notFound();
  return <PublicRegionalLanding page={page} region="navarra" searchParams={searchParams} />;
}
