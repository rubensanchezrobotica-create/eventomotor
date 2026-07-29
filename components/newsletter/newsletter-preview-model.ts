import type { Metadata } from "next";
import { isValidEmail } from "@/lib/newsletter/schemas";
import { NEWSLETTER_PROVINCE_OPTIONS } from "@/lib/newsletter/audience";
import { NEWSLETTER_EMAIL_KINDS, type NewsletterEmailKind } from "@/emails/newsletter/email-types";
import {
  evaluateNewsletterR4BLocalConfiguration,
  isNewsletterR4BLocalRequestAllowed,
} from "@/lib/newsletter/r4b-guard";

export { NEWSLETTER_PROVINCE_OPTIONS } from "@/lib/newsletter/audience";

export const NEWSLETTER_PREVIEW_FORM_STATES = [
  "idle",
  "focused",
  "invalid_email",
  "missing_province",
  "submitting",
  "pending_confirmation",
  "generic_error",
] as const;

export type NewsletterPreviewFormState = (typeof NEWSLETTER_PREVIEW_FORM_STATES)[number];
export type NewsletterEmailViewport = "desktop" | "mobile";

export type NewsletterPreviewOptions = {
  emailKind: NewsletterEmailKind;
  emailViewport: NewsletterEmailViewport;
  formState: NewsletterPreviewFormState;
};

export const NEWSLETTER_PREVIEW_METADATA: Metadata = {
  title: {
    absolute: "Preview de La Agenda Motor | EventoMotor",
  },
  description: "Preview interna del producto de newsletter La Agenda Motor.",
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

export function isNewsletterPreviewAvailable(
  mode: string | undefined,
  vercelEnvironment: string | undefined,
  nodeEnvironment: string | undefined,
  r4b?: {
    armed?: string;
    localOrigin?: string;
    vercel?: string;
    requestUrl: string;
    requestOrigin: string | null;
    requestHost: string | null;
  },
): boolean {
  if (r4b) {
    return isNewsletterR4BLocalRequestAllowed(
      evaluateNewsletterR4BLocalConfiguration({
        newsletterMode: mode,
        armed: r4b.armed,
        localOrigin: r4b.localOrigin,
        nodeEnv: nodeEnvironment,
        vercel: r4b.vercel,
        vercelEnv: vercelEnvironment,
      }),
      r4b.requestUrl,
      r4b.requestOrigin,
      r4b.requestHost,
    );
  }
  if (mode !== "preview") return false;
  if (vercelEnvironment === "production") return false;
  if (!vercelEnvironment && nodeEnvironment === "production") return false;
  return vercelEnvironment === undefined || ["development", "preview"].includes(vercelEnvironment);
}

export function validateNewsletterPreviewForm(
  email: string,
  provinceSlug: string,
): "invalid_email" | "missing_province" | null {
  if (!isValidEmail(email)) return "invalid_email";
  if (provinceSlug === "") return null;
  if (!NEWSLETTER_PROVINCE_OPTIONS.some((province) => province.slug === provinceSlug)) {
    return "missing_province";
  }
  return null;
}

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseNewsletterPreviewOptions(
  searchParams: Record<string, string | string[] | undefined>,
): NewsletterPreviewOptions {
  const requestedEmail = firstSearchValue(searchParams.email);
  const requestedViewport = firstSearchValue(searchParams.emailViewport);
  const requestedFormState = firstSearchValue(searchParams.formState);

  return {
    emailKind: NEWSLETTER_EMAIL_KINDS.includes(requestedEmail as NewsletterEmailKind)
      ? (requestedEmail as NewsletterEmailKind)
      : "confirmation",
    emailViewport: requestedViewport === "mobile" ? "mobile" : "desktop",
    formState: NEWSLETTER_PREVIEW_FORM_STATES.includes(requestedFormState as NewsletterPreviewFormState)
      ? (requestedFormState as NewsletterPreviewFormState)
      : "idle",
  };
}
