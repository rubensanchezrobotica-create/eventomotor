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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  reviewed: "Revisada",
  rejected: "Rechazada",
  imported: "Importada",
  spam: "Spam",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  reviewed: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  rejected: "border-red-300/20 bg-red-300/10 text-red-100",
  imported: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  spam: "border-zinc-300/20 bg-zinc-300/10 text-zinc-200",
};

function formatDateRange(submission: AdminSubmission) {
  if (!submission.start_date && !submission.end_date) return "Fecha pendiente";
  if (!submission.end_date || submission.end_date === submission.start_date) return submission.start_date || submission.end_date;
  return `${submission.start_date} - ${submission.end_date}`;
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

export default function AdminSubmissionsPage() {
  const [secret, setSecret] = useState("");
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

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
        headers: {
          authorization: `Bearer ${adminSecret}`,
        },
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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSubmissions();
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[94rem] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400/90">EventoMotor</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Solicitudes de eventos</h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              Revisión en solo lectura de eventos enviados desde /publicar-evento.
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
                Refrescar solicitudes
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
          <>
            <section className="rounded-lg border border-white/[0.07] bg-[#111216] p-3.5">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Solicitudes recibidas</h2>
                  <p className="text-xs text-zinc-500">
                    Mostrando {filteredSubmissions.length} de {submissions.length}. Esta vista no publica ni modifica solicitudes.
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
                  <option value="rejected">Rejected ({counts.rejected || 0})</option>
                  <option value="imported">Imported ({counts.imported || 0})</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-zinc-500">
                      <th className="border-b border-white/[0.08] px-3 py-2">Evento</th>
                      <th className="border-b border-white/[0.08] px-3 py-2">Fecha</th>
                      <th className="border-b border-white/[0.08] px-3 py-2">Ubicación</th>
                      <th className="border-b border-white/[0.08] px-3 py-2">Disciplina</th>
                      <th className="border-b border-white/[0.08] px-3 py-2">Fuente</th>
                      <th className="border-b border-white/[0.08] px-3 py-2">Contacto</th>
                      <th className="border-b border-white/[0.08] px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((submission) => (
                      <tr className="align-top hover:bg-white/[0.025]" key={submission.id}>
                        <td className="border-b border-white/[0.05] px-3 py-3">
                          <strong className="block text-white">{submission.event_name}</strong>
                          <span className="mt-1 block text-xs text-zinc-500">{submission.venue || "Recinto pendiente"}</span>
                        </td>
                        <td className="border-b border-white/[0.05] px-3 py-3 text-zinc-300">{formatDateRange(submission)}</td>
                        <td className="border-b border-white/[0.05] px-3 py-3 text-zinc-300">{place(submission)}</td>
                        <td className="border-b border-white/[0.05] px-3 py-3">
                          <span className="block text-zinc-200">{submission.discipline || "Sin disciplina"}</span>
                          <span className="mt-1 block text-xs text-zinc-500">{submission.vehicle_type || "Sin tipo"}</span>
                        </td>
                        <td className="max-w-[210px] border-b border-white/[0.05] px-3 py-3">
                          <a className="break-words text-red-200 underline decoration-red-200/30 underline-offset-4 hover:text-white" href={submission.source_url} rel="noreferrer" target="_blank">
                            source_url
                          </a>
                          {submission.ticket_url ? (
                            <a className="mt-1 block break-words text-xs text-zinc-400 underline decoration-white/20 underline-offset-4 hover:text-white" href={submission.ticket_url} rel="noreferrer" target="_blank">
                              entradas
                            </a>
                          ) : null}
                        </td>
                        <td className="border-b border-white/[0.05] px-3 py-3">
                          <a className="block text-zinc-100 hover:text-red-200" href={`mailto:${submission.contact_email}`}>
                            {submission.contact_email}
                          </a>
                          <span className="mt-1 block text-xs text-zinc-500">{submission.organizer_name || "Organizador pendiente"}</span>
                          {submission.contact_phone ? <span className="mt-1 block text-xs text-zinc-500">{submission.contact_phone}</span> : null}
                        </td>
                        <td className="border-b border-white/[0.05] px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(submission.status)}`}>
                            {statusLabel(submission.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!filteredSubmissions.length ? (
                <p className="py-8 text-center text-sm text-zinc-500">No hay solicitudes con este filtro.</p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
