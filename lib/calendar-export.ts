import type { SavedEvent } from "@/lib/saved-events";

function icsDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = String(value || "").slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function escapeIcs(value: string | undefined) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildEventIcs(event: SavedEvent) {
  const start = parseLocalDate(event.start);
  const end = addDays(parseLocalDate(event.end || event.start), 1);
  const location = [event.venue, event.city, event.province].filter(Boolean).join(", ");
  const description = [
    event.discipline ? `Disciplina: ${event.discipline}` : "",
    event.source_url ? `Fuente oficial: ${event.source_url}` : "",
    event.ticket_url ? `Entradas / inscripcion: ${event.ticket_url}` : "",
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(event.slug)}@eventomotor.com`,
    `DTSTAMP:${icsDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${escapeIcs(`https://www.eventomotor.com/evento/${event.slug}`)}`,
    "END:VEVENT",
  ].join("\r\n");
}

export function buildCalendarIcs(events: SavedEvent[]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventoMotor//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.map(buildEventIcs),
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcsFile(filename: string, events: SavedEvent[]) {
  if (typeof document === "undefined") return;

  const blob = new Blob([buildCalendarIcs(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
