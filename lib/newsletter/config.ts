import { isNewsletterMode } from "@/lib/newsletter/schemas";
import type { NewsletterMode } from "@/lib/newsletter/types";

export type NewsletterRuntimeEnvironment = {
  mode?: string;
  nodeEnv?: string;
  vercelEnv?: string;
};

export function resolveNewsletterMode(environment: NewsletterRuntimeEnvironment): NewsletterMode {
  const requestedMode = environment.mode;
  if (!requestedMode || !isNewsletterMode(requestedMode)) return "off";

  const isProduction =
    environment.vercelEnv === "production" ||
    (!environment.vercelEnv && environment.nodeEnv === "production");

  if (isProduction) return requestedMode === "live" ? "live" : "off";
  if (requestedMode === "live") return "off";
  return requestedMode;
}
