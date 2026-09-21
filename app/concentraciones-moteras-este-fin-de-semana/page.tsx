import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("concentraciones-moteras-este-fin-de-semana");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default async function ConcentracionesMoterasEsteFinDeSemanaPage() {
  await connection();

  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
