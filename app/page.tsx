import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import ConceptHomePage from "@/components/public/concept/ConceptHomePage";
import { absoluteUrl, DEFAULT_OG_IMAGE, HOME_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "EventoMotor | Calendario nacional de eventos de motor",
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "EventoMotor | Calendario nacional de eventos de motor",
    description: HOME_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), alt: "EventoMotor" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EventoMotor | Calendario nacional de eventos de motor",
    description: HOME_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

export default function HomePage() {
  const hasHeroImage = existsSync(join(process.cwd(), "public/images/hero/eventomotor-hero-motorsport.png"));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <ConceptHomePage hasHeroImage={hasHeroImage} />
    </>
  );
}
