import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("eventos-motor-baleares");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function EventosMotorBalearesPage() {
  if (!page) notFound();

  return <OpportunityPage page={page} />;
}
