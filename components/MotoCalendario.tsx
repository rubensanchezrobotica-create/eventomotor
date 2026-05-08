"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import CalendarView from "@/components/CalendarView";
import EventCard from "@/components/EventCard";
import EventModal from "@/components/EventModal";
import YearView from "@/components/YearView";
import ZoneView from "@/components/ZoneView";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import {
  API_EVENTS_URL,
  AUTO_REFRESH_MS,
  TODAY,
  cls,
  downloadCalendar,
  formatRange,
  getDisciplineColor,
  parseDate,
  statusOf,
} from "@/lib/date-utils";
import { matchesVehicleFilter } from "@/lib/event-classification";
import { normalizeRemoteEvents } from "@/lib/normalizers";
import { createEventSlug } from "@/lib/slug";
import type { EventItem, StatusFilter, ViewMode } from "@/types/event";

const QUICK_CHIPS = ["Trackdays", "Motocross", "Competición", "Concentraciones", "Ferias", "Rutas"];

const VEHICLE_FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "moto", label: "Motos" },
  { id: "coche", label: "Coches" },
] as const;

const INTENTIONS = [
  {
    label: "Quiero rodar",
    description: "Tandas, circuitos y velocidad",
    terms: ["trackday", "trackdays", "velocidad", "minivelocidad"],
  },
  {
    label: "Quiero competir",
    description: "Parrillas, campeonatos y pruebas",
    terms: ["motogp", "superbike", "juniorgp", "velocidad", "competicion", "competición"],
  },
  {
    label: "Quiero ver carreras",
    description: "Planes para vivir la competición",
    terms: ["motogp", "superbike", "juniorgp", "velocidad", "carreras"],
  },
  {
    label: "Quiero ruta",
    description: "Salidas, mototurismo y escapadas",
    terms: ["ruta", "rutas", "mototurismo"],
  },
  {
    label: "Quiero tierra",
    description: "Motocross, enduro, trial y campo",
    terms: ["motocross", "enduro", "trial", "cross country", "hard enduro"],
  },
  {
    label: "Quiero ferias/concentraciones",
    description: "Encuentros, ferias y clásicos",
    terms: ["feria", "ferias", "concentracion", "concentración", "concentraciones", "clasicos", "clásicos"],
  },
];

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    if (value) {
      acc[value] = (acc[value] || 0) + 1;
    }

    return acc;
  }, {});
}

