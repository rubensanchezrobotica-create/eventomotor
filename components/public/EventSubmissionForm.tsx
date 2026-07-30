"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export default function EventSubmissionForm() {
  const [state, setState] = useState<SubmissionState>({ status: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusClass = useMemo(() => {
    if (state.status === "success") return "emc-submission-status emc-submission-status-success";
    if (state.status === "error") return "emc-submission-status emc-submission-status-error";
    return "emc-submission-status";
  }, [state.status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      event_name: fieldValue(formData, "event_name"),
      start_date: fieldValue(formData, "start_date"),
      end_date: fieldValue(formData, "end_date"),
      city: fieldValue(formData, "city"),
      province: fieldValue(formData, "province"),
      venue: fieldValue(formData, "venue"),
      discipline: fieldValue(formData, "discipline"),
      vehicle_type: fieldValue(formData, "vehicle_type"),
      source_url: fieldValue(formData, "source_url"),
      ticket_url: fieldValue(formData, "ticket_url"),
      poster_url: fieldValue(formData, "poster_url"),
      description: fieldValue(formData, "description"),
      organizer_name: fieldValue(formData, "organizer_name"),
      contact_email: fieldValue(formData, "contact_email"),
      contact_phone: fieldValue(formData, "contact_phone"),
      website: fieldValue(formData, "website"),
    };

    setIsSubmitting(true);
    setState({ status: "idle", message: "" });

    try {
      const response = await fetch("/api/event-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setState({
          status: "error",
          message: result.error || "No se ha podido enviar el evento.",
          fields: result.fields,
        });
        return;
      }

      form.reset();
      setState({
        status: "success",
        message: result.message || "Evento enviado correctamente. Lo revisaremos antes de publicarlo.",
      });
    } catch {
      setState({
        status: "error",
        message: "No se ha podido enviar el evento. Revisa tu conexión e inténtalo de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function errorFor(field: string) {
    return state.fields?.[field] ? <small className="emc-field-error">{state.fields[field]}</small> : null;
  }

  return (
    <form className="emc-submission-form" onSubmit={handleSubmit}>
      <div className="emc-submission-form-head">
        <div>
          <div className="emc-kicker">Enviar evento</div>
          <h2>Cuéntanos tu evento</h2>
          <p>Solo publicamos eventos con fuente verificable. La solicitud quedará pendiente de revisión antes de aparecer en EventoMotor.</p>
        </div>
        <span>Revisión manual</span>
      </div>

      <div className="emc-honeypot" aria-hidden="true">
        <label htmlFor="website">Web</label>
        <input autoComplete="off" id="website" name="website" tabIndex={-1} type="text" />
      </div>

      <div className="emc-submission-grid">
        <label className="emc-submission-field emc-field-wide">
          <span>Nombre del evento *</span>
          <input name="event_name" placeholder="Ej. Concentración Motera..." required type="text" />
          {errorFor("event_name")}
        </label>

        <label className="emc-submission-field">
          <span>Fecha de inicio</span>
          <input name="start_date" type="date" />
          {errorFor("start_date")}
        </label>

        <label className="emc-submission-field">
          <span>Fecha de fin</span>
          <input name="end_date" type="date" />
          {errorFor("end_date")}
        </label>

        <label className="emc-submission-field">
          <span>Ciudad</span>
          <input name="city" placeholder="Ciudad" type="text" />
        </label>

        <label className="emc-submission-field">
          <span>Provincia</span>
          <input name="province" placeholder="Provincia" type="text" />
        </label>

        <label className="emc-submission-field emc-field-wide">
          <span>Recinto o ubicación</span>
          <input name="venue" placeholder="Circuito, recinto, plaza, punto de salida..." type="text" />
        </label>

        <label className="emc-submission-field">
          <span>Disciplina</span>
          <select name="discipline" defaultValue="">
            <option value="">Seleccionar</option>
            {disciplineOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="emc-submission-field">
          <span>Tipo de vehículo</span>
          <select name="vehicle_type" defaultValue="">
            <option value="">Seleccionar</option>
            {vehicleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="emc-submission-field emc-field-wide">
          <span>Web oficial o fuente *</span>
          <input inputMode="url" name="source_url" placeholder="web oficial, Instagram, Facebook..." required type="text" />
          {errorFor("source_url")}
        </label>

        <label className="emc-submission-field">
          <span>Entradas / inscripción</span>
          <input inputMode="url" name="ticket_url" placeholder="enlace de inscripción o entradas" type="text" />
          {errorFor("ticket_url")}
        </label>

        <label className="emc-submission-field">
          <span>Cartel o imagen</span>
          <input inputMode="url" name="poster_url" placeholder="enlace al cartel o imagen" type="text" />
          {errorFor("poster_url")}
        </label>

        <label className="emc-submission-field emc-field-wide">
          <span>Descripción breve</span>
          <textarea name="description" placeholder="Información confirmada del evento, sin inventar programa ni horarios." rows={4} />
        </label>

        <label className="emc-submission-field">
          <span>Nombre del organizador</span>
          <input name="organizer_name" placeholder="Organizador o club" type="text" />
        </label>

        <label className="emc-submission-field">
          <span>Email de contacto *</span>
          <input name="contact_email" placeholder="organizador@email.com" required type="email" />
          {errorFor("contact_email")}
        </label>

        <label className="emc-submission-field">
          <span>Teléfono opcional</span>
          <input name="contact_phone" placeholder="+34..." type="tel" />
        </label>
      </div>

      {state.message ? <p className={statusClass}>{state.message}</p> : null}

      <aside className="emc-submission-privacy" aria-labelledby="event-submission-privacy-title">
        <strong id="event-submission-privacy-title">Protección de datos:</strong>{" "}
        Los datos se tratarán para revisar y gestionar tu solicitud de publicación,
        contactar contigo cuando sea necesario y gestionar posibles rectificaciones
        o retiradas. La base jurídica es la gestión de la solicitud que realizas.
        Los proveedores tecnológicos de EventoMotor podrán tratar los datos para
        prestar sus servicios. Los datos de contacto se conservarán inicialmente
        hasta 2 años después del evento y posteriormente se eliminarán cuando ya no
        sean necesarios. Puedes ejercer tus derechos escribiendo a
        info@eventomotor.com. Consulta la{" "}
        <Link href="/privacidad">Política de privacidad</Link>.
      </aside>

      <div className="emc-submission-actions">
        <button className="emc-btn emc-btn-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Enviando..." : "Enviar evento"}
        </button>
        <small>El envío no publica el evento automáticamente.</small>
      </div>
    </form>
  );
}
