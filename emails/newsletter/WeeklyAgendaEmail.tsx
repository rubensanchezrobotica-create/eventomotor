import { Button, Heading, Hr, Link, Section, Text } from "react-email";
import { NEWSLETTER_EMAIL_METADATA } from "./email-metadata";
import NewsletterEmailShell from "./NewsletterEmailShell";
import type { NewsletterEmailEventFixture, WeeklyAgendaEmailProps } from "./email-types";

function EventCard({ event, compact = false }: { event: NewsletterEmailEventFixture; compact?: boolean }) {
  return (
    <Section style={compact ? styles.compactCard : styles.eventCard}>
      <Text style={styles.category}>{event.category}</Text>
      <Heading as="h3" style={compact ? styles.compactTitle : styles.eventTitle}>{event.title}</Heading>
      <Text style={styles.meta}>{event.dateLabel} · {event.locationLabel}</Text>
      <Text style={styles.eventSummary}>{event.summary}</Text>
      <Link href={event.href} style={styles.eventLink}>Ver evento →</Link>
    </Section>
  );
}

export default function WeeklyAgendaEmail({
  logoUrl,
  editionDate,
  provinceName,
  introduction,
  featuredEvents,
  nearbyEvents,
  travelEvent,
  recentlyAdded,
  agendaUrl,
  unsubscribeUrl,
}: WeeklyAgendaEmailProps) {
  const metadata = NEWSLETTER_EMAIL_METADATA.weekly;

  return (
    <NewsletterEmailShell logoUrl={logoUrl} preheader={metadata.preheader}>
      <Text style={styles.fixtureNotice}>
        Todos los eventos de esta edición son ficticios y se muestran únicamente para evaluar el formato.
      </Text>
      <Section style={styles.hero}>
        <Text style={styles.edition}>{editionDate}</Text>
        <Heading as="h1" style={styles.heading}>Tu fin de semana empieza aquí</Heading>
        <Text style={styles.introduction}>{introduction}</Text>
      </Section>

      <Section style={styles.section}>
        <Text style={styles.sectionEyebrow}>LA SELECCIÓN DE LA SEMANA</Text>
        <Heading as="h2" style={styles.sectionTitle}>Tres planes para elegir bien</Heading>
        {featuredEvents.map((event) => <EventCard event={event} key={event.title} />)}
      </Section>

      <Section style={styles.sectionTint}>
        <Text style={styles.sectionEyebrow}>CERCA DE TI</Text>
        <Heading as="h2" style={styles.sectionTitle}>En {provinceName}</Heading>
        {nearbyEvents.map((event) => <EventCard compact event={event} key={event.title} />)}
      </Section>

      <Section style={styles.section}>
        <Text style={styles.travelBadge}>MERECE EL VIAJE</Text>
        <EventCard event={travelEvent} />
      </Section>

      <Section style={styles.sectionTint}>
        <Text style={styles.sectionEyebrow}>RECIÉN AÑADIDOS</Text>
        <Heading as="h2" style={styles.sectionTitle}>Dos fechas para guardar</Heading>
        {recentlyAdded.map((event) => <EventCard compact event={event} key={event.title} />)}
      </Section>

      <Section style={styles.finalCta}>
        <Heading as="h2" style={styles.finalTitle}>Hay más planes esperando</Heading>
        <Text style={styles.finalCopy}>Consulta la agenda completa y filtra por fecha, zona o disciplina.</Text>
        <Button href={agendaUrl} style={styles.button}>Explorar toda la agenda</Button>
      </Section>

      <Hr style={styles.feedbackHr} />
      <Section style={styles.feedback}>
        <Text style={styles.feedbackTitle}>¿Te ha resultado útil esta edición?</Text>
        <Text style={styles.feedbackLinks}>Sí, mucho · Podría mejorar</Text>
        <Link href={unsubscribeUrl} style={styles.unsubscribe}>Darme de baja</Link>
      </Section>
    </NewsletterEmailShell>
  );
}

