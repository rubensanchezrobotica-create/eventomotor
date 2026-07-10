import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("eventos-motor-cantabria");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function EventosMotorCantabriaPage() {
  if (!page) notFound();

  return <OpportunityPage page={page} />;
}
