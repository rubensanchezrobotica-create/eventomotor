import {
  createEventCandidate,
  isEventCandidateStatus,
  listEventCandidates,
} from "@/lib/event-candidates/repository";
import type { EventCandidateInput, EventCandidateStatus, JsonObject } from "@/lib/event-candidates/types";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

function validateAdminSecret(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return {
      ok: false as const,
      status: 500,
      error: "ADMIN_SECRET is not configured. Add ADMIN_SECRET to your environment.",
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${adminSecret}`) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized. Send Authorization: Bearer ADMIN_SECRET.",
    };
  }

  return { ok: true as const };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(body: Record<string, unknown>, field: string) {
  return textValue(body, field) || null;
}

function optionalNumber(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);

  return null;
}

function optionalJsonObject(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return isRecord(value) ? (value as JsonObject) : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoDate(value: string | null) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseCandidateInput(body: unknown): EventCandidateInput {
  if (!isRecord(body)) {
    throw new Error("Request body must be an object.");
  }

  const normalizedTitle = textValue(body, "normalized_title");
  const sourceUrl = textValue(body, "source_url");
  const country = textValue(body, "country") || "ES";
  const startDate = optionalText(body, "start_date");
  const endDate = optionalText(body, "end_date");
  const statusValue = textValue(body, "status");
  const status: EventCandidateStatus = statusValue ? (statusValue as EventCandidateStatus) : "pending_review";

  if (!normalizedTitle) {
    throw new Error("normalized_title is required.");
  }

  if (!sourceUrl || !isHttpUrl(sourceUrl)) {
    throw new Error("source_url is required and must be a valid http(s) URL.");
  }

  if (!country) {
    throw new Error("country is required.");
  }

  if (statusValue && !isEventCandidateStatus(statusValue)) {
    throw new Error("status is invalid. Use pending_review, needs_info, approved, rejected, duplicate or published.");
  }

  if (!isIsoDate(startDate)) {
    throw new Error("start_date must use YYYY-MM-DD format.");
  }

  if (!isIsoDate(endDate)) {
    throw new Error("end_date must use YYYY-MM-DD format.");
  }

  if (startDate && endDate && endDate < startDate) {
    throw new Error("end_date cannot be earlier than start_date.");
  }

  return {
    agent_run_id: optionalText(body, "agent_run_id"),
    source_name: optionalText(body, "source_name"),
    source_url: sourceUrl,
    source_type: optionalText(body, "source_type"),
    source_country: optionalText(body, "source_country"),
    raw_title: optionalText(body, "raw_title"),
    raw_text: optionalText(body, "raw_text"),
    raw_payload: optionalJsonObject(body, "raw_payload"),
    normalized_title: normalizedTitle,
    slug_suggested: optionalText(body, "slug_suggested"),
    description: optionalText(body, "description"),
    start_date: startDate,
    end_date: endDate,
    date_confidence: optionalNumber(body, "date_confidence"),
    city: optionalText(body, "city"),
    province: optionalText(body, "province"),
    region: optionalText(body, "region"),
    country,
    location_name: optionalText(body, "location_name"),
    address: optionalText(body, "address"),
    location_confidence: optionalNumber(body, "location_confidence"),
    category: optionalText(body, "category"),
    discipline: optionalText(body, "discipline"),
    vehicle_type: optionalText(body, "vehicle_type"),
    organizer_name: optionalText(body, "organizer_name"),
    organizer_url: optionalText(body, "organizer_url"),
    contact_email: optionalText(body, "contact_email"),
    contact_phone: optionalText(body, "contact_phone"),
    image_url: optionalText(body, "image_url"),
    price_text: optionalText(body, "price_text"),
    registration_url: optionalText(body, "registration_url"),
    status,
    quality_score: optionalNumber(body, "quality_score"),
    duplicate_score: optionalNumber(body, "duplicate_score"),
    possible_duplicate_event_id: optionalText(body, "possible_duplicate_event_id"),
    duplicate_reason: optionalText(body, "duplicate_reason"),
    validation_errors: Array.isArray(body.validation_errors) ? body.validation_errors : [],
    review_notes: optionalText(body, "review_notes"),
    created_by_agent: optionalText(body, "created_by_agent") || "eventomotor-agent",
  };
}

export async function GET(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const country = url.searchParams.get("country") || undefined;
    const q = url.searchParams.get("q") || undefined;
    const limit = Number(url.searchParams.get("limit") || "");

    if (status !== "all" && !isEventCandidateStatus(status)) {
      return jsonError("Invalid status filter.", 400);
    }

    const candidates = await listEventCandidates({
      status: status === "all" ? "all" : status,
      country,
      q,
      limit,
    });

    return Response.json({ ok: true, candidates });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}

export async function POST(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const input = parseCandidateInput(await request.json());
    const candidate = await createEventCandidate(input);

    return Response.json({ ok: true, candidate }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 400);
  }
}
