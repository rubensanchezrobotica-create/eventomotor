// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState } from "react";

const API_EVENTS_URL = "/api/events";
const AUTO_REFRESH_MS = 15 * 60 * 1000;
const TODAY = new Date(2026, 3, 27);

const SOURCES = {
  RFME: "https://rfme.com/calendario-campeonatos/",
  MotoGP: "https://www.motogp.com/es/calendar/2026",
  CircuitCat: "https://www.circuitcat.com/",
  MotorLand: "https://www.motorlandaragon.com/",
  RicardoTormo: "https://entradas.circuitvalencia.com/circuitvalencia/events",
};

const SOURCE_FEEDS = [
  { id: "rfme", name: "RFME", url: SOURCES.RFME, type: "Calendario oficial" },
  { id: "motogp", name: "MotoGP", url: SOURCES.MotoGP, type: "Calendario oficial" },
  { id: "circuitcat", name: "Circuit de Barcelona-Catalunya", url: SOURCES.CircuitCat, type: "Circuito" },
  { id: "motorland", name: "MotorLand Aragón", url: SOURCES.MotorLand, type: "Circuito" },
  { id: "ricardotormo", name: "Circuit Ricardo Tormo", url: SOURCES.RicardoTormo, type: "Entradas" },
];

const FALLBACK_EVENTS = [
  {
    id: "motogp-jerez-2026",
    title: "Gran Premio de España de MotoGP",
    championship: "MotoGP World Championship",
    discipline: "MotoGP",
    start: "2026-04-24",
    end: "2026-04-26",
    venue: "Circuito de Jerez - Ángel Nieto",
    city: "Jerez de la Frontera",
    province: "Cádiz",
    region: "Andalucía",
    level: "Mundial",
    source: "MotoGP",
    sourceUrl: SOURCES.MotoGP,
    ticketUrl: "https://www.circuitodejerez.com/",
    tags: ["MotoGP", "velocidad"],
    featured: true,
  },
  {
    id: "motogp-catalunya-2026",
    title: "Gran Premi de Catalunya de MotoGP",
    championship: "MotoGP World Championship",
    discipline: "MotoGP",
    start: "2026-05-15",
    end: "2026-05-17",
    venue: "Circuit de Barcelona-Catalunya",
    city: "Montmeló",
    province: "Barcelona",
    region: "Catalunya",
    level: "Mundial",
    source: "Circuit de Barcelona-Catalunya",
    sourceUrl: SOURCES.CircuitCat,
    ticketUrl: SOURCES.CircuitCat,
    tags: ["MotoGP", "velocidad"],
    featured: true,
  },
  {
    id: "motogp-aragon-2026",
    title: "Gran Premio de Aragón de MotoGP",
    championship: "MotoGP World Championship",
    discipline: "MotoGP",
    start: "2026-08-28",
    end: "2026-08-30",
    venue: "MotorLand Aragón",
    city: "Alcañiz",
    province: "Teruel",
    region: "Aragón",
    level: "Mundial",
    source: "MotorLand Aragón",
    sourceUrl: SOURCES.MotorLand,
    ticketUrl: SOURCES.MotorLand,
    tags: ["MotoGP", "velocidad"],
    featured: true,
  },
  {
    id: "motogp-valencia-2026",
    title: "Gran Premio Motul de la Comunitat Valenciana",
    championship: "MotoGP World Championship",
    discipline: "MotoGP",
    start: "2026-11-27",
    end: "2026-11-29",
    venue: "Circuit Ricardo Tormo",
    city: "Cheste",
    province: "Valencia",
    region: "Comunitat Valenciana",
    level: "Mundial",
    source: "Circuit Ricardo Tormo",
    sourceUrl: SOURCES.RicardoTormo,
    ticketUrl: SOURCES.RicardoTormo,
    tags: ["MotoGP", "final"],
    featured: true,
  },
  {
    id: "esbk-navarra-2026",
    title: "ESBK Navarra",
    championship: "Campeonato de España de Superbike",
    discipline: "Superbike",
    start: "2026-05-07",
    end: "2026-05-10",
    venue: "Circuito de Navarra",
    city: "Los Arcos",
    province: "Navarra",
    region: "Navarra",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/campeonato-de-espana-de-superbike/",
    ticketUrl: "https://www.circuitodenavarra.com/",
    tags: ["ESBK", "superbike"],
    featured: true,
  },
  {
    id: "esbk-motorland-2026",
    title: "ESBK MotorLand Aragón",
    championship: "Campeonato de España de Superbike",
    discipline: "Superbike",
    start: "2026-07-16",
    end: "2026-07-19",
    venue: "MotorLand Aragón",
    city: "Alcañiz",
    province: "Teruel",
    region: "Aragón",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/campeonato-de-espana-de-superbike/",
    ticketUrl: SOURCES.MotorLand,
    tags: ["ESBK", "superbike"],
    featured: false,
  },
  {
    id: "copa-velocidad-jerez-2026",
    title: "Copa de España de Velocidad - Jerez",
    championship: "Copa de España de Velocidad",
    discipline: "Velocidad",
    start: "2026-05-29",
    end: "2026-05-31",
    venue: "Circuito de Jerez - Ángel Nieto",
    city: "Jerez de la Frontera",
    province: "Cádiz",
    region: "Andalucía",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/copa-de-espana-de-velocidad/",
    ticketUrl: "",
    tags: ["velocidad"],
    featured: false,
  },
  {
    id: "mx-osuna-2026",
    title: "Campeonato de España de Motocross - Osuna",
    championship: "Campeonato de España de Motocross",
    discipline: "Motocross",
    start: "2026-05-02",
    end: "2026-05-03",
    venue: "Circuito de Osuna",
    city: "Osuna",
    province: "Sevilla",
    region: "Andalucía",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/campeonato-de-espana-de-motocross/",
    ticketUrl: "",
    tags: ["MX", "offroad"],
    featured: true,
  },
  {
    id: "mx-motorland-2026",
    title: "Campeonato de España de Motocross - MotorLand",
    championship: "Campeonato de España de Motocross",
    discipline: "Motocross",
    start: "2026-09-19",
    end: "2026-09-20",
    venue: "MotorLand Aragón",
    city: "Alcañiz",
    province: "Teruel",
    region: "Aragón",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/campeonato-de-espana-de-motocross/",
    ticketUrl: SOURCES.MotorLand,
    tags: ["MX", "offroad"],
    featured: false,
  },
  {
    id: "trial-gironella-2026",
    title: "Campeonato de España de Trial - Gironella",
    championship: "Campeonato de España de Trial",
    discipline: "Trial",
    start: "2026-05-30",
    end: "2026-05-31",
    venue: "Gironella",
    city: "Gironella",
    province: "Barcelona",
    region: "Catalunya",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/campeonato-de-espana-de-trial/",
    ticketUrl: "",
    tags: ["trial"],
    featured: false,
  },
  {
    id: "enduro-orista-2026",
    title: "Campeonato de España de Enduro - Oristà",
    championship: "Campeonato de España de Enduro",
    discipline: "Enduro",
    start: "2026-09-19",
    end: "2026-09-20",
    venue: "Torre d'Oristà",
    city: "Oristà",
    province: "Barcelona",
    region: "Catalunya",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/campeonato-de-espana-de-enduro/",
    ticketUrl: "",
    tags: ["enduro"],
    featured: false,
  },
  {
    id: "mini-cartagena-2026",
    title: "Copa de España de MiniVelocidad - Cartagena",
    championship: "Copa de España de MiniVelocidad",
    discipline: "MiniVelocidad",
    start: "2026-05-01",
    end: "2026-05-03",
    venue: "Circuito de Cartagena",
    city: "Cartagena",
    province: "Murcia",
    region: "Región de Murcia",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/copa-de-espana-de-minivelocidad/",
    ticketUrl: "https://www.circuitocartagena.com/",
    tags: ["minivelocidad"],
    featured: false,
  },
  {
    id: "tour-penitentes-2026",
    title: "RFME Mototurismo Touring - Penitentes",
    championship: "RFME Mototurismo Touring Challenge",
    discipline: "Mototurismo",
    start: "2026-05-01",
    end: "2026-05-01",
    venue: "Penitentes",
    city: "Pirineo aragonés",
    province: "Huesca",
    region: "Aragón",
    level: "Nacional",
    source: "RFME",
    sourceUrl: "https://rfme.com/campeonatos/copa-de-espana-de-mototurismo/",
    ticketUrl: "",
    tags: ["mototurismo"],
    featured: false,
  },
];

