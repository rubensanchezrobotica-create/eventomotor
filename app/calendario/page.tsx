import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import ConceptHomePage from "@/components/public/concept/ConceptHomePage";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

const CALENDAR_DESCRIPTION =
  "Consulta el calendario nacional de eventos de motor en España por fecha, disciplina, zona y tipo de vehículo.";
const CALENDAR_URL = `${SITE_URL}/calendario`;

export const metadata: Metadata = {
  title: "Calendario de eventos de motor | EventoMotor",
  description: CALENDAR_DESCRIPTION,
  alternates: {
    canonical: CALENDAR_URL,
  },
  openGraph: {
    title: "Calendario de eventos de motor | EventoMotor",
    description: CALENDAR_DESCRIPTION,
    url: CALENDAR_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), alt: "EventoMotor" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Calendario de eventos de motor | EventoMotor",
    description: CALENDAR_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export default function CalendarPage() {
  const hasHeroImage = existsSync(join(process.cwd(), "public/images/hero/eventomotor-hero-motorsport.png"));

  return <ConceptHomePage hasHeroImage={hasHeroImage} />;
}
