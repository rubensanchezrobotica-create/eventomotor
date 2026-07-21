import "server-only";

import type {
  MailTransportResult,
  NewsletterMailCommand,
} from "@/lib/newsletter/service-types";

export interface NewsletterMailTransport {
  readonly availability: "ready" | "unavailable";
  send(command: NewsletterMailCommand): Promise<MailTransportResult>;
}

export class NullNewsletterMailTransport implements NewsletterMailTransport {
  readonly availability = "unavailable" as const;

  async send(command: NewsletterMailCommand): Promise<MailTransportResult> {
    void command;
    return { status: "skipped" };
  }
}
