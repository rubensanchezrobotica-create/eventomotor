"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  EVENT_CANDIDATE_STATUSES,
  type EventCandidate,
  type EventCandidateStatus,
} from "@/lib/event-candidates/types";

type CandidatesResponse =
  | { ok: true; candidates: EventCandidate[] }
  | { ok: false; error: string };

type CandidateMutationResponse =
  | { ok: true; candidate: EventCandidate }
  | { ok: false; error: string };

const STATUS_LABELS: Record<EventCandidateStatus, string> = {
  pending_review: "Pendiente",
  needs_info: "Necesita info",
  approved: "Aprobado",
  rejected: "Rechazado",
  duplicate: "Duplicado",
  published: "Publicado",
};

const REVIEW_STATUSES = EVENT_CANDIDATE_STATUSES.filter((status) => status !== "published");

function statusClass(status: EventCandidateStatus) {
  if (status === "approved") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "rejected" || status === "duplicate") return "border-red-300/25 bg-red-300/10 text-red-100";
  if (status === "needs_info") return "border-sky-300/25 bg-sky-300/10 text-sky-100";
  if (status === "published") return "border-purple-300/25 bg-purple-300/10 text-purple-100";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatScore(value: number | null) {
  if (value === null || value === undefined) return "0";
  return Number(value).toFixed(2);
}

function place(candidate: EventCandidate) {
  return [candidate.city, candidate.province, candidate.country].filter(Boolean).join(" / ") || "Sin ubicacion";
}

function sourceDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export default function EventCandidatesAdminPage() {
  const [secret, setSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EventCandidateStatus | "all">("pending_review");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<EventCandidate[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, EventCandidateStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const counts = useMemo(() => {
    return candidates.reduce<Record<string, number>>((result, candidate) => {
      result[candidate.status] = (result[candidate.status] || 0) + 1;
      return result;
    }, {});
  }, [candidates]);

  async function loadCandidates(adminSecret = secret, nextStatus = statusFilter) {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const params = new URLSearchParams();
      params.set("status", nextStatus);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/event-candidates?${params.toString()}`, {
        headers: {
          authorization: `Bearer ${adminSecret}`,
        },
      });
      const payload = (await response.json()) as CandidatesResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudieron cargar candidatos." : payload.error);
      }

      setCandidates(payload.candidates);
      setReviewNotes(
        payload.candidates.reduce<Record<string, string>>((result, candidate) => {
          result[candidate.id] = candidate.review_notes || "";
          return result;
        }, {}),
      );
      setStatusDrafts(
        payload.candidates.reduce<Record<string, EventCandidateStatus>>((result, candidate) => {
          result[candidate.id] = candidate.status;
          return result;
        }, {}),
      );
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
    await loadCandidates();
  }

  async function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCandidates();
  }

  async function handleStatusFilter(status: EventCandidateStatus) {
    setStatusFilter(status);
    await loadCandidates(secret, status);
  }

  async function updateCandidate(candidate: EventCandidate) {
    const nextStatus = statusDrafts[candidate.id] || candidate.status;
    const nextNotes = reviewNotes[candidate.id] || "";

    setUpdatingId(candidate.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/event-candidates/${candidate.id}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          review_notes: nextNotes,
        }),
      });
      const payload = (await response.json()) as CandidateMutationResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudo actualizar el candidato." : payload.error);
      }

      setCandidates((current) =>
        current.map((item) => (item.id === payload.candidate.id ? payload.candidate : item)),
      );
      setReviewNotes((current) => ({ ...current, [payload.candidate.id]: payload.candidate.review_notes || "" }));
      setStatusDrafts((current) => ({ ...current, [payload.candidate.id]: payload.candidate.status }));
      setNotice(`Candidato actualizado: ${payload.candidate.normalized_title}`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-300">EventoMotor Admin</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Candidatos de eventos</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Revisión manual de candidatos aislados del calendario público. Esta pantalla no publica eventos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/5" href="/admin">
              Eventos
            </Link>
            <Link className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/5" href="/admin/event-submissions">
              Solicitudes
            </Link>
          </div>
        </header>

        {!isAuthenticated ? (
          <form className="max-w-lg rounded-xl border border-white/10 bg-white/[0.04] p-5" onSubmit={handleLogin}>
            <label className="block text-sm font-semibold text-zinc-200" htmlFor="admin-secret">
              ADMIN_SECRET
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                className="min-h-10 flex-1 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-orange-300/60"
                id="admin-secret"
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Introduce ADMIN_SECRET"
                type="password"
                value={secret}
              />
              <button
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-60"
                disabled={isLoading || !secret.trim()}
                type="submit"
              >
                {isLoading ? "Entrando" : "Entrar"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {EVENT_CANDIDATE_STATUSES.map((status) => (
                <button
                  className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                    statusFilter === status ? statusClass(status) : "border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                  disabled={isLoading}
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  type="button"
                >
                  <span className="block text-xs font-bold uppercase tracking-wide">{STATUS_LABELS[status]}</span>
                  <strong className="mt-1 block text-xl">{counts[status] || 0}</strong>
                </button>
              ))}
            </section>

            <form className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-[220px_1fr_auto]" onSubmit={handleFilter}>
              <select
                className="min-h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
                onChange={(event) => setStatusFilter(event.target.value as EventCandidateStatus | "all")}
                value={statusFilter}
              >
                <option value="all">Todos los estados</option>
                {EVENT_CANDIDATE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <input
                className="min-h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por título, fuente, ciudad o provincia"
                type="search"
                value={query}
              />
              <button
                className="rounded-md border border-orange-300/30 bg-orange-500/15 px-4 py-2 text-sm font-bold text-orange-50 hover:bg-orange-500/25 disabled:opacity-60"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Cargando" : "Actualizar"}
              </button>
            </form>

            {notice ? <p className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
          </>
        )}

        {error ? <p className="rounded-md border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}

        {isAuthenticated ? (
          <section className="space-y-4">
            {candidates.length ? (
              candidates.map((candidate) => (
                <article className="rounded-xl border border-white/10 bg-white/[0.035] p-4" key={candidate.id}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(candidate.status)}`}>
                          {STATUS_LABELS[candidate.status]}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-zinc-300">
                          {formatDate(candidate.start_date)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-bold text-white">{candidate.normalized_title}</h2>
                      <p className="mt-1 text-sm text-zinc-400">{place(candidate)}</p>
                      <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                        <p>
                          <span className="text-zinc-500">Categoría:</span>{" "}
                          {candidate.category || "Sin categoria"}
                        </p>
                        <p>
                          <span className="text-zinc-500">Disciplina:</span>{" "}
                          {candidate.discipline || "Sin disciplina"}
                        </p>
                        <p>
                          <span className="text-zinc-500">Quality:</span> {formatScore(candidate.quality_score)}
                        </p>
                        <p>
                          <span className="text-zinc-500">Duplicate:</span> {formatScore(candidate.duplicate_score)}
                        </p>
                      </div>
                      <a
                        className="mt-3 inline-block break-all text-sm font-semibold text-orange-200 underline decoration-orange-200/30 underline-offset-4 hover:text-orange-100"
                        href={candidate.source_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {sourceDomain(candidate.source_url)}
                      </a>
                      {candidate.duplicate_reason ? (
                        <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                          {candidate.duplicate_reason}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500" htmlFor={`status-${candidate.id}`}>
                        Estado
                      </label>
                      <select
                        className="mt-2 min-h-10 w-full rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none"
                        id={`status-${candidate.id}`}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [candidate.id]: event.target.value as EventCandidateStatus,
                          }))
                        }
                        value={statusDrafts[candidate.id] || candidate.status}
                      >
                        {REVIEW_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>

                      <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-zinc-500" htmlFor={`notes-${candidate.id}`}>
                        Nota de revisión
                      </label>
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none"
                        id={`notes-${candidate.id}`}
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [candidate.id]: event.target.value,
                          }))
                        }
                        placeholder="Añade una nota para el equipo"
                        value={reviewNotes[candidate.id] || ""}
                      />

                      <button
                        className="mt-3 w-full rounded-md border border-emerald-300/30 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-50 hover:bg-emerald-500/25 disabled:opacity-60"
                        disabled={updatingId === candidate.id}
                        onClick={() => updateCandidate(candidate)}
                        type="button"
                      >
                        {updatingId === candidate.id ? "Guardando" : "Guardar revisión"}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-8 text-center text-zinc-400">
                {isLoading ? "Cargando candidatos." : "No hay candidatos con este filtro."}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
