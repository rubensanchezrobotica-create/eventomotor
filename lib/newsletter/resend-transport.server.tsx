import "server-only";

import { NEWSLETTER_EMAIL_METADATA } from "@/emails/newsletter/email-metadata";
import { renderNewsletterEmailContent } from "@/emails/newsletter/email-renderer";
import type {
  ConfirmSubscriptionEmailProps,
  WelcomeEmailProps,
} from "@/emails/newsletter/email-types";
import {
  NEWSLETTER_PROVINCE_OPTIONS,
  isNewsletterProvinceSlug,
} from "@/lib/newsletter/audience";
import type { NewsletterMailTransport } from "@/lib/newsletter/mail-transport.server";
import type {
  NewsletterResendClient,
  NewsletterResendClientResult,
} from "@/lib/newsletter/resend-client.server";
import { isValidEmail, isValidNewsletterOpaqueToken, normalizeEmail } from "@/lib/newsletter/schemas";
import type { NewsletterMailCommand } from "@/lib/newsletter/service-types";

const LOGO_PATH = "/brand/eventomotor-logo-horizontal-dark-header.png";
const NEWSLETTER_LINK_ORIGIN = "https://eventomotor.com";
const CONFIRMATION_PATH = "/preview/newsletter/confirm";
const UNSUBSCRIBE_PATH = "/preview/newsletter/unsubscribe";
const REGION_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
const DISPLAY_NAME_PATTERN = /^[^<>\r\n]{1,80}$/;

export type NewsletterResendTransportErrorCategory =
  | "resend_configuration_invalid"
  | "resend_recipient_not_allowed"
  | "resend_provider_error"
  | "resend_timeout"
  | "resend_response_invalid";

export class NewsletterResendTransportError extends Error {
  readonly category: NewsletterResendTransportErrorCategory;

  constructor(category: NewsletterResendTransportErrorCategory) {
    super("Newsletter Resend transport failed.");
    this.name = "NewsletterResendTransportError";
    this.category = category;
  }
}

type ResendNewsletterMailTransportOptions = {
  client: NewsletterResendClient;
  from: string;
  replyTo: string;
  allowedRecipients: readonly string[];
  linkOrigin?: string;
  now?: () => Date;
  renderConfirmation?: (
    props: ConfirmSubscriptionEmailProps,
  ) => Promise<{ html: string; text: string }>;
  renderWelcome?: (
    props: WelcomeEmailProps,
  ) => Promise<{ html: string; text: string }>;
};

function mapClientFailure(result: Exclude<NewsletterResendClientResult, { status: "accepted" }>): never {
  if (result.status === "timeout") {
    throw new NewsletterResendTransportError("resend_timeout");
  }
  if (result.status === "invalid_response") {
    throw new NewsletterResendTransportError("resend_response_invalid");
  }
  throw new NewsletterResendTransportError("resend_provider_error");
}

