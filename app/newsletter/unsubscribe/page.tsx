import type { Metadata } from "next";
import NewsletterTokenAction from "@/components/newsletter/NewsletterTokenAction";

export const metadata: Metadata = {
  title: {
    absolute: "Baja de La Agenda Motor | EventoMotor",
  },
  description: "Gestiona la baja de La Agenda Motor.",
};

export default function NewsletterProductionCanaryUnsubscribePage() {
  return (
    <NewsletterTokenAction
      experience="production-canary"
      kind="unsubscribe"
    />
  );
}
