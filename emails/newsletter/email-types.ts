export const NEWSLETTER_EMAIL_KINDS = ["confirmation", "welcome", "weekly"] as const;

export type NewsletterEmailKind = (typeof NEWSLETTER_EMAIL_KINDS)[number];

export type NewsletterEmailMetadata = {
  kind: NewsletterEmailKind;
  label: string;
  subject: string;
  preheader: string;
  previewHeight: number;
};

export type NewsletterEmailEventFixture = {
  title: string;
  category: string;
  dateLabel: string;
  locationLabel: string;
  summary: string;
  href: string;
};

export type ConfirmSubscriptionEmailProps = {
  logoUrl: string;
  confirmationUrl: string;
  expiresInHours: number;
};

export type WelcomeEmailProps = {
  logoUrl: string;
  provinceName: string;
  eventsUrl: string;
  unsubscribeUrl: string;
};

export type WeeklyAgendaEmailProps = {
  logoUrl: string;
  editionDate: string;
  provinceName: string;
  introduction: string;
  featuredEvents: NewsletterEmailEventFixture[];
  nearbyEvents: NewsletterEmailEventFixture[];
  travelEvent: NewsletterEmailEventFixture;
  recentlyAdded: NewsletterEmailEventFixture[];
  agendaUrl: string;
  unsubscribeUrl: string;
};

export type NewsletterEmailPropsByKind = {
  confirmation: ConfirmSubscriptionEmailProps;
  welcome: WelcomeEmailProps;
  weekly: WeeklyAgendaEmailProps;
};

export type RenderedNewsletterEmail = NewsletterEmailMetadata & {
  html: string;
  text: string;
};
