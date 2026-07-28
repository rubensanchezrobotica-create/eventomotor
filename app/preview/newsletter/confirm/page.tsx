import type { Metadata } from "next";
import NewsletterTokenAction from "@/components/newsletter/NewsletterTokenAction";

export const metadata: Metadata = {
  title: {
    absolute: "Confirmar La Agenda Motor | EventoMotor",
  },
  description: "Confirmación interna de la suscripción a La Agenda Motor.",
};

export default function NewsletterConfirmationPage() {
  return <NewsletterTokenAction kind="confirm" />;
}
