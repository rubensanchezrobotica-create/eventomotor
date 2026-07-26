"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  EVENT_DRAFT_CATEGORIES,
  EVENT_DRAFT_COUNTRIES,
  EVENT_DRAFT_DISCIPLINES,
  EVENT_DRAFT_REGIONS,
  createEditableEventDraft,
  eventDraftFingerprint,
  isCurrentEventDraftValidated,
  resetEditableEventDraft,
  updateEditableEventDraft,
  validateEditableEventDraft,
  type EditableDraftField,
  type EditableEventDraft,
} from "@/lib/admin-event-draft";
import { VEHICLE_TYPE_LABELS, VEHICLE_TYPE_OPTIONS } from "@/lib/event-classification";

type AdminSubmission = {
  id: string;
  event_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  province: string | null;
  venue: string | null;
  discipline: string | null;
  vehicle_type: string | null;
  source_url: string;
  ticket_url: string | null;
  description: string | null;
  organizer_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  poster_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type SubmissionsResponse =
  | { ok: true; submissions: AdminSubmission[] }
  | { ok: false; error: string };

type StatusUpdateResponse =
  | { ok: true; submission: AdminSubmission }
  | { ok: false; error: string };

type EventDraft = EditableEventDraft;

type DraftPreview = {
  draft: EventDraft;
  json: string;
  warnings: string[];
};

type ValidationCheck = {
  status: "ok" | "warning" | "error";
  label: string;
  message: string;
};

type PossibleDuplicate = {
  id: string;
  slug: string | null;
  title: string;
  startDate: string;
  endDate: string | null;
  city: string | null;
  province: string | null;
  reason: string;
};

type DraftValidationResult = {
  ok: true;
  status: "ok" | "warning" | "error";
  checks: ValidationCheck[];
  warnings: string[];
  errors: string[];
  fieldErrors: Partial<Record<EditableDraftField, string>>;
  possibleDuplicates: PossibleDuplicate[];
};

type DraftValidationResponse = DraftValidationResult | { ok: false; error: string };

type PublishEventResponse =
  | {
      ok: true;
      event: { id: string; slug: string | null; title: string };
      eventUrl: string;
      warnings: string[];
      possibleDuplicates: PossibleDuplicate[];
      submissionStatusUpdate?: { ok: true; status: "imported" } | { ok: false; status: "imported"; error: string } | null;
    }
  | {
      ok: false;
      error: string;
      warnings?: string[];
      errors?: string[];
      possibleDuplicates?: PossibleDuplicate[];
      exactDuplicate?: PossibleDuplicate;
    };

const STATUS_OPTIONS = ["pending", "reviewed", "imported", "rejected", "spam"] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  reviewed: "Revisada",
  published: "Publicada",
  discarded: "Descartada",
  rejected: "Rechazada",
  imported: "Importada",
  spam: "Spam",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  reviewed: "border-sky-300/25 bg-sky-300/10 text-sky-100",
  published: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  discarded: "border-zinc-300/25 bg-zinc-300/10 text-zinc-200",
  rejected: "border-red-300/25 bg-red-300/10 text-red-100",
  imported: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  spam: "border-zinc-300/25 bg-zinc-300/10 text-zinc-200",
};

function formatDate(value: string | null) {
  if (!value) return "Pendiente";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateRange(submission: AdminSubmission) {
  if (!submission.start_date && !submission.end_date) return "Fecha pendiente";
  if (!submission.end_date || submission.end_date === submission.start_date) return formatDate(submission.start_date || submission.end_date);
  return `${formatDate(submission.start_date)} - ${formatDate(submission.end_date)}`;
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status || "pending";
}

function statusClass(status: string) {
  return STATUS_CLASSES[status] || STATUS_CLASSES.pending;
}

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || "—";
}