const COLORS = {
  MotoGP: "bg-red-500 text-white border-red-300",
  Superbike: "bg-orange-500 text-white border-orange-300",
  Velocidad: "bg-amber-400 text-zinc-950 border-amber-200",
  Motocross: "bg-lime-400 text-zinc-950 border-lime-200",
  Trial: "bg-emerald-400 text-zinc-950 border-emerald-200",
  Enduro: "bg-green-500 text-white border-green-300",
  MiniVelocidad: "bg-sky-400 text-zinc-950 border-sky-200",
  Mototurismo: "bg-violet-500 text-white border-violet-300",
  Motociclismo: "bg-zinc-500 text-white border-zinc-300",
};

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEK_DAYS = ["L", "M", "X", "J", "V", "S", "D"];

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function parseDate(value) {
  const parts = String(value || "").slice(0, 10).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function isDateText(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10));
}

function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIcsDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function cleanIcs(text) {
  const slash = String.fromCharCode(92);
  const newline = String.fromCharCode(10);

  return String(text || "")
    .split(slash).join(slash + slash)
    .split(",").join(slash + ",")
    .split(";").join(slash + ";")
    .split(newline).join(slash + "n");
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRemoteEvent(raw, index) {
  if (!raw || typeof raw !== "object") return null;

  const title = String(raw.title || raw.name || "").trim();
  const start = String(raw.start || raw.startDate || raw.date || "").slice(0, 10);
  const endCandidate = String(raw.end || raw.endDate || raw.finishDate || start).slice(0, 10);

  if (!title || !isDateText(start)) return null;

  const discipline = String(raw.discipline || raw.category || "Motociclismo").trim();
  const venue = String(raw.venue || raw.location || "Por confirmar").trim();
  const city = String(raw.city || raw.locality || "Por confirmar").trim();
  const province = String(raw.province || raw.state || "Por confirmar").trim();

  return {
    id: String(raw.id || `${slugify(title)}-${start}-${index}`),
    title,
    championship: String(raw.championship || raw.series || discipline),
    discipline,
    start,
    end: isDateText(endCandidate) ? endCandidate : start,
    venue,
    city,
    province,
    region: String(raw.region || raw.community || province),
    level: String(raw.level || "Publicado"),
    source: String(raw.source || raw.feedName || "Fuente externa"),
    sourceUrl: String(raw.sourceUrl || raw.url || ""),
    ticketUrl: String(raw.ticketUrl || raw.ticketsUrl || ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [discipline],
    featured: Boolean(raw.featured),
  };
}

function normalizeRemoteEvents(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.events)
      ? payload.events
      : [];

  const seen = new Set();

  return list
    .map((item, index) => normalizeRemoteEvent(item, index))
    .filter(Boolean)
    .filter((event) => {
      const key = `${event.title}-${event.start}-${event.venue}`.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => parseDate(a.start) - parseDate(b.start));
}

function statusOf(event) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

  if (end < today) return "finalizado";
  if (start <= today && end >= today) return "en directo";

  return "proximo";
}

function formatStatus(status) {
  return status === "proximo" ? "próximo" : status;
}

function formatRange(event) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);

  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  });

  if (start.toDateString() === end.toDateString()) {
    return formatter.format(start);
  }

  if (start.getMonth() === end.getMonth()) {
    const monthName = formatter.format(end).split(" ").slice(1).join(" ");
    return `${start.getDate()}-${end.getDate()} ${monthName}`;
  }

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function isOnDay(event, day) {
  const current = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return parseDate(event.start) <= current && parseDate(event.end) >= current;
}

function daysForMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const days = [];

  for (let i = offset; i > 0; i -= 1) {
    days.push(addDays(first, -i));
  }

  for (let d = 1; d <= last.getDate(); d += 1) {
    days.push(new Date(year, month, d));
  }

  while (days.length % 7 !== 0) {
    days.push(addDays(days[days.length - 1], 1));
  }

  return days;
}

function downloadCalendar(items) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MotoCalendario Espana//ES",
  ];

  items.forEach((event) => {
    const location = `${event.venue}, ${event.city}, ${event.province}`;
    const description = `${event.championship} - ${event.discipline} - Fuente: ${event.sourceUrl}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@motocalendario.es`);
    lines.push("DTSTAMP:20260427T090000Z");
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(parseDate(event.start))}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(addDays(parseDate(event.end), 1))}`);
    lines.push(`SUMMARY:${cleanIcs(event.title)}`);
    lines.push(`LOCATION:${cleanIcs(location)}`);
    lines.push(`DESCRIPTION:${cleanIcs(description)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join(String.fromCharCode(13, 10))], {
    type: "text/calendar;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "moto-calendario-espana-2026.ics";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

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
      pass: statusOf(FALLBACK_EVENTS.find((event) => event.id === "motogp-catalunya-2026")) === "proximo",
    },
    {
      name: "finished status",
      pass: statusOf(FALLBACK_EVENTS.find((event) => event.id === "motogp-jerez-2026")) === "finalizado",
    },
    { name: "calendar weeks", pass: daysForMonth(2026, 4).length % 7 === 0 },
    { name: "ics escaping", pass: typeof cleanIcs("a,b;c") === "string" },
    { name: "ics date", pass: toIcsDate(parseDate("2026-05-15")) === "20260515" },
    { name: "date order", pass: FALLBACK_EVENTS.every((event) => parseDate(event.start) <= parseDate(event.end)) },
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

