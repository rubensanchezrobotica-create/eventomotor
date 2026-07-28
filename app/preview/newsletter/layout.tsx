import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import styles from "@/components/newsletter/NewsletterPreview.module.css";
import {
  isNewsletterPreviewAvailable,
  NEWSLETTER_PREVIEW_METADATA,
} from "@/components/newsletter/newsletter-preview-model";

export const metadata: Metadata = NEWSLETTER_PREVIEW_METADATA;

export default async function NewsletterPreviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();

  if (
    !isNewsletterPreviewAvailable(
      process.env.NEWSLETTER_MODE,
      process.env.VERCEL_ENV,
      process.env.NODE_ENV,
    )
  ) {
    notFound();
  }

  return (
    <div className={`emc-page ${styles.page}`}>
      <ConceptStyles />
      <header className={`emc-header-shell ${styles.headerShell}`}>
        <ConceptStaticHeader compactActions />
      </header>
      {children}
      <ConceptFooter contactTrackingLocation="newsletter_preview_footer" variant="compact" />
    </div>
  );
}
