import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicMotorcycleConcentrationsLanding from "@/components/concentrations/PublicMotorcycleConcentrationsLanding";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("concentraciones-moteras-2027");

export const metadata: Metadata = {
  ...buildOpportunityMetadata(page),
  robots: { index: true, follow: true },
};

export default function ConcentracionesMoteras2027Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!page) notFound();
  return (
    <PublicMotorcycleConcentrationsLanding
      eventFilter={page.filter}
      page={page}
      searchParams={searchParams}
      year={2027}
    />
  );
}
