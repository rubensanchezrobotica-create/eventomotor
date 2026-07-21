"use client";

import { useMemo, useState } from "react";
import type { NewsletterEmailKind, RenderedNewsletterEmail } from "@/emails/newsletter/email-types";
import type { NewsletterEmailViewport } from "./newsletter-preview-model";
import styles from "./NewsletterPreview.module.css";

type NewsletterEmailShowcaseProps = {
  emails: RenderedNewsletterEmail[];
  initialKind: NewsletterEmailKind;
  initialViewport: NewsletterEmailViewport;
};

export default function NewsletterEmailShowcase({
  emails,
  initialKind,
  initialViewport,
}: NewsletterEmailShowcaseProps) {
  const [kind, setKind] = useState(initialKind);
  const [viewport, setViewport] = useState(initialViewport);
  const [format, setFormat] = useState<"html" | "text">("html");
  const selected = useMemo(
    () => emails.find((email) => email.kind === kind) ?? emails[0],
    [emails, kind],
  );

  if (!selected) return null;

  return (
    <div className={styles.emailStudio} data-email-kind={selected.kind} data-email-viewport={viewport}>
      <div className={styles.emailControls}>
        <div aria-label="Seleccionar email" className={styles.segmentedControl} role="group">
          {emails.map((email) => (
            <button
              aria-pressed={selected.kind === email.kind}
              key={email.kind}
              onClick={() => setKind(email.kind)}
              type="button"
            >
              {email.label}
            </button>
          ))}
        </div>
        <div className={styles.emailControlRow}>
          <div aria-label="Tamaño de email" className={styles.segmentedControl} role="group">
            <button aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")} type="button">
              Escritorio
            </button>
            <button aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")} type="button">
              Móvil
            </button>
          </div>
          <div aria-label="Formato de email" className={styles.segmentedControl} role="group">
            <button aria-pressed={format === "html"} onClick={() => setFormat("html")} type="button">
              HTML renderizado
            </button>
            <button aria-pressed={format === "text"} onClick={() => setFormat("text")} type="button">
              Texto plano
            </button>
          </div>
        </div>
      </div>

      <div className={styles.emailMetadata}>
        <div><span>Asunto</span><strong>{selected.subject}</strong></div>
        <div><span>Preheader</span><p>{selected.preheader}</p></div>
      </div>

      <div className={styles.emailStage}>
        {format === "html" ? (
          <div className={styles.emailViewport} data-size={viewport}>
            <iframe
              height={selected.previewHeight}
              sandbox=""
              srcDoc={selected.html}
              tabIndex={-1}
              title={`Preview HTML del email ${selected.label}`}
            />
          </div>
        ) : (
          <pre className={styles.plainText} tabIndex={0}>{selected.text}</pre>
        )}
      </div>
      <p className={styles.emailSafetyNote}>
        Entorno interno: HTML generado sólo desde fixtures seguros. El iframe no ejecuta scripts y sus enlaces están desactivados.
        Consentimiento, preferencias, baja y textos legales requieren aprobación antes de la integración pública.
      </p>
    </div>
  );
}
