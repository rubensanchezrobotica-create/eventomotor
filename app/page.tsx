import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import RedesignV2Home from "@/components/redesign-v2/RedesignV2Home";
import { resolveNewsletterSurface } from "@/components/redesign-v2/site/preview-navigation";
import {
  currentNewsletterProductionCanaryEnvironment,
  currentNewsletterPublicLaunchEnvironment,
  evaluateNewsletterProductionCanaryResendConfiguration,
  evaluateNewsletterPublicLaunchResendConfiguration,
} from "@/lib/newsletter/resend-config.server";
import { isNewsletterPublicLaunchPageRequestAllowed } from "@/lib/newsletter/r5b-guard";
import { getVisibleEvents } from "@/lib/public-events";
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

export default async function HomePage() {
  await connection();
  const [requestHeaders, initialEvents] = await Promise.all([
    headers(),
    getVisibleEvents(),
  ]);
  const publicConfiguration =
    evaluateNewsletterPublicLaunchResendConfiguration(
      currentNewsletterPublicLaunchEnvironment(),
    );
  const canaryConfiguration =
    evaluateNewsletterProductionCanaryResendConfiguration(
      currentNewsletterProductionCanaryEnvironment(),
    );
  const newsletterPublicLaunchEnabled =
    publicConfiguration.enabled &&
    !canaryConfiguration.enabled &&
    isNewsletterPublicLaunchPageRequestAllowed(
      publicConfiguration,
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto"),
    );
  const newsletterSurface = resolveNewsletterSurface({
    navigationMode: "public",
    publicLaunchAllowed: newsletterPublicLaunchEnabled,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <RedesignV2Home
        events={initialEvents}
        newsletterVisible={newsletterPublicLaunchEnabled}
        newsletterQaVisible={newsletterSurface.visible && !newsletterPublicLaunchEnabled}
        newsletterCanSubmitLive={newsletterSurface.canSubmitLive}
        nowIso={new Date().toISOString()}
        routeMode="public"
      />
    </>
  );
}