function ExternalLink({ href, children }: { href: string | null | undefined; children: React.ReactNode }) {
  if (!href) return <span className="text-zinc-500">—</span>;

  return (
    <a className="break-words text-red-200 underline decoration-red-200/30 underline-offset-4 hover:text-white" href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

function copySummary(submission: AdminSubmission) {
  return [
    `Nombre del evento: ${submission.event_name}`,
    `Fecha inicio: ${valueOrDash(submission.start_date)}`,
    `Fecha fin: ${valueOrDash(submission.end_date)}`,
    `Ubicación: ${valueOrDash(submission.venue)}`,
    `Ciudad: ${valueOrDash(submission.city)}`,
    `Provincia: ${valueOrDash(submission.province)}`,
    `Disciplina: ${valueOrDash(submission.discipline)}`,
    `Tipo de vehículo: ${valueOrDash(submission.vehicle_type)}`,
    `Fuente oficial: ${submission.source_url}`,
    `Entradas / inscripción: ${valueOrDash(submission.ticket_url)}`,
    `Cartel / imagen: ${valueOrDash(submission.poster_url)}`,
    `Organizador: ${valueOrDash(submission.organizer_name)}`,
    `Email contacto: ${submission.contact_email}`,
    `Teléfono: ${valueOrDash(submission.contact_phone)}`,
    `Descripción: ${valueOrDash(submission.description)}`,
    `Estado: ${statusLabel(submission.status)}`,
    `Recibida: ${formatDateTime(submission.created_at)}`,
  ].join("\n");
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-100">{children}</dd>
    </div>
  );
}

function validationBadgeClass(status: "ok" | "warning" | "error") {
  if (status === "ok") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "warning") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-red-300/25 bg-red-300/10 text-red-100";
}

function validationIcon(status: "ok" | "warning" | "error") {
  if (status === "ok") return "OK";
  if (status === "warning") return "AVISO";
  return "ERROR";
}

function hasExactSlugDuplicate(validation: DraftValidationResult | undefined) {
  return Boolean(validation?.possibleDuplicates.some((duplicate) => duplicate.reason.toLowerCase().includes("mismo slug")));
}

function alreadyPublished(submission: AdminSubmission) {
  return ["published", "imported"].includes(submission.status);
}

function buildDraftPreview(draft: EventDraft): DraftPreview {
  const validation = validateEditableEventDraft(draft);
  return {
    draft,
    json: JSON.stringify(draft, null, 2),
    warnings: [...validation.errors, ...validation.warnings],
  };
}

