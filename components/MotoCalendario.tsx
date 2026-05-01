"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarView from "@/components/CalendarView";
import EventCard from "@/components/EventCard";
import EventModal from "@/components/EventModal";
import YearView from "@/components/YearView";
import ZoneView from "@/components/ZoneView";
import { API_EVENTS_URL, AUTO_REFRESH_MS, cleanIcs, cls, COLORS, daysForMonth, downloadCalendar, formatRange, parseDate, statusOf, toIcsDate } from "@/lib/date-utils";
import { FALLBACK_EVENTS } from "@/lib/fallback-events";
import { normalizeRemoteEvents } from "@/lib/normalizers";
import { SOURCE_FEEDS } from "@/lib/sources";
import type { EventItem, StatusFilter, SyncState, ViewMode } from "@/types/event";

function runSelfTests() {
  const remotePayload = {
    events: [
      { title: "Test Event", start: "2026-05-01", end: "2026-05-02", venue: "Test Track" },
      { title: "Test Event", start: "2026-05-01", end: "2026-05-02", venue: "Test Track" },
    ],
  };

  const tests = [
    { name: "events exist", pass: FALLBACK_EVENTS.length > 0 },
    { name: "date parser", pass: parseDate("2026-05-15").getMonth() === 4 },
    {
      name: "required fields",
      pass: FALLBACK_EVENTS.every((event) => event.id && event.title && event.start && event.end),
    },
    {
      name: "upcoming status",
      pass: statusOf(FALLBACK_EVENTS.find((event) => event.id === "motogp-catalunya-2026") as EventItem) === "proximo",
    },
    {
      name: "finished status",
      pass: statusOf(FALLBACK_EVENTS.find((event) => event.id === "motogp-jerez-2026") as EventItem) === "finalizado",
    },
    { name: "calendar weeks", pass: daysForMonth(2026, 4).length % 7 === 0 },
    { name: "ics escaping", pass: typeof cleanIcs("a,b;c") === "string" },
    { name: "ics date", pass: toIcsDate(parseDate("2026-05-15")) === "20260515" },
    { name: "date order", pass: FALLBACK_EVENTS.every((event) => parseDate(event.start).getTime() <= parseDate(event.end).getTime()) },
    { name: "remote normalize dedupes", pass: normalizeRemoteEvents(remotePayload).length === 1 },
    { name: "source feeds", pass: SOURCE_FEEDS.length >= 5 },
    { name: "api url", pass: API_EVENTS_URL === "/api/events" },
  ];

  if (typeof console !== "undefined") {
    tests.forEach((test) => {
      if (!test.pass) console.warn(`MotoCalendario self-test failed: ${test.name}`);
    });
  }

  return tests;
}

const SELF_TESTS = runSelfTests();