function eventText(event: EventItem) {
  return [
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
}

export default function MotoCalendarioEspana() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("lista");
  const [month, setMonth] = useState(TODAY.getMonth());
  const [calendarYear, setCalendarYear] = useState(TODAY.getFullYear());
  const [place, setPlace] = useState("Todas");
  const [status, setStatus] = useState<StatusFilter>("proximos");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<(typeof VEHICLE_FILTERS)[number]["id"]>("todos");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshEvents() {
    try {
      const response = await fetch(API_EVENTS_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudieron cargar eventos");
      }

      const payload = await response.json();
      setEvents(normalizeRemoteEvents(payload));
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshEvents();

    const timer = window.setInterval(refreshEvents, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  const vehicleEvents = useMemo(() => {
    return events.filter((event) => matchesVehicleFilter(event, vehicleFilter));
  }, [events, vehicleFilter]);

  const upcoming = useMemo(() => {
    return vehicleEvents
      .filter((event) => statusOf(event) !== "finalizado")
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
  }, [vehicleEvents]);

  useEffect(() => {
    const firstUpcoming = upcoming[0];

    if (firstUpcoming) {
      const date = parseDate(firstUpcoming.start);
      setMonth(date.getMonth());
      setCalendarYear(date.getFullYear());
    }
  }, [upcoming]);

  const allDisciplines = useMemo(() => uniqueSorted(vehicleEvents.map((event) => event.discipline)), [vehicleEvents]);
  const regions = useMemo(() => uniqueSorted(vehicleEvents.map((event) => event.region)), [vehicleEvents]);
  const provinces = useMemo(() => uniqueSorted(vehicleEvents.map((event) => event.province)), [vehicleEvents]);

  const placeOptions = useMemo(() => {
    return [
      { value: "Todas", label: "Toda España" },
      ...regions.map((name) => ({ value: `region:${name}`, label: name })),
      ...provinces.map((name) => ({ value: `province:${name}`, label: name })),
    ];
  }, [provinces, regions]);

  const provinceCounts = useMemo(() => {
    return Object.entries(countBy(vehicleEvents.map((event) => event.province))).sort((a, b) => b[1] - a[1]);
  }, [vehicleEvents]);

  const featuredEvents = useMemo(() => {
    const featured = upcoming.filter((event) => event.featured);
    return (featured.length >= 3 ? featured : [...featured, ...upcoming.filter((event) => !event.featured)]).slice(0, 4);
  }, [upcoming]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return vehicleEvents
      .filter((event) => {
        const okQuery = q === "" || eventText(event).includes(q);
        const okDiscipline = disciplines.length === 0 || disciplines.includes(event.discipline);
        const okPlace =
          place === "Todas" ||
          (place.startsWith("region:") && event.region === place.replace("region:", "")) ||
          (place.startsWith("province:") && event.province === place.replace("province:", ""));
        const currentStatus = statusOf(event);
        const okStatus =
          status === "todos" ||
          (status === "proximos" ? currentStatus !== "finalizado" : currentStatus === status);

        return okQuery && okDiscipline && okPlace && okStatus;
      })
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
  }, [query, disciplines, place, status, vehicleEvents]);

  const stats = useMemo(() => {
    return [
      { label: "eventos visibles", value: vehicleEvents.length },
      { label: "provincias", value: provinces.length },
      { label: "disciplinas", value: allDisciplines.length },
      { label: "próximos", value: upcoming.length },
    ].filter((item) => item.value > 0);
  }, [allDisciplines.length, provinces.length, upcoming.length, vehicleEvents.length]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (query.trim()) count += 1;
    if (vehicleFilter !== "todos") count += 1;
    if (place !== "Todas") count += 1;
    if (status !== "proximos") count += 1;
    count += disciplines.length;

    return count;
  }, [disciplines.length, place, query, status, vehicleFilter]);

  function scrollToResults() {
    window.setTimeout(() => {
      document.getElementById("eventos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function navigateToView(nextView: ViewMode) {
    setView(nextView);
    scrollToResults();
  }

  function toggleDiscipline(name: string) {
    setDisciplines((current) => {
      if (current.includes(name)) {
        return current.filter((item) => item !== name);
      }

      return [...current, name];
    });
  }

  function applyTerms(label: string, terms: string[]) {
    const matches = allDisciplines.filter((discipline) => {
      const normalized = discipline.toLowerCase();
      return terms.some((term) => normalized.includes(term.toLowerCase()));
    });

    setQuery(matches.length ? "" : label);
    setDisciplines(matches);
    setStatus("proximos");
    setView("lista");
    scrollToResults();
  }

  function applyProvince(name: string) {
    setPlace(`province:${name}`);
    setView("lista");
    scrollToResults();
  }

  function clear() {
    setQuery("");
    setVehicleFilter("todos");
    setPlace("Todas");
    setStatus("proximos");
    setDisciplines([]);
  }

  function scrollToZones() {
    document.getElementById("zonas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#0D0D0F] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0D0D0F]/86 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" aria-label="EventoMotor inicio">
            <EventomotorLogo tone="white" className="max-w-[13rem] sm:max-w-none" />
          </Link>

          <div className="hidden items-center rounded-full border border-white/[0.06] bg-white/[0.025] p-1 text-sm font-medium text-[#A6A6A6] md:flex">
            {[
              ["calendario", "Calendario"],
              ["lista", "Eventos"],
              ["zonas", "Zonas"],
            ].map(([targetView, label]) => (
              <button
                className={cls(
                  "rounded-full px-3 py-1.5 transition",
                  view === targetView ? "bg-white/[0.08] text-white" : "hover:text-white",
                )}
                key={targetView}
                onClick={() => navigateToView(targetView as ViewMode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <a
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-semibold text-white transition hover:border-red-500/35 hover:bg-red-500/[0.06]"
            href="#organizadores"
          >
            Publica tu evento
          </a>

          <div className="flex w-full items-center rounded-full border border-white/[0.06] bg-white/[0.025] p-1 text-sm font-medium text-[#A6A6A6] md:hidden">
            {[
              ["calendario", "Calendario"],
              ["lista", "Eventos"],
              ["zonas", "Zonas"],
            ].map(([targetView, label]) => (
              <button
                className={cls(
                  "flex-1 rounded-full px-3 py-1.5 transition",
                  view === targetView ? "bg-white/[0.08] text-white" : "hover:text-white",
                )}
                key={targetView}
                onClick={() => navigateToView(targetView as ViewMode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <section className="relative border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(225,6,0,0.16),transparent_35%),radial-gradient(circle_at_80%_12%,rgba(245,115,22,0.18),transparent_30%)]" />
          <div className="absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute right-0 top-24 h-px w-2/3 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:px-8 lg:py-20">
            <div>
              <p className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-100 shadow-[0_0_32px_rgba(225,6,0,0.12)]">
                La brújula del motor en España
              </p>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold text-white sm:text-7xl">
                Descubre dónde late el motor
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#A6A6A6]">
                Encuentra eventos de motor por fecha, zona, disciplina o tipo de plan.
              </p>
              <p className="mt-2 text-sm font-semibold text-red-100">Tu calendario de motor, siempre al día.</p>

              {stats.length ? (
                <div className="mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
                  {stats.map((item) => (
                    <div className="border-l border-white/[0.10] bg-white/[0.025] px-3 py-2" key={item.label}>
                      <p className="text-2xl font-semibold text-white">{item.value}</p>
                      <p className="text-xs text-[#A6A6A6]">{item.label}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-7 max-w-3xl rounded-[1.25rem] border border-red-500/25 bg-[#1A1111]/90 p-3 shadow-[0_20px_70px_rgba(225,6,0,0.16)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="px-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-red-200">
                      Explora por tipo
                    </span>
                    <p className="mt-1 text-sm font-semibold text-white">
                      Elige primero entre todos, motos o coches.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/[0.12] bg-black/35 p-1.5 md:min-w-[23rem]">
                    {VEHICLE_FILTERS.map((item) => (
                      <button
                        className={cls(
                          "min-h-12 rounded-xl px-4 text-sm font-black transition",
                          vehicleFilter === item.id
                            ? "bg-[#E10600] text-white shadow-[0_12px_34px_rgba(225,6,0,0.34)]"
                            : "border border-white/[0.06] bg-white/[0.035] text-zinc-200 hover:border-red-500/35 hover:bg-red-500/[0.10] hover:text-white",
                        )}
                        key={item.id}
                        onClick={() => {
                          setVehicleFilter(item.id);
                          setDisciplines([]);
                        }}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 max-w-3xl rounded-[1.25rem] border border-white/[0.10] bg-[#121820]/92 p-4 shadow-[0_18px_64px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-red-200">Cerca de ti</p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">Encuentra eventos cerca de ti</h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-[#A6A6A6]">
                      Salta directamente a las provincias con eventos y afina por zona en segundos.
                    </p>
                  </div>
                  <button
                    className="min-h-12 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 transition hover:bg-red-100"
                    onClick={scrollToZones}
                    type="button"
                  >
                    Ver zonas cercanas
                  </button>
                </div>
                {provinceCounts.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provinceCounts.slice(0, 3).map(([name, count]) => (
                      <button
                        className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-100 transition hover:border-red-400/50"
                        key={name}
                        onClick={() => applyProvince(name)}
                        type="button"
                      >
                        {name} · {count}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-8 max-w-3xl rounded-2xl border border-white/[0.08] bg-[#15161A]/92 p-2 shadow-[0_24px_90px_rgba(0,0,0,0.36)]">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative flex min-h-12 flex-1 items-center rounded-xl border border-transparent bg-black/25 focus-within:border-red-500/50">
                    <span className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-zinc-500">
                      <span className="absolute -bottom-1 -right-1 h-1.5 w-px rotate-[-45deg] rounded-full bg-zinc-500" />
                    </span>
                    <input
                      className="min-h-12 w-full rounded-xl bg-transparent pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Busca por evento, circuito, ciudad o disciplina..."
                      type="search"
                      value={query}
                    />
                  </label>
                  <button
                    className="min-h-12 rounded-xl bg-[#E10600] px-5 text-sm font-bold text-white shadow-[0_16px_44px_rgba(225,6,0,0.20)] transition hover:bg-red-500"
                    onClick={() => navigateToView("lista")}
                    type="button"
                  >
                    Explorar eventos
                  </button>
                  <button
                    className="min-h-12 rounded-xl border border-white/[0.08] bg-white/[0.035] px-5 text-sm font-semibold text-white transition hover:border-white/[0.16]"
                    onClick={() => navigateToView("calendario")}
                    type="button"
                  >
                    Ver calendario
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-[#A6A6A6] transition hover:border-red-500/30 hover:bg-red-500/[0.05] hover:text-white"
                    key={chip}
                    onClick={() => applyTerms(chip, [chip.toLowerCase(), chip.toLowerCase().replace("s", "")])}
                    type="button"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <aside className="self-end rounded-2xl border border-white/[0.08] bg-[#15161A]/84 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-200">
                  Próximos eventos destacados
                </p>
                <span className="h-px flex-1 bg-gradient-to-r from-red-500/40 to-transparent" />
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {featuredEvents.map((event) => (
                  <article
                    className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
                    key={event.id}
                    style={{ "--discipline-accent": getDisciplineColor(event.discipline).accent } as React.CSSProperties}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-12 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-1.5 text-center shadow-[inset_3px_0_0_var(--discipline-accent)]">
                        <p className="text-[10px] font-semibold uppercase text-red-100">
                          {formatRange(event).split(" ").slice(-1).join(" ")}
                        </p>
                        <p className="text-lg font-black leading-none text-white">
                          {formatRange(event).split(" ")[0]}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="line-clamp-2 text-sm font-semibold text-white">{event.title}</h2>
                        <p className="mt-1 truncate text-xs text-[#A6A6A6]">
                          {event.discipline} / {event.city}, {event.province}
                        </p>
                        <Link
                          className="mt-2 inline-flex rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-white transition hover:border-red-500/35"
                          href={`/evento/${event.slug || createEventSlug(event.title, event.start)}`}
                        >
                          Ver evento
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}

                {!featuredEvents.length ? (
                  <div className="rounded-xl border border-dashed border-white/[0.10] bg-white/[0.03] p-5 text-sm text-[#A6A6A6]">
                    {isLoading ? "Cargando eventos..." : "No hay próximos eventos visibles ahora mismo."}
                  </div>
                ) : null}
              </div>
              <button
                className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white transition hover:border-red-500/35 hover:bg-red-500/[0.06]"
                onClick={() => navigateToView("calendario")}
                type="button"
              >
                Ver calendario completo
              </button>
            </aside>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl scroll-mt-24 gap-5 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8" id="zonas">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Explora por zonas</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Encuentra el pulso cerca de ti</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#A6A6A6]">
              Provincias y zonas aparecen solo cuando hay eventos reales asociados. Al elegir una, los resultados se actualizan al momento.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {provinceCounts.slice(0, 8).map(([name, count]) => (
              <button
                className="group flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#15161A]/76 px-4 py-3 text-left transition hover:border-red-500/35 hover:bg-white/[0.045]"
                key={name}
                onClick={() => applyProvince(name)}
                type="button"
              >
                <span>
                  <span className="block font-semibold text-white">{name}</span>
                  <span className="mt-0.5 block text-xs text-[#A6A6A6]">Ver eventos en la zona</span>
                </span>
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-100">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-white/[0.018]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Formas de vivir el motor</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Elige el plan y afinamos la brújula</h2>
              </div>
              <p className="max-w-md text-sm text-[#A6A6A6]">Cada opción busca coincidencias reales en disciplinas y etiquetas de los eventos publicados.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {INTENTIONS.map((item) => (
                <button
                  className="rounded-xl border border-white/[0.08] bg-[#15161A]/76 p-4 text-left transition hover:border-red-500/35 hover:bg-white/[0.045]"
                  key={item.label}
                  onClick={() => applyTerms(item.label, item.terms)}
                  type="button"
                >
                  <span className="block text-base font-semibold text-white">{item.label}</span>
                  <span className="mt-1 block text-sm text-[#A6A6A6]">{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" id="eventos">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Buscar y filtrar</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Explora eventos</h2>
            <p className="mt-1 text-sm text-[#A6A6A6]">
              Filtra por zona, disciplina o fecha para encontrar el plan perfecto.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#15161A]/78 shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
            <button
              className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
              onClick={() => setFiltersOpen((current) => !current)}
              type="button"
            >
              <span>
                <span className="text-sm font-semibold text-white">Buscar y filtrar</span>
                <span className="mt-1 block text-xs text-[#A6A6A6]">
                  {activeFilterCount ? `${activeFilterCount} filtros activos` : "Sin filtros activos"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {activeFilterCount ? (
                  <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-100">
                    {activeFilterCount}
                  </span>
                ) : null}
                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white">
                  {filtersOpen ? "Ocultar filtros" : "Abrir filtros"}
                </span>
              </span>
            </button>

            <div
              className={cls(
                "grid overflow-hidden border-t border-white/[0.06] transition-all duration-300",
                filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="p-4 pt-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_13rem_13rem_13rem_auto]">
                    <input
                      className="min-h-10 rounded-lg border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/50"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por título, ciudad, provincia, disciplina..."
                      type="search"
                      value={query}
                    />
                    <select
                      className="min-h-10 rounded-lg border border-white/[0.08] bg-[#101114] px-3 text-sm text-white outline-none"
                      onChange={(event) => {
                        const next = event.target.value;
                        setDisciplines(next === "Todas" ? [] : [next]);
                      }}
                      value={disciplines.length === 1 ? disciplines[0] : "Todas"}
                    >
                      <option value="Todas">Todas las disciplinas</option>
                      {allDisciplines.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <select
                      className="min-h-10 rounded-lg border border-white/[0.08] bg-[#101114] px-3 text-sm text-white outline-none"
                      onChange={(event) => setPlace(event.target.value)}
                      value={place}
                    >
                      {placeOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="min-h-10 rounded-lg border border-white/[0.08] bg-[#101114] px-3 text-sm text-white outline-none"
                      onChange={(event) => setStatus(event.target.value as StatusFilter)}
                      value={status}
                    >
                      <option value="proximos">Próximos</option>
                      <option value="todos">Todos</option>
                      <option value="finalizado">Finalizados</option>
                      <option value="en directo">En directo</option>
                    </select>
                    <button
                      className="min-h-10 rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 text-sm font-semibold text-white transition hover:border-white/[0.16]"
                      onClick={clear}
                      type="button"
                    >
                      Limpiar
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {allDisciplines.map((name) => (
                      <button
                        className={cls(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          disciplines.includes(name)
                            ? "border-red-500/35 bg-red-500/10 text-red-100"
                            : "border-white/[0.08] bg-white/[0.025] text-[#A6A6A6] hover:border-white/[0.16] hover:text-white",
                        )}
                        key={name}
                        onClick={() => toggleDiscipline(name)}
                        type="button"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                {isLoading ? "Cargando eventos" : `${filtered.length} eventos encontrados`}
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Resultados</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["calendario", "Calendario"],
                ["lista", "Eventos"],
                ["zonas", "Zonas"],
                ["anual", "Anual"],
              ].map(([name, label]) => (
                <button
                  className={cls(
                    "rounded-md px-3 py-2 text-sm font-semibold transition",
                    view === name
                      ? "bg-white text-zinc-950"
                      : "border border-white/[0.08] bg-white/[0.035] text-[#A6A6A6] hover:border-white/[0.16] hover:text-white",
                  )}
                  key={name}
                  onClick={() => setView(name as ViewMode)}
                  type="button"
                >
                  {label}
                </button>
              ))}
              <button
                className="rounded-md border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm font-semibold text-[#A6A6A6] transition hover:border-white/[0.16] hover:text-white"
                onClick={() => downloadCalendar(filtered)}
                type="button"
              >
                Exportar calendario
              </button>
            </div>
          </div>

          {view === "lista" ? (
            <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.slice(0, 12).map((event) => (
                <EventCard key={event.id} event={event} onOpen={setSelected} />
              ))}
            </section>
          ) : null}

          {view === "calendario" ? (
            <CalendarView year={calendarYear} month={month} setMonth={setMonth} items={filtered} onOpen={setSelected} />
          ) : null}

          {view === "anual" ? <YearView items={filtered} setMonth={setMonth} setView={setView} /> : null}

          {view === "zonas" ? <ZoneView items={filtered} setRegion={applyProvince} onOpen={setSelected} /> : null}

          {!isLoading && filtered.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/[0.10] bg-white/[0.03] p-10 text-center">
              <h3 className="text-xl font-semibold text-white">No hay eventos con esos filtros</h3>
              <p className="mt-2 text-sm text-[#A6A6A6]">Prueba a limpiar filtros o cambiar la búsqueda.</p>
            </div>
          ) : null}
        </section>

        <section className="border-t border-white/[0.06] bg-[linear-gradient(110deg,rgba(225,6,0,0.10),transparent_42%)]" id="organizadores">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Organizadores</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">¿Organizas un evento?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A6A6A6]">
                Publica tu evento en EventoMotor y llega a usuarios que buscan planes de motor por fecha, zona y disciplina.
              </p>
            </div>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 transition hover:bg-red-100"
              href="mailto:hola@eventomotor.com?subject=Publicar%20evento%20en%20EventoMotor"
            >
              Publica tu evento
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <EventomotorLogo tone="white" className="h-9" />
            <p className="mt-3 max-w-md text-sm text-[#A6A6A6]">
              La brújula del motor en España: eventos reales por fecha, zona y disciplina.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-[#A6A6A6]">
            <button onClick={() => navigateToView("lista")} type="button">Eventos</button>
            <button onClick={() => navigateToView("calendario")} type="button">Calendario</button>
            <button onClick={() => navigateToView("zonas")} type="button">Zonas</button>
            <a href="#organizadores">Organizadores</a>
          </div>
        </div>
      </footer>

      <EventModal event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
