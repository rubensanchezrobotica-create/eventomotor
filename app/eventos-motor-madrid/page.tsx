import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("eventos-motor-madrid");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function EventosMotorMadridPage() {
  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
