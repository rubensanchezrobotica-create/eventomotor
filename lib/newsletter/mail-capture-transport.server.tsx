import "server-only";

import { randomUUID } from "node:crypto";
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
const UNSUBSCRIBE_PATH = "/preview/newsletter/unsubscribe";
const REGION_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

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
  renderWelcome?: (
    props: WelcomeEmailProps,
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

function assertWelcomeCommand(command: NewsletterMailCommand): asserts command is Extract<
  NewsletterMailCommand,
  { kind: "welcome" }
> {
  if (
    command.kind !== "welcome" ||
    !isValidEmail(command.recipientEmail) ||
    !isValidNewsletterOpaqueToken(command.rawUnsubscribeToken) ||
    !isNewsletterProvinceSlug(command.provinceSlug) ||
    (command.regionSlug !== null && !REGION_SLUG_PATTERN.test(command.regionSlug)) ||
    !LOCALE_PATTERN.test(command.locale)
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
  private readonly renderWelcome: (
    props: WelcomeEmailProps,
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
    this.renderWelcome =
      options.renderWelcome ??
      ((props) => renderNewsletterEmailContent("welcome", props));
  }

  async send(command: NewsletterMailCommand): Promise<{ status: "accepted" }> {
    if (command.kind === "welcome") return this.captureWelcome(command);
    return this.captureConfirmation(command);
  }

  private async captureConfirmation(
    command: NewsletterMailCommand,
  ): Promise<{ status: "accepted" }> {
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

  private async captureWelcome(
    command: NewsletterMailCommand,
  ): Promise<{ status: "accepted" }> {
    assertWelcomeCommand(command);

    const province = NEWSLETTER_PROVINCE_OPTIONS.find(
      (option) => option.slug === command.provinceSlug,
    );
    if (!province) throw new NewsletterMailCaptureTransportError();

    const unsubscribeUrl = new URL(UNSUBSCRIBE_PATH, this.origin);
    unsubscribeUrl.searchParams.set("token", command.rawUnsubscribeToken);
    const eventsUrl = new URL(`/eventos-motor-${command.provinceSlug}`, this.origin);
    const rendered = await this.renderWelcome({
      logoUrl: new URL(LOGO_PATH, this.origin).toString(),
      provinceName: province.name,
      eventsUrl: eventsUrl.toString(),
      unsubscribeUrl: unsubscribeUrl.toString(),
    });

    const capture: NewsletterMailCapture = {
      schemaVersion: 1,
      id: this.idFactory(),
      mailType: "welcome",
      recipientEmail: command.recipientEmail,
      subject: NEWSLETTER_EMAIL_METADATA.welcome.subject,
      html: rendered.html,
      text: rendered.text,
      capturedAt: this.now().toISOString(),
      status: "captured",
      metadata: {
        locale: command.locale,
        province: command.provinceSlug,
        ...(command.regionSlug ? { region: command.regionSlug } : {}),
      },
    };

    await this.store.save(capture);
    return { status: "accepted" };
  }
}
