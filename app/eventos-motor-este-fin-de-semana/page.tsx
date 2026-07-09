import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("eventos-motor-este-fin-de-semana");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function EventosMotorEsteFinDeSemanaPage() {
  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
