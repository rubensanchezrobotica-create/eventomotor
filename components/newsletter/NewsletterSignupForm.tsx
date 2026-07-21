"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import {
  NEWSLETTER_PREVIEW_FORM_STATES,
  NEWSLETTER_PROVINCE_OPTIONS,
  validateNewsletterPreviewForm,
  type NewsletterPreviewFormState,
} from "./newsletter-preview-model";
import styles from "./NewsletterPreview.module.css";

type NewsletterSignupFormProps = {
  initialState?: NewsletterPreviewFormState;
  variant?: "product" | "lab";
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
  pending_confirmation: "Respuesta genérica que invita a revisar el correo.",
  generic_error: "Error recuperable sin exponer información del suscriptor.",
};

function stateMessage(state: NewsletterPreviewFormState): string | null {
  if (state === "invalid_email") return "Escribe una dirección de correo válida.";
  if (state === "missing_province") return "Selecciona una provincia para personalizar la agenda.";
  if (state === "generic_error") return "No hemos podido completar la simulación. Inténtalo de nuevo.";
  return null;
}

export default function NewsletterSignupForm({
  initialState = "idle",
  variant = "product",
}: NewsletterSignupFormProps) {
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [state, setState] = useState<NewsletterPreviewFormState>(initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLSelectElement>(null);
  const error = stateMessage(state);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNewsletterPreviewForm(email, province);
    if (validation) {
      setState(validation);
      if (validation === "invalid_email") emailRef.current?.focus();
      if (validation === "missing_province") provinceRef.current?.focus();
      return;
    }

    setState("submitting");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
    setEmail("");
    setState("pending_confirmation");
  }

  function chooseLabState(nextState: NewsletterPreviewFormState) {
    setState(nextState);
    if (nextState === "invalid_email") setEmail("correo-sin-formato");
    if (nextState === "missing_province") setProvince("");
    if (nextState === "focused") window.setTimeout(() => emailRef.current?.focus(), 0);
    if (nextState === "pending_confirmation") setEmail("");
  }

  if (variant === "lab") {
    return (
      <div className={styles.labStatePanel} data-form-state={state}>
        <div className={styles.stateButtons} aria-label="Estados simulados del formulario">
          {NEWSLETTER_PREVIEW_FORM_STATES.map((item) => (
            <button
              aria-pressed={state === item}
              key={item}
              onClick={() => chooseLabState(item)}
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

  if (state === "pending_confirmation") {
    return (
      <div className={styles.successPanel} data-form-state={state} role="status" aria-live="polite">
        <span className={styles.successIcon} aria-hidden="true">✓</span>
        <div>
          <strong>Revisa tu correo</strong>
          <p>Te hemos enviado un enlace para confirmar que quieres recibir La Agenda Motor.</p>
          <button className={styles.textButton} onClick={() => setState("idle")} type="button">
            Volver al formulario
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-form-state={state}>
      <form className={styles.signupForm} noValidate onSubmit={submit}>
        <div className={styles.formGrid}>
          <label className={styles.field} htmlFor="newsletter-preview-email">
            <span>Email</span>
            <input
              aria-describedby={`newsletter-email-help${state === "invalid_email" ? " newsletter-form-error" : ""}`}
              aria-invalid={state === "invalid_email"}
              autoComplete="email"
              id="newsletter-preview-email"
              onChange={(event) => {
                setEmail(event.target.value);
                if (state !== "focused") setState("focused");
              }}
              onFocus={() => state === "idle" && setState("focused")}
              placeholder="tu@email.com"
              ref={emailRef}
              type="email"
              value={email}
            />
            <small id="newsletter-email-help">Tu provincia nos ayuda a ordenar primero los planes más cercanos.</small>
          </label>

          <label className={styles.field} htmlFor="newsletter-preview-province">
            <span>Provincia</span>
            <select
              aria-describedby={state === "missing_province" ? "newsletter-form-error" : undefined}
              aria-invalid={state === "missing_province"}
              id="newsletter-preview-province"
              onChange={(event) => {
                setProvince(event.target.value);
                if (state === "missing_province") setState("focused");
              }}
              ref={provinceRef}
              value={province}
            >
              <option value="">Selecciona una provincia</option>
              {NEWSLETTER_PROVINCE_OPTIONS.map((option) => (
                <option key={option.slug} value={option.slug}>{option.name}</option>
              ))}
            </select>
          </label>
        </div>

        <button className={styles.primaryButton} disabled={state === "submitting"} type="submit">
          {state === "submitting" ? "Preparando confirmación…" : "Recibir la agenda semanal"}
        </button>

        <p className={styles.microcopy}>Un correo a la semana. Sin ruido. Puedes darte de baja cuando quieras.</p>
        <p className={styles.legalCopy}>
          Al continuar, consulta nuestra <Link href="/privacidad">privacidad</Link> y el
          {" "}<Link href="/aviso-legal">aviso legal</Link>.
        </p>
        <p className={styles.formError} id="newsletter-form-error" role="alert" aria-live="assertive">
          {error}
        </p>
      </form>

    </div>
  );
}
