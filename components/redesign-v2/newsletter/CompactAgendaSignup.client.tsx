"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { validateNewsletterPreviewForm } from "@/components/newsletter/newsletter-preview-model";
import { NEWSLETTER_CONSENT_VERSION } from "@/lib/newsletter/audience";
import {
  requestNewsletterSubscription,
  runNewsletterMutationOnce,
  type NewsletterRequestClientResult,
} from "@/lib/newsletter/http-client";
import styles from "./CompactAgendaSignup.module.css";

type CompactAgendaSignupProps = {
  description: string;
  eyebrow: string;
  title: string;
};

type CompactAgendaSignupState =
  | "idle"
  | "validating"
  | "submitting"
  | NewsletterRequestClientResult;

type FieldErrors = {
  consent?: string;
  email?: string;
};

const RESULT_COPY: Partial<
  Record<CompactAgendaSignupState, { copy: string; title: string }>
> = {
  accepted: {
    title: "Solicitud recibida",
    copy: "Si la dirección indicada puede completar la suscripción, recibirás un correo de confirmación en unos minutos.",
  },
  invalid: {
    title: "Revisa los datos",
    copy: "No hemos podido validar la solicitud. Revisa los campos e inténtalo de nuevo.",
  },
  unavailable: {
    title: "Suscripción no disponible",
    copy: "Ahora mismo no podemos completar la solicitud. Inténtalo de nuevo más tarde.",
  },
  rate_limited: {
    title: "Espera antes de intentarlo de nuevo",
    copy: "Se han realizado demasiados intentos. Vuelve a probar dentro de unos minutos.",
  },
  temporarily_unavailable: {
    title: "No podemos completar la solicitud",
    copy: "Ha ocurrido un problema temporal. Inténtalo de nuevo más tarde.",
  },
};

export default function CompactAgendaSignup({
  description,
  eyebrow,
  title,
}: CompactAgendaSignupProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const emailId = `${id}-email`;
  const emailErrorId = `${id}-email-error`;
  const consentId = `${id}-consent`;
  const consentErrorId = `${id}-consent-error`;
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<CompactAgendaSignupState>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const submissionLock = useRef(false);
  const busy = state === "validating" || state === "submitting";
  const result = RESULT_COPY[state];

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;

    setState("validating");
    const validation = validateNewsletterPreviewForm(email, "");
    const errors: FieldErrors = {};
    if (validation === "invalid_email") errors.email = "Introduce un correo válido.";
    if (!consent) {
      errors.consent = "Debes aceptar la información de privacidad para suscribirte.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setState("invalid");
      if (errors.email) emailRef.current?.focus();
      else consentRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setState("submitting");
    const nextState = await runNewsletterMutationOnce(submissionLock, () =>
      requestNewsletterSubscription({
        email,
        consentVersion: NEWSLETTER_CONSENT_VERSION,
      }),
    );
    if (!nextState) return;
    if (nextState === "accepted") {
      setEmail("");
      setConsent(false);
    }
    setState(nextState);
  }

  function resetResult() {
    setState("idle");
    setFieldErrors({});
    emailRef.current?.focus();
  }

  return (
    <section
      aria-labelledby={titleId}
      className={styles.panel}
      data-newsletter-surface="v2-compact"
    >
      <div className={styles.copy}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>

      {state === "accepted" ? (
        <div
          aria-live="polite"
          className={styles.accepted}
          ref={resultRef}
          role="status"
          tabIndex={-1}
        >
          <span aria-hidden="true">✓</span>
          <strong>{RESULT_COPY.accepted?.title}</strong>
          <p>{RESULT_COPY.accepted?.copy}</p>
          <small>El enlace de confirmación caduca a las 24 horas.</small>
        </div>
      ) : (
        <form aria-busy={busy} className={styles.form} noValidate onSubmit={submit}>
          <label className={styles.emailField} htmlFor={emailId}>
            <span>Correo electrónico *</span>
            <input
              aria-describedby={fieldErrors.email ? emailErrorId : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="email"
              id={emailId}
              inputMode="email"
              maxLength={254}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                }
              }}
              placeholder="tu@email.com"
              ref={emailRef}
              type="email"
              value={email}
            />
          </label>
          {fieldErrors.email ? (
            <p className={styles.fieldError} id={emailErrorId}>{fieldErrors.email}</p>
          ) : null}

          <label className={styles.consent} htmlFor={consentId}>
            <input
              aria-describedby={fieldErrors.consent ? consentErrorId : undefined}
              aria-invalid={Boolean(fieldErrors.consent)}
              checked={consent}
              id={consentId}
              onChange={(event) => {
                setConsent(event.target.checked);
                if (fieldErrors.consent) {
                  setFieldErrors((current) => ({ ...current, consent: undefined }));
                }
              }}
              ref={consentRef}
              type="checkbox"
            />
            <span>
              Quiero recibir cada semana “La Agenda Motor”, la newsletter de EventoMotor,
              en la dirección de correo indicada.
            </span>
          </label>
          {fieldErrors.consent ? (
            <p className={styles.fieldError} id={consentErrorId}>{fieldErrors.consent}</p>
          ) : null}

          <button className={styles.submit} disabled={busy} type="submit">
            {state === "validating"
              ? "Revisando…"
              : state === "submitting"
                ? "Enviando…"
                : "Quiero recibirla"}
          </button>

          <div className={styles.legal}>
            <p className={styles.privacy}>
              <b>Finalidad:</b> gestionar tu suscripción y enviarte La Agenda Motor.{" "}
              <b>Legitimación:</b> consentimiento. Puedes ejercer tus derechos en{" "}
              <a href="mailto:info@eventomotor.com">info@eventomotor.com</a>. Consulta la{" "}
              <Link href="/privacidad">Política de privacidad</Link> y el{" "}
              <Link href="/aviso-legal">Aviso legal</Link>.
            </p>
            <p className={styles.ageNotice}>
              Al suscribirte declaras tener al menos 14 años y haber leído la{" "}
              <Link href="/privacidad">información sobre protección de datos</Link>.
            </p>
            <p className={styles.microcopy}>Puedes darte de baja cuando quieras.</p>
          </div>

          <div
            aria-live="polite"
            className={styles.result}
            ref={resultRef}
            role={state === "invalid" ? "alert" : "status"}
            tabIndex={result ? -1 : undefined}
          >
            {result ? (
              <>
                <strong>{result.title}</strong>
                <p>{result.copy}</p>
                <button onClick={resetResult} type="button">Intentarlo de nuevo</button>
              </>
            ) : (
              <span className={styles.srOnly}>
                {busy ? "Solicitud en curso." : "Formulario listo."}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
