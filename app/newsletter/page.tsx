import { connection } from "next/server";
import NewsletterPreviewPage from "@/components/newsletter/NewsletterPreviewPage";
import { parseNewsletterPreviewOptions } from "@/components/newsletter/newsletter-preview-model";
import { renderAllNewsletterEmailPreviews } from "@/lib/newsletter/render-email.server";

export default async function NewsletterProductionCanaryPage() {
  await connection();
  const emails = await renderAllNewsletterEmailPreviews();

  return (
    <NewsletterPreviewPage
      emails={emails}
      experience="production-canary"
      initialOptions={parseNewsletterPreviewOptions({})}
    />
  );
}
