import { SITE_URL } from "@/lib/seo";

export const NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE =
  "production-double-opt-in-canary";
export const NEWSLETTER_PRODUCTION_CANARY_CANONICAL_ORIGIN = SITE_URL;

export type NewsletterProductionCanaryRequestConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      canonicalEndpoint: string;
    };

export function parseNewsletterProductionCanaryOrigin(
  value: string | undefined,
): URL | null {
  if (
    !value ||
    value !== NEWSLETTER_PRODUCTION_CANARY_CANONICAL_ORIGIN ||
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
      parsed.origin !== NEWSLETTER_PRODUCTION_CANARY_CANONICAL_ORIGIN
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isNewsletterProductionCanaryPageRequestAllowed(
  configuration: NewsletterProductionCanaryRequestConfiguration,
  requestHost: string | null,
  forwardedProtocol: string | null,
): boolean {
  if (!configuration.enabled || !requestHost || forwardedProtocol !== "https") {
    return false;
  }
  const configured = new URL(configuration.canonicalEndpoint);
  return requestHost.toLowerCase() === configured.host.toLowerCase();
}

export function isNewsletterProductionCanaryMutationRequestAllowed(
  configuration: NewsletterProductionCanaryRequestConfiguration,
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
