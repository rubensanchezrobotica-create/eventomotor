import "server-only";

import { getNewsletterServerConfig } from "@/lib/newsletter/config.server";
import { createConfiguredNewsletterMailCaptureRuntime } from "@/lib/newsletter/mail-capture-config.server";
import {
  NullNewsletterMailTransport,
  type NewsletterMailTransport,
} from "@/lib/newsletter/mail-transport.server";
import { createConfiguredNewsletterResendRuntime } from "@/lib/newsletter/resend-config.server";
import type { NewsletterMode } from "@/lib/newsletter/types";

export type ConfiguredNewsletterMailRuntime = {
  serviceMode: NewsletterMode;
  transport: NewsletterMailTransport;
};

export function createConfiguredNewsletterMailRuntime(): ConfiguredNewsletterMailRuntime {
  const capture = createConfiguredNewsletterMailCaptureRuntime();
  if (capture) {
    return {
      serviceMode: capture.serviceMode,
      transport: capture.transport,
    };
  }

  const resend = createConfiguredNewsletterResendRuntime();
  if (resend) return resend;

  return {
    serviceMode: getNewsletterServerConfig().mode,
    transport: new NullNewsletterMailTransport(),
  };
}
