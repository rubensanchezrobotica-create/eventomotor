import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import NewsletterLandingV2 from "@/components/redesign-v2/newsletter/NewsletterLandingV2";
import { isRedesignPreviewAvailable } from "@/components/redesign-v2/redesign-v2-model";

export const metadata: Metadata = {
  title: "Preview La Agenda Motor V2 | EventoMotor",
  description: "Vista previa visual de La Agenda Motor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default async function NewsletterV2PreviewPage() {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();
  return <NewsletterLandingV2 context="preview" />;
}