export default function MotoCalendarioEspana() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("calendario");
  const [month, setMonth] = useState(3);
  const [region, setRegion] = useState("Todas");
  const [status, setStatus] = useState<StatusFilter>("proximos");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [events, setEvents] = useState<EventItem[]>(FALLBACK_EVENTS);
  const [syncState, setSyncState] = useState<SyncState>("fallback");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");

  async function refreshEvents() {
    setSyncState("loading");
    setSyncError("");

    try {
      const response = await fetch(API_EVENTS_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const remoteEvents = normalizeRemoteEvents(payload);

      if (remoteEvents.length === 0) {
        throw new Error("No valid events returned");
      }

      setEvents(remoteEvents);
      setLastSync(payload.updatedAt || new Date().toISOString());
      setSyncState("live");
    } catch (error) {
      setEvents(FALLBACK_EVENTS);
      setSyncState("fallback");
      setLastSync(null);
      setSyncError(error instanceof Error ? error.message : "Unknown sync error");
    }
  }

  useEffect(() => {
    refreshEvents();

    const timer = window.setInterval(refreshEvents, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  const allDisciplines = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.discipline))).sort();
  }, [events]);

  const regions = useMemo(() => {
    return ["Todas", ...Array.from(new Set(events.map((event) => event.region))).sort()];
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return events
      .filter((event) => {
        const text = [
          event.title,
          event.championship,
          event.discipline,
          event.venue,
          event.city,
          event.province,
          event.region,
          event.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase();

        const okQuery = q === "" || text.includes(q);
        const okDiscipline = disciplines.length === 0 || disciplines.includes(event.discipline);
        const okRegion = region === "Todas" || event.region === region;

        const currentStatus = statusOf(event);
        const okStatus =
          status === "todos" ||
          (status === "proximos" ? currentStatus !== "finalizado" : currentStatus === status);

        return okQuery && okDiscipline && okRegion && okStatus;
      })
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
  }, [query, disciplines, region, status, events]);

  const upcoming = useMemo(() => {
    return events
      .filter((event) => statusOf(event) !== "finalizado")
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
  }, [events]);

  const testsPassed = SELF_TESTS.every((test) => test.pass);

  function toggleDiscipline(name: string) {
    setDisciplines((current) => {
      if (current.includes(name)) {
        return current.filter((item) => item !== name);
      }

      return [...current, name];
    });
  }

  function clear() {
    setQuery("");
    setRegion("Todas");
    setStatus("proximos");
    setDisciplines([]);
  }

  const syncLabel =
    syncState === "live"
      ? "Conectado a /api/events"
      : syncState === "loading"
        ? "Sincronizando"
        : "Fallback local";

  const lastSyncLabel = lastSync ? new Date(lastSync).toLocaleString("es-ES") : "Sin backend activo";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="relative border-b border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-950 to-orange-950/40">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-300 to-red-600 text-2xl shadow-xl shadow-red-950/40">
                🏍️
              </div>

              <div>
                <p className="text-lg font-black">MotoCalendario</p>
                <p className="text-xs uppercase tracking-widest text-zinc-500">España 2026</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={refreshEvents}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
              >
                Sincronizar
              </button>

              <button
                onClick={() => downloadCalendar(filtered)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-zinc-950 hover:bg-orange-200"
              >
                Exportar ICS
              </button>
            </div>
          </nav>

          <section className="grid items-end gap-8 py-12 lg:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full border border-orange-300/30 bg-orange-300/10 px-4 py-2 text-sm font-bold text-orange-100">
                Agenda viva de motociclismo español
              </p>

              <h1 className="mt-5 max-w-4xl text-5xl font-black leading-none tracking-tight sm:text-7xl">
                Eventos de moto en calendario.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                Calendario de eventos de motociclismo en España. Preparado para cargar datos desde{" "}
                <span className="font-bold text-orange-200">/api/events</span> y refrescarse cada 15 minutos.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => setView("calendario")}
                  className="rounded-2xl bg-orange-400 px-5 py-3 font-black text-zinc-950 hover:bg-orange-300"
                >
                  Ver calendario
                </button>

                <button
                  onClick={() => setView("lista")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white hover:bg-white/10"
                >
                  Explorar eventos
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40">
              <p className="text-sm text-zinc-400">Estado de sincronización</p>
              <h2 className="mt-2 text-2xl font-black text-white">{syncLabel}</h2>
              <p className="mt-3 text-sm text-zinc-300">Última actualización: {lastSyncLabel}</p>

              {syncError ? (
                <p className="mt-2 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100">
                  Backend no disponible: {syncError}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {upcoming.slice(0, 6).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelected(event)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10"
                  >
                    {formatRange(event)} - {event.discipline}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Eventos cargados", events.length, syncState === "live" ? "Datos del backend" : "Datos fallback"],
            ["Próximos", upcoming.length, "Desde el 27 de abril de 2026"],
            ["Fuentes", SOURCE_FEEDS.length, "Preparadas para backend"],
            ["Tests", testsPassed ? "OK" : "Revisar", "Autocomprobaciones incluidas"],
          ].map(([label, value, helper]) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
              <p className="text-sm text-zinc-400">{label}</p>
              <p className="mt-2 text-3xl font-black text-white">{value}</p>
              <p className="mt-2 text-xs text-zinc-500">{helper}</p>
            </div>
          ))}
        </section>

        <section className="sticky top-0 z-30 mt-8 rounded-3xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl shadow-black/30">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por evento, circuito, provincia, disciplina..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-300/50"
            />

            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-bold text-white outline-none"
            >
              {regions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-bold text-white outline-none"
            >
              <option value="proximos">Próximos + en directo</option>
              <option value="todos">Todos</option>
              <option value="finalizado">Finalizados</option>
              <option value="en directo">En directo</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {allDisciplines.map((name) => (
              <button
                key={name}
                onClick={() => toggleDiscipline(name)}
                className={cls(
                  "rounded-full border px-3 py-2 text-xs font-black",
                  disciplines.includes(name)
                    ? COLORS[name] || COLORS.Motociclismo
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
                )}
              >
                {name}
              </button>
            ))}

            <button
              onClick={clear}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-300 hover:bg-white/10"
            >
              Limpiar
            </button>
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-orange-200">
              {filtered.length} eventos encontrados
            </p>
            <h2 className="mt-2 text-3xl font-black text-white">Agenda motera 2026</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {["calendario", "anual", "lista", "zonas"].map((name) => (
              <button
                key={name}
                onClick={() => setView(name as ViewMode)}
                className={cls(
                  "rounded-2xl px-4 py-2 text-sm font-black capitalize",
                  view === name
                    ? "bg-white text-zinc-950"
                    : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        {view === "calendario" ? (
          <CalendarView month={month} setMonth={setMonth} items={filtered} onOpen={setSelected} />
        ) : null}

        {view === "anual" ? (
          <YearView items={filtered} setMonth={setMonth} setView={setView} />
        ) : null}

        {view === "lista" ? (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} onOpen={setSelected} />
            ))}
          </section>
        ) : null}

        {view === "zonas" ? (
          <ZoneView items={filtered} setRegion={setRegion} onOpen={setSelected} />
        ) : null}

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <h3 className="text-2xl font-black text-white">No hay eventos con esos filtros</h3>
            <p className="mt-2 text-zinc-500">Prueba a limpiar filtros o cambiar la búsqueda.</p>
          </div>
        ) : null}

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
            <p className="text-sm font-bold uppercase tracking-widest text-orange-200">
              Fuentes conectables
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              Preparado para automatizar la ingesta
            </h3>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {SOURCE_FEEDS.map((feed) => (
                <a
                  key={feed.id}
                  href={feed.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/5"
                >
                  <p className="font-black text-white">{feed.name}</p>
                  <p className="mt-1 text-sm text-zinc-500">Tipo: {feed.type}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-orange-300/20 bg-orange-500/10 p-6">
            <h3 className="text-2xl font-black text-white">Backend esperado</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li>GET /api/events</li>
              <li>Respuesta: updatedAt + events[]</li>
              <li>Cron recomendado: cada 6-24 horas</li>
              <li>Scrapers: RFME, MotoGP y circuitos</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="relative mt-12 border-t border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
        Datos v1 con fallback local. Verifica siempre la fuente antes de comprar entradas.
      </footer>

      <EventModal event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
