"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { NEWSLETTER_CONSENT_VERSION } from "@/lib/newsletter/audience";
import {
  requestNewsletterSubscription,
  runNewsletterMutationOnce,
} from "@/lib/newsletter/http-client";
import {
  NEWSLETTER_PREVIEW_FORM_STATES,
  NEWSLETTER_PROVINCE_OPTIONS,
  validateNewsletterPreviewForm,
  type NewsletterPreviewFormState,
} from "./newsletter-preview-model";
import styles from "./NewsletterPreview.module.css";

export const NEWSLETTER_SIGNUP_STATES = [
  "idle",
  "validating",
  "submitting",
  "accepted",
  "invalid",
  "unavailable",
  "rate_limited",
  "temporarily_unavailable",
] as const;

export type NewsletterSignupState = (typeof NEWSLETTER_SIGNUP_STATES)[number];

type NewsletterSignupFormProps = {
  initialState?: NewsletterPreviewFormState;
  variant?: "product" | "lab";
};

type FieldErrors = {
  email?: string;
  province?: string;
  consent?: string;
};

const STATE_LABELS: Record<NewsletterPreviewFormState, string> = {
  idle: "Inicial",
  focused: "Foco",
  invalid_email: "Email inválido",
  missing_province: "Sin provincia",
  submitting: "Enviando",
  pending_confirmation: "Éxito",
  generic_error: "Error genérico",
};

const STATE_DESCRIPTIONS: Record<NewsletterPreviewFormState, string> = {
  idle: "Formulario preparado para comenzar.",
  focused: "Campo activo con foco visible.",
  invalid_email: "Validación de formato con error anunciado.",
  missing_province: "Provincia requerida antes de continuar.",
  submitting: "Espera breve con el CTA desactivado.",
  pending_confirmation: "Respuesta genérica que protege el estado de la dirección.",
  generic_error: "Error recuperable sin exponer información del suscriptor.",
};

const RESULT_COPY: Partial<Record<NewsletterSignupState, { title: string; copy: string }>> = {
  accepted: {
    title: "Solicitud recibida",
    copy: "Si la dirección puede suscribirse, recibirá un correo para confirmar la suscripción.",
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

function NewsletterSignupLab({ initialState }: { initialState: NewsletterPreviewFormState }) {
  const [state, setState] = useState<NewsletterPreviewFormState>(initialState);

  return (
    <div className={styles.labStatePanel} data-form-state={state}>
      <div className={styles.stateButtons} aria-label="Estados simulados del formulario">
        {NEWSLETTER_PREVIEW_FORM_STATES.map((item) => (
          <button
            aria-pressed={state === item}
            key={item}
            onClick={() => setState(item)}
            type="button"
          >
            {STATE_LABELS[item]}
          </button>
        ))}
      </div>
      <div className={styles.labStateReadout} role="status" aria-live="polite">
        <strong>{STATE_LABELS[state]}</strong>
        <p>{STATE_DESCRIPTIONS[state]}</p>
      </div>
    </div>
  );
}

function NewsletterProductSignupForm() {
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<NewsletterSignupState>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLSelectElement>(null);
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
    const validation = validateNewsletterPreviewForm(email, province);
    const errors: FieldErrors = {};
    if (validation === "invalid_email") errors.email = "Introduce un correo válido.";
    if (validation === "missing_province") errors.province = "Selecciona una provincia.";
    if (!consent) {
      errors.consent = "Debes aceptar la información de privacidad para suscribirte.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setState("invalid");
      if (errors.email) emailRef.current?.focus();
      else if (errors.province) provinceRef.current?.focus();
      else consentRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setState("submitting");
    const nextState = await runNewsletterMutationOnce(submissionLock, () =>
      requestNewsletterSubscription({
        email,
        province,
        consentVersion: NEWSLETTER_CONSENT_VERSION,
      }),
    );
    if (!nextState) return;
    if (nextState === "accepted") setEmail("");
    setState(nextState);
  }

  function resetResult() {
    setState("idle");
    setFieldErrors({});
    emailRef.current?.focus();
  }

  return (
    <div data-form-state={state}>
      <form className={styles.signupForm} noValidate onSubmit={submit}>
        <div className={styles.formGrid}>
          <label className={styles.field} htmlFor="newsletter-preview-email">
            <span>Email</span>
            <input
              aria-describedby={[
                "newsletter-email-help",
                fieldErrors.email ? "newsletter-email-error" : "",
              ].filter(Boolean).join(" ")}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="email"
              id="newsletter-preview-email"
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
            <small id="newsletter-email-help">
              Tu provincia nos ayuda a ordenar primero los planes más cercanos.
            </small>
            {fieldErrors.email ? (
              <small className={styles.fieldError} id="newsletter-email-error">
                {fieldErrors.email}
              </small>
            ) : null}
          </label>

          <label className={styles.field} htmlFor="newsletter-preview-province">
            <span>Provincia</span>
            <select
              aria-describedby={fieldErrors.province ? "newsletter-province-error" : undefined}
              aria-invalid={Boolean(fieldErrors.province)}
              id="newsletter-preview-province"
              onChange={(event) => {
                setProvince(event.target.value);
                if (fieldErrors.province) {
                  setFieldErrors((current) => ({ ...current, province: undefined }));
                }
              }}
              ref={provinceRef}
              value={province}
            >
              <option value="">Selecciona una provincia</option>
              {NEWSLETTER_PROVINCE_OPTIONS.map((option) => (
                <option key={option.slug} value={option.slug}>{option.name}</option>
              ))}
            </select>
            {fieldErrors.province ? (
              <small className={styles.fieldError} id="newsletter-province-error">
                {fieldErrors.province}
              </small>
            ) : null}
          </label>
        </div>

        <label className={styles.consentField} htmlFor="newsletter-preview-consent">
          <input
            aria-describedby={fieldErrors.consent ? "newsletter-consent-error" : undefined}
            aria-invalid={Boolean(fieldErrors.consent)}
            checked={consent}
            id="newsletter-preview-consent"
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
            He leído la <Link href="/privacidad">información de privacidad</Link> y acepto
            recibir La Agenda Motor.
          </span>
        </label>
        {fieldErrors.consent ? (
          <p className={styles.fieldError} id="newsletter-consent-error">
            {fieldErrors.consent}
          </p>
        ) : null}

        <button className={styles.primaryButton} disabled={busy} type="submit">
          {state === "validating"
            ? "Revisando datos…"
            : state === "submitting"
              ? "Enviando solicitud…"
              : "Recibir la agenda semanal"}
        </button>

        <p className={styles.microcopy}>Puedes darte de baja cuando quieras.</p>

        <div
          aria-live="polite"
          className={styles.formResult}
          data-has-result={result ? "true" : "false"}
          ref={resultRef}
          role={state === "invalid" ? "alert" : "status"}
          tabIndex={result ? -1 : undefined}
        >
          {result ? (
            <>
              <strong>{result.title}</strong>
              <p>{result.copy}</p>
              {state !== "accepted" ? (
                <button className={styles.textButton} onClick={resetResult} type="button">
                  Intentarlo de nuevo
                </button>
              ) : null}
            </>
          ) : (
            <span className={styles.srOnly}>
              {busy ? "Solicitud en curso." : "Formulario listo."}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default function NewsletterSignupForm({
  initialState = "idle",
  variant = "product",
}: NewsletterSignupFormProps) {
  if (variant === "lab") return <NewsletterSignupLab initialState={initialState} />;
  return <NewsletterProductSignupForm />;
}
