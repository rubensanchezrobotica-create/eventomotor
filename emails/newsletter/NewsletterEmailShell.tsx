import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from "react-email";

type NewsletterEmailShellProps = {
  children: ReactNode;
  logoUrl: string;
  preheader: string;
  footerNote?: string;
};

export default function NewsletterEmailShell({
  children,
  logoUrl,
  preheader,
  footerNote = "Este mensaje forma parte de La Agenda Motor de EventoMotor.",
}: NewsletterEmailShellProps) {
  return (
    <Html lang="es">
      <Head>
        <meta content="dark light" name="color-scheme" />
        <meta content="dark light" name="supported-color-schemes" />
      </Head>
      <Preview>{preheader}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img alt="EventoMotor" height="36" src={logoUrl} style={styles.logo} width="203" />
            <Text style={styles.productName}>LA AGENDA MOTOR</Text>
          </Section>
          {children}
          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>{footerNote}</Text>
            <Text style={styles.footerText}>La Agenda Motor · EventoMotor</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    margin: "0",
    padding: "28px 0",
    backgroundColor: "#07090d",
    color: "#f8fafc",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  container: {
    width: "94%",
    maxWidth: "640px",
    margin: "0 auto",
    overflow: "hidden",
    border: "1px solid #252b35",
    borderRadius: "20px",
    backgroundColor: "#0d1118",
  },
  header: {
    padding: "28px 34px 22px",
    borderBottom: "1px solid #252b35",
    backgroundColor: "#090c11",
  },
  logo: {
    display: "block",
    width: "203px",
    maxWidth: "100%",
    height: "auto",
  },
  productName: {
    margin: "17px 0 0",
    color: "#ff7b1a",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.8px",
  },
  hr: {
    margin: "0",
    borderColor: "#252b35",
  },
  footer: {
    padding: "22px 34px 28px",
  },
  footerText: {
    margin: "0 0 8px",
    color: "#8993a3",
    fontSize: "11px",
    lineHeight: "17px",
  },
} as const;
