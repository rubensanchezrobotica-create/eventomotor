import "server-only";

import type { NewsletterMailTransport } from "@/lib/newsletter/mail-transport.server";
import {
  FileNewsletterMailCaptureStore,
  type NewsletterMailCaptureStore,
} from "@/lib/newsletter/mail-capture-store.server";
import {
  CaptureNewsletterMailTransport,
  parseLocalNewsletterCaptureOrigin,
} from "@/lib/newsletter/mail-capture-transport.server";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export type NewsletterMailCaptureEnvironment = {
  newsletterMode?: string;
  mailTransport?: string;
  captureOrigin?: string;
  nodeEnv?: string;
  vercelEnv?: string;
  supabaseUrl?: string;
  serviceRoleConfigured?: boolean;
};

export type NewsletterMailCaptureConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      origin: string;
    };

export type ConfiguredNewsletterMailCaptureRuntime = {
  origin: string;
  store: NewsletterMailCaptureStore;
  transport: NewsletterMailTransport;
  serviceMode: "test";
};

function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "http:" &&
      LOCAL_HOSTNAMES.has(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

export function evaluateNewsletterMailCaptureConfiguration(
  environment: NewsletterMailCaptureEnvironment,
): NewsletterMailCaptureConfiguration {
  const origin = environment.captureOrigin
    ? parseLocalNewsletterCaptureOrigin(environment.captureOrigin)
    : null;

  if (
    environment.newsletterMode !== "preview" ||
    environment.mailTransport !== "capture" ||
    environment.nodeEnv !== "development" ||
    environment.vercelEnv !== undefined ||
    !origin ||
    !isLocalSupabaseUrl(environment.supabaseUrl) ||
    environment.serviceRoleConfigured !== true
  ) {
    return { enabled: false };
  }

  return { enabled: true, origin: origin.origin };
}

function currentCaptureEnvironment(): NewsletterMailCaptureEnvironment {
  return {
    newsletterMode: process.env.NEWSLETTER_MODE,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    captureOrigin: process.env.NEWSLETTER_MAIL_CAPTURE_ORIGIN,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function createConfiguredNewsletterMailCaptureRuntime():
  | ConfiguredNewsletterMailCaptureRuntime
  | null {
  const configuration = evaluateNewsletterMailCaptureConfiguration(
    currentCaptureEnvironment(),
  );
  if (!configuration.enabled) return null;

  const store = new FileNewsletterMailCaptureStore();
  return {
    origin: configuration.origin,
    store,
    transport: new CaptureNewsletterMailTransport({
      store,
      origin: configuration.origin,
    }),
    serviceMode: "test",
  };
}

export function isNewsletterMailboxRequestAllowed(
  runtime: ConfiguredNewsletterMailCaptureRuntime,
  requestHost: string | null,
): boolean {
  if (!requestHost) return false;
  try {
    const requested = new URL(`http://${requestHost}`);
    const configured = new URL(runtime.origin);
    return (
      LOCAL_HOSTNAMES.has(requested.hostname) &&
      requested.host.toLowerCase() === configured.host.toLowerCase()
    );
  } catch {
    return false;
  }
}
