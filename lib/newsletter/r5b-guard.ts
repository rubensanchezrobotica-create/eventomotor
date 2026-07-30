import { SITE_URL } from "@/lib/seo";

export const NEWSLETTER_PUBLIC_LAUNCH_ARMED_VALUE =
  "confirmed-public-launch";
export const NEWSLETTER_PUBLIC_LAUNCH_CANONICAL_ORIGIN = SITE_URL;

export type NewsletterPublicLaunchRequestConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      canonicalEndpoint: string;
    };

export function parseNewsletterPublicLaunchOrigin(
  value: string | undefined,
): URL | null {
  if (
    !value ||
    value !== NEWSLETTER_PUBLIC_LAUNCH_CANONICAL_ORIGIN ||
    value !== value.trim()
  ) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.origin !== NEWSLETTER_PUBLIC_LAUNCH_CANONICAL_ORIGIN
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isValidNewsletterWebhookSecret(
  value: string | undefined,
): value is string {
  return Boolean(
    value &&
      value.startsWith("whsec_") &&
      value.length >= 20 &&
      value.length <= 500 &&
      value === value.trim() &&
      !/[\s\u0000-\u001f\u007f]/.test(value),
  );
}

export function isNewsletterPublicLaunchPageRequestAllowed(
  configuration: NewsletterPublicLaunchRequestConfiguration,
  requestHost: string | null,
  forwardedProtocol: string | null,
): boolean {
  if (!configuration.enabled || !requestHost || forwardedProtocol !== "https") {
    return false;
  }
  const configured = new URL(configuration.canonicalEndpoint);
  return requestHost.toLowerCase() === configured.host.toLowerCase();
}

export function isNewsletterPublicLaunchMutationRequestAllowed(
  configuration: NewsletterPublicLaunchRequestConfiguration,
  requestUrl: string,
  requestOrigin: string | null,
  requestHost: string | null,
): boolean {
  if (!configuration.enabled || !requestOrigin || !requestHost) return false;

  try {
    const configured = new URL(configuration.canonicalEndpoint);
    const requested = new URL(requestUrl);
    const origin = new URL(requestOrigin);
    return (
      requested.origin === configured.origin &&
      origin.origin === configured.origin &&
      requestHost.toLowerCase() === configured.host.toLowerCase()
    );
  } catch {
    return false;
  }
}
