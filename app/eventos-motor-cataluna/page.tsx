import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityPage from "@/components/public/seo/OpportunityPage";
import { getOpportunityPage } from "@/lib/opportunity-pages";
import { SITE_URL } from "@/lib/seo";

const page = getOpportunityPage("eventos-motor-cataluna");

export const metadata: Metadata = {
  title: page?.title,
  description: page?.description,
  alternates: {
    canonical: `${SITE_URL}/eventos-motor-cataluna`,
  },
};

export default function EventosMotorCatalunaPage() {
  if (!page) notFound();
  return <OpportunityPage page={page} />;
}
