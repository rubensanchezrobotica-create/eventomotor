import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import EventSubmissionForm from "@/components/public/EventSubmissionForm";
import styles from "@/components/public/PublicarEventoV2.module.css";
import { madridCalendarDateKey } from "@/components/redesign-v2/calendar/calendar-page-model";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { getVisibleEvents } from "@/lib/public-events";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import { SITE_URL } from "@/lib/seo";

const processSteps = [
  {
    number: "01",
    title: "Envíanos la información",
    detail: "Completa los datos y añade una fuente oficial que podamos consultar.",
  },
  {
    number: "02",
    title: "La revisamos",
    detail: "Comprobamos que la información sea verificable y encaje en la agenda.",
  },
  {
    number: "03",
    title: "La incorporamos",
    detail: "Si encaja y podemos verificarla, publicamos la ficha en EventoMotor.",
  },
] as const;

const usefulLinks = [
  { label: "Calendario de eventos", href: PUBLIC_NAVIGATION.calendar },
  { label: "Eventos este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
  { label: "Explorar disciplinas", href: PUBLIC_NAVIGATION.disciplines },
  { label: "Explorar zonas", href: PUBLIC_NAVIGATION.zones },
] as const;

export const metadata: Metadata = {
  title: "Publicar evento de motor gratis",
  description:
    "Publica gratis tu concentración motera, rallye, rodada, feria, ruta o evento de motor en EventoMotor. Revisamos la información y enlazamos a la fuente oficial.",
  alternates: {
    canonical: `${SITE_URL}/publicar-evento`,
  },
};

export default async function PublicarEventoPage() {
  await connection();
  const today = madridCalendarDateKey();
  const upcomingCount = (await getVisibleEvents()).filter(
    (event) => (event.end || event.start) >= today,
  ).length;

  return (
    <div className={`${styles.pageScope} ${redesignV2DisplayPilot.variable}`}>
      <V2InteriorShell
        breadcrumbs={[
          { label: "Inicio", navigationId: "home" },
          { label: "Publicar evento" },
        ]}
        currentNavigationId="publish"
        description="Envíanos tu evento gratis. Revisamos cada propuesta antes de publicarla y una fuente oficial nos ayuda a verificarla."
        eyebrow="Envía tu evento"
        navigationMode="public"
        title="Publica tu evento"
        upcomingCount={upcomingCount}
      >
        <div className={styles.content}>
          <section aria-labelledby="publish-process-title" className={styles.processSection}>
            <div className={styles.sectionHeading}>
              <span>Proceso de revisión</span>
              <h2 id="publish-process-title">TRES PASOS, SIN COSTE</h2>
              <p>El envío abre una solicitud de revisión; no publica el evento automáticamente.</p>
            </div>
            <ol className={styles.processGrid}>
              {processSteps.map((step) => (
                <li key={step.number}>
                  <span aria-hidden="true">{step.number}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="submission-form-title" className={styles.formSection} id="enviar-evento">
            <div className={styles.formIntro}>
              <span>Formulario</span>
              <h2 id="submission-form-title">CUÉNTANOS TU EVENTO</h2>
              <p>
                Los campos marcados con <strong>*</strong> son obligatorios. El resto ayuda a preparar una ficha más útil y fácil de verificar.
              </p>
            </div>
            <EventSubmissionForm />
          </section>

          <section aria-labelledby="publish-links-title" className={styles.linksSection}>
            <div className={styles.sectionHeading}>
              <span>Explora EventoMotor</span>
              <h2 id="publish-links-title">CONSULTA LA AGENDA</h2>
              <p>Revisa cómo presentamos fechas, disciplinas y territorios antes de enviar tu propuesta.</p>
            </div>
            <div className={styles.linkGrid}>
              {usefulLinks.map((link) => (
                <Link href={link.href} key={link.href}>
                  <span>{link.label}</span>
                  <strong aria-hidden="true">↗</strong>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </V2InteriorShell>
    </div>
  );
}
