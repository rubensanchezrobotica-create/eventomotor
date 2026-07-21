import "server-only";

import { resolveNewsletterMode } from "@/lib/newsletter/config";
import type { NewsletterMode } from "@/lib/newsletter/types";

export type NewsletterServerConfig = {
  mode: NewsletterMode;
};

export function getNewsletterServerConfig(): NewsletterServerConfig {
  return {
    mode: resolveNewsletterMode({
      mode: process.env.NEWSLETTER_MODE,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    }),
  };
}
