"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./PublicarEventoV2.module.css";
import {
  buildEventSubmissionPayload,
  claimSubmissionLock,
  postEventSubmission,
  releaseSubmissionLock,
} from "./event-submission-client";

type SubmissionState =
  | { status: "idle"; message: string; fields?: Record<string, string> }
  | { status: "success"; message: string; fields?: Record<string, string> }
  | { status: "error"; message: string; fields?: Record<string, string> };

const disciplineOptions = [
  "Rallyes",
  "Circuito",
  "Concentraciones",
  "Rutas",
  "Ferias",
  "Offroad",
  "Clásicos",
  "Karting",
  "Otros",
];

const vehicleOptions = [
  { label: "Moto", value: "moto" },
  { label: "Coche", value: "coche" },
  { label: "Mixto", value: "mixto" },
  { label: "Karting / otros", value: "otros" },
];

type FieldA11yOptions = {
  helperIds?: string[];
};

export default function EventSubmissionForm() {
  const [state, setState] = useState<SubmissionState>({ status: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);

  function fieldA11y(field: string, options: FieldA11yOptions = {}) {
    const errorId = state.fields?.[field] ? `${field}-error` : undefined;
    const describedBy = [...(options.helperIds || []), ...(errorId ? [errorId] : [])].join(" ");
    return {
      "aria-describedby": describedBy || undefined,
      "aria-invalid": errorId ? true : undefined,
    };
  }

  function errorFor(field: string) {
    const message = state.fields?.[field];
    return message ? <small className={styles.fieldError} id={`${field}-error`}>{message}</small> : null;
  }

  function focusOutcome(form: HTMLFormElement, fields?: Record<string, string>) {
    window.requestAnimationFrame(() => {
      const firstField = Object.keys(fields || {})[0];
      const control = firstField ? form.elements.namedItem(firstField) : null;
      if (control instanceof HTMLElement) {
        control.focus();
        return;
      }
      statusRef.current?.focus();
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claimSubmissionLock(submissionLock)) return;

    const form = event.currentTarget;
    const payload = buildEventSubmissionPayload(new FormData(form));
    setIsSubmitting(true);
    setState({ status: "idle", message: "" });

    try {
      const outcome = await postEventSubmission(payload);
      if (outcome.status === "success") form.reset();
      setState(outcome);
      focusOutcome(form, outcome.fields);
    } finally {
      releaseSubmissionLock(submissionLock);
      setIsSubmitting(false);
    }
  }

  if (state.status === "success") {
    return (
      <div
        aria-labelledby="submission-success-title"
        aria-live="polite"
        className={styles.successPanel}
        data-submission-state="success"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        <span>Recibido</span>
        <h2 id="submission-success-title">HEMOS RECIBIDO TU EVENTO</h2>
        <p>{state.message}</p>
        <small>Lo revisaremos antes de incorporarlo a la agenda.</small>
      </div>
    );
  }

  return (
    <form aria-busy={isSubmitting} className={styles.form} noValidate={false} onSubmit={handleSubmit}>
      <div
        aria-live="assertive"
        className={state.status === "error" ? styles.errorStatus : styles.statusPlaceholder}
        data-submission-state={state.status}
        ref={statusRef}
        role={state.status === "error" ? "alert" : "status"}
        tabIndex={-1}
      >
        {state.message}
      </div>

      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="website">Web</label>
        <input autoComplete="off" id="website" name="website" tabIndex={-1} type="text" />
      </div>

      <fieldset className={styles.formGroup}>
        <legend className={styles.groupLegend}>
          <span aria-hidden="true">01</span>
          <span><strong>Evento</strong><small>Qué tipo de cita quieres compartir.</small></span>
        </legend>
        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Nombre del evento <RequiredMark /></span>
            <input name="event_name" placeholder="Ej. Concentración Motera..." required type="text" {...fieldA11y("event_name")} />
            {errorFor("event_name")}
          </label>
          <label className={styles.field}>
            <span>Disciplina</span>
            <select defaultValue="" name="discipline">
              <option value="">Seleccionar</option>
              {disciplineOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Tipo de vehículo</span>
            <select defaultValue="" name="vehicle_type">
              <option value="">Seleccionar</option>
              {vehicleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.formGroup}>
        <legend className={styles.groupLegend}>
          <span aria-hidden="true">02</span>
          <span><strong>Fecha y lugar</strong><small>Cuándo y dónde se celebra.</small></span>
        </legend>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Fecha de inicio</span>
            <input name="start_date" type="date" {...fieldA11y("start_date", { helperIds: ["date-helper"] })} />
            {errorFor("start_date")}
          </label>
          <label className={styles.field}>
            <span>Fecha de fin</span>
            <input name="end_date" type="date" {...fieldA11y("end_date", { helperIds: ["date-helper"] })} />
            {errorFor("end_date")}
          </label>
          <p className={`${styles.fieldHelper} ${styles.fieldWide}`} id="date-helper">Las fechas son opcionales. Puedes completar una o ambas si ya están confirmadas.</p>
          <label className={styles.field}>
            <span>Ciudad</span>
            <input name="city" placeholder="Ciudad" type="text" />
          </label>
          <label className={styles.field}>
            <span>Provincia</span>
            <input name="province" placeholder="Provincia" type="text" />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Recinto o ubicación</span>
            <input name="venue" placeholder="Circuito, recinto, plaza, punto de salida..." type="text" />
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.formGroup}>
        <legend className={styles.groupLegend}>
          <span aria-hidden="true">03</span>
          <span><strong>Información oficial</strong><small>Fuentes y contexto para verificar la propuesta.</small></span>
        </legend>
        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Web oficial o fuente <RequiredMark /></span>
            <input inputMode="url" name="source_url" placeholder="Web oficial, Instagram, Facebook..." required type="text" {...fieldA11y("source_url", { helperIds: ["source-url-helper"] })} />
            <small className={styles.fieldHelper} id="source-url-helper">Fuente oficial donde EventoMotor pueda comprobar los datos del evento.</small>
            {errorFor("source_url")}
          </label>
          <label className={styles.field}>
            <span>Entradas / inscripción</span>
            <input inputMode="url" name="ticket_url" placeholder="Enlace de inscripción o entradas" type="text" {...fieldA11y("ticket_url")} />
            {errorFor("ticket_url")}
          </label>
          <label className={styles.field}>
            <span>Cartel o imagen</span>
            <input inputMode="url" name="poster_url" placeholder="Enlace al cartel o imagen" type="text" {...fieldA11y("poster_url", { helperIds: ["poster-url-helper"] })} />
            <small className={styles.fieldHelper} id="poster-url-helper">Introduce una URL pública; este formulario no admite archivos.</small>
            {errorFor("poster_url")}
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Descripción breve</span>
            <textarea name="description" placeholder="Información confirmada del evento, sin inventar programa ni horarios." rows={5} />
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.formGroup}>
        <legend className={styles.groupLegend}>
          <span aria-hidden="true">04</span>
          <span><strong>Contacto</strong><small>Datos para gestionar y revisar la solicitud.</small></span>
        </legend>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Nombre del organizador</span>
            <input name="organizer_name" placeholder="Organizador o club" type="text" />
          </label>
          <label className={styles.field}>
            <span>Email de contacto <RequiredMark /></span>
            <input name="contact_email" placeholder="organizador@email.com" required type="email" {...fieldA11y("contact_email", { helperIds: ["contact-helper"] })} />
            {errorFor("contact_email")}
          </label>
          <label className={styles.field}>
            <span>Teléfono opcional</span>
            <input name="contact_phone" placeholder="+34..." type="tel" />
          </label>
          <p className={styles.fieldHelper} id="contact-helper">El contacto se usa para la gestión y revisión; no se muestra públicamente por defecto.</p>
        </div>
      </fieldset>

      <fieldset className={`${styles.formGroup} ${styles.reviewGroup}`}>
        <legend className={styles.groupLegend}>
          <span aria-hidden="true">05</span>
          <span><strong>Revisión y envío</strong><small>Comprueba los datos antes de enviar.</small></span>
        </legend>
        <div className={styles.reviewLayout}>
          <aside aria-labelledby="event-submission-privacy-title" className={styles.privacy}>
            <strong id="event-submission-privacy-title">Protección de datos:</strong>
            <p>
              Los datos se tratarán para revisar y gestionar tu solicitud de publicación, contactar contigo cuando sea necesario y gestionar posibles rectificaciones o retiradas. La base jurídica es la gestión de la solicitud que realizas. Los proveedores tecnológicos de EventoMotor podrán tratar los datos para prestar sus servicios. Los datos de contacto se conservarán inicialmente hasta 2 años después del evento y posteriormente se eliminarán cuando ya no sean necesarios. Puedes ejercer tus derechos escribiendo a info@eventomotor.com. Consulta la <Link href="/privacidad">Política de privacidad</Link>.
            </p>
          </aside>
          <div className={styles.actions}>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enviando..." : "Enviar evento"}
            </button>
            <small>El envío no publica el evento automáticamente. Quedará pendiente de revisión.</small>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className={styles.requiredMark}>*</span>
      <span className={styles.srOnly}> (obligatorio)</span>
    </>
  );
}
