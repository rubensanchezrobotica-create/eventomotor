"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

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

const STATUS_OPTIONS = ["pending", "reviewed", "published", "discarded"] as const;

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

function place(submission: AdminSubmission) {
  return [submission.city, submission.province].filter(Boolean).join(", ") || "Ubicación pendiente";
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
                <option value="published">Published ({counts.published || 0})</option>
                <option value="discarded">Discarded ({counts.discarded || 0})</option>
                <option value="imported">Imported ({counts.imported || 0})</option>
                <option value="rejected">Rejected ({counts.rejected || 0})</option>
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
                </article>
              ) : null,
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
