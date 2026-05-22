import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { getOpportunityPage } from "@/lib/opportunity-pages";
import { SITE_URL } from "@/lib/seo";

const page = getOpportunityPage("ferias-motor-espana-2026");

export const metadata: Metadata = {
  title: page?.title,
  description: page?.description,
  alternates: {
    canonical: `${SITE_URL}/ferias-motor-espana-2026`,
  },
};

export default function FeriasMotorEspana2026Page() {
  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
