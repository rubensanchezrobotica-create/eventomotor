import { createElement, type ReactElement } from "react";
import { render, toPlainText } from "react-email";
import ConfirmSubscriptionEmail from "./ConfirmSubscriptionEmail";
import WelcomeEmail from "./WelcomeEmail";
import WeeklyAgendaEmail from "./WeeklyAgendaEmail";
import { NEWSLETTER_EMAIL_FIXTURES } from "./email-fixtures";
import { NEWSLETTER_EMAIL_METADATA } from "./email-metadata";
import {
  NEWSLETTER_EMAIL_KINDS,
  type NewsletterEmailKind,
  type RenderedNewsletterEmail,
} from "./email-types";

function buildNewsletterEmail(kind: NewsletterEmailKind): ReactElement {
  switch (kind) {
    case "confirmation":
      return createElement(ConfirmSubscriptionEmail, NEWSLETTER_EMAIL_FIXTURES.confirmation);
    case "welcome":
      return createElement(WelcomeEmail, NEWSLETTER_EMAIL_FIXTURES.welcome);
    case "weekly":
      return createElement(WeeklyAgendaEmail, NEWSLETTER_EMAIL_FIXTURES.weekly);
  }
}

export async function renderNewsletterEmail(kind: NewsletterEmailKind): Promise<string> {
  return render(buildNewsletterEmail(kind), { pretty: false });
}

export async function renderNewsletterEmailText(kind: NewsletterEmailKind): Promise<string> {
  return toPlainText(await renderNewsletterEmail(kind));
}

export async function renderNewsletterEmailPreview(
  kind: NewsletterEmailKind,
): Promise<RenderedNewsletterEmail> {
  const html = await renderNewsletterEmail(kind);
  return {
    ...NEWSLETTER_EMAIL_METADATA[kind],
    html,
    text: toPlainText(html),
  };
}

export async function renderAllNewsletterEmailPreviews(): Promise<RenderedNewsletterEmail[]> {
  return Promise.all(NEWSLETTER_EMAIL_KINDS.map(renderNewsletterEmailPreview));
}
