import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PreviewHomePage from "@/components/preview/PreviewHomePage";

export const metadata: Metadata = {
  title: "Preview del buscador",
  description: "Vista local aislada del nuevo buscador de EventoMotor.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SearchPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const hasHeroImage = existsSync(join(process.cwd(), "public/images/hero/eventomotor-hero-motorsport.png"));

  return <PreviewHomePage hasHeroImage={hasHeroImage} />;
}
