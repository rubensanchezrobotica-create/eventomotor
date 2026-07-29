export const NEWSLETTER_R4B_ARMED_VALUE = "local-one-recipient";
export const NEWSLETTER_R4B_CONTROLLED_STATUS =
  "Entorno de prueba controlado · envío real limitado a un destinatario autorizado.";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export type NewsletterR4BLocalEnvironment = {
  newsletterMode?: string;
  armed?: string;
  localOrigin?: string;
  nodeEnv?: string;
  vercel?: string;
  vercelEnv?: string;
};

export type NewsletterR4BLocalConfiguration =
  | { enabled: false }
  | { enabled: true; origin: string };

export function parseNewsletterR4BLocalOrigin(value: string | undefined): URL | null {
  if (!value || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "http:" ||
      !LOOPBACK_HOSTNAMES.has(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      value !== parsed.origin
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function evaluateNewsletterR4BLocalConfiguration(
  environment: NewsletterR4BLocalEnvironment,
): NewsletterR4BLocalConfiguration {
  const localOrigin = parseNewsletterR4BLocalOrigin(environment.localOrigin);
  if (
    environment.newsletterMode !== "test" ||
    environment.armed !== NEWSLETTER_R4B_ARMED_VALUE ||
    environment.nodeEnv !== "development" ||
    environment.vercel !== undefined ||
    environment.vercelEnv !== undefined ||
    !localOrigin
  ) {
    return { enabled: false };
  }
  return { enabled: true, origin: localOrigin.origin };
}

export function isNewsletterR4BLocalRequestAllowed(
  configuration: NewsletterR4BLocalConfiguration,
  requestUrl: string,
  requestOrigin: string | null,
  requestHost: string | null,
): boolean {
  if (!configuration.enabled || !requestOrigin || !requestHost) return false;
  try {
    const configured = new URL(configuration.origin);
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
