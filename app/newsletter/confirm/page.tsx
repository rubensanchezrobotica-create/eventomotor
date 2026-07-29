import type { Metadata } from "next";
import NewsletterTokenAction from "@/components/newsletter/NewsletterTokenAction";

export const metadata: Metadata = {
  title: {
    absolute: "Confirmar La Agenda Motor | EventoMotor",
  },
  description: "Confirma tu suscripción a La Agenda Motor.",
};

export default function NewsletterProductionCanaryConfirmationPage() {
  return (
    <NewsletterTokenAction
      experience="production-canary"
      kind="confirm"
    />
  );
}
