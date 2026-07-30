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
  missing_province: "Provincia inválida",
  submitting: "Enviando",
  pending_confirmation: "Éxito",
  generic_error: "Error genérico",
};

const STATE_DESCRIPTIONS: Record<NewsletterPreviewFormState, string> = {
  idle: "Formulario preparado para comenzar.",
  focused: "Campo activo con foco visible.",
  invalid_email: "Validación de formato con error anunciado.",
  missing_province: "El selector rechaza valores territoriales no permitidos.",
  submitting: "Espera breve con el CTA desactivado.",
  pending_confirmation: "Respuesta genérica que protege el estado de la dirección.",
  generic_error: "Error recuperable sin exponer información del suscriptor.",
};

const RESULT_COPY: Partial<Record<NewsletterSignupState, { title: string; copy: string }>> = {
  accepted: {
    title: "Solicitud recibida",
    copy:
      "Si la dirección indicada puede completar la suscripción, recibirás un correo de confirmación en unos minutos. Revisa también las carpetas de Spam y Promociones.",
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
    if (validation === "missing_province") errors.province = "Selecciona una provincia válida.";
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
        province: province || undefined,
        consentVersion: NEWSLETTER_CONSENT_VERSION,
      }),
    );
    if (!nextState) return;
    if (nextState === "accepted") {
      setEmail("");
      setProvince("");
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
    <div data-form-state={state}>
      {state === "accepted" ? (
        <div
          aria-live="polite"
          className={styles.acceptedResult}
          ref={resultRef}
          role="status"
          tabIndex={-1}
        >
          <span aria-hidden="true" className={styles.acceptedResultIcon}>✓</span>
          <strong>{RESULT_COPY.accepted?.title}</strong>
          <p>{RESULT_COPY.accepted?.copy}</p>
          <small>El enlace de confirmación caduca a las 24 horas.</small>
        </div>
      ) : (
      <form
        aria-busy={busy}
        className={styles.signupForm}
        noValidate
        onSubmit={submit}
      >
        <div className={styles.formGrid}>
          <label className={styles.field} htmlFor="newsletter-preview-email">
            <span>Correo electrónico *</span>
            <input
              aria-describedby={fieldErrors.email ? "newsletter-email-error" : undefined}
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
            {fieldErrors.email ? (
              <small className={styles.fieldError} id="newsletter-email-error">
                {fieldErrors.email}
              </small>
            ) : null}
          </label>

          <label className={styles.field} htmlFor="newsletter-preview-province">
            <span>Provincia — opcional</span>
            <select
              aria-describedby={[
                "newsletter-province-help",
                fieldErrors.province ? "newsletter-province-error" : "",
              ].filter(Boolean).join(" ")}
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
              <option value="">Selección general de España</option>
              {NEWSLETTER_PROVINCE_OPTIONS.map((option) => (
                <option key={option.slug} value={option.slug}>{option.name}</option>
              ))}
            </select>
            <small id="newsletter-province-help">
              La utilizaremos únicamente para recomendarte eventos cercanos. Si no
              eliges ninguna, recibirás una selección general de España.
            </small>
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
            Quiero recibir cada semana “La Agenda Motor”, la newsletter de
            EventoMotor, en la dirección de correo indicada.
          </span>
        </label>
        {fieldErrors.consent ? (
          <p className={styles.fieldError} id="newsletter-consent-error">
            {fieldErrors.consent}
          </p>
        ) : null}

        <aside
          aria-label="Información básica sobre protección de datos"
          className={styles.privacyLayer}
        >
          <p>
            <b>Responsable:</b> Rubén Ginés Sánchez García, titular de
            EventoMotor. <b>Finalidad:</b> gestionar la suscripción y enviar La
            Agenda Motor. <b>Legitimación:</b> consentimiento.{" "}
            <b>Derechos:</b> puedes ejercerlos en{" "}
            <a href="mailto:info@eventomotor.com">info@eventomotor.com</a>.{" "}
            Más información en la{" "}
            <Link href="/privacidad">Política de privacidad</Link>
            {" · "}
            <Link href="/aviso-legal">Aviso legal</Link>.
          </p>
        </aside>

        <p className={styles.ageNotice}>
          Al suscribirte declaras tener al menos 14 años y haber leído la{" "}
          <Link href="/privacidad">información sobre protección de datos</Link>.
        </p>

        <button className={styles.primaryButton} disabled={busy} type="submit">
          {state === "validating"
            ? "Revisando datos…"
            : state === "submitting"
              ? "Enviando solicitud…"
              : "Quiero recibir La Agenda Motor"}
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
              <button className={styles.textButton} onClick={resetResult} type="button">
                Intentarlo de nuevo
              </button>
            </>
          ) : (
            <span className={styles.srOnly}>
              {busy ? "Solicitud en curso." : "Formulario listo."}
            </span>
          )}
        </div>
      </form>
      )}
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
