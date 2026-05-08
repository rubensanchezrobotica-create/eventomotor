import type { EventItem, EventStatus } from "@/types/event";

export const API_EVENTS_URL = "/api/events";
export const AUTO_REFRESH_MS = 15 * 60 * 1000;
export const TODAY = new Date();

export const COLORS: Record<string, string> = {
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

export const DISCIPLINE_COLORS: Record<
  string,
  {
    name: string;
    accent: string;
    badge: string;
    calendar: string;
    dot: string;
  }
> = {
  MotoGP: {
    name: "rojo",
    accent: "#E10600",
    badge: "border-red-500/25 bg-red-500/10 text-red-100",
    calendar: "border-l-red-500 bg-red-500/[0.08] text-red-50",
    dot: "bg-red-500",
  },
  Superbike: {
    name: "naranja",
    accent: "#F97316",
    badge: "border-orange-400/25 bg-orange-400/10 text-orange-100",
    calendar: "border-l-orange-400 bg-orange-400/[0.08] text-orange-50",
    dot: "bg-orange-400",
  },
  Velocidad: {
    name: "ambar",
    accent: "#F59E0B",
    badge: "border-amber-400/25 bg-amber-400/10 text-amber-100",
    calendar: "border-l-amber-400 bg-amber-400/[0.08] text-amber-50",
    dot: "bg-amber-400",
  },
  Motocross: {
    name: "verde lima",
    accent: "#A3E635",
    badge: "border-lime-400/25 bg-lime-400/10 text-lime-100",
    calendar: "border-l-lime-400 bg-lime-400/[0.08] text-lime-50",
    dot: "bg-lime-400",
  },
  Enduro: {
    name: "verde",
    accent: "#22C55E",
    badge: "border-green-400/25 bg-green-400/10 text-green-100",
    calendar: "border-l-green-400 bg-green-400/[0.08] text-green-50",
    dot: "bg-green-400",
  },
  Trial: {
    name: "turquesa",
    accent: "#2DD4BF",
    badge: "border-teal-400/25 bg-teal-400/10 text-teal-100",
    calendar: "border-l-teal-400 bg-teal-400/[0.08] text-teal-50",
    dot: "bg-teal-400",
  },
  Mototurismo: {
    name: "violeta",
    accent: "#A78BFA",
    badge: "border-violet-400/25 bg-violet-400/10 text-violet-100",
    calendar: "border-l-violet-400 bg-violet-400/[0.08] text-violet-50",
    dot: "bg-violet-400",
  },
  MiniVelocidad: {
    name: "cyan",
    accent: "#22D3EE",
    badge: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
    calendar: "border-l-cyan-400 bg-cyan-400/[0.08] text-cyan-50",
    dot: "bg-cyan-400",
  },
  Supermoto: {
    name: "fucsia",
    accent: "#E879F9",
    badge: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100",
    calendar: "border-l-fuchsia-400 bg-fuchsia-400/[0.08] text-fuchsia-50",
    dot: "bg-fuchsia-400",
  },
  "Cross Country": {
    name: "esmeralda",
    accent: "#34D399",
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    calendar: "border-l-emerald-400 bg-emerald-400/[0.08] text-emerald-50",
    dot: "bg-emerald-400",
  },
  Freestyle: {
    name: "rosa",
    accent: "#F472B6",
    badge: "border-pink-400/25 bg-pink-400/10 text-pink-100",
    calendar: "border-l-pink-400 bg-pink-400/[0.08] text-pink-50",
    dot: "bg-pink-400",
  },
  "Hard Enduro": {
    name: "verde oscuro",
    accent: "#16A34A",
    badge: "border-green-600/25 bg-green-600/10 text-green-100",
    calendar: "border-l-green-600 bg-green-600/[0.08] text-green-50",
    dot: "bg-green-600",
  },
  Motociclismo: {
    name: "gris",
    accent: "#A1A1AA",
    badge: "border-white/[0.08] bg-white/[0.035] text-zinc-200",
    calendar: "border-l-zinc-500 bg-white/[0.035] text-zinc-100",
    dot: "bg-zinc-400",
  },
};

export function getDisciplineColor(discipline: string) {
  return DISCIPLINE_COLORS[discipline] || DISCIPLINE_COLORS.Motociclismo;
}

export const MONTHS = [
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

export const WEEK_DAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function parseDate(value: string) {
  const parts = String(value || "").slice(0, 10).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function isDateText(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10));
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function toIcsDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function cleanIcs(text: string) {
  const slash = String.fromCharCode(92);
  const newline = String.fromCharCode(10);

  return String(text || "")
    .split(slash).join(slash + slash)
    .split(",").join(slash + ",")
    .split(";").join(slash + ";")
    .split(newline).join(slash + "n");
}

export function statusOf(event: EventItem): EventStatus {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

  if (end < today) return "finalizado";
  if (start <= today && end >= today) return "en directo";

  return "proximo";
}

export function formatStatus(status: EventStatus) {
  return status === "proximo" ? "próximo" : status;
}

export function formatRange(event: EventItem) {
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

export function isOnDay(event: EventItem, day: Date) {
  const current = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return parseDate(event.start).getTime() <= current.getTime() && parseDate(event.end).getTime() >= current.getTime();
}

export function daysForMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const days: Date[] = [];

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

export function downloadCalendar(items: EventItem[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventoMotor//ES",
  ];

  items.forEach((event) => {
    const location = `${event.venue}, ${event.city}, ${event.province}`;
    const description = `${event.championship} - ${event.discipline} - Fuente: ${event.sourceUrl}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@eventomotor.com`);
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
  link.download = "eventomotor-calendario-2026.ics";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
