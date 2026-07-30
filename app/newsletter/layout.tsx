import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import NewsletterPreviewShell from "@/components/newsletter/NewsletterPreviewShell";
import styles from "@/components/newsletter/NewsletterPreview.module.css";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import {
  currentNewsletterProductionCanaryEnvironment,
  currentNewsletterPublicLaunchEnvironment,
  evaluateNewsletterProductionCanaryResendConfiguration,
  evaluateNewsletterPublicLaunchResendConfiguration,
} from "@/lib/newsletter/resend-config.server";
import { isNewsletterProductionCanaryPageRequestAllowed } from "@/lib/newsletter/r5a-guard";
import { isNewsletterPublicLaunchPageRequestAllowed } from "@/lib/newsletter/r5b-guard";
import { SITE_URL } from "@/lib/seo";

const NEWSLETTER_TITLE = "La Agenda Motor | EventoMotor";
const NEWSLETTER_DESCRIPTION =
  "Recibe cada semana una selección de eventos, rutas y planes de motor cerca de ti.";

export function generateMetadata(): Metadata {
  const publicConfiguration =
    evaluateNewsletterPublicLaunchResendConfiguration(
      currentNewsletterPublicLaunchEnvironment(),
    );
  const canaryConfiguration =
    evaluateNewsletterProductionCanaryResendConfiguration(
      currentNewsletterProductionCanaryEnvironment(),
    );
  const publicLaunchEnabled =
    publicConfiguration.enabled && !canaryConfiguration.enabled;

  return {
    title: {
      absolute: NEWSLETTER_TITLE,
    },
    description: NEWSLETTER_DESCRIPTION,
    alternates: publicLaunchEnabled
      ? { canonical: `${SITE_URL}/newsletter` }
      : undefined,
    referrer: "no-referrer",
    robots: publicLaunchEnabled
      ? {
          index: true,
          follow: true,
        }
      : {
          index: false,
          follow: false,
          noarchive: true,
          googleBot: {
            index: false,
            follow: false,
            noarchive: true,
          },
        },
  };
}

export default async function NewsletterProductionCanaryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const requestHeaders = await headers();
  const configuration =
    evaluateNewsletterProductionCanaryResendConfiguration(
      currentNewsletterProductionCanaryEnvironment(),
    );
  const publicConfiguration =
    evaluateNewsletterPublicLaunchResendConfiguration(
      currentNewsletterPublicLaunchEnvironment(),
    );

  const canaryAllowed =
    configuration.enabled &&
    !publicConfiguration.enabled &&
    isNewsletterProductionCanaryPageRequestAllowed(
      configuration,
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto"),
    );
  const publicLaunchAllowed =
    publicConfiguration.enabled &&
    !configuration.enabled &&
    isNewsletterPublicLaunchPageRequestAllowed(
      publicConfiguration,
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto"),
    );

  if (!canaryAllowed && !publicLaunchAllowed) {
    notFound();
  }

  return (
    <div className={`emc-page ${styles.page}`}>
      <ConceptStyles />
      <NewsletterPreviewShell>{children}</NewsletterPreviewShell>
    </div>
  );
}
