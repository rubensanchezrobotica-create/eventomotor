import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import NewsletterPreviewPage from "@/components/newsletter/NewsletterPreviewPage";
import styles from "@/components/newsletter/NewsletterPreview.module.css";
import {
  isNewsletterPreviewAvailable,
  NEWSLETTER_PREVIEW_METADATA,
  parseNewsletterPreviewOptions,
} from "@/components/newsletter/newsletter-preview-model";
import { renderAllNewsletterEmailPreviews } from "@/lib/newsletter/render-email.server";

type NewsletterPreviewRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = NEWSLETTER_PREVIEW_METADATA;

export default async function NewsletterPreviewRoute({ searchParams }: NewsletterPreviewRouteProps) {
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

  const [emails, params] = await Promise.all([
    renderAllNewsletterEmailPreviews(),
    searchParams,
  ]);

  return (
    <div className={`emc-page ${styles.page}`}>
      <ConceptStyles />
      <header className={`emc-header-shell ${styles.headerShell}`}>
        <ConceptStaticHeader compactActions />
      </header>
      <NewsletterPreviewPage emails={emails} initialOptions={parseNewsletterPreviewOptions(params)} />
      <ConceptFooter contactTrackingLocation="newsletter_preview_footer" variant="compact" />
    </div>
  );
}