const styles = {
  fixtureNotice: {
    display: "none",
    maxHeight: "0",
    overflow: "hidden",
    color: "transparent",
    fontSize: "0",
    lineHeight: "0",
  },
  hero: { padding: "34px 34px 28px" },
  edition: {
    margin: "0 0 12px",
    color: "#ff9468",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    textTransform: "uppercase" as const,
  },
  heading: {
    margin: "0",
    color: "#ffffff",
    fontSize: "34px",
    lineHeight: "40px",
    letterSpacing: "-0.9px",
  },
  introduction: {
    margin: "17px 0 0",
    color: "#c7d0dc",
    fontSize: "15px",
    lineHeight: "24px",
  },
  section: { padding: "26px 34px" },
  sectionTint: {
    padding: "28px 34px",
    borderTop: "1px solid #252b35",
    borderBottom: "1px solid #252b35",
    backgroundColor: "#0a0f16",
  },
  sectionEyebrow: {
    margin: "0 0 8px",
    color: "#ff7b1a",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1.4px",
  },
  sectionTitle: {
    margin: "0 0 17px",
    color: "#ffffff",
    fontSize: "23px",
    lineHeight: "28px",
    letterSpacing: "-0.4px",
  },
  eventCard: {
    margin: "0 0 14px",
    padding: "20px",
    border: "1px solid #2a3340",
    borderRadius: "14px",
    backgroundColor: "#111823",
  },
  compactCard: {
    margin: "0 0 10px",
    padding: "17px",
    border: "1px solid #252e3a",
    borderRadius: "12px",
    backgroundColor: "#0e141d",
  },
  category: {
    margin: "0 0 7px",
    color: "#ff9b74",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.7px",
    textTransform: "uppercase" as const,
  },
  eventTitle: {
    margin: "0",
    color: "#ffffff",
    fontSize: "21px",
    lineHeight: "26px",
  },
  compactTitle: {
    margin: "0",
    color: "#ffffff",
    fontSize: "18px",
    lineHeight: "23px",
  },
  meta: {
    margin: "8px 0 0",
    color: "#aeb9c8",
    fontSize: "12px",
    lineHeight: "18px",
  },
  eventSummary: {
    margin: "10px 0 0",
    color: "#c7d0dc",
    fontSize: "13px",
    lineHeight: "20px",
  },
  eventLink: {
    display: "inline-block",
    marginTop: "13px",
    color: "#ff9b74",
    fontSize: "13px",
    fontWeight: "700",
    textDecoration: "none",
  },
  travelBadge: {
    display: "inline-block",
    margin: "0 0 12px",
    padding: "7px 10px",
    borderRadius: "999px",
    backgroundColor: "#452011",
    color: "#ffb18f",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
  },
  finalCta: {
    padding: "34px",
    textAlign: "center" as const,
  },
  finalTitle: {
    margin: "0",
    color: "#ffffff",
    fontSize: "25px",
    lineHeight: "30px",
  },
  finalCopy: {
    margin: "12px 0 0",
    color: "#aeb9c8",
    fontSize: "14px",
    lineHeight: "21px",
  },
  button: {
    display: "block",
    margin: "22px 0 0",
    padding: "15px 22px",
    borderRadius: "12px",
    backgroundColor: "#ff5b1f",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "20px",
    textDecoration: "none",
  },
  feedbackHr: { margin: "0", borderColor: "#252b35" },
  feedback: { padding: "24px 34px 30px", textAlign: "center" as const },
  feedbackTitle: { margin: "0", color: "#c7d0dc", fontSize: "12px", lineHeight: "18px" },
  feedbackLinks: { margin: "10px 0 0", color: "#ff9b74", fontSize: "12px", fontWeight: "700" },
  unsubscribe: { display: "inline-block", marginTop: "22px", color: "#aeb9c8", fontSize: "11px", textDecoration: "underline" },
};