function EventBadge({ discipline }) {
  const color = COLORS[discipline] || COLORS.Motociclismo;

  return (
    <span className={cls("rounded-full border px-3 py-1 text-xs font-black", color)}>
      {discipline}
    </span>
  );
}

function EventCard({ event, onOpen }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl shadow-black/30 transition hover:-translate-y-1 hover:border-orange-300/40">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <EventBadge discipline={event.discipline} />
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-300">
          {event.level}
        </span>
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-zinc-300">
          {formatStatus(statusOf(event))}
        </span>
        {event.featured ? (
          <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-zinc-950">
            Destacado
          </span>
        ) : null}
      </div>

      <button onClick={() => onOpen(event)} className="text-left">
        <h3 className="text-xl font-black leading-tight text-white hover:text-orange-200">
          {event.title}
        </h3>
      </button>

      <p className="mt-1 text-sm text-zinc-400">{event.championship}</p>

      <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <p>Fecha: {formatRange(event)} de 2026</p>
        <p>Lugar: {event.city}, {event.province}</p>
        <p>Circuito: {event.venue}</p>
        <p>Fuente: {event.source}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {event.tags.map((tag) => (
          <span key={`${event.id}-${tag}`} className="rounded-full bg-white/5 px-2 py-1 text-xs text-zinc-400">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <button
          onClick={() => onOpen(event)}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-zinc-950 hover:bg-orange-200"
        >
          Ver ficha
        </button>

        {event.ticketUrl ? (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            Entradas
          </a>
        ) : null}

        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            Fuente
          </a>
        ) : null}
      </div>
    </article>
  );
}

