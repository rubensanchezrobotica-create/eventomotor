import type { NewsletterEmailKind, NewsletterEmailMetadata } from "./email-types";

export const NEWSLETTER_EMAIL_METADATA: Record<NewsletterEmailKind, NewsletterEmailMetadata> = {
  confirmation: {
    kind: "confirmation",
    label: "Confirmación",
    subject: "Confirma tu suscripción a La Agenda Motor",
    preheader: "Solo falta un paso para recibir los mejores eventos del motor cerca de ti.",
    previewHeight: 760,
  },
  welcome: {
    kind: "welcome",
    label: "Bienvenida",
    subject: "Ya estás dentro: tu Agenda Motor empieza aquí",
    preheader: "Tu suscripción está confirmada y te avisaremos cuando la primera edición esté preparada.",
    previewHeight: 920,
  },
  weekly: {
    kind: "weekly",
    label: "Agenda semanal",
    subject: "La Agenda Motor · 5 planes para este fin de semana",
    preheader: "Clásicos, rallyes, motos y circuito: tu selección semanal de eventos del motor.",
    previewHeight: 2580,
  },
};
