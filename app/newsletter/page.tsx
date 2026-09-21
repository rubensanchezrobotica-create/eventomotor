import { connection } from "next/server";
import NewsletterPreviewPage from "@/components/newsletter/NewsletterPreviewPage";
import NewsletterLandingV2 from "@/components/redesign-v2/newsletter/NewsletterLandingV2";
import { parseNewsletterPreviewOptions } from "@/components/newsletter/newsletter-preview-model";
import { renderAllNewsletterEmailPreviews } from "@/lib/newsletter/render-email.server";
import {
  currentNewsletterPublicLaunchEnvironment,
  evaluateNewsletterPublicLaunchResendConfiguration,
} from "@/lib/newsletter/resend-config.server";

export default async function NewsletterProductionCanaryPage() {
  await connection();
  const publicConfiguration =
    evaluateNewsletterPublicLaunchResendConfiguration(
      currentNewsletterPublicLaunchEnvironment(),
    );

  if (publicConfiguration.enabled) return <NewsletterLandingV2 context="public" />;

  const emails = await renderAllNewsletterEmailPreviews();
  return <NewsletterPreviewPage emails={emails} experience="production-canary" initialOptions={parseNewsletterPreviewOptions({})} />;
}
