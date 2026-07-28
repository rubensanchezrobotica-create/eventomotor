import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  createConfiguredNewsletterMailCaptureRuntime,
  isNewsletterMailboxRequestAllowed,
} from "@/lib/newsletter/mail-capture-config.server";
import { NEWSLETTER_PREVIEW_METADATA } from "@/components/newsletter/newsletter-preview-model";
import styles from "./NewsletterMailbox.module.css";

export const metadata: Metadata = {
  ...NEWSLETTER_PREVIEW_METADATA,
  title: { absolute: "Buzón local de La Agenda Motor | EventoMotor" },
};

function formatCaptureDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

export default async function NewsletterMailboxPage() {
  await connection();
  const requestHeaders = await headers();
  const runtime = createConfiguredNewsletterMailCaptureRuntime();
  if (!runtime || !isNewsletterMailboxRequestAllowed(runtime, requestHeaders.get("host"))) {
    notFound();
  }

  let captures: Awaited<ReturnType<typeof runtime.store.list>> | null = null;
  try {
    captures = await runtime.store.list();
  } catch {
    captures = null;
  }

  return (
    <main className={styles.mailbox}>
      <div className="emc-container">
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ENTORNO LOCAL PROTEGIDO</span>
            <h1>Buzón de captura</h1>
            <p>
              Inspección local de los mensajes preparados por el transporte de captura. No existe
              entrega de correo, proveedor externo ni acceso desde Vercel.
            </p>
          </div>
          <Link href="/preview/newsletter">Volver a la preview</Link>
        </header>

        <div className={styles.securityNote}>
          Los destinatarios aparecen enmascarados. El contenido completo sólo está disponible en
          el detalle interno por ID aleatorio y se elimina de esta vista tras siete días.
        </div>

        {captures === null ? (
          <section className={styles.statusCard} role="status">
            <span className={styles.label}>ESTADO</span>
            <h2>No se pudo leer el buzón</h2>
            <p>La captura permanece cerrada. Revisa la configuración local sin exponer datos.</p>
          </section>
        ) : captures.length === 0 ? (
          <section className={styles.statusCard} role="status">
            <span className={styles.label}>SIN CAPTURAS</span>
            <h2>El buzón está vacío</h2>
            <p>
              Sólo aparecerán mensajes generados por el flujo local explícito. La preview visual no
              crea capturas por sí sola.
            </p>
          </section>
        ) : (
          <ol className={styles.captureList} aria-label="Capturas de correo">
            {captures.map((capture) => (
              <li className={styles.captureItem} key={capture.id}>
                <div>
                  <span>Fecha</span>
                  <time dateTime={capture.capturedAt}>{formatCaptureDate(capture.capturedAt)}</time>
                </div>
                <div>
                  <span>Destinatario</span>
                  <strong>{capture.maskedRecipient}</strong>
                </div>
                <div>
                  <span>{capture.mailType}</span>
                  <strong>{capture.subject}</strong>
                </div>
                <div>
                  <span className={styles.capturedBadge}>{capture.status}</span>
                  <Link
                    className={styles.captureLink}
                    href={`/preview/newsletter/mailbox/${capture.id}`}
                  >
                    Ver detalle
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
