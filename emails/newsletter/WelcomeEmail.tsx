import { Button, Heading, Link, Section, Text } from "react-email";
import { NEWSLETTER_EMAIL_METADATA } from "./email-metadata";
import NewsletterEmailShell from "./NewsletterEmailShell";
import type { WelcomeEmailProps } from "./email-types";

export default function WelcomeEmail({
  logoUrl,
  provinceName,
  eventsUrl,
  unsubscribeUrl,
}: WelcomeEmailProps) {
  const metadata = NEWSLETTER_EMAIL_METADATA.welcome;

  return (
    <NewsletterEmailShell logoUrl={logoUrl} preheader={metadata.preheader}>
      <Section style={styles.content}>
        <Text style={styles.eyebrow}>SUSCRIPCIÓN CONFIRMADA</Text>
        <Heading as="h1" style={styles.heading}>Ya estás dentro</Heading>
        <Text style={styles.copy}>
          Tu Agenda Motor empieza aquí. Cada semana recibirás una selección breve de eventos del
          motor, con especial atención a <strong style={styles.highlight}>{provinceName}</strong>.
        </Text>
        <Section style={styles.summary}>
          <Text style={styles.summaryTitle}>Qué recibirás</Text>
          <Text style={styles.summaryItem}>✓ Eventos seleccionados y fechas claras</Text>
          <Text style={styles.summaryItem}>✓ Planes cerca de tu provincia</Text>
          <Text style={styles.summaryItem}>✓ Un solo correo semanal, sin ruido</Text>
        </Section>
        <Button href={eventsUrl} style={styles.button}>Ver próximos eventos</Button>
        <Text style={styles.frequency}>La primera edición llegará en el próximo envío semanal.</Text>
        <Text style={styles.links}>
          <Link href={unsubscribeUrl} style={styles.link}>Darme de baja</Link>
        </Text>
      </Section>
    </NewsletterEmailShell>
  );
}

const styles = {
  content: { padding: "36px 34px 38px" },
  eyebrow: {
    margin: "0 0 10px",
    color: "#5de3a6",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.5px",
  },
  heading: {
    margin: "0",
    color: "#ffffff",
    fontSize: "34px",
    lineHeight: "40px",
    letterSpacing: "-0.9px",
  },
  copy: {
    margin: "17px 0 0",
    color: "#cbd3df",
    fontSize: "16px",
    lineHeight: "25px",
  },
  highlight: { color: "#ffffff" },
  summary: {
    margin: "25px 0 0",
    padding: "20px",
    border: "1px solid #2a3340",
    borderRadius: "14px",
    backgroundColor: "#111823",
  },
  summaryTitle: {
    margin: "0 0 11px",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
  },
  summaryItem: {
    margin: "7px 0",
    color: "#c7d0dc",
    fontSize: "14px",
    lineHeight: "21px",
  },
  button: {
    display: "block",
    margin: "28px 0 0",
    padding: "15px 22px",
    borderRadius: "12px",
    backgroundColor: "#ff5b1f",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "20px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  frequency: {
    margin: "18px 0 0",
    color: "#9ca7b7",
    fontSize: "12px",
    lineHeight: "19px",
  },
  links: {
    margin: "24px 0 0",
    color: "#8f9aaa",
    fontSize: "12px",
    lineHeight: "22px",
  },
  link: { color: "#ff9a72", textDecoration: "underline" },
};
