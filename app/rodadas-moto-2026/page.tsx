import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("rodadas-moto-2026");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function RodadasMoto2026Page() {
  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