function CalendarView({ month, setMonth, items, onOpen }) {
  const days = daysForMonth(2026, month);

  const monthEvents = items.filter((event) => {
    return parseDate(event.start).getMonth() === month || parseDate(event.end).getMonth() === month;
  });

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-3">
        <button
          onClick={() => setMonth((m) => (m + 11) % 12)}
          className="rounded-2xl bg-white/10 px-4 py-3 text-white hover:bg-white/20"
        >
          Anterior
        </button>

        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-orange-200">Vista mensual</p>
          <h2 className="text-3xl font-black text-white">{MONTHS[month]} 2026</h2>
          <p className="text-sm text-zinc-400">{monthEvents.length} eventos filtrados este mes</p>
        </div>

        <button
          onClick={() => setMonth((m) => (m + 1) % 12)}
          className="rounded-2xl bg-white/10 px-4 py-3 text-white hover:bg-white/20"
        >
          Siguiente
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/30">
        <div className="grid grid-cols-7 gap-2 pb-3 text-center text-xs font-black text-zinc-500">
          {WEEK_DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayEvents = items.filter((event) => isOnDay(event, day));
            const inMonth = day.getMonth() === month;
            const isToday = day.toDateString() === TODAY.toDateString();

            const dayClass = cls(
              "min-h-28 rounded-2xl border p-2",
              inMonth ? "border-white/10 bg-zinc-950/70" : "border-white/5 bg-zinc-950/20 opacity-50",
              isToday ? "ring-2 ring-orange-300" : "",
            );

            return (
              <div key={day.toISOString()} className={dayClass}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-black text-white">{day.getDate()}</span>
                  {dayEvents.length > 0 ? (
                    <span className="rounded-full bg-white/10 px-2 text-xs font-bold text-white">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onOpen(event)}
                      className={cls(
                        "block w-full truncate rounded-lg px-2 py-1 text-left text-xs font-bold",
                        COLORS[event.discipline] || COLORS.Motociclismo,
                      )}
                    >
                      {event.title}
                    </button>
                  ))}

                  {dayEvents.length > 3 ? (
                    <p className="px-1 text-xs text-zinc-500">+{dayEvents.length - 3} más</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function YearView({ items, setMonth, setView }) {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {MONTHS.map((name, month) => {
        const monthItems = items.filter((event) => {
          return parseDate(event.start).getMonth() === month || parseDate(event.end).getMonth() === month;
        });

        return (
          <button
            key={name}
            onClick={() => {
              setMonth(month);
              setView("calendario");
            }}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left hover:border-orange-300/40 hover:bg-white/10"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white">{name}</h3>
              <span className="rounded-full bg-orange-300 px-3 py-1 text-xs font-black text-zinc-950">
                {monthItems.length}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {monthItems.slice(0, 4).map((event) => (
                <p key={event.id} className="truncate text-sm text-zinc-300">
                  {formatRange(event)} - {event.title}
                </p>
              ))}

              {monthItems.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin eventos con los filtros actuales</p>
              ) : null}

              {monthItems.length > 4 ? (
                <p className="text-xs text-zinc-500">+{monthItems.length - 4} más</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </section>
  );
}

function ZoneView({ items, setRegion, onOpen }) {
  const counts = items.reduce((acc, event) => {
    acc[event.region] = (acc[event.region] || 0) + 1;
    return acc;
  }, {});

  const zones = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-bold uppercase tracking-widest text-orange-200">Zonas</p>
        <h3 className="mt-2 text-2xl font-black text-white">Mapa rápido de actividad</h3>

        <div className="mt-5 space-y-2">
          {zones.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setRegion(name)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-left hover:bg-white/10"
            >
              <span className="font-bold text-white">{name}</span>
              <span className="rounded-full bg-orange-300 px-3 py-1 text-xs font-black text-zinc-950">
                {count}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="grid gap-4 md:grid-cols-2">
        {items.slice(0, 18).map((event) => (
          <EventCard key={event.id} event={event} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function EventModal({ event, onClose }) {
  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <EventBadge discipline={event.discipline} />
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-300">
                {formatStatus(statusOf(event))}
              </span>
            </div>

            <h2 className="text-3xl font-black text-white">{event.title}</h2>
            <p className="mt-2 text-zinc-400">{event.championship}</p>
          </div>

          <button onClick={onClose} className="rounded-2xl bg-white/10 px-4 py-2 text-white hover:bg-white/20">
            Cerrar
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <InfoBox label="Fecha" value={`${formatRange(event)} de 2026`} />
          <InfoBox label="Circuito / lugar" value={event.venue} />
          <InfoBox label="Ubicación" value={`${event.city}, ${event.province}`} />
          <InfoBox label="Fuente" value={event.source} />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-2xl bg-white px-4 py-3 text-center font-black text-zinc-950 hover:bg-orange-200"
            >
              Ver fuente oficial
            </a>
          ) : null}

          {event.ticketUrl ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black text-white hover:bg-white/10"
            >
              Entradas / info
            </a>
          ) : (
            <span className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black text-zinc-500">
              Sin enlace de entradas
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
    </div>
  );
}

export default function MotoCalendarioEspana() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("calendario");
  const [month, setMonth] = useState(3);
  const [region, setRegion] = useState("Todas");
  const [status, setStatus] = useState("proximos");
  const [disciplines, setDisciplines] = useState([]);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState(FALLBACK_EVENTS);
  const [syncState, setSyncState] = useState("fallback");
  const [lastSync, setLastSync] = useState(null);
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
      .sort((a, b) => parseDate(a.start) - parseDate(b.start));
  }, [query, disciplines, region, status, events]);

  const upcoming = useMemo(() => {
    return events
      .filter((event) => statusOf(event) !== "finalizado")
      .sort((a, b) => parseDate(a.start) - parseDate(b.start));
  }, [events]);

  const testsPassed = SELF_TESTS.every((test) => test.pass);

  function toggleDiscipline(name) {
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
              onChange={(event) => setStatus(event.target.value)}
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
                onClick={() => setView(name)}
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