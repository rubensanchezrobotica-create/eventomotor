import { connection } from "next/server";
import NewsletterPreviewPage from "@/components/newsletter/NewsletterPreviewPage";
import { parseNewsletterPreviewOptions } from "@/components/newsletter/newsletter-preview-model";
import { renderAllNewsletterEmailPreviews } from "@/lib/newsletter/render-email.server";

type NewsletterPreviewRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewsletterPreviewRoute({ searchParams }: NewsletterPreviewRouteProps) {
  await connection();

  const [emails, params] = await Promise.all([
    renderAllNewsletterEmailPreviews(),
    searchParams,
  ]);

  return <NewsletterPreviewPage emails={emails} initialOptions={parseNewsletterPreviewOptions(params)} />;
}