function parseTransportOrigin(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isValidTransportSender(value: string): boolean {
  if (value.length > 320 || value !== value.trim()) return false;
  if (isValidEmail(value)) return true;
  const match = value.match(/^(.+?)\s*<([^<>]+)>$/);
  return Boolean(
    match &&
      DISPLAY_NAME_PATTERN.test(match[1]?.trim() ?? "") &&
      isValidEmail(match[2] ?? ""),
  );
}

export class ResendNewsletterMailTransport implements NewsletterMailTransport {
  readonly availability = "ready" as const;
  private readonly client: NewsletterResendClient;
  private readonly from: string;
  private readonly replyTo: string;
  private readonly allowedRecipients: ReadonlySet<string>;
  private readonly origin: URL;
  private readonly now: () => Date;
  private readonly renderConfirmation: (
    props: ConfirmSubscriptionEmailProps,
  ) => Promise<{ html: string; text: string }>;
  private readonly renderWelcome: (
    props: WelcomeEmailProps,
  ) => Promise<{ html: string; text: string }>;

  constructor(options: ResendNewsletterMailTransportOptions) {
    const origin = parseTransportOrigin(options.linkOrigin ?? NEWSLETTER_LINK_ORIGIN);
    const allowedRecipients = options.allowedRecipients.map(normalizeEmail);
    if (
      !origin ||
      !isValidTransportSender(options.from) ||
      options.replyTo !== options.replyTo.trim() ||
      !isValidEmail(options.replyTo) ||
      allowedRecipients.length < 1 ||
      options.allowedRecipients.some(
        (recipient, index) =>
          recipient !== allowedRecipients[index] ||
          recipient.includes("*") ||
          /[<>;,]/.test(recipient) ||
          !isValidEmail(recipient),
      ) ||
      new Set(allowedRecipients).size !== allowedRecipients.length
    ) {
      throw new NewsletterResendTransportError("resend_configuration_invalid");
    }
    this.client = options.client;
    this.from = options.from;
    this.replyTo = normalizeEmail(options.replyTo);
    this.allowedRecipients = new Set(allowedRecipients);
    this.origin = origin;
    this.now = options.now ?? (() => new Date());
    this.renderConfirmation =
      options.renderConfirmation ??
      ((props) => renderNewsletterEmailContent("confirmation", props));
    this.renderWelcome =
      options.renderWelcome ??
      ((props) => renderNewsletterEmailContent("welcome", props));
  }

  async send(command: NewsletterMailCommand): Promise<{ status: "accepted" }> {
    const recipient = normalizeEmail(command.recipientEmail);
    if (
      !isValidEmail(command.recipientEmail) ||
      command.recipientEmail.includes(",") ||
      command.recipientEmail.includes(";") ||
      !this.allowedRecipients.has(recipient)
    ) {
      throw new NewsletterResendTransportError("resend_recipient_not_allowed");
    }

    const content =
      command.kind === "confirmation"
        ? await this.renderConfirmationContent(command)
        : await this.renderWelcomeContent(command);
    let result: NewsletterResendClientResult;
    try {
      result = await this.client.sendEmail({
        from: this.from,
        to: [recipient],
        replyTo: this.replyTo,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch {
      throw new NewsletterResendTransportError("resend_provider_error");
    }
    if (result.status !== "accepted") mapClientFailure(result);
    return { status: "accepted" };
  }

  private async renderConfirmationContent(
    command: Extract<NewsletterMailCommand, { kind: "confirmation" }>,
  ) {
    if (
      !isValidNewsletterOpaqueToken(command.rawConfirmationToken) ||
      !["subscribe", "resubscribe"].includes(command.purpose) ||
      !Number.isFinite(Date.parse(command.expiresAt))
    ) {
      throw new NewsletterResendTransportError("resend_configuration_invalid");
    }
    const confirmationUrl = new URL(CONFIRMATION_PATH, this.origin);
    confirmationUrl.searchParams.set("token", command.rawConfirmationToken);
    const expiresAt = new Date(command.expiresAt);
    const rendered = await this.renderConfirmation({
      logoUrl: new URL(LOGO_PATH, this.origin).toString(),
      confirmationUrl: confirmationUrl.toString(),
      expiresInHours: Math.max(
        1,
        Math.ceil((expiresAt.getTime() - this.now().getTime()) / (60 * 60 * 1_000)),
      ),
    });
    return {
      subject: NEWSLETTER_EMAIL_METADATA.confirmation.subject,
      ...rendered,
    };
  }

  private async renderWelcomeContent(
    command: Extract<NewsletterMailCommand, { kind: "welcome" }>,
  ) {
    if (
      !isValidNewsletterOpaqueToken(command.rawUnsubscribeToken) ||
      !isNewsletterProvinceSlug(command.provinceSlug) ||
      (command.regionSlug !== null && !REGION_SLUG_PATTERN.test(command.regionSlug)) ||
      !LOCALE_PATTERN.test(command.locale)
    ) {
      throw new NewsletterResendTransportError("resend_configuration_invalid");
    }
    const province = NEWSLETTER_PROVINCE_OPTIONS.find(
      (option) => option.slug === command.provinceSlug,
    );
    if (!province) {
      throw new NewsletterResendTransportError("resend_configuration_invalid");
    }
    const unsubscribeUrl = new URL(UNSUBSCRIBE_PATH, this.origin);
    unsubscribeUrl.searchParams.set("token", command.rawUnsubscribeToken);
    const rendered = await this.renderWelcome({
      logoUrl: new URL(LOGO_PATH, this.origin).toString(),
      provinceName: province.name,
      eventsUrl: new URL(`/eventos-motor-${command.provinceSlug}`, this.origin).toString(),
      unsubscribeUrl: unsubscribeUrl.toString(),
    });
    return {
      subject: NEWSLETTER_EMAIL_METADATA.welcome.subject,
      ...rendered,
    };
  }
}
