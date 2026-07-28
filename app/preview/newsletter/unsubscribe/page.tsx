import type { Metadata } from "next";
import NewsletterTokenAction from "@/components/newsletter/NewsletterTokenAction";

export const metadata: Metadata = {
  title: {
    absolute: "Baja de La Agenda Motor | EventoMotor",
  },
  description: "Baja interna de la suscripción a La Agenda Motor.",
};

export default function NewsletterUnsubscribePage() {
  return <NewsletterTokenAction kind="unsubscribe" />;
}
