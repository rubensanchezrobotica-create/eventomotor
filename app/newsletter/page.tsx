import { connection } from "next/server";
import NewsletterPreviewPage from "@/components/newsletter/NewsletterPreviewPage";
import { parseNewsletterPreviewOptions } from "@/components/newsletter/newsletter-preview-model";
import { renderAllNewsletterEmailPreviews } from "@/lib/newsletter/render-email.server";
import {
  currentNewsletterPublicLaunchEnvironment,
  evaluateNewsletterPublicLaunchResendConfiguration,
} from "@/lib/newsletter/resend-config.server";

export default async function NewsletterProductionCanaryPage() {
  await connection();
  const emails = await renderAllNewsletterEmailPreviews();
  const publicConfiguration =
    evaluateNewsletterPublicLaunchResendConfiguration(
      currentNewsletterPublicLaunchEnvironment(),
    );

  return (
    <NewsletterPreviewPage
      emails={
        publicConfiguration.enabled
          ? emails.filter((email) => email.kind === "weekly")
          : emails
      }
      experience={publicConfiguration.enabled ? "public" : "production-canary"}
      initialOptions={parseNewsletterPreviewOptions({})}
    />
  );
}
