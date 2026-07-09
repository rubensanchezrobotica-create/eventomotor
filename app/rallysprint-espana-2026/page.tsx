import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const page = getOpportunityPage("rallysprint-espana-2026");

export const metadata: Metadata = buildOpportunityMetadata(page);

export default function RallysprintEspana2026Page() {
  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
