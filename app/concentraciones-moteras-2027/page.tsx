import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicMotorcycleConcentrationsLanding from "@/components/concentrations/PublicMotorcycleConcentrationsLanding";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("concentraciones-moteras-2027");

// P2 stays out of public search until SEO Operations approves the annual launch.
export const metadata: Metadata = {
  ...buildOpportunityMetadata(page),
  robots: { index: false, follow: false },
};

export default function ConcentracionesMoteras2027Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!page) notFound();
  return (
    <PublicMotorcycleConcentrationsLanding
      page={page}
      searchParams={searchParams}
      year={2027}
    />
  );
}