function DraftField({
  draft,
  error,
  field,
  label,
  multiline = false,
  onChange,
  options,
  type = "text",
  wide = false,
}: {
  draft: EventDraft;
  error?: string;
  field: EditableDraftField;
  label: string;
  multiline?: boolean;
  onChange: (field: EditableDraftField, value: string) => void;
  options?: ReadonlyArray<{ label: string; value: string }>;
  type?: "text" | "date" | "url";
  wide?: boolean;
}) {
  const inputId = `event-draft-${draft.sourceSubmissionId}-${field}`;
  const errorId = `${inputId}-error`;
  const value = field === "tags" ? draft.tags.join("\n") : draft[field];
  const className = `min-h-10 w-full rounded-md border bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-red-300/70 ${
    error ? "border-red-400/70" : "border-white/[0.10] focus:border-red-300/60"
  }`;

  return (
    <label className={`grid min-w-0 gap-1.5 ${wide ? "md:col-span-2" : ""}`} htmlFor={inputId}>
      <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</span>
      {options ? (
        <select
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          className={className}
          id={inputId}
          onChange={(event) => onChange(field, event.target.value)}
          value={value}
        >
          <option value="">Selecciona una opción</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : multiline ? (
        <textarea
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          className={`${className} min-h-28 resize-y whitespace-pre-wrap break-words`}
          id={inputId}
          onChange={(event) => onChange(field, event.target.value)}
          value={value}
        />
      ) : (
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          className={`${className} min-w-0`}
          id={inputId}
          onChange={(event) => onChange(field, event.target.value)}
          type={type}
          value={value}
        />
      )}
      {error ? <span className="text-xs leading-5 text-red-200" id={errorId} role="alert">{error}</span> : null}
    </label>
  );
}

export default function EventSubmissionsAdmin() {
  const [secret, setSecret] = useState("");
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EventDraft>>({});
  const [originalDrafts, setOriginalDrafts] = useState<Record<string, EventDraft>>({});
  const [validatedFingerprints, setValidatedFingerprints] = useState<Record<string, string>>({});
  const [draftChangeWarnings, setDraftChangeWarnings] = useState<Record<string, string>>({});
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, DraftValidationResult>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<Record<string, { eventUrl: string; title: string }>>({});
  const [publishWarnings, setPublishWarnings] = useState<Record<string, string>>({});

  const filteredSubmissions = useMemo(() => {
    if (statusFilter === "todos") return submissions;
    return submissions.filter((submission) => submission.status === statusFilter);
  }, [statusFilter, submissions]);

  const counts = useMemo(() => {
    return submissions.reduce<Record<string, number>>((result, submission) => {
      result[submission.status] = (result[submission.status] || 0) + 1;
      return result;
    }, {});
  }, [submissions]);

  async function loadSubmissions(adminSecret = secret) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/submissions", {
        headers: { authorization: `Bearer ${adminSecret}` },
      });
      const payload = (await response.json()) as SubmissionsResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudieron cargar las solicitudes." : payload.error);
      }

      setSubmissions(payload.submissions);
      setIsAuthenticated(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateStatus(submission: AdminSubmission, status: string) {
    setUpdatingId(submission.id);
    setError("");

    try {
      const response = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: submission.id, status }),
      });
      const payload = (await response.json()) as StatusUpdateResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudo actualizar el estado." : payload.error);
      }

      setSubmissions((current) => current.map((item) => (item.id === payload.submission.id ? payload.submission : item)));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : String(statusError));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCopy(submission: AdminSubmission) {
    try {
      await navigator.clipboard.writeText(copySummary(submission));
      setCopyMessage(`Datos copiados: ${submission.event_name}`);
    } catch {
      setCopyMessage("No se pudo copiar al portapapeles.");
    }
  }

  function handleGenerateDraft(submission: AdminSubmission) {
    const draft = createEditableEventDraft(submission);
    setExpandedId(submission.id);
    setDraftId(submission.id);
    setDrafts((current) => ({ ...current, [submission.id]: draft }));
    setOriginalDrafts((current) => ({ ...current, [submission.id]: structuredClone(draft) }));
    setValidationResults((current) => {
      const next = { ...current };
      delete next[submission.id];
      return next;
    });
    setValidatedFingerprints((current) => {
      const next = { ...current };
      delete next[submission.id];
      return next;
    });
    setDraftChangeWarnings((current) => ({ ...current, [submission.id]: "" }));
    setCopyMessage(`Borrador generado para revisar: ${submission.event_name}`);
  }

  async function handleCopyDraft(submission: AdminSubmission) {
    const draft = drafts[submission.id];
    if (!draft) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      setCopyMessage(`JSON de borrador copiado: ${submission.event_name}`);
    } catch {
      setCopyMessage("No se pudo copiar el JSON al portapapeles.");
    }
  }

  function handleDraftChange(submission: AdminSubmission, field: EditableDraftField, value: string) {
    const previousWasValidated = Boolean(validatedFingerprints[submission.id]);
    setDrafts((current) => {
      const draft = current[submission.id];
      if (!draft) return current;
      return {
        ...current,
        [submission.id]: updateEditableEventDraft(draft, field, value),
      };
    });
    setValidatedFingerprints((current) => {
      const next = { ...current };
      delete next[submission.id];
      return next;
    });
    setPublishWarnings((current) => ({ ...current, [submission.id]: "" }));
    setDraftChangeWarnings((current) => ({
      ...current,
      [submission.id]: previousWasValidated
        ? "Has modificado el borrador. Valida de nuevo antes de publicar."
        : current[submission.id] || "",
    }));
  }

  function handleResetDraft(submission: AdminSubmission) {
    const original = originalDrafts[submission.id];
    if (!original) return;
    setDrafts((current) => ({ ...current, [submission.id]: resetEditableEventDraft(original) }));
    setValidationResults((current) => {
      const next = { ...current };
      delete next[submission.id];
      return next;
    });
    setValidatedFingerprints((current) => {
      const next = { ...current };
      delete next[submission.id];
      return next;
    });
    setDraftChangeWarnings((current) => ({ ...current, [submission.id]: "" }));
    setPublishWarnings((current) => ({ ...current, [submission.id]: "" }));
    setCopyMessage(`Borrador restablecido: ${submission.event_name}`);
  }

  async function handleValidateDraft(submission: AdminSubmission) {
    const draft = drafts[submission.id];
    if (!draft) return;
    setValidatingId(submission.id);
    setError("");

    try {
      const response = await fetch("/api/admin/validate-event-draft", {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as DraftValidationResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudo validar el borrador." : payload.error);
      }

      setValidationResults((current) => ({ ...current, [submission.id]: payload }));
      setValidatedFingerprints((current) => ({
        ...current,
        [submission.id]: eventDraftFingerprint(draft),
      }));
      setDraftChangeWarnings((current) => ({ ...current, [submission.id]: "" }));
      setCopyMessage(`Validación completada: ${submission.event_name}`);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : String(validationError));
    } finally {
      setValidatingId(null);
    }
  }

  async function handlePublishDraft(submission: AdminSubmission) {
    const draft = drafts[submission.id];
    const validation = validationResults[submission.id];

    setPublishWarnings((current) => ({ ...current, [submission.id]: "" }));

    if (!draft || !validation) {
      setPublishWarnings((current) => ({ ...current, [submission.id]: "Valida el borrador antes de publicar." }));
      return;
    }

    if (validatedFingerprints[submission.id] !== eventDraftFingerprint(draft)) {
      setPublishWarnings((current) => ({
        ...current,
        [submission.id]: "Has modificado el borrador. Valida de nuevo antes de publicar.",
      }));
      return;
    }

    if (validation.errors.length || validation.status === "error") {
      setPublishWarnings((current) => ({ ...current, [submission.id]: "El borrador tiene errores críticos y no se puede publicar." }));
      return;
    }

    if (hasExactSlugDuplicate(validation)) {
      setPublishWarnings((current) => ({ ...current, [submission.id]: "Ya existe un evento con este slug." }));
      return;
    }

    const baseConfirm = window.confirm(
      "Vas a publicar este evento en EventoMotor. Revisa título, fecha, ubicación y fuente oficial antes de continuar.",
    );

    if (!baseConfirm) return;

    const hasWarnings = validation.warnings.length || validation.status === "warning";
    const hasDuplicates = validation.possibleDuplicates.length > 0;

    if (hasWarnings) {
      const warningConfirm = window.confirm("Este borrador tiene avisos pendientes. ¿Quieres publicarlo igualmente?");
      if (!warningConfirm) return;
    }

    if (hasDuplicates) {
      const duplicateConfirm = window.confirm("Se han detectado posibles duplicados. Revisa la lista antes de publicar. ¿Quieres continuar?");
      if (!duplicateConfirm) return;
    }

    setPublishingId(submission.id);
    setError("");

    try {
      const response = await fetch("/api/admin/publish-event-draft", {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft,
          confirmWarnings: Boolean(hasWarnings),
          confirmPossibleDuplicates: Boolean(hasDuplicates),
        }),
      });
      const payload = (await response.json()) as PublishEventResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudo publicar el evento." : payload.error);
      }

      setPublishResults((current) => ({
        ...current,
        [submission.id]: {
          eventUrl: payload.eventUrl,
          title: payload.event.title,
        },
      }));
      if (payload.submissionStatusUpdate?.ok) {
        setSubmissions((current) => current.map((item) => (item.id === submission.id ? { ...item, status: "imported" } : item)));
      }
      if (payload.submissionStatusUpdate && !payload.submissionStatusUpdate.ok) {
        const statusUpdateError = payload.submissionStatusUpdate.error;
        setPublishWarnings((current) => ({
          ...current,
          [submission.id]: `Evento publicado, pero no se pudo marcar la solicitud como importada: ${statusUpdateError}`,
        }));
      }
      setCopyMessage(`Evento publicado correctamente: ${payload.event.title}`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setPublishingId(null);
    }
  }

  async function handleCopyEventUrl(submission: AdminSubmission) {
    const result = publishResults[submission.id];

    if (!result) return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${result.eventUrl}`);
      setCopyMessage(`Enlace copiado: ${result.eventUrl}`);
    } catch {
      setCopyMessage("No se pudo copiar el enlace del evento.");
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSubmissions();
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[96rem] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400/90">EventoMotor Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Solicitudes de eventos</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
              Revisa solicitudes recibidas desde /publicar-evento. Esta pantalla no publica eventos automáticamente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-100 hover:border-white/[0.16]" href="/admin">
              Mesa de eventos
            </Link>
            {isAuthenticated ? (
              <button
                className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-100 hover:border-white/[0.16]"
                onClick={() => loadSubmissions()}
                type="button"
              >
                Refrescar
              </button>
            ) : null}
          </div>
        </header>

        <section className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3.5">
          <form className="flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={handleLogin}>
            <label className="grid flex-1 gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Clave de administración</span>
              <input
                className="min-h-10 rounded-md border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none focus:border-red-400/80"
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Introduce ADMIN_SECRET"
                type="password"
                value={secret}
              />
            </label>
            <button
              className="min-h-10 self-end rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
              disabled={isLoading || !secret.trim()}
              type="submit"
            >
              {isLoading ? "Cargando" : "Entrar"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        </section>

        {isAuthenticated ? (
          <section className="rounded-lg border border-white/[0.07] bg-[#111216] p-3.5">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Solicitudes recibidas</h2>
                <p className="text-xs text-zinc-500">
                  Mostrando {filteredSubmissions.length} de {submissions.length}. Puedes revisar, copiar datos y cambiar estado.
                </p>
              </div>
              <select
                className="min-h-9 rounded-md border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none focus:border-red-400/80"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="todos">Todos los estados</option>
                <option value="pending">Pending ({counts.pending || 0})</option>
                <option value="reviewed">Reviewed ({counts.reviewed || 0})</option>
                <option value="imported">Importadas ({counts.imported || 0})</option>
                <option value="rejected">Rechazadas ({counts.rejected || 0})</option>
                <option value="spam">Spam ({counts.spam || 0})</option>
              </select>
            </div>

            {copyMessage ? <p className="mb-3 rounded-md border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">{copyMessage}</p> : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-zinc-500">
                    <th className="border-b border-white/[0.08] px-3 py-2">Recibida</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Evento</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Fecha inicio</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Ciudad</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Provincia</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Disciplina / tipo</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Contacto</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Estado</th>
                    <th className="border-b border-white/[0.08] px-3 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission) => (
                    <tr className="align-top hover:bg-white/[0.025]" key={submission.id}>
                      <td className="border-b border-white/[0.05] px-3 py-3 text-zinc-400">{formatDateTime(submission.created_at)}</td>
                      <td className="border-b border-white/[0.05] px-3 py-3">
                        <strong className="block text-white">{submission.event_name}</strong>
                        <span className="mt-1 block text-xs text-zinc-500">{submission.venue || "Recinto pendiente"}</span>
                      </td>
                      <td className="border-b border-white/[0.05] px-3 py-3 text-zinc-300">{formatDate(submission.start_date)}</td>
                      <td className="border-b border-white/[0.05] px-3 py-3 text-zinc-300">{valueOrDash(submission.city)}</td>
                      <td className="border-b border-white/[0.05] px-3 py-3 text-zinc-300">{valueOrDash(submission.province)}</td>
                      <td className="border-b border-white/[0.05] px-3 py-3">
                        <span className="block text-zinc-200">{submission.discipline || "Sin disciplina"}</span>
                        <span className="mt-1 block text-xs text-zinc-500">{submission.vehicle_type || "Sin tipo"}</span>
                      </td>
                      <td className="border-b border-white/[0.05] px-3 py-3">
                        <a className="block text-zinc-100 hover:text-red-200" href={`mailto:${submission.contact_email}`}>
                          {submission.contact_email}
                        </a>
                        <span className="mt-1 block text-xs text-zinc-500">{submission.organizer_name || "Organizador pendiente"}</span>
                      </td>
                      <td className="border-b border-white/[0.05] px-3 py-3">
                        <span className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(submission.status)}`}>
                          {statusLabel(submission.status)}
                        </span>
                        <select
                          className="block min-h-8 w-full rounded-md border border-white/[0.08] bg-black/30 px-2 text-xs text-white outline-none focus:border-red-400/80 disabled:opacity-50"
                          disabled={updatingId === submission.id}
                          onChange={(event) => updateStatus(submission, event.target.value)}
                          value={STATUS_OPTIONS.includes(submission.status as (typeof STATUS_OPTIONS)[number]) ? submission.status : "pending"}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-white/[0.05] px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <button
                            className="rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-2 text-xs font-bold text-white hover:border-red-300/50 hover:bg-red-500/10"
                            onClick={() => setExpandedId((current) => (current === submission.id ? null : submission.id))}
                            type="button"
                          >
                            {expandedId === submission.id ? "Ocultar" : "Ver detalle"}
                          </button>
                          <button
                            className="rounded-md border border-white/[0.10] bg-black/20 px-3 py-2 text-xs font-bold text-zinc-200 hover:border-white/[0.22] hover:bg-white/[0.07]"
                            onClick={() => handleCopy(submission)}
                            type="button"
                          >
                            Copiar datos
                          </button>
                          <button
                            className="rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100 hover:border-amber-200/50 hover:bg-amber-300/15"
                            onClick={() => handleGenerateDraft(submission)}
                            type="button"
                          >
                            Generar borrador
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!filteredSubmissions.length ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                {submissions.length ? "No hay solicitudes con este filtro." : "No hay solicitudes de eventos pendientes."}
              </p>
            ) : null}

            {filteredSubmissions.map((submission) =>
              expandedId === submission.id ? (
                <article className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-4 shadow-2xl shadow-black/20" key={`detail-${submission.id}`}>
                  <div className="mb-4 flex flex-col gap-2 border-b border-white/[0.06] pb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-red-300">Detalle de solicitud</p>
                      <h3 className="mt-1 text-xl font-semibold text-white">{submission.event_name}</h3>
                      <p className="mt-1 text-sm text-zinc-400">Recibida el {formatDateTime(submission.created_at)}</p>
                    </div>
                    <button
                      className="rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-2 text-xs font-bold text-white hover:border-red-300/50 hover:bg-red-500/10"
                      onClick={() => handleCopy(submission)}
                      type="button"
                    >
                      Copiar datos
                    </button>
                    <button
                      className="rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100 hover:border-amber-200/50 hover:bg-amber-300/15"
                      onClick={() => handleGenerateDraft(submission)}
                      type="button"
                    >
                      Generar borrador de evento
                    </button>
                  </div>

                  <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailRow label="Fecha inicio / fin">{formatDateRange(submission)}</DetailRow>
                    <DetailRow label="Ubicación completa">{valueOrDash(submission.venue)}</DetailRow>
                    <DetailRow label="Ciudad">{valueOrDash(submission.city)}</DetailRow>
                    <DetailRow label="Provincia">{valueOrDash(submission.province)}</DetailRow>
                    <DetailRow label="Disciplina / tipo">{valueOrDash(submission.discipline)}</DetailRow>
                    <DetailRow label="Vehículo">{valueOrDash(submission.vehicle_type)}</DetailRow>
                    <DetailRow label="Organizador">{valueOrDash(submission.organizer_name)}</DetailRow>
                    <DetailRow label="Estado">{statusLabel(submission.status)}</DetailRow>
                    <DetailRow label="Fuente oficial">
                      <ExternalLink href={submission.source_url}>{submission.source_url}</ExternalLink>
                    </DetailRow>
                    <DetailRow label="Entradas / inscripción">
                      <ExternalLink href={submission.ticket_url}>{submission.ticket_url || "—"}</ExternalLink>
                    </DetailRow>
                    <DetailRow label="Cartel / imagen">
                      <ExternalLink href={submission.poster_url}>{submission.poster_url || "—"}</ExternalLink>
                    </DetailRow>
                    <DetailRow label="Email contacto">
                      <a className="text-red-200 underline decoration-red-200/30 underline-offset-4 hover:text-white" href={`mailto:${submission.contact_email}`}>
                        {submission.contact_email}
                      </a>
                    </DetailRow>
                    <DetailRow label="Teléfono">{valueOrDash(submission.contact_phone)}</DetailRow>
                    <div className="rounded-md border border-white/[0.06] bg-black/20 p-3 md:col-span-2 xl:col-span-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Descripción / comentarios</dt>
                      <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{valueOrDash(submission.description)}</dd>
                    </div>
                  </dl>

                  {draftId === submission.id
                    ? (() => {
                        const draft = drafts[submission.id];
                        if (!draft) return null;
                        const preview = buildDraftPreview(draft);
                        const localValidation = validateEditableEventDraft(draft);
                        const validation = validationResults[submission.id];
                        const publishResult = publishResults[submission.id];
                        const publishWarning = publishWarnings[submission.id];
                        const validatedExactDraft = isCurrentEventDraftValidated(
                          draft,
                          validatedFingerprints[submission.id],
                        );
                        const publishBlocked =
                          alreadyPublished(submission) ||
                          !validation ||
                          !validatedExactDraft ||
                          validation.status === "error" ||
                          validation.errors.length > 0 ||
                          hasExactSlugDuplicate(validation);

                        return (
                          <section className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.055] p-4">
                            <div className="flex flex-col gap-3 border-b border-amber-200/10 pb-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Borrador seguro</p>
                                <h4 className="mt-1 text-lg font-semibold text-white">Revisar datos antes de publicar</h4>
                                <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                                  Corrige los datos necesarios y valida de nuevo. El formulario vive únicamente en este navegador hasta que se publique.
                                </p>
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                <button
                                  className="rounded-md border border-white/[0.12] bg-white/[0.08] px-3 py-2 text-xs font-bold text-white hover:border-amber-200/50 hover:bg-amber-300/10"
                                  onClick={() => handleResetDraft(submission)}
                                  type="button"
                                >
                                  Restablecer borrador
                                </button>
                                <button
                                  className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100 hover:border-emerald-200/50 hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={validatingId === submission.id}
                                  onClick={() => handleValidateDraft(submission)}
                                  type="button"
                                >
                                  {validatingId === submission.id ? "Validando" : "Validar cambios"}
                                </button>
                              </div>
                            </div>

                            {draftChangeWarnings[submission.id] ? (
                              <p className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-50" role="status">
                                {draftChangeWarnings[submission.id]}
                              </p>
                            ) : null}

                            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                              <DraftField draft={draft} error={localValidation.fieldErrors.title} field="title" label="Título" onChange={(field, value) => handleDraftChange(submission, field, value)} wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.slug} field="slug" label="Slug" onChange={(field, value) => handleDraftChange(submission, field, value)} wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.startDate} field="startDate" label="Fecha de inicio" onChange={(field, value) => handleDraftChange(submission, field, value)} type="date" />
                              <DraftField draft={draft} error={localValidation.fieldErrors.endDate} field="endDate" label="Fecha de fin" onChange={(field, value) => handleDraftChange(submission, field, value)} type="date" />
                              <DraftField draft={draft} error={localValidation.fieldErrors.venue} field="venue" label="Recinto" onChange={(field, value) => handleDraftChange(submission, field, value)} wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.city} field="city" label="Ciudad" onChange={(field, value) => handleDraftChange(submission, field, value)} />
                              <DraftField draft={draft} error={localValidation.fieldErrors.province} field="province" label="Provincia" onChange={(field, value) => handleDraftChange(submission, field, value)} />
                              <DraftField
                                draft={draft}
                                error={localValidation.fieldErrors.region}
                                field="region"
                                label="Región"
                                onChange={(field, value) => handleDraftChange(submission, field, value)}
                                options={EVENT_DRAFT_REGIONS.map((value) => ({ label: value, value }))}
                              />
                              <DraftField
                                draft={draft}
                                error={localValidation.fieldErrors.country}
                                field="country"
                                label="País"
                                onChange={(field, value) => handleDraftChange(submission, field, value)}
                                options={EVENT_DRAFT_COUNTRIES}
                              />
                              <DraftField
                                draft={draft}
                                error={localValidation.fieldErrors.discipline}
                                field="discipline"
                                label="Disciplina"
                                onChange={(field, value) => handleDraftChange(submission, field, value)}
                                options={EVENT_DRAFT_DISCIPLINES.map((value) => ({ label: value, value }))}
                              />
                              <DraftField
                                draft={draft}
                                error={localValidation.fieldErrors.category}
                                field="category"
                                label="Categoría"
                                onChange={(field, value) => handleDraftChange(submission, field, value)}
                                options={EVENT_DRAFT_CATEGORIES.map((value) => ({ label: value, value }))}
                              />
                              <DraftField
                                draft={draft}
                                error={localValidation.fieldErrors.vehicleType}
                                field="vehicleType"
                                label="Tipo de vehículo"
                                onChange={(field, value) => handleDraftChange(submission, field, value)}
                                options={VEHICLE_TYPE_OPTIONS.map((value) => ({ label: VEHICLE_TYPE_LABELS[value], value }))}
                              />
                              <DraftField draft={draft} error={localValidation.fieldErrors.organizer} field="organizer" label="Organizador" onChange={(field, value) => handleDraftChange(submission, field, value)} />
                              <DraftField draft={draft} error={localValidation.fieldErrors.sourceUrl} field="sourceUrl" label="Fuente oficial" onChange={(field, value) => handleDraftChange(submission, field, value)} type="url" wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.ticketUrl} field="ticketUrl" label="Entradas" onChange={(field, value) => handleDraftChange(submission, field, value)} type="url" wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.registrationUrl} field="registrationUrl" label="Inscripción" onChange={(field, value) => handleDraftChange(submission, field, value)} type="url" wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.posterUrl} field="posterUrl" label="Cartel / imagen directa" onChange={(field, value) => handleDraftChange(submission, field, value)} type="url" wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.shortDescription} field="shortDescription" label="Descripción breve" multiline onChange={(field, value) => handleDraftChange(submission, field, value)} wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.longDescription} field="longDescription" label="Descripción larga" multiline onChange={(field, value) => handleDraftChange(submission, field, value)} wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.scheduleText} field="scheduleText" label="Programa / horario" multiline onChange={(field, value) => handleDraftChange(submission, field, value)} wide />
                              <DraftField draft={draft} error={localValidation.fieldErrors.tags} field="tags" label="Etiquetas (una por línea)" multiline onChange={(field, value) => handleDraftChange(submission, field, value)} wide />
                            </div>

                            {preview.warnings.length ? (
                              <div className="mt-4 rounded-lg border border-amber-300/20 bg-black/20 p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Revisión pendiente</p>
                                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-50/90">
                                  {preview.warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <p className="mt-3 rounded-lg border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
                                Datos mínimos presentes. Aun así, revisa duplicados y fuente oficial antes de publicar.
                              </p>
                            )}

                            <details className="mt-4 rounded-lg border border-white/[0.08] bg-black/25">
                              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">
                                Ver JSON del borrador
                              </summary>
                              <div className="border-t border-white/[0.08] p-3">
                                <button
                                  className="mb-3 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 py-2 text-xs font-bold text-white hover:border-amber-200/50 hover:bg-amber-300/10"
                                  onClick={() => handleCopyDraft(submission)}
                                  type="button"
                                >
                                  Copiar JSON
                                </button>
                                <pre className="max-h-[32rem] max-w-full overflow-x-auto whitespace-pre rounded-lg border border-white/[0.08] bg-black/45 p-3 text-xs leading-5 text-zinc-100">
                                  <code>{preview.json}</code>
                                </pre>
                              </div>
                            </details>

                            {validation ? (
                              <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-4">
                                <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">RESULTADO DE VALIDACIÓN</p>
                                    <h5 className="mt-1 text-base font-semibold text-white">Revisión previa del borrador</h5>
                                  </div>
                                  <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${validationBadgeClass(validation.status)}`}>
                                    {validationIcon(validation.status)}
                                  </span>
                                </div>

                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                  {validation.checks.map((check) => (
                                    <div className={`rounded-lg border p-3 ${validationBadgeClass(check.status)}`} key={`${check.label}-${check.message}`}>
                                      <p className="text-xs font-bold uppercase tracking-wide">{validationIcon(check.status)} · {check.label}</p>
                                      <p className="mt-1 text-sm leading-5">{check.message}</p>
                                    </div>
                                  ))}
                                </div>

                                {validation.status === "warning" ? (
                                  <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
                                    El borrador puede ser válido, pero requiere revisión manual antes de publicarse.
                                  </p>
                                ) : null}

                                {validation.possibleDuplicates.length ? (
                                  <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
                                    <p className="text-xs font-bold uppercase tracking-wide text-amber-100">Posibles duplicados</p>
                                    <ul className="mt-2 space-y-2 text-sm text-amber-50/90">
                                      {validation.possibleDuplicates.map((duplicate) => (
                                        <li className="rounded-md bg-black/20 p-2" key={duplicate.id}>
                                          <strong className="block text-white">{duplicate.title}</strong>
                                          <span className="block text-xs text-amber-50/75">
                                            {duplicate.startDate} · {[duplicate.city, duplicate.province].filter(Boolean).join(", ") || "Ubicación pendiente"} · {duplicate.reason}
                                          </span>
                                          {duplicate.slug ? <span className="mt-1 block break-all text-xs text-amber-100/80">/evento/{duplicate.slug}</span> : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Publicación controlada</p>
                                      <h5 className="mt-1 text-base font-semibold text-white">Publicar evento desde este borrador</h5>
                                      <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                                        Esta acción inserta un evento nuevo visible en EventoMotor. No modifica eventos existentes.
                                      </p>
                                      {!validation ? <p className="mt-2 text-sm text-amber-100">Valida el borrador antes de publicar.</p> : null}
                                      {validation && hasExactSlugDuplicate(validation) ? <p className="mt-2 text-sm text-red-200">Ya existe un evento con este slug.</p> : null}
                                      {alreadyPublished(submission) ? <p className="mt-2 text-sm text-emerald-100">Esta solicitud ya figura como publicada/importada.</p> : null}
                                      {publishWarning ? <p className="mt-2 text-sm text-amber-100">{publishWarning}</p> : null}
                                    </div>
                                    <button
                                      className="rounded-md border border-red-300/30 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-50 hover:border-red-200/60 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-white/[0.04] disabled:text-zinc-500"
                                      disabled={publishBlocked || publishingId === submission.id}
                                      onClick={() => handlePublishDraft(submission)}
                                      type="button"
                                    >
                                      {publishingId === submission.id ? "Publicando" : "Publicar evento"}
                                    </button>
                                  </div>

                                  {publishResult ? (
                                    <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
                                      <p className="text-sm font-bold text-emerald-100">Evento publicado correctamente</p>
                                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Link className="break-all text-sm text-emerald-50 underline decoration-emerald-200/40 underline-offset-4 hover:text-white" href={publishResult.eventUrl}>
                                          {publishResult.eventUrl}
                                        </Link>
                                        <button
                                          className="w-fit rounded-md border border-emerald-200/30 bg-black/20 px-3 py-1.5 text-xs font-bold text-emerald-50 hover:bg-emerald-300/10"
                                          onClick={() => handleCopyEventUrl(submission)}
                                          type="button"
                                        >
                                          Copiar enlace
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {!validation ? (
                              <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Publicación controlada</p>
                                    <h5 className="mt-1 text-base font-semibold text-white">Publicar evento desde este borrador</h5>
                                    <p className="mt-2 text-sm text-amber-100">Valida el borrador antes de publicar.</p>
                                  </div>
                                  <button
                                    className="rounded-md border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-bold text-zinc-500"
                                    disabled
                                    type="button"
                                  >
                                    Publicar evento
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </section>
                        );
                      })()
                    : null}
                </article>
              ) : null,
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
