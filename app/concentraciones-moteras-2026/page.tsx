import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicMotorcycleConcentrationsLanding from "@/components/concentrations/PublicMotorcycleConcentrationsLanding";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("concentraciones-moteras-2026");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function ConcentracionesMoteras2026Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!page) notFound();
  return (
    <PublicMotorcycleConcentrationsLanding
      page={page}
      searchParams={searchParams}
    />
  );
}
