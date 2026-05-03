"use client";

import { FormEvent, useMemo, useState } from "react";

type AdminEvent = {
  id: string;
  title: string;
  discipline: string | null;
  start_date: string;
  venue: string | null;
  city: string | null;
  province: string | null;
  source: string | null;
  featured: boolean | null;
};

type EventsResponse =
  | { ok: true; events: AdminEvent[] }
  | { ok: false; error: string };

type PatchResponse =
  | { ok: true; event: AdminEvent }
  | { ok: false; error: string };

function matchesSearch(event: AdminEvent, search: string) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [event.title, event.discipline, event.city]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [search, setSearch] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filteredEvents = useMemo(
    () => events.filter((event) => matchesSearch(event, search)),
    [events, search],
  );

  async function loadEvents(adminSecret = secret) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/events", {
        headers: {
          authorization: `Bearer ${adminSecret}`,
        },
      });
      const payload = (await response.json()) as EventsResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudieron cargar los eventos." : payload.error);
      }

      setEvents(payload.events);
      setIsAuthenticated(true);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);

      setError(message);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadEvents();
  }

  async function toggleFeatured(event: AdminEvent) {
    setUpdatingId(event.id);
    setError("");

    try {
      const response = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: event.id, featured: !event.featured }),
      });
      const payload = (await response.json()) as PatchResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudo actualizar el evento." : payload.error);
      }

      setEvents((currentEvents) =>
        currentEvents.map((currentEvent) =>
          currentEvent.id === payload.event.id ? payload.event : currentEvent,
        ),
      );
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : String(updateError);

      setError(message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-red-400">EventoMotor</p>
            <h1 className="text-2xl font-semibold text-white">Admin de eventos</h1>
          </div>
          {isAuthenticated ? (
            <button
              className="w-fit rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
              onClick={() => loadEvents()}
              type="button"
            >
              Refrescar
            </button>
          ) : null}
        </header>

        <section className="border-b border-zinc-800 pb-5">
          <form className="flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={handleLogin}>
            <input
              className="min-h-11 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-400"
              onChange={(event) => setSecret(event.target.value)}
              placeholder="ADMIN_SECRET"
              type="password"
              value={secret}
            />
            <button
              className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
              disabled={isLoading || !secret.trim()}
              type="submit"
            >
              {isLoading ? "Cargando" : "Entrar"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        </section>

        {isAuthenticated ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-400 sm:max-w-md"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por titulo, disciplina o ciudad"
                type="search"
                value={search}
              />
              <p className="text-sm text-zinc-400">
                {filteredEvents.length} de {events.length} eventos
              </p>
            </div>

            <div className="overflow-x-auto border border-zinc-800">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="px-3 py-3 font-medium">Title</th>
                    <th className="px-3 py-3 font-medium">Discipline</th>
                    <th className="px-3 py-3 font-medium">Start</th>
                    <th className="px-3 py-3 font-medium">Venue</th>
                    <th className="px-3 py-3 font-medium">City</th>
                    <th className="px-3 py-3 font-medium">Province</th>
                    <th className="px-3 py-3 font-medium">Source</th>
                    <th className="px-3 py-3 font-medium">Featured</th>
                    <th className="px-3 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredEvents.map((event) => (
                    <tr className="align-top hover:bg-zinc-900/70" key={event.id}>
                      <td className="max-w-sm px-3 py-3 font-medium text-white">{event.title}</td>
                      <td className="px-3 py-3 text-zinc-300">{event.discipline || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-300">
                        {event.start_date}
                      </td>
                      <td className="px-3 py-3 text-zinc-300">{event.venue || "-"}</td>
                      <td className="px-3 py-3 text-zinc-300">{event.city || "-"}</td>
                      <td className="px-3 py-3 text-zinc-300">{event.province || "-"}</td>
                      <td className="px-3 py-3 text-zinc-300">{event.source || "-"}</td>
                      <td className="px-3 py-3 text-zinc-300">
                        {event.featured ? "Si" : "No"}
                      </td>
                      <td className="flex min-w-52 gap-2 px-3 py-3">
                        <button
                          className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={updatingId === event.id}
                          onClick={() => toggleFeatured(event)}
                          type="button"
                        >
                          {event.featured ? "Desmarcar" : "Marcar"}
                        </button>
                        <button
                          className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-500"
                          disabled
                          title="TODO: implementar cuando exista el campo visible en public.events"
                          type="button"
                        >
                          Ocultar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
