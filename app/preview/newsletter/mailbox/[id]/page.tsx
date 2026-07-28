import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NEWSLETTER_PREVIEW_METADATA } from "@/components/newsletter/newsletter-preview-model";
import {
  createConfiguredNewsletterMailCaptureRuntime,
  isNewsletterMailboxRequestAllowed,
} from "@/lib/newsletter/mail-capture-config.server";
import {
  buildSafeNewsletterMailboxSrcDoc,
  listRedactedNewsletterCaptureLinks,
} from "@/lib/newsletter/mail-capture-view.server";
import styles from "../NewsletterMailbox.module.css";

export const metadata: Metadata = {
  ...NEWSLETTER_PREVIEW_METADATA,
  title: { absolute: "Detalle de captura local | EventoMotor" },
};

type NewsletterMailboxDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatCaptureDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

export default async function NewsletterMailboxDetailPage({
  params,
}: NewsletterMailboxDetailPageProps) {
  await connection();
  const [{ id }, requestHeaders] = await Promise.all([params, headers()]);
  const runtime = createConfiguredNewsletterMailCaptureRuntime();
  if (!runtime || !isNewsletterMailboxRequestAllowed(runtime, requestHeaders.get("host"))) {
    notFound();
  }

  let capture;
  try {
    capture = await runtime.store.get(id);
  } catch {
    capture = null;
  }
  if (!capture) notFound();

  const safeHtml = buildSafeNewsletterMailboxSrcDoc(capture.html);
  const redactedLinks = listRedactedNewsletterCaptureLinks(capture.html, runtime.origin);

  return (
    <main className={styles.mailbox}>
      <div className="emc-container">
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>DETALLE INTERNO</span>
            <h1>{capture.subject}</h1>
            <p>
              El HTML se muestra dentro de un iframe aislado, sin scripts, formularios, navegación
              superior ni carga automática de recursos remotos.
            </p>
          </div>
          <Link className={styles.backLink} href="/preview/newsletter/mailbox">
            Volver al buzón
          </Link>
        </header>

        <article className={styles.detailCard}>
          <div className={styles.detailGrid}>
            <div>
              <span className={styles.label}>Destinatario interno</span>
              <strong>{capture.recipientEmail}</strong>
            </div>
            <div>
              <span className={styles.label}>Tipo y estado</span>
              <strong>
                {capture.mailType} · {capture.status}
              </strong>
            </div>
            <div>
              <span className={styles.label}>Capturado</span>
              <time dateTime={capture.capturedAt}>{formatCaptureDate(capture.capturedAt)}</time>
            </div>
            <div>
              <span className={styles.label}>ID aleatorio</span>
              <strong>{capture.id}</strong>
            </div>
          </div>

          <section className={styles.contentSection}>
            <h2>HTML aislado</h2>
            <p>
              Los tokens sólo pueden aparecer dentro del contenido original del mensaje capturado.
            </p>
            <iframe
              className={styles.emailFrame}
              referrerPolicy="no-referrer"
              sandbox=""
              srcDoc={safeHtml}
              title={`Correo capturado: ${capture.subject}`}
            />
          </section>

          <section className={styles.contentSection}>
            <h2>Texto plano</h2>
            <p>Representación generada desde la misma plantilla React Email.</p>
            <pre className={styles.plainText}>{capture.text}</pre>
          </section>

          <section className={styles.contentSection}>
            <h2>Enlaces detectados</h2>
            <p>Los valores de query se ocultan fuera del contenido del correo.</p>
            <ul className={styles.linkList}>
              {redactedLinks.map((link) => (
                <li key={link}>
                  <code>{link}</code>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
