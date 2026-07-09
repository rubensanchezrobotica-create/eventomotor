import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("concentraciones-moteras-este-fin-de-semana");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function ConcentracionesMoterasEsteFinDeSemanaPage() {
  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
