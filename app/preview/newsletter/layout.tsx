import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import NewsletterPreviewShell from "@/components/newsletter/NewsletterPreviewShell";
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
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("host");
  const requestOrigin = requestHost ? `http://${requestHost}` : null;

  if (
    !isNewsletterPreviewAvailable(
      process.env.NEWSLETTER_MODE,
      process.env.VERCEL_ENV,
      process.env.NODE_ENV,
      {
        armed: process.env.NEWSLETTER_R4B_ARMED,
        localOrigin: process.env.NEWSLETTER_R4B_LOCAL_ORIGIN,
        vercel: process.env.VERCEL,
        requestUrl: requestOrigin ?? "invalid:",
        requestOrigin,
        requestHost,
      },
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
