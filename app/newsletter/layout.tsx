import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import NewsletterPreviewShell from "@/components/newsletter/NewsletterPreviewShell";
import styles from "@/components/newsletter/NewsletterPreview.module.css";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import {
  currentNewsletterProductionCanaryEnvironment,
  evaluateNewsletterProductionCanaryResendConfiguration,
} from "@/lib/newsletter/resend-config.server";
import { isNewsletterProductionCanaryPageRequestAllowed } from "@/lib/newsletter/r5a-guard";

export const metadata: Metadata = {
  title: {
    absolute: "La Agenda Motor | EventoMotor",
  },
  description:
    "Recibe una selección semanal de planes y eventos del motor cerca de ti.",
  referrer: "no-referrer",
  robots: {
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

export default async function NewsletterProductionCanaryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const requestHeaders = await headers();
  const configuration =
    evaluateNewsletterProductionCanaryResendConfiguration(
      currentNewsletterProductionCanaryEnvironment(),
    );

  if (
    !isNewsletterProductionCanaryPageRequestAllowed(
      configuration,
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto"),
    )
  ) {
    notFound();
  }

  return (
    <div className={`emc-page ${styles.page}`}>
      <ConceptStyles />
      <NewsletterPreviewShell>{children}</NewsletterPreviewShell>
    </div>
  );
}
