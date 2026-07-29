import { Button, Heading, Link, Section, Text } from "react-email";
import { NEWSLETTER_EMAIL_METADATA } from "./email-metadata";
import NewsletterEmailShell from "./NewsletterEmailShell";
import type { ConfirmSubscriptionEmailProps } from "./email-types";

export default function ConfirmSubscriptionEmail({
  logoUrl,
  confirmationUrl,
  expiresInHours,
  privacyUrl,
  contactEmail,
}: ConfirmSubscriptionEmailProps) {
  const metadata = NEWSLETTER_EMAIL_METADATA.confirmation;

  return (
    <NewsletterEmailShell logoUrl={logoUrl} preheader={metadata.preheader}>
      <Section style={styles.content}>
        <Text style={styles.eyebrow}>SOLO FALTA UN PASO</Text>
        <Heading as="h1" style={styles.heading}>Confirma que quieres recibir La Agenda Motor</Heading>
        <Text style={styles.copy}>
          Has recibido este correo porque se ha solicitado una suscripción a “La
          Agenda Motor” utilizando esta dirección.
        </Text>
        <Text style={styles.copy}>
          Pulsa el botón <strong>Confirmar mi suscripción</strong> para completar
          el alta. El enlace caduca en {expiresInHours} horas y solo puede
          utilizarse una vez.
        </Text>
        <Button href={confirmationUrl} style={styles.button}>Confirmar mi suscripción</Button>
        <Text style={styles.note}>
          Si no has realizado esta solicitud, ignora este mensaje. No te daremos
          de alta.
        </Text>
        <Text style={styles.legal}>
          Responsable: Rubén Ginés Sánchez García, titular del proyecto
          EventoMotor. Puedes consultar la{" "}
          <Link href={privacyUrl} style={styles.link}>Política de privacidad</Link>
          {" "}o escribir a{" "}
          <Link href={`mailto:${contactEmail}`} style={styles.link}>{contactEmail}</Link>.
        </Text>
      </Section>
    </NewsletterEmailShell>
  );
}

const styles = {
  content: { padding: "36px 34px 38px" },
  eyebrow: {
    margin: "0 0 12px",
    color: "#ff8a55",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.5px",
  },
  heading: {
    margin: "0",
    color: "#ffffff",
    fontSize: "32px",
    lineHeight: "38px",
    letterSpacing: "-0.8px",
  },
  copy: {
    margin: "18px 0 0",
    color: "#cbd3df",
    fontSize: "16px",
    lineHeight: "25px",
  },
  button: {
    display: "block",
    width: "auto",
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
  note: {
    margin: "22px 0 0",
    color: "#8f9aaa",
    fontSize: "12px",
    lineHeight: "19px",
  },
  legal: {
    margin: "18px 0 0",
    color: "#8f9aaa",
    fontSize: "11px",
    lineHeight: "18px",
  },
  link: { color: "#ff9a72", textDecoration: "underline" },
};
