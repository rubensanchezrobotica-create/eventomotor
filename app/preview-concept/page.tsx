import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConceptHomePage from "@/components/public/concept/ConceptHomePage";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreviewConceptPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return <ConceptHomePage />;
}
