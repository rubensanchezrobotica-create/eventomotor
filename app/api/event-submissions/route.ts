import { createSupabaseServerClient } from "@/lib/supabase";
import type { EventSubmissionInsert } from "@/lib/supabase";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

type RateEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateEntry>();

function jsonError(message: string, status: number, fields?: Record<string, string>) {
  return Response.json({ ok: false, error: message, fields }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(body: Record<string, unknown>, field: string, maxLength = 500) {
  const value = body[field];

  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function textField(body: Record<string, unknown>, field: string, maxLength = 1600) {
  const value = body[field];

  if (typeof value !== "string") return "";

  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, maxLength);
}

function nullable(value: string) {
  return value ? value : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDate(value: string) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getClientKey(request: Request, contactEmail: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `${forwardedFor || realIp || "unknown"}:${contactEmail.toLowerCase()}`;
}

function rateLimit(key: string) {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("La solicitud no tiene un formato válido.", 400);
  }

  if (!isRecord(body)) {
    return jsonError("La solicitud no tiene un formato válido.", 400);
  }

  if (stringField(body, "website", 200)) {
    return jsonError("No se ha podido enviar el evento.", 400);
  }

  const eventName = stringField(body, "event_name", 180);
  const sourceUrl = stringField(body, "source_url", 600);
  const contactEmail = stringField(body, "contact_email", 220);
  const startDate = stringField(body, "start_date", 10);
  const endDate = stringField(body, "end_date", 10);
  const fields: Record<string, string> = {};

  if (!eventName) fields.event_name = "Indica el nombre del evento.";
  if (!sourceUrl) fields.source_url = "Añade una web oficial o fuente verificable.";
  if (!contactEmail) fields.contact_email = "Indica un email de contacto.";
  if (contactEmail && !isValidEmail(contactEmail)) fields.contact_email = "El email no parece válido.";
  if (sourceUrl && !isValidUrl(sourceUrl)) fields.source_url = "La fuente debe ser una URL válida.";
  if (!isValidDate(startDate)) fields.start_date = "La fecha de inicio debe usar un formato válido.";
  if (!isValidDate(endDate)) fields.end_date = "La fecha de fin debe usar un formato válido.";
  if (startDate && endDate && endDate < startDate) fields.end_date = "La fecha de fin no puede ser anterior al inicio.";

  if (Object.keys(fields).length) {
    return jsonError("Revisa los campos marcados antes de enviar el evento.", 400, fields);
  }

  if (!rateLimit(getClientKey(request, contactEmail))) {
    return jsonError("Has enviado varias solicitudes seguidas. Inténtalo de nuevo más tarde.", 429);
  }

  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return jsonError("El envío de eventos no está configurado todavía.", 500);
  }

  const submission: EventSubmissionInsert = {
    event_name: eventName,
    start_date: nullable(startDate),
    end_date: nullable(endDate) || nullable(startDate),
    city: nullable(stringField(body, "city", 140)),
    province: nullable(stringField(body, "province", 140)),
    venue: nullable(stringField(body, "venue", 220)),
    discipline: nullable(stringField(body, "discipline", 120)),
    vehicle_type: nullable(stringField(body, "vehicle_type", 80)),
    source_url: sourceUrl,
    ticket_url: nullable(stringField(body, "ticket_url", 600)),
    description: nullable(textField(body, "description", 1400)),
    organizer_name: nullable(stringField(body, "organizer_name", 180)),
    contact_email: contactEmail.toLowerCase(),
    contact_phone: nullable(stringField(body, "contact_phone", 80)),
    poster_url: nullable(stringField(body, "poster_url", 600)),
    status: "pending",
  };

  if (submission.ticket_url && !isValidUrl(submission.ticket_url)) {
    return jsonError("El enlace de entradas debe ser una URL válida.", 400, {
      ticket_url: "El enlace de entradas debe ser una URL válida.",
    });
  }

  if (submission.poster_url && !isValidUrl(submission.poster_url)) {
    return jsonError("El enlace del cartel debe ser una URL válida.", 400, {
      poster_url: "El enlace del cartel debe ser una URL válida.",
    });
  }

  const { error } = await supabase.from("event_submissions").insert(submission);

  if (error) {
    console.error("Event submission insert failed", error);
    return jsonError("No se ha podido guardar la solicitud. Inténtalo de nuevo en unos minutos.", 500);
  }

  return Response.json({
    ok: true,
    message: "Evento enviado correctamente. Lo revisaremos antes de publicarlo.",
  });
}
