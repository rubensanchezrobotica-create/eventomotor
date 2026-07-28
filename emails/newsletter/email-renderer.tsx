import { createElement, type ReactElement } from "react";
import { render, toPlainText } from "react-email";
import ConfirmSubscriptionEmail from "./ConfirmSubscriptionEmail";
import WelcomeEmail from "./WelcomeEmail";
import WeeklyAgendaEmail from "./WeeklyAgendaEmail";
import { NEWSLETTER_EMAIL_FIXTURES } from "./email-fixtures";
import { NEWSLETTER_EMAIL_METADATA } from "./email-metadata";
import {
  NEWSLETTER_EMAIL_KINDS,
  type NewsletterEmailPropsByKind,
  type NewsletterEmailKind,
  type RenderedNewsletterEmail,
} from "./email-types";

function buildNewsletterEmail<Kind extends NewsletterEmailKind>(
  kind: Kind,
  props: NewsletterEmailPropsByKind[Kind],
): ReactElement {
  switch (kind) {
    case "confirmation":
      return createElement(ConfirmSubscriptionEmail, props as NewsletterEmailPropsByKind["confirmation"]);
    case "welcome":
      return createElement(WelcomeEmail, props as NewsletterEmailPropsByKind["welcome"]);
    case "weekly":
      return createElement(WeeklyAgendaEmail, props as NewsletterEmailPropsByKind["weekly"]);
  }
}

export async function renderNewsletterEmailContent<Kind extends NewsletterEmailKind>(
  kind: Kind,
  props: NewsletterEmailPropsByKind[Kind],
): Promise<{ html: string; text: string }> {
  const html = await render(buildNewsletterEmail(kind, props), { pretty: false });
  return { html, text: toPlainText(html) };
}

export async function renderNewsletterEmail(kind: NewsletterEmailKind): Promise<string> {
  return (
    await renderNewsletterEmailContent(
      kind,
      NEWSLETTER_EMAIL_FIXTURES[kind] as NewsletterEmailPropsByKind[typeof kind],
    )
  ).html;
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
