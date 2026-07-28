import "server-only";

import { randomUUID } from "node:crypto";
import { NEWSLETTER_EMAIL_METADATA } from "@/emails/newsletter/email-metadata";
import { renderNewsletterEmailContent } from "@/emails/newsletter/email-renderer";
import type { ConfirmSubscriptionEmailProps } from "@/emails/newsletter/email-types";
import { isValidEmail, isValidNewsletterOpaqueToken } from "@/lib/newsletter/schemas";
import type { NewsletterMailTransport } from "@/lib/newsletter/mail-transport.server";
import type { NewsletterMailCommand } from "@/lib/newsletter/service-types";
import type {
  NewsletterMailCapture,
  NewsletterMailCaptureStore,
} from "@/lib/newsletter/mail-capture-store.server";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const LOGO_PATH = "/brand/eventomotor-logo-horizontal-dark-header.png";
const CONFIRMATION_PATH = "/preview/newsletter/confirm";

export class NewsletterMailCaptureTransportError extends Error {
  constructor() {
    super("Newsletter mail capture transport failed.");
    this.name = "NewsletterMailCaptureTransportError";
  }
}

type CaptureNewsletterMailTransportOptions = {
  store: NewsletterMailCaptureStore;
  origin: string;
  now?: () => Date;
  idFactory?: () => string;
  renderConfirmation?: (
    props: ConfirmSubscriptionEmailProps,
  ) => Promise<{ html: string; text: string }>;
};

export function parseLocalNewsletterCaptureOrigin(value: string): URL | null {
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    return null;
  }
  if (
    origin.protocol !== "http:" ||
    !LOCAL_HOSTNAMES.has(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    return null;
  }
  return origin;
}

function assertConfirmationCommand(command: NewsletterMailCommand): asserts command is Extract<
  NewsletterMailCommand,
  { kind: "confirmation" }
> {
  if (
    command.kind !== "confirmation" ||
    !isValidEmail(command.recipientEmail) ||
    !isValidNewsletterOpaqueToken(command.rawConfirmationToken) ||
    !["subscribe", "resubscribe"].includes(command.purpose) ||
    !Number.isFinite(Date.parse(command.expiresAt))
  ) {
    throw new NewsletterMailCaptureTransportError();
  }
}

export class CaptureNewsletterMailTransport implements NewsletterMailTransport {
  readonly availability = "ready" as const;
  private readonly store: NewsletterMailCaptureStore;
  private readonly origin: URL;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly renderConfirmation: (
    props: ConfirmSubscriptionEmailProps,
  ) => Promise<{ html: string; text: string }>;

  constructor(options: CaptureNewsletterMailTransportOptions) {
    const origin = parseLocalNewsletterCaptureOrigin(options.origin);
    if (!origin) throw new NewsletterMailCaptureTransportError();
    this.store = options.store;
    this.origin = origin;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
    this.renderConfirmation =
      options.renderConfirmation ??
      ((props) => renderNewsletterEmailContent("confirmation", props));
  }

  async send(command: NewsletterMailCommand): Promise<{ status: "accepted" }> {
    assertConfirmationCommand(command);

    const capturedAt = this.now();
    const expiresAt = new Date(command.expiresAt);
    const confirmationUrl = new URL(CONFIRMATION_PATH, this.origin);
    confirmationUrl.searchParams.set("token", command.rawConfirmationToken);

    const rendered = await this.renderConfirmation({
      logoUrl: new URL(LOGO_PATH, this.origin).toString(),
      confirmationUrl: confirmationUrl.toString(),
      expiresInHours: Math.max(
        1,
        Math.ceil((expiresAt.getTime() - capturedAt.getTime()) / (60 * 60 * 1000)),
      ),
    });

    const capture: NewsletterMailCapture = {
      schemaVersion: 1,
      id: this.idFactory(),
      mailType: "confirmation",
      recipientEmail: command.recipientEmail,
      subject: NEWSLETTER_EMAIL_METADATA.confirmation.subject,
      html: rendered.html,
      text: rendered.text,
      capturedAt: capturedAt.toISOString(),
      status: "captured",
      metadata: {
        purpose: command.purpose,
        expiresAt: expiresAt.toISOString(),
      },
    };

    await this.store.save(capture);
    return { status: "accepted" };
  }
}
