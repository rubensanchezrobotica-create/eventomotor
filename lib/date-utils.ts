import type { EventItem, EventStatus } from "@/types/event";

export const API_EVENTS_URL = "/api/events";
export const AUTO_REFRESH_MS = 15 * 60 * 1000;
export const TODAY = new Date(2026, 3, 27);

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
